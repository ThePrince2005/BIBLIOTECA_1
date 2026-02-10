const { pool } = require('../config/database');

class DiccionarioModel {
    static async buscar(termino = '', pagina = 1, porPagina = 20) {
        const offset = (pagina - 1) * porPagina;
        let query = 'SELECT * FROM diccionario';
        let countQuery = 'SELECT COUNT(*) as total FROM diccionario';
        const params = [];

        if (termino) {
            const filtro = `%${termino}%`;
            query += ' WHERE termino LIKE ? OR definicion LIKE ?';
            countQuery += ' WHERE termino LIKE ? OR definicion LIKE ?';
            params.push(filtro, filtro);
        }

        query += ' ORDER BY termino ASC LIMIT ? OFFSET ?';
        params.push(porPagina, offset);

        const [rows] = await pool.query(query, params);
        const [totalRows] = await pool.query(countQuery, termino ? [params[0], params[1]] : []);

        return {
            terminos: rows,
            total: totalRows[0].total,
            paginas: Math.ceil(totalRows[0].total / porPagina)
        };
    }

    static async obtenerPorId(id) {
        const [rows] = await pool.query('SELECT * FROM diccionario WHERE id = ?', [id]);
        return rows[0];
    }

    static async crear(datos) {
        const { termino, definicion, ejemplo } = datos;
        const [result] = await pool.query(
            'INSERT INTO diccionario (termino, definicion, ejemplo) VALUES (?, ?, ?)',
            [termino, definicion, ejemplo]
        );
        return result.insertId;
    }

    static async actualizar(id, datos) {
        const { termino, definicion, ejemplo } = datos;
        const [result] = await pool.query(
            'UPDATE diccionario SET termino = ?, definicion = ?, ejemplo = ? WHERE id = ?',
            [termino, definicion, ejemplo, id]
        );
        return result.affectedRows > 0;
    }

    static async eliminar(id) {
        const [result] = await pool.query('DELETE FROM diccionario WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = DiccionarioModel;
