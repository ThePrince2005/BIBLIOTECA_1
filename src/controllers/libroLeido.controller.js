const Prestamo = require('../models/prestamo.model');
const LecturaVirtual = require('../models/lecturaVirtual.model');

class LibroLeidoController {
    /**
     * Mostrar lista de libros leídos (físicos y virtuales)
     */
    static async listar(req, res) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).render('error', {
                    title: 'No autenticado',
                    message: 'Debes iniciar sesión para ver tus libros leídos.',
                    error: {}
                });
            }

            const usuarioId = req.user.id;
            console.log('Obteniendo libros leídos para usuario:', usuarioId);

            // Obtener historial completo de préstamos (físicos: activos, devueltos, vencidos)
            let librosFisicos = [];
            try {
                if (typeof Prestamo.obtenerHistorialPorUsuario === 'function') {
                    librosFisicos = await Prestamo.obtenerHistorialPorUsuario(usuarioId) || [];
                    console.log('Libros físicos (historial) obtenidos:', librosFisicos.length);
                } else if (typeof Prestamo.obtenerLibrosLeidos === 'function') {
                    // Fallback si no existe la nueva función
                    librosFisicos = await Prestamo.obtenerLibrosLeidos(usuarioId) || [];
                    console.log('Libros físicos (solo leídos) obtenidos:', librosFisicos.length);
                } else {
                    console.error('Prestamo.obtenerHistorialPorUsuario no es una función');
                }
            } catch (error) {
                console.error('Error al obtener libros físicos:', error);
                console.error('Stack:', error.stack);
                librosFisicos = [];
            }

            // Obtener libros virtuales leídos
            let librosVirtuales = [];
            try {
                if (typeof LecturaVirtual.obtenerLibrosLeidos === 'function') {
                    librosVirtuales = await LecturaVirtual.obtenerLibrosLeidos(usuarioId) || [];
                    console.log('Libros virtuales obtenidos:', librosVirtuales.length);
                } else {
                    console.error('LecturaVirtual.obtenerLibrosLeidos no es una función');
                }
            } catch (error) {
                console.error('Error al obtener libros virtuales:', error);
                console.error('Stack:', error.stack);
                librosVirtuales = [];
            }

            // Combinar y formatear
            let librosLeidos = [
                ...librosFisicos.map(libro => ({
                    id: libro.id,
                    tipo: 'fisico',
                    libro_id: libro.libro_id,
                    titulo: libro.titulo,
                    autor: libro.autor,
                    editorial: libro.editorial,
                    area: libro.area,
                    portada: '/img/portada-default.jpg',
                    fecha_lectura: libro.fecha_devolucion_real, // Puede ser null si está activo
                    estado_prestamo: libro.estado || (libro.fecha_devolucion_real ? 'devuelto' : 'activo'),
                    validado: libro.validado || false,
                    fecha_validacion: libro.fecha_validacion,
                    datos_validacion: {
                        opinion: libro.opinion_libro,
                        resumen: libro.resumen_libro,
                        personajes: libro.personajes_principales,
                        tema: libro.tema_principal,
                        lecciones: libro.lecciones_aprendidas
                    }
                })),
                ...librosVirtuales.map(libro => ({
                    id: libro.id,
                    tipo: 'virtual',
                    libro_id: libro.libro_virtual_id,
                    titulo: libro.titulo,
                    autor: libro.autor,
                    editorial: null,
                    area: libro.categoria,
                    portada: libro.portada_url || '/img/portada-default.jpg',
                    fecha_lectura: libro.created_at || libro.fecha_lectura,
                    validado: libro.validado || false,
                    fecha_validacion: libro.fecha_validacion,
                    datos_validacion: {
                        opinion: libro.opinion_libro,
                        resumen: libro.resumen_libro,
                        personajes: libro.personajes_principales,
                        tema: libro.tema_principal,
                        lecciones: libro.lecciones_aprendidas
                    }
                }))
            ];

            // Ordenar por fecha de lectura
            librosLeidos.sort((a, b) => {
                const fechaA = a.fecha_lectura ? new Date(a.fecha_lectura) : new Date(0);
                const fechaB = b.fecha_lectura ? new Date(b.fecha_lectura) : new Date(0);
                return fechaB - fechaA;
            });

            // Filtering (In-Memory)
            const search = req.query.search ? req.query.search.toLowerCase().trim() : '';
            const tipo = req.query.tipo || ''; // 'fisico' or 'virtual'

            if (tipo) {
                librosLeidos = librosLeidos.filter(libro => libro.tipo === tipo);
            }

            if (search) {
                librosLeidos = librosLeidos.filter(libro => {
                    return (
                        (libro.titulo && libro.titulo.toLowerCase().includes(search)) ||
                        (libro.autor && libro.autor.toLowerCase().includes(search)) ||
                        (libro.area && libro.area.toLowerCase().includes(search)) ||
                        (libro.editorial && libro.editorial.toLowerCase().includes(search))
                    );
                });
            }

            console.log('Total libros leídos (filtrados):', librosLeidos.length);

            // Paginación en memoria
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;

            const totalLibros = librosLeidos.length;
            const totalPaginas = Math.ceil(totalLibros / limit);

            const librosPaginados = librosLeidos.slice(startIndex, endIndex);

            // Si no hay libros, mostrar lista vacía en lugar de error
            res.render('libros/leidos', {
                librosLeidos: librosPaginados || [],
                usuario: req.user,
                pagination: {
                    page,
                    limit,
                    totalLibros,
                    totalPaginas
                },
                search,
                tipo
            });
        } catch (error) {
            console.error('Error al listar libros leídos:', error);
            console.error('Stack trace:', error.stack);

            // Mostrar error más detallado en desarrollo
            const errorMessage = process.env.NODE_ENV === 'development'
                ? `Error: ${error.message}`
                : 'Error al cargar los libros leídos. Por favor, intenta más tarde.';

            res.status(500).render('error', {
                title: 'Error',
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? {
                    message: error.message,
                    stack: error.stack
                } : {}
            });
        }
    }

    /**
     * Mostrar formulario de validación
     */
    static async mostrarFormularioValidacion(req, res) {
        try {
            const { tipo, id } = req.params;
            const usuarioId = req.user.id;

            let libro = null;

            if (tipo === 'fisico') {
                // Usar obtenerHistorialPorUsuario para encontrar también préstamos activos
                const prestamos = await Prestamo.obtenerHistorialPorUsuario(usuarioId);
                const prestamo = prestamos.find(p => p.id === parseInt(id));

                if (!prestamo) {
                    return res.status(404).render('error', {
                        title: 'Libro no encontrado',
                        message: 'El libro que buscas no existe o no tienes acceso a él.',
                        error: {}
                    });
                }

                libro = {
                    id: prestamo.id,
                    titulo: prestamo.titulo,
                    autor: prestamo.autor,
                    editorial: prestamo.editorial,
                    area: prestamo.area,
                    portada_url: prestamo.portada_url,
                    imagen_portada: prestamo.imagen_portada,
                    opinion_libro: prestamo.opinion_libro,
                    resumen_libro: prestamo.resumen_libro,
                    personajes_principales: prestamo.personajes_principales,
                    tema_principal: prestamo.tema_principal,
                    lecciones_aprendidas: prestamo.lecciones_aprendidas
                };
            } else if (tipo === 'virtual') {
                const lecturas = await LecturaVirtual.obtenerLibrosLeidos(usuarioId);
                const lectura = lecturas.find(l => l.id === parseInt(id));

                if (!lectura) {
                    return res.status(404).render('error', {
                        title: 'Libro no encontrado',
                        message: 'El libro que buscas no existe o no tienes acceso a él.',
                        error: {}
                    });
                }

                libro = {
                    id: lectura.id,
                    titulo: lectura.titulo,
                    autor: lectura.autor,
                    editorial: null,
                    categoria: lectura.categoria,
                    portada_url: lectura.portada_url,
                    opinion_libro: lectura.opinion_libro,
                    resumen_libro: lectura.resumen_libro,
                    personajes_principales: lectura.personajes_principales,
                    tema_principal: lectura.tema_principal,
                    lecciones_aprendidas: lectura.lecciones_aprendidas
                };
            } else {
                return res.status(400).render('error', {
                    title: 'Tipo inválido',
                    message: 'Tipo de libro inválido.',
                    error: {}
                });
            }

            res.render('libros/formulario-validacion', {
                libro,
                tipo,
                id,
                usuario: req.user
            });
        } catch (error) {
            console.error('Error al mostrar formulario de validación:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Error al cargar el formulario de validación.',
                error: {}
            });
        }
    }

    /**
     * Procesar validación de libro
     */
    static async validar(req, res) {
        try {
            const { tipo, id } = req.params;
            const usuarioId = req.user.id;
            const {
                opinion_libro,
                resumen_libro,
                personajes_principales,
                tema_principal,
                lecciones_aprendidas
            } = req.body;

            // Validar campos requeridos
            if (!opinion_libro || opinion_libro.trim().length < 10) {
                return res.status(400).json({
                    message: 'La opinión sobre el libro debe tener al menos 10 caracteres'
                });
            }

            if (!resumen_libro || resumen_libro.trim().length < 20) {
                return res.status(400).json({
                    message: 'El resumen del libro debe tener al menos 20 caracteres'
                });
            }

            const datosValidacion = {
                opinion_libro: opinion_libro.trim(),
                resumen_libro: resumen_libro.trim(),
                personajes_principales: personajes_principales ? personajes_principales.trim() : null,
                tema_principal: tema_principal ? tema_principal.trim() : null,
                lecciones_aprendidas: lecciones_aprendidas ? lecciones_aprendidas.trim() : null
            };

            if (tipo === 'fisico') {
                // Verificar que el préstamo pertenece al usuario (usando historial para permitir activos)
                const prestamos = await Prestamo.obtenerHistorialPorUsuario(usuarioId);
                const prestamo = prestamos.find(p => p.id === parseInt(id));

                if (!prestamo) {
                    return res.status(404).json({ message: 'Préstamo no encontrado' });
                }

                if (prestamo.validado) {
                    return res.status(400).json({
                        message: 'Este libro ya ha sido validado y no puede editarse.'
                    });
                }

                await Prestamo.validarPrestamo(parseInt(id), datosValidacion);
            } else if (tipo === 'virtual') {
                // Verificar que la lectura pertenece al usuario
                const lecturas = await LecturaVirtual.obtenerLibrosLeidos(usuarioId);
                const lectura = lecturas.find(l => l.id === parseInt(id));

                if (!lectura) {
                    return res.status(404).json({ message: 'Lectura virtual no encontrada' });
                }

                if (lectura.validado) {
                    return res.status(400).json({
                        message: 'Este libro ya ha sido validado y no puede editarse.'
                    });
                }

                await LecturaVirtual.validarLectura(parseInt(id), datosValidacion);
            } else {
                return res.status(400).json({ message: 'Tipo de libro inválido' });
            }

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({
                    success: true,
                    message: 'Libro validado exitosamente'
                });
            }

            req.session.flash = {
                tipo: 'success',
                mensaje: 'Libro validado exitosamente.'
            };
            res.redirect('/libros-leidos');
        } catch (error) {
            console.error('Error al validar libro:', error);

            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(500).json({
                    message: error.message || 'Error al validar el libro'
                });
            }

            req.session.flash = {
                tipo: 'danger',
                mensaje: error.message || 'Error al validar el libro.'
            };
            res.redirect('/libros-leidos');
        }
    }
}

module.exports = LibroLeidoController;
