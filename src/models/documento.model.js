const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

class Documento {
    // Subir un nuevo documento
    static async crear(documento) {
        try {
            const [result] = await pool.execute(
                'INSERT INTO documentos (titulo, descripcion, nombre_archivo, ruta_archivo, tipo_archivo, tamanio, id_usuario, tipo_documento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    documento.titulo,
                    documento.descripcion || null,
                    documento.nombre_archivo,
                    documento.ruta_archivo,
                    documento.tipo_archivo,
                    documento.tamanio,
                    documento.id_usuario,
                    documento.tipo_documento || 'otro'
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error al crear documento:', error);
            throw error;
        }
    }

    // Obtener todos los documentos
    static async obtenerTodos() {
        try {
            const [documentos] = await pool.execute(
                'SELECT d.*, u.nombre as nombre_usuario, d.id as id_documento FROM documentos d JOIN usuarios u ON d.id_usuario = u.id ORDER BY d.fecha_subida DESC'
            );
            return documentos;
        } catch (error) {
            console.error('Error al obtener documentos:', error);
            throw error;
        }
    }

    // Obtener documento por ID
    static async obtenerPorId(id) {
        try {
            const [documentos] = await pool.execute(
                'SELECT * FROM documentos WHERE id = ?',
                [id]
            );
            return documentos[0] || null;
        } catch (error) {
            console.error('Error al obtener documento por ID:', error);
            throw error;
        }
    }

    // Eliminar documento
    static async eliminar(id) {
        try {
            // Primero obtenemos la ruta del archivo
            const documento = await this.obtenerPorId(id);
            if (!documento) {
                throw new Error('Documento no encontrado');
            }

            // Eliminamos el registro de la base de datos
            const [result] = await pool.execute(
                'DELETE FROM documentos WHERE id = ?',
                [id]
            );

            // Si se eliminó correctamente, eliminamos el archivo físico
            if (result.affectedRows > 0) {
                try {
                    const filePath = path.join(__dirname, '../..', 'public', documento.ruta_archivo);
                    await fs.unlink(filePath);
                } catch (err) {
                    console.error('Error al eliminar archivo físico:', err);
                    // No lanzamos el error para no interrumpir el flujo si falla la eliminación del archivo
                }
            }

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error al eliminar documento:', error);
            throw error;
        }
    }

    // Obtener documentos por tipo
    static async obtenerPorTipo(tipo) {
        try {
            const [documentos] = await pool.execute(
                'SELECT d.*, u.nombre as nombre_usuario FROM documentos d JOIN usuarios u ON d.id_usuario = u.id WHERE d.tipo_documento = ? ORDER BY d.fecha_subida DESC',
                [tipo]
            );
            return documentos;
        } catch (error) {
            console.error('Error al obtener documentos por tipo:', error);
            throw error;
        }
    }
}

module.exports = Documento;
