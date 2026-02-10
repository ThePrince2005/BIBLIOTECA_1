const db = require('../config/database');
const emailService = require('../utils/email');

const AuditoriaModel = {
    // Configuración de correos desde variables de entorno
    adminEmail: process.env.ADMIN_EMAIL,
    notificacionEmails: process.env.NOTIFICACION_EMAILS?.split(',') || [],
    /**
     * Registrar una acción en el sistema
     * @param {string} accion - Tipo de acción realizada
     * @param {string} entidad - Entidad afectada (libro, usuario, prestamo, etc)
     * @param {number} entidad_id - ID de la entidad afectada
     * @param {number} usuario_id - ID del usuario que realizó la acción
     * @param {Object} detalles - Detalles adicionales de la acción
     */
    async registrar(accion, entidad, entidad_id, usuario_id, detalles = {}, datosAnteriores = null) {
        try {
            // Si hay datos anteriores, calcular los cambios
            if (datosAnteriores && detalles.nuevos_valores) {
                const cambios = {};
                for (const [key, newValue] of Object.entries(detalles.nuevos_valores)) {
                    if (datosAnteriores[key] !== newValue) {
                        cambios[key] = {
                            anterior: datosAnteriores[key],
                            nuevo: newValue
                        };
                    }
                }
                detalles.cambios = cambios;
            }

            // Agregar nivel de importancia
            detalles.importancia = this.determinarImportancia(accion, entidad, detalles);

            const [result] = await db.pool.query(
                'INSERT INTO auditoria (accion, entidad, entidad_id, usuario_id, detalles, fecha_registro, importancia) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
                [accion, entidad, entidad_id, usuario_id, JSON.stringify(detalles), detalles.importancia]
            );

            // Si es un evento importante, enviar notificación
            if (detalles.importancia === 'ALTA') {
                await this.notificarEventoImportante(accion, entidad, entidad_id, detalles);
            }

            return result.insertId;
        } catch (error) {
            console.error('Error al registrar auditoría:', error);
            throw error;
        }
    },

    determinarImportancia(accion, entidad, detalles) {
        // Eventos de alta importancia
        if (
            accion.includes('ERROR') ||
            accion.includes('ELIMINAR') ||
            accion.includes('SEGURIDAD') ||
            (entidad === 'USUARIO' && (
                accion.includes('LOGIN_FALLIDO') ||
                accion.includes('CAMBIO_ROL') ||
                accion.includes('BLOQUEO')
            )) ||
            (entidad === 'PRESTAMO' && (
                accion.includes('VENCIDO') ||
                accion.includes('PERDIDA')
            )) ||
            (entidad === 'LIBRO' && (
                accion.includes('BAJA') ||
                accion.includes('PERDIDA')
            ))
        ) {
            return 'ALTA';
        }

        // Eventos de importancia media
        if (
            accion.includes('CREAR') ||
            accion.includes('ACTUALIZAR') ||
            accion.includes('MODIFICAR') ||
            (entidad === 'PRESTAMO' && (
                accion.includes('DEVOLUCION') ||
                accion.includes('RENOVACION')
            )) ||
            (entidad === 'LIBRO' && (
                accion.includes('INVENTARIO') ||
                accion.includes('UBICACION')
            )) ||
            (entidad === 'USUARIO' && accion.includes('ACCESO'))
        ) {
            return 'MEDIA';
        }

        // Eventos de baja importancia
        return 'BAJA';
    },

    async notificarEventoImportante(accion, entidad, entidad_id, detalles) {
        try {
            // Obtener emails de administradores de la base de datos
            const [admins] = await db.pool.query(
                'SELECT correo FROM usuarios WHERE rol = "admin"'
            );
            
            // Combinar emails de administradores de la BD con los configurados
            const destinatarios = [
                ...new Set([
                    ...admins.map(admin => admin.email),
                    this.adminEmail,
                    ...this.notificacionEmails
                ].filter(Boolean))
            ];

            if (destinatarios.length > 0) {
                const titulo = `[BIBLIOTECA] Evento ${detalles.importancia}: ${accion}`;
                const mensaje = `
                    <h2>Se ha registrado un evento importante en el sistema</h2>
                    <p><strong>Acción:</strong> ${accion}</p>
                    <p><strong>Entidad:</strong> ${entidad}</p>
                    <p><strong>ID:</strong> ${entidad_id}</p>
                    <p><strong>Importancia:</strong> ${detalles.importancia}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-PE')}</p>
                    ${detalles.cambios ? `
                        <h3>Cambios Realizados:</h3>
                        <pre>${JSON.stringify(detalles.cambios, null, 2)}</pre>
                    ` : ''}
                    <h3>Detalles Adicionales:</h3>
                    <pre>${JSON.stringify(detalles, null, 2)}</pre>
                `;

                const tipoNotificacion = detalles.importancia === 'ALTA' ? 'error' :
                                       detalles.importancia === 'MEDIA' ? 'warning' : 'info';

                await emailService.enviarNotificacion(destinatarios, titulo, mensaje, tipoNotificacion);
            }
        } catch (error) {
            console.error('Error al enviar notificación:', error);
            // No interrumpir el flujo si falla la notificación
        }
    },

    /**
     * Obtener registros de auditoría con filtros
     */
    async obtenerRegistros({
        accion = null,
        entidad = null,
        usuario_id = null,
        fecha_inicio = null,
        fecha_fin = null,
        limite = 50,
        offset = 0
    } = {}) {
        try {
            let query = `
                SELECT 
                    a.*,
                    u.nombre as usuario_nombre,
                    u.rol as usuario_rol
                FROM auditoria a
                LEFT JOIN usuarios u ON a.usuario_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (accion) {
                query += ' AND a.accion = ?';
                params.push(accion);
            }
            if (entidad) {
                query += ' AND a.entidad = ?';
                params.push(entidad);
            }
            if (usuario_id) {
                query += ' AND a.usuario_id = ?';
                params.push(usuario_id);
            }
            if (fecha_inicio) {
                query += ' AND a.fecha_registro >= ?';
                params.push(fecha_inicio);
            }
            if (fecha_fin) {
                query += ' AND a.fecha_registro <= ?';
                params.push(fecha_fin);
            }

            query += ' ORDER BY a.fecha_registro DESC LIMIT ? OFFSET ?';
            params.push(limite, offset);

            const [registros] = await db.pool.query(query, params);
            return registros;
        } catch (error) {
            console.error('Error al obtener registros de auditoría:', error);
            throw error;
        }
    },

    /**
     * Obtener estadísticas de auditoría
     */
    async obtenerEstadisticas(fecha_inicio = null, fecha_fin = null) {
        try {
            let queryParams = [];
            let dateFilter = '';
            
            if (fecha_inicio && fecha_fin) {
                dateFilter = 'WHERE fecha_registro BETWEEN ? AND ?';
                queryParams = [fecha_inicio, fecha_fin];
            }

            const [stats] = await db.pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM auditoria ${dateFilter}) as total_registros,
                    (
                        SELECT COUNT(DISTINCT usuario_id)
                        FROM auditoria
                        ${dateFilter}
                    ) as usuarios_distintos,
                    (
                        SELECT COUNT(*)
                        FROM auditoria
                        ${dateFilter}
                        AND accion LIKE '%_ERROR'
                    ) as total_errores
            `, queryParams);

            const [accionesPorTipo] = await db.pool.query(`
                SELECT accion, COUNT(*) as total
                FROM auditoria
                ${dateFilter}
                GROUP BY accion
                ORDER BY total DESC
            `, queryParams);

            const [accionesPorUsuario] = await db.pool.query(`
                SELECT 
                    u.nombre,
                    u.rol,
                    COUNT(*) as total_acciones
                FROM auditoria a
                JOIN usuarios u ON a.usuario_id = u.id
                ${dateFilter}
                GROUP BY a.usuario_id, u.nombre, u.rol
                ORDER BY total_acciones DESC
                LIMIT 10
            `, queryParams);

            return {
                ...stats[0],
                accionesPorTipo,
                accionesPorUsuario
            };
        } catch (error) {
            console.error('Error al obtener estadísticas de auditoría:', error);
            throw error;
        }
    }
};

module.exports = AuditoriaModel;