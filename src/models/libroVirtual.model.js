// src/models/libroVirtual.model.js
const { pool } = require('../config/database'); // <--- así, no ../config/db

const LibroVirtual = {
  async findOrCreateByVolume(data) {
    const {
      google_volume_id,
      titulo,
      autor,
      editorial,
      isbn,
      categoria,
      anio_publicacion,
      portada_url,
      preview_link,
      descripcion,
    } = data;

    const [rows] = await pool.query(
      'SELECT * FROM libros_virtuales WHERE google_volume_id = ?',
      [google_volume_id]
    );

    if (rows.length > 0) {
      return rows[0];
    }

    const [result] = await pool.query(
      `INSERT INTO libros_virtuales
        (google_volume_id, titulo, autor, editorial, isbn, categoria, anio_publicacion, portada_url, preview_link, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        google_volume_id,
        titulo,
        autor,
        editorial,
        isbn,
        categoria,
        anio_publicacion,
        portada_url,
        preview_link,
        descripcion,
      ]
    );

    const [inserted] = await pool.query(
      'SELECT * FROM libros_virtuales WHERE id = ?',
      [result.insertId]
    );

    return inserted[0];
  },
};

module.exports = LibroVirtual;
