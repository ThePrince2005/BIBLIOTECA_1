const Prestamo = require('../models/prestamo.model');
const { validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Libro = require('../models/libro.model');
const LogrosService = require('../services/logros.service');
const ResenaModel = require('../models/resena.model');
const Usuario = require('../models/usuario.model');

class PrestamoController {
    /**
     * Obtener préstamos del usuario actual
     */
    static async misPrestamos(req, res) {
        try {
            await Prestamo.verificarVencidos();

            // El modelo expone `obtenerPorUsuario` para obtener préstamos del usuario
            const prestamos = await Prestamo.obtenerPorUsuario(req.user.id);
            const estadisticas = {};
            const historialLectura = [];
            const librosElegibles = req.user?.rol === 'estudiante'
                ? await ResenaModel.listarLibrosElegibles(req.user.id)
                : [];

            // Si es una petición AJAX, devolver JSON
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ prestamos });
            }

            // Si es una petición normal, renderizar vista
            res.render('prestamos/mis-prestamos', {
                prestamos,
                usuario: req.user,
                librosElegibles
            });
        } catch (error) {
            console.error('Error al obtener préstamos:', error);
            res.status(500).json({ message: 'Error al obtener préstamos' });
        }
    }

    /**
     * Obtener todos los préstamos en formato JSON (para DataTable)
     */
    static async obtenerTodosJson(req, res) {
        try {
            const filtros = {
                estado: req.query.estado,
                grado: req.query.grado ? parseInt(req.query.grado) : null,
                fechaInicio: req.query.fechaInicio,
                fechaFin: req.query.fechaFin
            };

            const prestamos = await Prestamo.obtenerTodos(filtros);

            const jsonData = prestamos.map(p => ({
                id: p.id,
                usuario: {
                    nombre: p.nombre_estudiante || p.nombre || p.usuario_nombre || '',
                    grado: p.grado || p.usuario_grado || null,
                    seccion: p.seccion || p.usuario_seccion || '',
                    dni: p.dni || ''
                },
                libro: {
                    titulo: p.titulo || p.libro_titulo || '',
                    autor: p.autor || p.libro_autor || ''
                },
                fecha_prestamo: p.fecha_prestamo,
                fecha_devolucion_esperada: p.fecha_devolucion_esperada,
                estado: p.estado
            }));

            return res.json(jsonData);
        } catch (error) {
            console.error('Error al obtener préstamos (JSON):', error);
            res.status(500).json({ message: 'Error al obtener préstamos' });
        }
    }

    /**
     * Obtener todos los préstamos (vista administrativa)
     */
    /**
     * Obtener todos los préstamos (vista administrativa)
     */
    static async admin(req, res) {
        try {
            // ACTUALIZACIÓN AUTOMÁTICA DE VENCIDOS
            await Prestamo.verificarVencidos();

            // Lógica de fechas (similar a reporte controller)
            const { periodo } = req.query;
            let fechaInicio, fechaFin;

            if (periodo) {
                const now = new Date();
                switch (periodo) {
                    case 'anio_actual':
                        fechaInicio = new Date(now.getFullYear(), 0, 1);
                        fechaFin = new Date(now.getFullYear(), 11, 31);
                        break;
                    case 'mes_actual':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        break;
                    case 'trimestre':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        break;
                    case 'bimestre':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        break;
                    case 'hoy':
                        fechaInicio = new Date();
                        fechaFin = new Date();
                        break;
                }
            }

            const filtros = {
                estado: req.query.estado,
                grado: req.query.grado ? parseInt(req.query.grado) : null,
                fechaInicio: fechaInicio ? fechaInicio.toISOString().split('T')[0] : req.query.fechaInicio,
                fechaFin: fechaFin ? fechaFin.toISOString().split('T')[0] : req.query.fechaFin,
                limitReturned: 20 // Limit returned loans to latest 20
            };

            const prestamosCrudos = await Prestamo.obtenerTodos(filtros);

            console.log('Préstamos obtenidos:', prestamosCrudos.length);
            console.log('Filtros aplicados:', filtros);
            console.log('Préstamos por rol:', {
                estudiantes: prestamosCrudos.filter(p => p.usuario_rol === 'estudiante').length,
                docentes: prestamosCrudos.filter(p => p.usuario_rol === 'docente').length,
                admin: prestamosCrudos.filter(p => p.usuario_rol === 'admin').length
            });

            const prestamos = prestamosCrudos.map(p => ({
                id: p.id,
                usuario: {
                    nombre: p.nombre_estudiante || p.nombre || p.usuario_nombre || 'N/A',
                    grado: p.grado || p.usuario_grado || null,
                    seccion: p.seccion || p.usuario_seccion || '',
                    dni: p.dni || 'N/A',
                    rol: p.usuario_rol || null
                },
                libro: {
                    titulo: p.titulo || p.libro_titulo || 'N/A',
                    autor: p.autor || p.libro_autor || 'N/A'
                },
                fecha_prestamo: p.fecha_prestamo,
                fecha_devolucion_esperada: p.fecha_devolucion_esperada,
                fecha_devolucion_real: p.fecha_devolucion_real,
                estado: p.estado,
                tipo_prestamo: p.tipo_prestamo
            }));

            const prestamosEstudiantes = prestamos.filter(p => p.usuario.rol === 'estudiante');
            const prestamosDocentes = prestamos.filter(p => p.usuario.rol === 'docente');

            console.log('Préstamos filtrados:', {
                total: prestamos.length,
                estudiantes: prestamosEstudiantes.length,
                docentes: prestamosDocentes.length
            });

            res.render('prestamos/admin', {
                prestamos,
                prestamosEstudiantes,
                prestamosDocentes,
                filtros: { ...filtros, periodo }, // Pass periodo back to view
                usuario: req.user,
                navActive: { gestionPrestamos: true }
            });
        } catch (error) {
            console.error('Error al obtener préstamos:', error);
            res.status(500).json({ message: 'Error al obtener préstamos' });
        }
    }

    /**
     * Crear nuevo préstamo
     */
    static async crearPrestamo(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Log detallado para debugging
                console.warn('Validación de préstamo falló:', {
                    body: req.body,
                    errors: errors.array()
                });
                return res.status(400).json({ errors: errors.array() });
            }

            const { tipo_prestamo, duracion, libro_id, observaciones } = req.body;
            let fecha_devolucion_esperada = new Date(); // Uses server time (configured to Peru)

            const duracionNum = parseInt(duracion, 10);

            if (tipo_prestamo === 'dias') {
                fecha_devolucion_esperada.setDate(fecha_devolucion_esperada.getDate() + duracionNum);
                // Optional: set to end of day if desired, or keep exact time. keeping exact time matches logic.
            } else if (tipo_prestamo === 'horas') {
                fecha_devolucion_esperada.setHours(fecha_devolucion_esperada.getHours() + duracionNum);
            }

            const prestamoData = {
                usuario_id: req.user.id,
                libro_id: libro_id,
                fecha_devolucion_esperada: fecha_devolucion_esperada, // Pass Date object
                observaciones: observaciones,
                tipo_prestamo: tipo_prestamo
            };

            const prestamoId = await Prestamo.crear(prestamoData);

            res.status(201).json({
                message: 'Préstamo creado exitosamente',
                id: prestamoId
            });
        } catch (error) {
            console.error('Error al crear préstamo:', error);
            res.status(500).json({
                message: error.message || 'Error al crear préstamo'
            });
        }
    }

    /**
     * Registrar devolución de un préstamo
     */
    static async registrarDevolucion(req, res) {
        try {
            const result = await Prestamo.registrarDevolucion(req.params.id);

            // Si se devuelve con éxito, evaluar logros (no bloquear en caso de fallo)
            try {
                if (result && result.usuario_id) {
                    const { leidos, asignados } = await LogrosService.evaluarYAsignarLogros(result.usuario_id);

                    // Si es una petición AJAX, devolver JSON
                    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                        return res.json({ message: 'Devolución registrada exitosamente', leidos, asignados });
                    }

                    // Si no es AJAX, redirigir
                    req.session.flash = {
                        tipo: 'success',
                        mensaje: 'Devolución registrada exitosamente.'
                    };
                    return res.redirect(`/prestamos/${req.params.id}/detalle`);
                }
            } catch (err) {
                console.error('Error evaluando logros:', err);
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.json({ message: 'Devolución registrada, pero no se pudieron actualizar logros' });
                }
            }

            // Si es una petición AJAX, devolver JSON
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ message: 'Devolución registrada exitosamente' });
            }

            // Si no es AJAX, redirigir
            req.session.flash = {
                tipo: 'success',
                mensaje: 'Devolución registrada exitosamente.'
            };
            res.redirect(`/prestamos/${req.params.id}/detalle`);
        } catch (error) {
            console.error('Error al registrar devolución:', error);

            // Si es una petición AJAX, devolver JSON
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({
                    message: error.message || 'Error al registrar devolución'
                });
            }

            // Si no es AJAX, redirigir con mensaje de error
            req.session.flash = {
                tipo: 'danger',
                mensaje: error.message || 'Error al registrar devolución.'
            };
            res.redirect(`/prestamos/${req.params.id}/detalle`);
        }
    }

    /**
     * Registrar devolución por parte del propio estudiante (verifica propiedad)
     */
    static async registrarDevolucionUsuario(req, res) {
        try {
            const prestamoId = req.params.id;
            const prestamo = await Prestamo.obtenerPorId(prestamoId);
            if (!prestamo) return res.status(404).json({ message: 'Préstamo no encontrado' });
            if (prestamo.usuario_id !== req.user.id) return res.status(403).json({ message: 'No autorizado' });

            const result = await Prestamo.registrarDevolucion(prestamoId);

            try {
                if (result && result.usuario_id) {
                    const LogrosService = require('../services/logros.service');
                    const { leidos, asignados } = await LogrosService.evaluarYAsignarLogros(result.usuario_id);
                    return res.json({ message: 'Devolución registrada exitosamente', leidos, asignados });
                }
            } catch (err) {
                console.error('Error evaluando logros (usuario):', err);
                return res.json({ message: 'Devolución registrada, pero no se pudieron actualizar logros' });
            }

            res.json({ message: 'Devolución registrada exitosamente' });
        } catch (error) {
            console.error('Error al registrar devolución (usuario):', error);
            res.status(500).json({ message: error.message || 'Error al registrar devolución' });
        }
    }

    /**
     * Crear reserva de libro
     */
    static async crearReserva(req, res) {
        try {
            const reservaData = {
                usuario_id: req.user.id,
                libro_id: req.body.libro_id
            };

            const reservaId = await Prestamo.crearReserva(reservaData);

            res.status(201).json({
                message: 'Reserva creada exitosamente',
                id: reservaId
            });
        } catch (error) {
            console.error('Error al crear reserva:', error);
            res.status(500).json({
                message: error.message || 'Error al crear reserva'
            });
        }
    }

    /**
     * Aprobar un préstamo pendiente
     */
    static async aprobarPrestamo(req, res) {
        try {
            const { id } = req.params;
            const exito = await Prestamo.aprobar(id);

            if (exito) {
                res.json({ message: 'Préstamo aprobado correctamente' });
            } else {
                res.status(404).json({ message: 'Préstamo no encontrado o no se pudo aprobar' });
            }
        } catch (error) {
            console.error('Error al aprobar préstamo:', error);
            res.status(500).json({ message: 'Error al aprobar el préstamo' });
        }
    }

    /**
     * Verificar préstamos vencidos (endpoint para CRON)
     */
    static async verificarVencidos(req, res) {
        try {
            const actualizados = await Prestamo.verificarVencidos();
            res.json({
                message: `${actualizados} préstamos marcados como vencidos`
            });
        } catch (error) {
            console.error('Error al verificar vencimientos:', error);
            res.status(500).json({
                message: 'Error al verificar vencimientos'
            });
        }
    }

    /**
     * Muestra el formulario para solicitar un nuevo préstamo.
     */
    static async showCrearForm(req, res) {
        try {
            const libroId = req.params.libroId;
            // Fetch both libro and full user data in parallel
            const [libro, usuarioCompleto] = await Promise.all([
                Libro.buscarPorId(libroId),
                Usuario.findById(req.user.id)
            ]);

            if (!libro || libro.ejemplares_disponibles <= 0) {
                return res.status(404).render('error', {
                    title: 'Libro no disponible',
                    message: 'El libro que intentas solicitar no está disponible para préstamo en este momento.',
                    error: {}
                });
            }

            res.render('prestamos/crear', {
                libro: libro,
                usuario: usuarioCompleto || req.user // Fallback to req.user if db fail
            });
        } catch (error) {
            console.error('Error al mostrar formulario de préstamo:', error);
            res.status(500).render('error', { message: 'Error al cargar la página de solicitud' });
        }
    }

    /**
     * Generar reporte de préstamos
     */
    static async generarReporte(req, res) {
        try {
            const filtros = {
                estado: req.query.estado,
                grado: req.query.grado ? parseInt(req.query.grado) : null,
                fechaInicio: req.query.fechaInicio,
                fechaFin: req.query.fechaFin
            };

            // Calcular estadísticas
            const prestamos = await Prestamo.obtenerTodos(filtros);
            const totalPrestamos = prestamos.length;
            const prestamosActivos = prestamos.filter(p => p.estado === 'activo').length;
            const prestamosVencidos = prestamos.filter(p => p.estado === 'vencido').length;
            const prestamosDevueltos = prestamos.filter(p => p.estado === 'devuelto').length;

            const estadisticas = {
                total: totalPrestamos,
                activos: prestamosActivos,
                vencidos: prestamosVencidos,
                devueltos: prestamosDevueltos
            };

            // Renderizar vista HTML si no se pide otro formato
            res.render('prestamos/reportes', {
                prestamos,
                estadisticas,
                filtros,
                usuario: req.user
            });
        } catch (error) {
            console.error('Error al generar reporte:', error);
            res.status(500).json({ message: 'Error al generar reporte' });
        }
    }

    /**
     * Ver detalles completos de un préstamo (solo admin)
     */
    static async verDetallePrestamo(req, res) {
        try {
            const { id } = req.params;
            const { pool } = require('../config/database');

            // Obtener información completa del préstamo con todos los datos del usuario
            const [prestamos] = await pool.query(
                `SELECT 
                    p.id,
                    p.fecha_prestamo,
                    p.fecha_devolucion_esperada,
                    p.fecha_devolucion_real,
                    p.estado,
                    p.tipo_prestamo,
                    p.observaciones,
                    p.created_at as prestamo_created_at,
                    u.id as usuario_id,
                    u.nombre as usuario_nombre,
                    u.correo as usuario_correo,
                    u.dni as usuario_dni,
                    u.rol as usuario_rol,
                    u.grado,
                    u.seccion,
                    u.area_docente,
                    u.anio_ingreso,
                    u.foto_url as usuario_foto,
                    u.created_at as usuario_created_at,
                    u.updated_at as usuario_updated_at,
                    l.id as libro_id,
                    l.titulo as libro_titulo,
                    l.autor as libro_autor,
                    l.editorial as libro_editorial,
                    l.isbn as libro_isbn,
                    l.area as libro_area,
                    l.anio_publicacion as libro_anio,
                    l.grado_recomendado as libro_grado_recomendado,
                    l.ejemplares_totales,
                    l.ejemplares_disponibles,
                    l.ubicacion as libro_ubicacion,
                    l.descripcion as libro_descripcion,
                    DATEDIFF(CURDATE(), p.fecha_devolucion_esperada) as dias_vencido
                FROM prestamos p
                INNER JOIN usuarios u ON p.usuario_id = u.id
                INNER JOIN libros l ON p.libro_id = l.id
                WHERE p.id = ?`,
                [id]
            );

            if (!prestamos || prestamos.length === 0) {
                req.session.flash = {
                    tipo: 'danger',
                    mensaje: 'Préstamo no encontrado.'
                };
                return res.redirect('/dashboard/admin');
            }

            const prestamo = prestamos[0];

            res.render('prestamos/detalle', {
                prestamo,
                usuario: req.user
            });
        } catch (error) {
            console.error('Error al obtener detalles del préstamo:', error);
            req.session.flash = {
                tipo: 'danger',
                mensaje: 'Error al cargar los detalles del préstamo.'
            };
            res.redirect('/dashboard/admin');
        }
    }

    /**
     * Enviar alerta de recordatorio al usuario (solo admin)
     */
    static async enviarAlertaRecordatorio(req, res) {
        try {
            const { id } = req.params;
            const { pool } = require('../config/database');
            const emailService = require('../utils/email');
            const auditoria = require('../models/auditoria.model');

            // Obtener información del préstamo
            const [prestamos] = await pool.query(
                `SELECT 
                    p.id,
                    p.fecha_prestamo,
                    p.fecha_devolucion_esperada,
                    p.estado,
                    u.nombre as usuario_nombre,
                    u.correo as usuario_correo,
                    u.rol as usuario_rol,
                    u.grado,
                    u.seccion,
                    l.titulo as libro_titulo,
                    l.autor as libro_autor,
                    DATEDIFF(CURDATE(), p.fecha_devolucion_esperada) as dias_vencido
                FROM prestamos p
                INNER JOIN usuarios u ON p.usuario_id = u.id
                INNER JOIN libros l ON p.libro_id = l.id
                WHERE p.id = ?`,
                [id]
            );

            if (!prestamos || prestamos.length === 0) {
                return res.status(404).json({
                    success: false,
                    mensaje: 'Préstamo no encontrado.'
                });
            }

            const prestamo = prestamos[0];
            const diasVencido = prestamo.dias_vencido || 0;
            const esVencido = prestamo.estado === 'vencido';

            // Preparar mensaje según el estado
            let asunto, mensajeHtml;

            if (esVencido) {
                asunto = 'URGENTE: Recordatorio de devolución - Préstamo vencido';
                mensajeHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #dc2626;">⚠️ Recordatorio Urgente de Devolución</h2>
                        <p>Hola <strong>${prestamo.usuario_nombre}</strong>,</p>
                        <p>Te recordamos que tienes un préstamo <strong style="color: #dc2626;">VENCIDO</strong> que requiere tu atención inmediata.</p>
                        
                        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #dc2626;">Detalles del Préstamo:</h3>
                            <ul style="line-height: 1.8;">
                                <li><strong>Libro:</strong> ${prestamo.libro_titulo}</li>
                                <li><strong>Autor:</strong> ${prestamo.libro_autor || 'N/A'}</li>
                                <li><strong>Fecha de préstamo:</strong> ${new Date(prestamo.fecha_prestamo).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</li>
                                <li><strong>Fecha límite de devolución:</strong> ${new Date(prestamo.fecha_devolucion_esperada).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</li>
                                <li><strong>Días de retraso:</strong> <span style="color: #dc2626; font-weight: bold;">${diasVencido} días</span></li>
                            </ul>
                        </div>

                        <p style="color: #dc2626; font-weight: bold;">Por favor, devuelve el libro lo antes posible para evitar mayores sanciones.</p>
                        
                        <p>Si ya devolviste el libro, por favor contacta con la biblioteca para actualizar el registro.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="color: #6b7280; font-size: 12px;">
                            Este es un mensaje automático del sistema de Biblioteca Escolar.<br>
                            Si tienes alguna pregunta, por favor contacta con el administrador de la biblioteca.
                        </p>
                    </div>
                `;
            } else {
                asunto = 'Recordatorio de devolución - Préstamo próximo a vencer';
                mensajeHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #f59e0b;">📚 Recordatorio de Devolución</h2>
                        <p>Hola <strong>${prestamo.usuario_nombre}</strong>,</p>
                        <p>Te recordamos que tienes un préstamo que debe ser devuelto pronto.</p>
                        
                        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #f59e0b;">Detalles del Préstamo:</h3>
                            <ul style="line-height: 1.8;">
                                <li><strong>Libro:</strong> ${prestamo.libro_titulo}</li>
                                <li><strong>Autor:</strong> ${prestamo.libro_autor || 'N/A'}</li>
                                <li><strong>Fecha de préstamo:</strong> ${new Date(prestamo.fecha_prestamo).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</li>
                                <li><strong>Fecha límite de devolución:</strong> ${new Date(prestamo.fecha_devolucion_esperada).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</li>
                            </ul>
                        </div>

                        <p>Por favor, asegúrate de devolver el libro antes de la fecha límite.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="color: #6b7280; font-size: 12px;">
                            Este es un mensaje automático del sistema de Biblioteca Escolar.<br>
                            Si tienes alguna pregunta, por favor contacta con el administrador de la biblioteca.
                        </p>
                    </div>
                `;
            }

            // Enviar correo
            await emailService.enviarCorreo({
                to: prestamo.usuario_correo,
                subject: asunto,
                html: mensajeHtml
            });

            // Registrar en auditoría
            await auditoria.registrar(
                'ALERTA_RECORDATORIO_ENVIADA',
                'PRESTAMO',
                prestamo.id,
                req.user.id,
                {
                    usuario_destinatario: prestamo.usuario_nombre,
                    email_destinatario: prestamo.usuario_correo,
                    tipo_alerta: esVencido ? 'vencido' : 'recordatorio',
                    dias_vencido: diasVencido,
                    enviado_por: req.user.nombre
                }
            );

            req.session.flash = {
                tipo: 'success',
                mensaje: `Alerta enviada exitosamente a ${prestamo.usuario_nombre}.`
            };

            res.json({
                success: true,
                mensaje: 'Alerta enviada exitosamente.'
            });
        } catch (error) {
            console.error('Error al enviar alerta:', error);
            res.status(500).json({
                success: false,
                mensaje: 'Error al enviar la alerta.'
            });
        }
    }
}

module.exports = PrestamoController;