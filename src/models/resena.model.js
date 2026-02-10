const { pool } = require('../config/database');

class ResenaModel {
    static async crear({ usuario_id, libro_id, prestamo_id, calificacion, comentario }) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO resenas (usuario_id, libro_id, prestamo_id, calificacion, comentario)
                 VALUES (?, ?, ?, ?, ?)`,
                [usuario_id, libro_id, prestamo_id, calificacion, comentario]
            );
            return result.insertId;
        } finally {
            connection.release();
        }
    }

    static async actualizar(id, { calificacion, comentario }) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `UPDATE resenas
                 SET calificacion = ?, comentario = ?, fecha_creacion = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [calificacion, comentario, id]
            );
            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    static async eliminar(id) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                'DELETE FROM resenas WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    static async buscarPorId(id) {
        const [rows] = await pool.query(
            `SELECT r.*, u.nombre AS usuario_nombre, u.foto_url, u.grado, u.seccion, l.titulo AS libro_titulo
             FROM resenas r
             JOIN usuarios u ON u.id = r.usuario_id
             JOIN libros l ON l.id = r.libro_id
             WHERE r.id = ?
             LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    }

    static async listarPorLibro(libroId) {
        const [rows] = await pool.query(
            `SELECT r.*, u.nombre AS usuario_nombre, u.foto_url, u.grado, u.seccion
             FROM resenas r
             JOIN usuarios u ON u.id = r.usuario_id
             WHERE r.libro_id = ?
             ORDER BY r.fecha_creacion DESC`,
            [libroId]
        );
        return rows;
    }

    static async obtenerResumenLibro(libroId) {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total, COALESCE(AVG(calificacion), 0) AS promedio
             FROM resenas WHERE libro_id = ?`,
            [libroId]
        );
        return rows[0] || { total: 0, promedio: 0 };
    }

    static async listarPorUsuario(usuarioId) {
        const [rows] = await pool.query(
            `SELECT r.*, l.titulo AS libro_titulo, l.autor AS libro_autor
             FROM resenas r
             JOIN libros l ON l.id = r.libro_id
             WHERE r.usuario_id = ?
             ORDER BY r.fecha_creacion DESC`,
            [usuarioId]
        );
        return rows;
    }

    static async listarTodas(filtros = {}) {
        let query = `SELECT r.*, u.nombre AS usuario_nombre, l.titulo AS libro_titulo
                     FROM resenas r
                     JOIN usuarios u ON u.id = r.usuario_id
                     JOIN libros l ON l.id = r.libro_id
                     WHERE 1 = 1`;
        const params = [];

        if (filtros.libroId) {
            query += ' AND r.libro_id = ?';
            params.push(filtros.libroId);
        }

        if (filtros.calMin) {
            query += ' AND r.calificacion >= ?';
            params.push(filtros.calMin);
        }

        if (filtros.calMax) {
            query += ' AND r.calificacion <= ?';
            params.push(filtros.calMax);
        }

        if (filtros.fechaInicio) {
            query += ' AND DATE(r.fecha_creacion) >= ?';
            params.push(filtros.fechaInicio);
        }

        if (filtros.fechaFin) {
            query += ' AND DATE(r.fecha_creacion) <= ?';
            params.push(filtros.fechaFin);
        }

        query += ' ORDER BY r.fecha_creacion DESC';

        const [rows] = await pool.query(query, params);
        return rows;
    }

    static async obtenerContextoUsuarioLibro(usuarioId, libroId) {
        const connection = await pool.getConnection();
        try {
            const [prestamos] = await connection.execute(
                `SELECT p.id, p.estado, p.fecha_devolucion_real
                 FROM prestamos p
                 WHERE p.usuario_id = ? AND p.libro_id = ?
                 ORDER BY p.fecha_prestamo DESC`,
                [usuarioId, libroId]
            );

            if (!prestamos.length) {
                return { prestamoElegibleId: null, resenaEditable: null };
            }

            const prestamoIds = prestamos.map(p => p.id);
            const [resenas] = await connection.query(
                `SELECT * FROM resenas
                 WHERE usuario_id = ? AND libro_id = ?
                 ORDER BY fecha_creacion DESC`,
                [usuarioId, libroId]
            );

            const resenasPorPrestamo = new Map();
            resenas.forEach(resena => {
                resenasPorPrestamo.set(resena.prestamo_id, resena);
            });

            const elegible = prestamos.find(prestamo => {
                const estadoPermitido = prestamo.estado === 'activo' || prestamo.fecha_devolucion_real !== null;
                return estadoPermitido && !resenasPorPrestamo.has(prestamo.id);
            });

            return {
                prestamoElegibleId: elegible ? elegible.id : null,
                resenaEditable: resenas[0] || null
            };
        } finally {
            connection.release();
        }
    }

    static async verificarPrestamoDisponible(prestamoId, usuarioId) {
        const [rows] = await pool.query(
            `SELECT p.id, p.usuario_id, p.libro_id, p.estado, p.fecha_devolucion_real
             FROM prestamos p
             WHERE p.id = ? AND p.usuario_id = ?
             LIMIT 1`,
            [prestamoId, usuarioId]
        );
        if (!rows.length) return null;
        const prestamo = rows[0];
        const estadoPermitido = prestamo.estado === 'activo' || prestamo.fecha_devolucion_real !== null;
        return estadoPermitido ? prestamo : null;
    }

    static async existeResenaParaPrestamo(prestamoId) {
        const [rows] = await pool.query(
            'SELECT id FROM resenas WHERE prestamo_id = ? LIMIT 1',
            [prestamoId]
        );
        return rows[0] || null;
    }

    static async listarLibrosElegibles(usuarioId) {
        const [rows] = await pool.query(
            `SELECT DISTINCT l.id, l.titulo
             FROM prestamos p
             JOIN libros l ON l.id = p.libro_id
             WHERE p.usuario_id = ?
             AND (p.estado = 'activo' OR p.fecha_devolucion_real IS NOT NULL)
             ORDER BY l.titulo ASC`,
            [usuarioId]
        );
        return rows;
    }

    static async listarLibrosConResenas() {
        const [rows] = await pool.query(
            `SELECT DISTINCT l.id, l.titulo
             FROM resenas r
             JOIN libros l ON l.id = r.libro_id
             ORDER BY l.titulo ASC`
        );
        return rows;
    }

    static async obtenerResumenPorLibros(libroIds = []) {
        if (!Array.isArray(libroIds) || libroIds.length === 0) {
            return {};
        }
        const [rows] = await pool.query(
            `SELECT libro_id, COUNT(*) AS total, AVG(calificacion) AS promedio
             FROM resenas
             WHERE libro_id IN (?)
             GROUP BY libro_id`,
            [libroIds]
        );
        return rows.reduce((acc, row) => {
            acc[row.libro_id] = {
                total: row.total,
                promedio: row.promedio
            };
            return acc;
        }, {});
    }
}

module.exports = ResenaModel;
