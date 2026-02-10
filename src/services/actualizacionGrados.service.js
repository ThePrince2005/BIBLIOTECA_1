const cron = require('node-cron');
const GradoEstudianteModel = require('../models/gradoEstudiante.model');
const auditoria = require('../models/auditoria.model');

class ActualizacionGradosService {
    constructor() {
        // Programar la actualización automática para ejecutarse
        // el 1 de marzo a las 00:01 AM de cada año (inicio del año escolar en Perú)
        this.cronExpression = '1 0 1 3 *';
        this.job = null;
        this.iniciar();
    }

    /**
     * Iniciar el servicio de actualización automática
     */
    iniciar() {
        try {
            this.job = cron.schedule(this.cronExpression, async () => {
                console.log('Iniciando actualización automática de grados...');
                
                try {
                    // Ejecutar la actualización masiva
                    const resultados = await GradoEstudianteModel.actualizarGradosMasivamente();
                    
                    // Registrar el resultado en auditoría
                    await auditoria.registrar(
                        'EJECUCION_AUTOMATICA_GRADOS',
                        'SISTEMA',
                        null,
                        null,
                        {
                            fecha_ejecucion: new Date(),
                            resultados: resultados,
                            estado: 'COMPLETADO'
                        }
                    );

                    console.log('Actualización de grados completada:', resultados);
                } catch (error) {
                    console.error('Error en la actualización automática:', error);
                    
                    // Registrar el error en auditoría
                    await auditoria.registrar(
                        'ERROR_ACTUALIZACION_GRADOS',
                        'SISTEMA',
                        null,
                        null,
                        {
                            fecha_error: new Date(),
                            error: error.message,
                            estado: 'ERROR'
                        }
                    );
                }
            }, {
                scheduled: true,
                timezone: "America/Lima" // Ajustar según tu zona horaria
            });

            console.log('Servicio de actualización de grados iniciado correctamente');
            return true;
        } catch (error) {
            console.error('Error al iniciar el servicio:', error);
            return false;
        }
    }

    /**
     * Detener el servicio de actualización automática
     */
    detener() {
        if (this.job) {
            this.job.stop();
            console.log('Servicio de actualización de grados detenido');
            return true;
        }
        return false;
    }

    /**
     * Ejecutar una actualización manual
     */
    async ejecutarActualizacionManual() {
        try {
            console.log('Iniciando actualización manual de grados...');
            
            // Registrar inicio de la actualización manual
            await auditoria.registrar(
                'INICIO_ACTUALIZACION_MANUAL',
                'SISTEMA',
                null,
                null,
                {
                    fecha_inicio: new Date(),
                    tipo: 'MANUAL'
                }
            );

            // Ejecutar la actualización
            const resultados = await GradoEstudianteModel.actualizarGradosMasivamente();

            // Registrar finalización exitosa
            await auditoria.registrar(
                'FIN_ACTUALIZACION_MANUAL',
                'SISTEMA',
                null,
                null,
                {
                    fecha_fin: new Date(),
                    resultados: resultados,
                    estado: 'COMPLETADO'
                }
            );

            return resultados;
        } catch (error) {
            console.error('Error en actualización manual:', error);
            
            // Registrar el error
            await auditoria.registrar(
                'ERROR_ACTUALIZACION_MANUAL',
                'SISTEMA',
                null,
                null,
                {
                    fecha_error: new Date(),
                    error: error.message,
                    estado: 'ERROR'
                }
            );

            throw error;
        }
    }

    /**
     * Verificar el estado del servicio
     */
    obtenerEstado() {
        return {
            activo: this.job !== null,
            proximaEjecucion: this.job ? this.job.nextDate() : null,
            configuracion: {
                expresionCron: this.cronExpression,
                zonaHoraria: "America/Lima"
            }
        };
    }
}

// Exportar una única instancia del servicio
module.exports = new ActualizacionGradosService();