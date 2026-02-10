const db = require('../config/database');

const FavoritoModel = {
    /**
     * Agregar un libro a favoritos
     */
    async agregar(usuario_id, libro_id) {
        const connection = await db.pool.getConnection();
        try {
            // Verificar si el libro existe
            const [libro] = await connection.execute(
                'SELECT id FROM libros WHERE id = ?',
                [libro_id]
            );

            if (!libro[0]) {
                throw new Error('El libro no existe');
            }

            // Verificar si ya está en favoritos para este usuario
            const [existing] = await connection.execute(
                'SELECT id FROM favoritos WHERE usuario_id = ? AND libro_id = ?',
                [usuario_id, libro_id]
            );

            if (existing[0]) {
                // Ya existe: devolver el id existente sin intentar insertar
                return existing[0].id;
            }

            const [result] = await connection.execute(
                'INSERT INTO favoritos (usuario_id, libro_id, created_at) VALUES (?, ?, NOW())',
                [usuario_id, libro_id]
            );
            return result.insertId;
        } catch (error) {
            // Errores inesperados
            throw error;
        } finally {
            // Liberar la conexion al pool
            try { connection.release(); } catch (e) { /* ignore */ }
        }
    },

    /**
     * Eliminar un libro de favoritos
     */
    async eliminar(usuario_id, libro_id) {
        const [result] = await db.pool.query(
            'DELETE FROM favoritos WHERE usuario_id = ? AND libro_id = ?',
            [usuario_id, libro_id]
        );
        return result.affectedRows > 0;
    },

    /**
     * Obtener todos los favoritos de un usuario
     */
    async obtenerPorUsuario(usuario_id) {
        const [favoritos] = await db.pool.query(`
            SELECT 
                f.id,
                f.created_at as fecha_agregado,
                l.id as libro_id,
                l.titulo,
                l.autor,
                '' as portada_url,
                (l.ejemplares_disponibles > 0) as disponible,
                COALESCE(l.area, '') as categoria
            FROM favoritos f
            JOIN libros l ON f.libro_id = l.id
            WHERE f.usuario_id = ?
            ORDER BY f.created_at DESC
        `, [usuario_id]);
        return favoritos;
    },

    /**
     * Verificar si un libro está en favoritos
     */
    async esFavorito(usuario_id, libro_id) {
        const [favoritos] = await db.pool.query(
            'SELECT 1 FROM favoritos WHERE usuario_id = ? AND libro_id = ?',
            [usuario_id, libro_id]
        );
        return favoritos.length > 0;
    },

    /**
     * Obtener estadísticas de favoritos
     */
    async obtenerEstadisticas(usuario_id) {
        // 1. Total de favoritos y categorías
        const [statsFavoritos] = await db.pool.query(`
            SELECT 
                COUNT(*) as total_favoritos,
                COUNT(DISTINCT COALESCE(l.area, '')) as categorias_diferentes
            FROM favoritos f
            JOIN libros l ON f.libro_id = l.id
            WHERE f.usuario_id = ?
        `, [usuario_id]);

        // 2. Total de lecturas (físicas)
        const [statsFisicos] = await db.pool.query(`
            SELECT COUNT(*) as total 
            FROM prestamos 
            WHERE usuario_id = ? AND fecha_devolucion_real IS NOT NULL
        `, [usuario_id]);

        // 3. Total de lecturas (virtuales)
        // Verificar nombre de tabla correcto (asumiendo 'libros_leidos' o similar, ajustaré si grep dice otra cosa)
        // Por seguridad, usaré un try/catch en este bloque específico si dudo de la tabla, 
        // pero mejor corregiré basado en grep. 
        // ASUMIENDO 'libros_leidos' POR AHORA, pero        // 3. Total de lecturas (virtuales)
        const [statsVirtuales] = await db.pool.query(`
            SELECT COUNT(*) as total FROM lecturas_virtuales WHERE usuario_id = ?
        `, [usuario_id]);

        return {
            total_favoritos: statsFavoritos[0].total_favoritos || 0,
            categorias_diferentes: statsFavoritos[0].categorias_diferentes || 0,
            favoritos_leidos: (statsFisicos[0].total || 0) + (statsVirtuales[0].total || 0)
        };
    },

    /**
     * Obtener IDs de libros favoritos de un usuario
     */
    async obtenerIdsPorUsuario(usuario_id) {
        const [rows] = await db.pool.query(
            'SELECT libro_id FROM favoritos WHERE usuario_id = ?',
            [usuario_id]
        );
        return rows.map(row => row.libro_id);
    }
};

module.exports = FavoritoModel;