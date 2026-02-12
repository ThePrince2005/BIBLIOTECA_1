const { pool } = require('../config/database');

class Libro {
    /**
     * Crear un nuevo libro
     * @param {Object} libroData - Datos del libro
     * @returns {Promise} Resultado de la creación
     */
    static async crear(libroData) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO libros (
                    titulo, autor, editorial, isbn, area, 
                    grado_recomendado, anio_publicacion, 
                    ejemplares_totales, ejemplares_disponibles,
                    ubicacion, descripcion, palabras_clave, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    libroData.titulo,
                    libroData.autor,
                    libroData.editorial,
                    libroData.isbn,
                    libroData.area,
                    libroData.grado_recomendado,
                    libroData.anio_publicacion,
                    libroData.ejemplares_totales,
                    libroData.ejemplares_totales, // Inicialmente disponibles = totales
                    libroData.ubicacion,
                    libroData.descripcion,
                    libroData.palabras_clave
                    , libroData.estado || 'disponible'
                ]
            );
            return result.insertId;
        } finally {
            connection.release();
        }
    }

    /**
     * Buscar libro por ID
     * @param {number} id - ID del libro
     * @returns {Promise} Libro encontrado
     */
    static async buscarPorId(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM libros WHERE id = ?',
                [id]
            );
            return rows[0];
        } finally {
            connection.release();
        }
    }

    /**
     * Buscar libros con filtros
     * @param {Object} filtros - Criterios de búsqueda
     * @param {number} pagina - Número de página
     * @param {number} porPagina - Elementos por página
     * @returns {Promise} Lista de libros y total
     */
    static async buscar(filtros = {}, pagina = 1, porPagina = 10) {
        const connection = await pool.getConnection();
        try {
            let query = "SELECT * FROM libros WHERE estado != 'eliminado'";
            let countQuery = "SELECT COUNT(*) as total FROM libros WHERE estado != 'eliminado'";
            const valores = [];
            const condiciones = [];

            // Aplicar filtros
            if (filtros.titulo) {
                const palabras = filtros.titulo.trim().split(/\s+/);
                palabras.forEach(palabra => {
                    condiciones.push('titulo LIKE ?');
                    valores.push(`%${palabra}%`);
                });
            }
            if (filtros.autor) {
                condiciones.push('autor LIKE ?');
                valores.push(`%${filtros.autor}%`);
            }
            if (filtros.area) {
                condiciones.push('area = ?');
                valores.push(filtros.area);
            }
            if (filtros.palabrasClave) {
                condiciones.push('MATCH(titulo, autor, descripcion, palabras_clave) AGAINST(? IN BOOLEAN MODE)');
                valores.push(filtros.palabrasClave);
            }

            // Agregar condiciones a las queries
            if (condiciones.length > 0) {
                const whereClause = ' AND ' + condiciones.join(' AND ');
                query += whereClause;
                countQuery += whereClause;
            }

            // Obtener total de resultados
            const [countRows] = await connection.execute(countQuery, valores);
            const total = countRows[0].total;

            // Agregar paginación
            // Agregar paginación (Interpolar directamente para evitar error ER_WRONG_ARGUMENTS)
            const limit = parseInt(porPagina) || 10;
            const offset = Math.max(0, (parseInt(pagina) || 1) - 1) * limit;
            query += ` LIMIT ${limit} OFFSET ${offset}`;
            // valores.push(limit, offset); // NO agregar a valores para prepared statements

            // Ejecutar búsqueda
            const [rows] = await connection.execute(query, valores);

            return {
                libros: rows,
                total,
                paginas: Math.ceil(total / porPagina)
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Actualizar datos del libro
     * @param {number} id - ID del libro
     * @param {Object} libroData - Datos a actualizar
     * @returns {Promise} Resultado de la actualización
     */
    static async actualizar(id, libroData) {
        const connection = await pool.getConnection();
        try {
            const actualizables = [
                'titulo', 'autor', 'editorial', 'isbn', 'area',
                'grado_recomendado', 'anio_publicacion', 'ejemplares_totales',
                'ubicacion', 'descripcion', 'palabras_clave', 'estado'
            ];
            const updates = [];
            const valores = [];

            actualizables.forEach(campo => {
                if (libroData[campo] !== undefined) {
                    updates.push(`${campo} = ?`);
                    valores.push(libroData[campo]);
                }
            });

            // Si se actualizan los ejemplares totales, ajustar disponibles
            if (libroData.ejemplares_totales !== undefined) {
                const libro = await this.buscarPorId(id);
                const diferencia = libroData.ejemplares_totales - libro.ejemplares_totales;
                updates.push('ejemplares_disponibles = ejemplares_disponibles + ?');
                valores.push(diferencia);
            }

            valores.push(id);

            const [result] = await connection.execute(
                `UPDATE libros SET ${updates.join(', ')} WHERE id = ?`,
                valores
            );

            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    /**
     * Eliminar libro
     * @param {number} id - ID del libro
     * @returns {Promise} Resultado de la eliminación
     */
    static async eliminar(id) {
        const connection = await pool.getConnection();
        try {
            // Verificar si hay préstamos activos
            const [prestamos] = await connection.execute(
                "SELECT COUNT(*) as total FROM prestamos WHERE libro_id = ? AND estado = 'activo'",
                [id]
            );

            if (prestamos[0].total > 0) {
                throw new Error('No se puede eliminar el libro porque tiene préstamos activos');
            }

            // Verificar si el libro está en favoritos
            const [favoritos] = await connection.execute(
                'SELECT COUNT(*) as total FROM favoritos WHERE libro_id = ?',
                [id]
            );

            if (favoritos[0].total > 0) {
                throw new Error('No se puede eliminar el libro porque está marcado como favorito por uno o más usuarios.');
            }

            // Perform Soft Delete
            const [result] = await connection.execute(
                "UPDATE libros SET estado = 'eliminado', ejemplares_disponibles = 0 WHERE id = ?",
                [id]
            );

            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    /**
     * Obtener áreas únicas de libros
     * @returns {Promise} Lista de áreas
     */
    static async obtenerAreas() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT DISTINCT area FROM libros ORDER BY area'
            );
            return rows.map(row => row.area);
        } finally {
            connection.release();
        }
    }

    /**
     * Verificar disponibilidad de un libro
     * @param {number} id - ID del libro
     * @returns {Promise} Estado de disponibilidad
     */
    static async verificarDisponibilidad(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT ejemplares_disponibles FROM libros WHERE id = ?',
                [id]
            );
            return rows[0]?.ejemplares_disponibles > 0;
        } finally {
            connection.release();
        }
    }
}

module.exports = Libro;