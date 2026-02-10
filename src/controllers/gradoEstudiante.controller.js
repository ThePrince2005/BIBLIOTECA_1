const GradoEstudianteModel = require('../models/gradoEstudiante.model');
const actualizacionService = require('../services/actualizacionGrados.service');
const auditoria = require('../models/auditoria.model');

const GradoEstudianteController = {
    /**
     * Obtener estadísticas de grados
     */
    async obtenerEstadisticas(req, res) {
        try {
            const estadisticas = await GradoEstudianteModel.obtenerEstadisticas();
            res.json({ success: true, data: estadisticas });
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Error al obtener estadísticas de grados'
            });
        }
    },

    /**
     * Actualizar grado de un estudiante específico
     */
    async actualizarGradoEstudiante(req, res) {
        const { estudianteId } = req.params;

        try {
            // Verificar permisos
            if (!req.usuario || !['ADMIN', 'DIRECTOR'].includes(req.usuario.rol)) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'No tiene permisos para realizar esta acción'
                });
            }

            const resultado = await GradoEstudianteModel.actualizarGrado(estudianteId);

            // Registrar la acción manual en auditoría
            await auditoria.registrar(
                'ACTUALIZACION_MANUAL_GRADO',
                'USUARIO',
                estudianteId,
                req.usuario.id,
                resultado
            );

            res.json({ 
                success: true, 
                message: 'Grado actualizado correctamente',
                data: resultado
            });
        } catch (error) {
            console.error('Error al actualizar grado:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Error al actualizar grado'
            });
        }
    },

    /**
     * Ejecutar actualización masiva de grados
     */
    async ejecutarActualizacionMasiva(req, res) {
        try {
            // Verificar permisos
            if (!req.usuario || !['ADMIN', 'DIRECTOR'].includes(req.usuario.rol)) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'No tiene permisos para realizar esta acción'
                });
            }

            const resultados = await actualizacionService.ejecutarActualizacionManual();

            res.json({ 
                success: true, 
                message: 'Actualización masiva completada',
                data: resultados
            });
        } catch (error) {
            console.error('Error en actualización masiva:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Error en la actualización masiva'
            });
        }
    },

    /**
     * Obtener estado del servicio de actualización
     */
    async obtenerEstadoServicio(req, res) {
        try {
            // Verificar permisos
            if (!req.usuario || !['ADMIN', 'DIRECTOR'].includes(req.usuario.rol)) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'No tiene permisos para realizar esta acción'
                });
            }

            const estado = actualizacionService.obtenerEstado();
            res.json({ success: true, data: estado });
        } catch (error) {
            console.error('Error al obtener estado:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Error al obtener estado del servicio'
            });
        }
    }
};

module.exports = GradoEstudianteController;