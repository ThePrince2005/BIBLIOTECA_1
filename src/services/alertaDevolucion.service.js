const cron = require('node-cron');
const PrestamoModel = require('../models/prestamo.model');
const emailService = require('./email.service'); // Corregido el path si es necesario
const auditoria = require('../models/auditoria.model');

class AlertaDevolucionService {
    constructor() {
        // Programar verificación diaria a las 8:00 AM
        this.cronExpression = '0 8 * * *';
        this.job = null;
    }

    /**
     * Iniciar el servicio de alertas
     */
    iniciar() {
        try {
            this.job = cron.schedule(this.cronExpression, async () => {
                console.log('Iniciando verificación de devoluciones pendientes...');
                
                try {
                    await this.verificarDevoluciones();
                } catch (error) {
                    console.error('Error en verificación de devoluciones:', error);
                    
                    // Registrar error en auditoría
                    await auditoria.registrar(
                        'ERROR_VERIFICACION_DEVOLUCIONES',
                        'SISTEMA',
                        null,
                        null,
                        {
                            error: error.message,
                            fecha: new Date()
                        }
                    );
                }
            }, {
                scheduled: true,
                timezone: "America/Lima"
            });

            console.log('Servicio de alertas de devolución iniciado');
            return true;
        } catch (error) {
            console.error('Error al iniciar servicio de alertas:', error);
            return false;
        }
    }

    /**
     * Detener el servicio de alertas
     */
    detener() {
        if (this.job) {
            this.job.stop();
            console.log('Servicio de alertas de devolución detenido');
            return true;
        }
        return false;
    }

    /**
     * Verificar devoluciones pendientes y enviar alertas
     */
    async verificarDevoluciones() {
        try {
            // Obtener préstamos próximos a vencer (2 días antes)
            const proximosVencer = await PrestamoModel.obtenerPrestamosProximosVencer(2);
            
            // Obtener préstamos vencidos
            const vencidos = await PrestamoModel.obtenerPrestamosVencidos();

            // Enviar alertas para próximos a vencer
            const alertasProximos = proximosVencer.map(prestamo => 
                this.enviarAlertaProximoVencer(prestamo)
            );

            // Enviar alertas para vencidos
            const alertasVencidos = vencidos.map(prestamo => 
                this.enviarAlertaVencido(prestamo)
            );
            
            await Promise.all([...alertasProximos, ...alertasVencidos]);
            // Marcar préstamos como vencidos
            if (vencidos.length > 0) {
                await PrestamoModel.marcarPrestamosVencidos(
                    vencidos.map(p => p.id)
                );

                // Registrar en auditoría
                await auditoria.registrar(
                    'PRESTAMOS_MARCADOS_VENCIDOS',
                    'SISTEMA',
                    null,
                    null,
                    {
                        total_vencidos: vencidos.length,
                        prestamos: vencidos.map(p => p.id)
                    }
                );
            }

            // Retornar estadísticas
            return {
                proximosVencer: proximosVencer.length,
                vencidos: vencidos.length,
                fechaVerificacion: new Date()
            };
        } catch (error) {
            console.error('Error en verificación:', error);
            throw error;
        }
    }

    /**
     * Enviar alerta de próximo vencimiento
     */
    async enviarAlertaProximoVencer(prestamo) {
        try {
            const diasRestantes = Math.ceil(
                (new Date(prestamo.fecha_devolucion_esperada) - new Date()) / (1000 * 60 * 60 * 24)
            );

            const asunto = 'Préstamo próximo a vencer';
            const html = `
                <h2>Recordatorio de Devolución</h2>
                <p>Hola ${prestamo.nombre_estudiante},</p>
                <p>Tu préstamo del libro "${prestamo.titulo}" vence en ${diasRestantes} días.</p>
                <p><strong>Detalles del préstamo:</strong></p>
                <ul>
                    <li>Libro: ${prestamo.titulo}</li>
                    <li>Fecha de préstamo: ${new Date(prestamo.fecha_prestamo).toLocaleDateString('es-PE')}</li>
                    <li>Fecha de devolución: ${new Date(prestamo.fecha_devolucion_esperada).toLocaleDateString('es-PE')}</li>
                </ul>
                <p>Por favor, asegúrate de devolver el libro a tiempo para evitar sanciones.</p>
            `;

            await emailService.enviarEmail(
                prestamo.email_estudiante,
                asunto,
                html
            );

            // Registrar en auditoría
            await auditoria.registrar(
                'ALERTA_PROXIMO_VENCER',
                'PRESTAMO',
                prestamo.id,
                null,
                {
                    dias_restantes: diasRestantes,
                    email_enviado: true
                }
            );
        } catch (error) {
            console.error('Error al enviar alerta de próximo vencimiento:', error);
            throw error;
        }
    }

    /**
     * Enviar alerta de préstamo vencido
     */
    async enviarAlertaVencido(prestamo) {
        try {
            const diasVencido = Math.abs(Math.floor(
                (new Date() - new Date(prestamo.fecha_devolucion_esperada)) / (1000 * 60 * 60 * 24)
            ));

            const asuntoEstudiante = 'URGENTE: Préstamo vencido';
            const htmlEstudiante = `
                <h2>Préstamo Vencido</h2>
                <p>Hola ${prestamo.nombre_estudiante},</p>
                <p>Tu préstamo del libro "${prestamo.titulo}" está vencido por ${diasVencido} días.</p>
                <p><strong>Detalles del préstamo:</strong></p>
                <ul>
                    <li>Libro: ${prestamo.titulo}</li>
                    <li>Fecha de préstamo: ${new Date(prestamo.fecha_prestamo).toLocaleDateString('es-PE')}</li>
                    <li>Fecha límite de devolución: ${new Date(prestamo.fecha_devolucion_esperada).toLocaleDateString('es-PE')}</li>
                </ul>
                <p>Por favor, devuelve el libro lo antes posible para evitar mayores sanciones.</p>
            `;

            const asuntoAdmin = `Préstamo vencido - ${prestamo.nombre_estudiante}`;
            const htmlAdmin = `
                <h2>Préstamo Vencido</h2>
                <p>El siguiente préstamo está vencido:</p>
                <ul>
                    <li>Estudiante: ${prestamo.nombre_estudiante}</li>
                    <li>Grado: ${prestamo.grado}</li>
                    <li>Libro: ${prestamo.titulo}</li>
                    <li>Días de retraso: ${diasVencido}</li>
                </ul>
            `;

            // Enviar al estudiante
            await Promise.all([
                emailService.enviarEmail(prestamo.email_estudiante, asuntoEstudiante, htmlEstudiante),
                emailService.enviarEmail(process.env.ADMIN_EMAIL, asuntoAdmin, htmlAdmin)
            ]);

            // Registrar en auditoría
            await auditoria.registrar(
                'ALERTA_VENCIDO',
                'PRESTAMO',
                prestamo.id,
                null,
                {
                    dias_vencido: diasVencido,
                    email_enviado: true
                }
            );
        } catch (error) {
            console.error('Error al enviar alerta de vencimiento:', error);
            throw error;
        }
    }
}

// Exportar una única instancia del servicio
module.exports = new AlertaDevolucionService();