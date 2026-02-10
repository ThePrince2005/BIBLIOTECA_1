const db = require('../config/database');
const auditoria = require('./auditoria.model');

const GradoEstudianteModel = {
    // Constantes para los grados
    GRADOS: {
        INICIAL_3: 'INICIAL_3',
        INICIAL_4: 'INICIAL_4',
        INICIAL_5: 'INICIAL_5',
        PRIMERO: 'PRIMERO',
        SEGUNDO: 'SEGUNDO',
        TERCERO: 'TERCERO',
        CUARTO: 'CUARTO',
        QUINTO: 'QUINTO',
        SEXTO: 'SEXTO',
        GRADUADO: 'GRADUADO'
    },

    // Orden de progresión de grados
    ORDEN_GRADOS: [
        'INICIAL_3',
        'INICIAL_4',
        'INICIAL_5',
        'PRIMERO',
        'SEGUNDO',
        'TERCERO',
        'CUARTO',
        'QUINTO',
        'SEXTO',
        'GRADUADO'
    ],

    /**
     * Obtener el siguiente grado en la secuencia
     */
    obtenerSiguienteGrado(gradoActual) {
        const indiceActual = this.ORDEN_GRADOS.indexOf(gradoActual);
        if (indiceActual === -1 || indiceActual === this.ORDEN_GRADOS.length - 1) {
            return null;
        }
        return this.ORDEN_GRADOS[indiceActual + 1];
    },

    /**
     * Verificar si un estudiante es elegible para promoción
     */
    async esElegibleParaPromocion(estudianteId) {
        try {
            const [estudiante] = await db.pool.query(
                'SELECT * FROM usuarios WHERE id = ? AND rol = "ESTUDIANTE"',
                [estudianteId]
            );

            if (!estudiante || estudiante.length === 0) {
                return false;
            }

            // Verificar si el estudiante ya está graduado
            if (estudiante[0].grado === this.GRADOS.GRADUADO) {
                return false;
            }

            // Aquí podrías agregar más validaciones según tus requisitos
            // Por ejemplo, verificar calificaciones, asistencia, etc.

            return true;
        } catch (error) {
            console.error('Error al verificar elegibilidad:', error);
            return false;
        }
    },

    /**
     * Actualizar el grado de un estudiante
     */
    async actualizarGrado(estudianteId) {
        try {
            // Obtener información actual del estudiante
            const [estudiante] = await db.pool.query(
                'SELECT * FROM usuarios WHERE id = ? AND rol = "ESTUDIANTE"',
                [estudianteId]
            );

            if (!estudiante || estudiante.length === 0) {
                throw new Error('Estudiante no encontrado');
            }

            const estudianteActual = estudiante[0];
            const siguienteGrado = this.obtenerSiguienteGrado(estudianteActual.grado);

            if (!siguienteGrado) {
                throw new Error('No hay siguiente grado disponible');
            }

            // Verificar elegibilidad
            if (!await this.esElegibleParaPromocion(estudianteId)) {
                throw new Error('Estudiante no elegible para promoción');
            }

            // Actualizar el grado
            await db.pool.query(
                'UPDATE usuarios SET grado = ? WHERE id = ?',
                [siguienteGrado, estudianteId]
            );

            // Registrar en auditoría
            await auditoria.registrar(
                'ACTUALIZAR_GRADO',
                'USUARIO',
                estudianteId,
                null,
                {
                    grado_anterior: estudianteActual.grado,
                    grado_nuevo: siguienteGrado,
                    tipo_actualizacion: 'AUTOMATICA',
                    fecha_actualizacion: new Date()
                }
            );

            return {
                estudianteId,
                gradoAnterior: estudianteActual.grado,
                gradoNuevo: siguienteGrado
            };
        } catch (error) {
            console.error('Error al actualizar grado:', error);
            throw error;
        }
    },

    /**
     * Actualizar grados de todos los estudiantes elegibles
     */
    async actualizarGradosMasivamente(fechaCorte = new Date()) {
        try {
            // Obtener todos los estudiantes activos
            const [estudiantes] = await db.pool.query(
                'SELECT id, nombre, grado FROM usuarios WHERE rol = "estudiante" AND grado IS NOT NULL'
            );

            const resultados = {
                exitosos: [],
                fallidos: []
            };

            // Procesar cada estudiante
            for (const estudiante of estudiantes) {
                try {
                    if (await this.esElegibleParaPromocion(estudiante.id)) {
                        const resultado = await this.actualizarGrado(estudiante.id);
                        resultados.exitosos.push(resultado);
                    }
                } catch (error) {
                    resultados.fallidos.push({
                        estudianteId: estudiante.id,
                        nombre: estudiante.nombre,
                        error: error.message
                    });
                }
            }

            // Registrar el proceso completo en auditoría
            await auditoria.registrar(
                'ACTUALIZACION_MASIVA_GRADOS',
                'SISTEMA',
                null,
                null,
                {
                    fecha_corte: fechaCorte,
                    estudiantes_actualizados: resultados.exitosos.length,
                    estudiantes_fallidos: resultados.fallidos.length,
                    detalles: resultados
                }
            );

            return resultados;
        } catch (error) {
            console.error('Error en actualización masiva de grados:', error);
            throw error;
        }
    },

    /**
     * Obtener estadísticas de grados
     */
    async obtenerEstadisticas() {
        try {
            const [estadisticas] = await db.pool.query(`
                SELECT 
                    grado,
                    COUNT(*) as total_estudiantes,
                    SUM(CASE WHEN genero = 'M' THEN 1 ELSE 0 END) as masculino,
                    SUM(CASE WHEN genero = 'F' THEN 1 ELSE 0 END) as femenino
                FROM usuarios 
                WHERE rol = 'ESTUDIANTE'
                GROUP BY grado
                ORDER BY FIELD(grado, ${this.ORDEN_GRADOS.map(g => `'${g}'`).join(', ')})
            `);

            return estadisticas;
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            throw error;
        }
    }
};

module.exports = GradoEstudianteModel;