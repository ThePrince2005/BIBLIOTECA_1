const { pool } = require('../config/database');

class LogroModel {
    static async obtenerTodos() {
        const [rows] = await pool.query('SELECT * FROM logros ORDER BY umbral ASC');
        return rows;
    }

    static async obtenerPorClave(clave) {
        const [rows] = await pool.query('SELECT * FROM logros WHERE clave = ? LIMIT 1', [clave]);
        return rows[0] || null;
    }

    static async obtenerPorId(id) {
        const [rows] = await pool.query('SELECT * FROM logros WHERE id = ? LIMIT 1', [id]);
        return rows[0] || null;
    }

    static async obtenerLogrosUsuario(usuarioId) {
        try {
            const [rows] = await pool.query(
                `SELECT l.* FROM logros l
                 JOIN usuario_logros ul ON ul.logro_id = l.id
                 WHERE ul.usuario_id = ?`,
                [usuarioId]
            );
            return rows;
        } catch (e) {
            // Si no existe la tabla usuario_logros, intentar con logros_usuario (nombres alternativos de migraciones)
            try {
                const [rows] = await pool.query(
                    `SELECT l.* FROM logros l
                     JOIN logros_usuario lu ON lu.logro_id = l.id
                     WHERE lu.usuario_id = ?`,
                    [usuarioId]
                );
                return rows;
            } catch (err) {
                console.error('Error obteniendo logros para usuario (tablas usuario_logros/logros_usuario):', err.message);
                return [];
            }
        }
    }

    static async asignarLogroAUsuario(usuarioId, logroId) {
        try {
            const [res] = await pool.query(
                'INSERT IGNORE INTO usuario_logros (usuario_id, logro_id) VALUES (?, ?)',
                [usuarioId, logroId]
            );
            return res.insertId || null;
        } catch (e) {
            // Intentar con nombre alternativo de tabla
            try {
                const [res] = await pool.query(
                    'INSERT IGNORE INTO logros_usuario (usuario_id, logro_id) VALUES (?, ?)',
                    [usuarioId, logroId]
                );
                return res.insertId || null;
            } catch (err) {
                console.error('Error asignando logro en ambas tablas usuario_logros/logros_usuario:', err);
                throw err;
            }
        }
    }
}

module.exports = LogroModel;
