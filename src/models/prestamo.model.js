const { pool } = require('../config/database');
const Libro = require('./libro.model');

class PrestamoModel {
    /**
     * Crea un nuevo préstamo y actualiza el stock del libro.
     * Se utiliza una transacción para garantizar la atomicidad.
     * @param {object} datosPrestamo - { libro_id, usuario_id, fecha_devolucion_esperada, observaciones }
     * @returns {Promise<number>} ID del nuevo préstamo.
     */
    static async crear(datosPrestamo) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Verificar disponibilidad del libro
            const libro = await connection.execute('SELECT ejemplares_disponibles FROM libros WHERE id = ? FOR UPDATE', [datosPrestamo.libro_id]);
            if (libro[0][0].ejemplares_disponibles <= 0) {
                throw new Error('No hay ejemplares disponibles para este libro.');
            }

            // 2. Insertar el préstamo
            const [result] = await connection.execute(
                `INSERT INTO prestamos (libro_id, usuario_id, fecha_prestamo, fecha_devolucion_esperada, estado, observaciones, tipo_prestamo)
                 VALUES (?, ?, NOW(), ?, 'pendiente', ?, ?)`,
                [
                    datosPrestamo.libro_id,
                    datosPrestamo.usuario_id,
                    datosPrestamo.fecha_devolucion_esperada,
                    datosPrestamo.observaciones,
                    datosPrestamo.tipo_prestamo || 'dias'
                ]
            );
            const prestamoId = result.insertId;

            // 3. Actualizar el número de ejemplares disponibles
            await connection.execute(
                'UPDATE libros SET ejemplares_disponibles = ejemplares_disponibles - 1 WHERE id = ?',
                [datosPrestamo.libro_id]
            );

            // Obtener información del usuario antes de cerrar la conexión
            const [usuarioInfo] = await connection.execute(
                'SELECT rol, nombre FROM usuarios WHERE id = ?',
                [datosPrestamo.usuario_id]
            );

            await connection.commit();

            // Log para debugging
            console.log('Préstamo creado:', {
                id: prestamoId,
                usuario_id: datosPrestamo.usuario_id,
                usuario_rol: usuarioInfo[0]?.rol,
                usuario_nombre: usuarioInfo[0]?.nombre,
                libro_id: datosPrestamo.libro_id,
                estado: 'pendiente'
            });

