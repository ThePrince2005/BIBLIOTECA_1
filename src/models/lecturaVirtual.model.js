// src/models/lecturaVirtual.model.js
const { pool } = require('../config/database');

const LecturaVirtual = {
  async registrarLectura(usuarioId, libroVirtualId) {
    const [result] = await pool.query(
      `INSERT INTO lecturas_virtuales (usuario_id, libro_virtual_id, fecha_lectura)
       VALUES (?, ?, NOW())`,
      [usuarioId, libroVirtualId]
    );
    return result.insertId;
  },

  /**
   * Obtener libros virtuales leídos por un usuario
   */
  async obtenerLibrosLeidos(usuarioId) {
    try {
      // Consulta básica sin columnas de validación (funciona siempre)
      const [rows] = await pool.query(
        `SELECT lv.id, lv.libro_virtual_id, lv.fecha_lectura,
                lv_meta.titulo, lv_meta.autor, lv_meta.portada_url, lv_meta.categoria
         FROM lecturas_virtuales lv
         JOIN libros_virtuales lv_meta ON lv.libro_virtual_id = lv_meta.id
         WHERE lv.usuario_id = ?
         ORDER BY lv.fecha_lectura DESC`,
        [usuarioId]
      );
      
      // Intentar obtener columnas de validación si existen
      let tieneColumnasValidacion = false;
      try {
        const [columns] = await pool.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'lecturas_virtuales' 
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
           FROM lecturas_virtuales 
           WHERE id IN (${placeholders})`,
          ids
        );
        
        const validacionesMap = {};
        validaciones.forEach(v => {
          validacionesMap[v.id] = v;
        });

        return rows.map(row => ({
          ...row,
          created_at: row.fecha_lectura,
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
        created_at: row.fecha_lectura,
        validado: false,
        fecha_validacion: null,
        opinion_libro: null,
        resumen_libro: null,
        personajes_principales: null,
        tema_principal: null,
        lecciones_aprendidas: null
      }));
    } catch (error) {
      console.error('Error en obtenerLibrosLeidos (virtual):', error);
      return [];
    }
  },

  /**
   * Validar una lectura virtual con cuestionario
   */
  async validarLectura(lecturaId, datosValidacion) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Verificar que la lectura existe
      const [lecturas] = await connection.execute(
        'SELECT id, usuario_id FROM lecturas_virtuales WHERE id = ?',
        [lecturaId]
      );

      if (!lecturas || lecturas.length === 0) {
        throw new Error('Lectura virtual no encontrada');
      }

      // Verificar si las columnas de validación existen
      let tieneColumnasValidacion = false;
      try {
        const [columns] = await connection.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'lecturas_virtuales' 
           AND COLUMN_NAME = 'validado'`
        );
        tieneColumnasValidacion = columns.length > 0;
      } catch (e) {
        console.warn('No se pudo verificar columnas de validación:', e.message);
      }

      if (tieneColumnasValidacion) {
        // Actualizar con datos de validación
        await connection.execute(
          `UPDATE lecturas_virtuales 
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
            lecturaId
          ]
        );
      } else {
        // Si las columnas no existen, solo registrar que se intentó validar
        console.warn('Las columnas de validación no existen. Ejecuta la migración 20250115_add_validacion_libros.sql');
        throw new Error('Las columnas de validación no existen en la base de datos. Por favor, ejecuta la migración primero.');
      }

      await connection.commit();
      return { success: true, lectura_id: lecturaId };
    } catch (err) {
      await connection.rollback();
      console.error('Error al validar lectura virtual:', err);
      throw err;
    } finally {
      connection.release();
    }
  },
};

module.exports = LecturaVirtual;