            return prestamoId;
        } catch (error) {
            await connection.rollback();
            console.error('Error al crear préstamo:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Obtiene los préstamos de un usuario específico.
     * @param {number} usuarioId - ID del usuario.
     * @returns {Promise<Array>} Lista de préstamos del usuario.
     */
    static async obtenerPorUsuario(usuarioId) {
        const [rows] = await pool.query(
            `SELECT p.id, p.libro_id, l.titulo, l.autor, p.fecha_prestamo, p.fecha_devolucion_esperada, p.fecha_devolucion_real, p.estado, p.tipo_prestamo
             FROM prestamos p
             JOIN libros l ON p.libro_id = l.id
             WHERE p.usuario_id = ?
             ORDER BY p.fecha_prestamo DESC`,
            [usuarioId]
        );
        return rows;
    }



    /**
     * Obtener historial completo de préstamos por usuario con datos de validación
     */
    static async obtenerHistorialPorUsuario(usuarioId) {
        try {
            // Consulta básica sin columnas de validación
            // Eliminamos "AND p.fecha_devolucion_real IS NOT NULL" para traer todos
            const [rows] = await pool.query(
                `SELECT p.id, p.libro_id, p.fecha_devolucion_real, p.estado,
                        l.titulo, l.autor, l.editorial, l.area
                 FROM prestamos p
                 JOIN libros l ON p.libro_id = l.id
                 WHERE p.usuario_id = ?
                 ORDER BY p.fecha_prestamo DESC`,
                [usuarioId]
            );

            // Intentar obtener columnas de validación si existen
            let tieneColumnasValidacion = false;
            try {
                const [columns] = await pool.query(
                    `SELECT COLUMN_NAME 
                     FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = DATABASE() 
                     AND TABLE_NAME = 'prestamos' 
                     AND COLUMN_NAME = 'validado'`
                );
                tieneColumnasValidacion = columns.length > 0;
            } catch (e) {
                // Ignorar error de verificación
            }

            // Si las columnas existen, obtener datos adicionales
            if (tieneColumnasValidacion && rows.length > 0) {
                const ids = rows.map(r => r.id);
                const placeholders = ids.map(() => '?').join(',');
                const [validaciones] = await pool.query(
                    `SELECT id, validado, fecha_validacion, opinion_libro, resumen_libro, 
                            personajes_principales, tema_principal, lecciones_aprendidas
                     FROM prestamos 
                     WHERE id IN (${placeholders})`,
                    ids
                );

                const validacionesMap = {};
                validaciones.forEach(v => {
                    validacionesMap[v.id] = v;
                });

                return rows.map(row => ({
                    ...row,
                    validado: validacionesMap[row.id]?.validado || false,
                    fecha_validacion: validacionesMap[row.id]?.fecha_validacion || null,
                    opinion_libro: validacionesMap[row.id]?.opinion_libro || null,
                    resumen_libro: validacionesMap[row.id]?.resumen_libro || null,
                    personajes_principales: validacionesMap[row.id]?.personajes_principales || null,
                    tema_principal: validacionesMap[row.id]?.tema_principal || null,
                    lecciones_aprendidas: validacionesMap[row.id]?.lecciones_aprendidas || null
                }));
            }

            // Si no existen las columnas, retornar con valores por defecto
            return (rows || []).map(row => ({
                ...row,
                validado: false,
                fecha_validacion: null,
                opinion_libro: null,
                resumen_libro: null,
                personajes_principales: null,
                tema_principal: null,
                lecciones_aprendidas: null
            }));
        } catch (error) {
            console.error('Error en obtenerHistorialPorUsuario:', error);
            return [];
        }
    }

    /**
     * Obtener libros físicos leídos por un usuario (préstamos devueltos)
     */
    static async obtenerLibrosLeidos(usuarioId) {
        try {
            // Consulta básica sin columnas de validación (funciona siempre)
            const [rows] = await pool.query(
                `SELECT p.id, p.libro_id, p.fecha_devolucion_real,
                        l.titulo, l.autor, l.editorial, l.area
                 FROM prestamos p
                 JOIN libros l ON p.libro_id = l.id
                 WHERE p.usuario_id = ? AND p.fecha_devolucion_real IS NOT NULL
                 ORDER BY p.fecha_devolucion_real DESC`,
                [usuarioId]
            );

            // Intentar obtener columnas de validación si existen
            let tieneColumnasValidacion = false;
            try {
                const [columns] = await pool.query(
                    `SELECT COLUMN_NAME 
                     FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = DATABASE() 
                     AND TABLE_NAME = 'prestamos' 
                     AND COLUMN_NAME = 'validado'`
                );
                tieneColumnasValidacion = columns.length > 0;
            } catch (e) {
                // Ignorar error de verificación
            }

            // Si las columnas existen, obtener datos adicionales
            if (tieneColumnasValidacion && rows.length > 0) {
                const ids = rows.map(r => r.id);
                const placeholders = ids.map(() => '?').join(',');
                const [validaciones] = await pool.query(
                    `SELECT id, validado, fecha_validacion, opinion_libro, resumen_libro, 
                            personajes_principales, tema_principal, lecciones_aprendidas
                     FROM prestamos 
                     WHERE id IN (${placeholders})`,
                    ids
                );

                const validacionesMap = {};
                validaciones.forEach(v => {
                    validacionesMap[v.id] = v;
                });

                return rows.map(row => ({
                    ...row,
                    validado: validacionesMap[row.id]?.validado || false,
                    fecha_validacion: validacionesMap[row.id]?.fecha_validacion || null,
                    opinion_libro: validacionesMap[row.id]?.opinion_libro || null,
                    resumen_libro: validacionesMap[row.id]?.resumen_libro || null,
                    personajes_principales: validacionesMap[row.id]?.personajes_principales || null,
                    tema_principal: validacionesMap[row.id]?.tema_principal || null,
                    lecciones_aprendidas: validacionesMap[row.id]?.lecciones_aprendidas || null
                }));
            }

            // Si no existen las columnas, retornar con valores por defecto
            return (rows || []).map(row => ({
                ...row,
                validado: false,
                fecha_validacion: null,
                opinion_libro: null,
                resumen_libro: null,
                personajes_principales: null,
                tema_principal: null,
                lecciones_aprendidas: null
            }));
        } catch (error) {
            console.error('Error en obtenerLibrosLeidos:', error);
            return [];
        }
    }

    /**
     * Validar un préstamo con cuestionario
     */
    static async validarPrestamo(prestamoId, datosValidacion) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Verificar que el préstamo existe y está devuelto
            const [prestamos] = await connection.execute(
                'SELECT id, usuario_id, fecha_devolucion_real FROM prestamos WHERE id = ?',
                [prestamoId]
            );

            if (!prestamos || prestamos.length === 0) {
                throw new Error('Préstamo no encontrado');
            }

            // Verificar si las columnas de validación existen
            let tieneColumnasValidacion = false;
            try {
                const [columns] = await connection.query(
                    `SELECT COLUMN_NAME 
                     FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = DATABASE() 
                     AND TABLE_NAME = 'prestamos' 
                     AND COLUMN_NAME = 'validado'`
                );
                tieneColumnasValidacion = columns.length > 0;
            } catch (e) {
                console.warn('No se pudo verificar columnas de validación:', e.message);
            }

            if (tieneColumnasValidacion) {
                // Actualizar con datos de validación
                await connection.execute(
                    `UPDATE prestamos 
                     SET validado = TRUE,
                         opinion_libro = ?,
                         resumen_libro = ?,
                         personajes_principales = ?,
                         tema_principal = ?,
                         lecciones_aprendidas = ?,
                         fecha_validacion = NOW()
                     WHERE id = ?`,
                    [
                        datosValidacion.opinion_libro || null,
                        datosValidacion.resumen_libro || null,
                        datosValidacion.personajes_principales || null,
                        datosValidacion.tema_principal || null,
                        datosValidacion.lecciones_aprendidas || null,
                        prestamoId
                    ]
                );
            } else {
                // Si las columnas no existen, lanzar error informativo
                console.warn('Las columnas de validación no existen. Ejecuta la migración 20250115_add_validacion_libros.sql');
                throw new Error('Las columnas de validación no existen en la base de datos. Por favor, ejecuta la migración primero.');
            }

            await connection.commit();
            return { success: true, prestamo_id: prestamoId };
        } catch (err) {
            await connection.rollback();
            console.error('Error al validar préstamo:', err);
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Obtener préstamo por id
     */
    static async obtenerPorId(id) {
        const [rows] = await pool.query(
            `SELECT p.*, u.nombre as usuario_nombre FROM prestamos p
             JOIN usuarios u ON p.usuario_id = u.id
             WHERE p.id = ? LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Obtiene todos los préstamos del sistema (para administradores).
     * @returns {Promise<Array>} Lista de todos los préstamos.
     */
    static async obtenerTodos(filtros = {}) {
        const selectClause = `
            SELECT 
                p.id, 
                u.nombre as nombre_estudiante, 
                u.dni, 
                u.rol as usuario_rol,
                l.titulo, 
                l.autor, 
                p.fecha_prestamo, 
                p.fecha_devolucion_esperada, 
                p.fecha_devolucion_real, 
                p.estado, 
                p.tipo_prestamo
            FROM prestamos p
            JOIN usuarios u ON p.usuario_id = u.id
            JOIN libros l ON p.libro_id = l.id
        `;

        // Helper to build WHERE conditions
        const buildWhere = (includeEstadoFilter = true) => {
            let conditions = ['1=1'];
            const params = [];

            if (includeEstadoFilter && filtros.estado) {
                conditions.push('p.estado = ?');
                params.push(filtros.estado);
            }

            if (filtros.rol) {
                conditions.push('u.rol = ?');
                params.push(filtros.rol);
            }

            if (filtros.grado) {
                conditions.push('(u.rol = "docente" OR u.grado = ?)');
                params.push(filtros.grado);
            }

            if (filtros.fechaInicio) {
                conditions.push('p.fecha_prestamo >= ?');
                params.push(filtros.fechaInicio);
            }

            if (filtros.fechaFin) {
                conditions.push('p.fecha_prestamo <= ?');
                params.push(filtros.fechaFin);
            }

            return { where: conditions.join(' AND '), params };
        };

        // If limitReturned is requested, use UNION strategy
        if (filtros.limitReturned) {
            // Part 1: Non-returned loans (Active, Overdue, Pending) - Unlimited
            const whereNonReturned = buildWhere(false); // Handle state manually
            // Exclude 'devuelto' manually in the query
            // Careful: if filtros.estado is set to 'devuelto', this part should be empty, but let's assume this flag is used for the general view

            // Query A: Everything EXCEPT 'devuelto'
            const queryA = `${selectClause} WHERE ${whereNonReturned.where} AND p.estado != 'devuelto'`;

            // Query B: Only 'devuelto', limited
            const whereReturned = buildWhere(false);
            const queryB = `${selectClause} WHERE ${whereReturned.where} AND p.estado = 'devuelto' ORDER BY p.fecha_devolucion_real DESC LIMIT ?`;

            // Combine params
            const finalParams = [...whereNonReturned.params, ...whereReturned.params, filtros.limitReturned];

            // Final UNION Query
            // Note: wrap in parentheses for order/limit safety in union if needed, though simple union usually works
            const fullQuery = `
                (${queryA}) 
                UNION ALL 
                (${queryB}) 
                ORDER BY fecha_prestamo DESC
            `;

            const [rows] = await pool.query(fullQuery, finalParams);
            return rows;
        }

        // Default behavior (Original Logic)
        let query = selectClause + ' WHERE ' + buildWhere(true).where;
        query += ' ORDER BY p.fecha_prestamo DESC';

        const [rows] = await pool.query(query, buildWhere(true).params);
        return rows;
    }

    /**
     * Obtiene préstamos que están a punto de vencer.
     * @param {number} dias - Número de días de antelación para la alerta.
     * @returns {Promise<Array>}
     */
    static async obtenerPrestamosProximosVencer(dias) {
        const [rows] = await pool.query(
            `SELECT p.id, p.fecha_devolucion_esperada, p.fecha_prestamo, u.nombre as nombre_estudiante, u.email as email_estudiante, l.titulo
             FROM prestamos p
             JOIN usuarios u ON p.usuario_id = u.id
             JOIN libros l ON p.libro_id = l.id
             WHERE p.estado = 'activo' AND p.fecha_devolucion_esperada BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
            [dias]
        );
        return rows;
    }

    /**
     * Obtiene préstamos que ya han vencido y siguen activos.
     * @returns {Promise<Array>}
     */
    static async obtenerPrestamosVencidos() {
        const [rows] = await pool.query(
            `SELECT p.id, p.fecha_devolucion_esperada, p.fecha_prestamo, u.nombre as nombre_estudiante, u.email as email_estudiante, u.grado, l.titulo
             FROM prestamos p
             JOIN usuarios u ON p.usuario_id = u.id
             JOIN libros l ON p.libro_id = l.id
             WHERE p.estado = 'activo' AND p.fecha_devolucion_esperada < CURDATE()`
        );
        return rows;
    }

    /**
     * Verifica y actualiza el estado de los préstamos vencidos.
     * @returns {Promise<number>} Número de préstamos actualizados.
     */
    static async verificarVencidos() {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Obtener préstamos vencidos que aún están activos
            const [vencidos] = await connection.query(
                "SELECT id FROM prestamos WHERE estado = 'activo' AND fecha_devolucion_esperada < NOW()"
            );

            if (vencidos.length === 0) {
                await connection.commit();
                return 0;
            }

            const ids = vencidos.map(p => p.id);

            // 2. Actualizar estado a 'vencido'
            const [result] = await connection.query(
                "UPDATE prestamos SET estado = 'vencido' WHERE id IN (?)",
                [ids]
            );

            await connection.commit();
            return result.affectedRows;
        } catch (error) {
            await connection.rollback();
            console.error('Error en verificarVencidos:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Marca una lista de préstamos como 'vencido'.
     * @param {Array<number>} prestamoIds - IDs de los préstamos a marcar.
     * @returns {Promise<any>}
     */
    static async marcarPrestamosVencidos(prestamoIds) {
        if (prestamoIds.length === 0) return;
        const [result] = await pool.query(
            "UPDATE prestamos SET estado = 'vencido' WHERE id IN (?) AND estado = 'activo'",
            [prestamoIds]
        );
        return result;
    }

    /**
     * Obtiene los últimos préstamos realizados (recientes) para mostrar en panel.
     * @param {number} limit - número máximo de elementos a devolver
     */
    static async obtenerRecientes(limit = 10) {
        const [rows] = await pool.query(
            `SELECT p.id, p.usuario_id, u.nombre as nombre_usuario, l.id as libro_id, l.titulo, p.fecha_prestamo, p.fecha_devolucion_esperada, p.estado
             FROM prestamos p
             JOIN usuarios u ON p.usuario_id = u.id
             JOIN libros l ON p.libro_id = l.id
             ORDER BY p.fecha_prestamo DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    }
    /**
     * Aprueba un préstamo pendiente.
     * @param {number} id - ID del préstamo.
     * @returns {Promise<boolean>} True si se aprobó correctamente.
     */
    static async aprobar(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Obtener datos originales del préstamo para calcular duración
            const [rows] = await connection.query(
                'SELECT fecha_prestamo, fecha_devolucion_esperada FROM prestamos WHERE id = ?',
                [id]
            );

            if (rows.length === 0) {
                await connection.rollback();
                return false;
            }

            const prestamo = rows[0];
            const start = new Date(prestamo.fecha_prestamo);
            const due = new Date(prestamo.fecha_devolucion_esperada);

            // Calcular duración en milisegundos
            const duration = due - start;

            // 2. Actualizar fechas relativas al momento de aprobación (ahora)
            // fecha_prestamo = NOW()
            // fecha_devolucion_esperada = NOW() + duration

            const [result] = await connection.query(
                `UPDATE prestamos 
                 SET estado = 'activo', 
                     fecha_prestamo = NOW(),
                     fecha_devolucion_esperada = DATE_ADD(NOW(), INTERVAL ? SECOND)
                 WHERE id = ?`,
                [Math.floor(duration / 1000), id]
            );

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            console.error('Error al aprobar préstamo:', error);
            throw error;
        } finally {
            connection.release();
        }
    }
}

/**
 * Registrar devolución: actualizar fecha_devolucion_real, estado y recuperar usuario para evaluación de logros
 */
PrestamoModel.registrarDevolucion = async function (prestamoId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Obtener préstamo y verificar estado
        const [rows] = await connection.execute('SELECT id, usuario_id, libro_id, estado, fecha_prestamo FROM prestamos WHERE id = ? FOR UPDATE', [prestamoId]);
        if (!rows || rows.length === 0) throw new Error('Préstamo no encontrado');
        const prestamo = rows[0];
        if (prestamo.estado === 'devuelto') {
            await connection.commit();
            return;
        }

        // Actualizar préstamo: fecha_devolucion_real y estado
        await connection.execute(
            "UPDATE prestamos SET fecha_devolucion_real = NOW(), estado = 'devuelto' WHERE id = ?",
            [prestamoId]
        );

        // Incrementar ejemplares disponibles
        await connection.execute('UPDATE libros SET ejemplares_disponibles = ejemplares_disponibles + 1 WHERE id = ?', [prestamo.libro_id]);

        await connection.commit();



        return { usuario_id: prestamo.usuario_id };
    } catch (err) {
        await connection.rollback();
        console.error('Error in registrarDevolucion:', err);
        throw err;
    } finally {
        connection.release();
    }
};

/**
 * Contar devoluciones completas de un usuario (préstamos con fecha_devolucion_real not null)
 */
PrestamoModel.countDevolucionesPorUsuario = async function (usuarioId) {
    const [rows] = await pool.query('SELECT COUNT(*) as total FROM prestamos WHERE usuario_id = ? AND fecha_devolucion_real IS NOT NULL', [usuarioId]);
    // rows is an array with one object { total: N }
    return rows[0] ? rows[0].total : 0;
};

module.exports = PrestamoModel;