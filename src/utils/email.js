const nodemailer = require('nodemailer');

// Configurar el transportador de correo
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const emailService = {
    /**
     * Enviar un correo electrónico
     * @param {Object} options - Opciones del correo
     * @param {string|string[]} options.to - Destinatario(s)
     * @param {string} options.subject - Asunto del correo
     * @param {string} options.html - Contenido HTML del correo
     */
    async enviarCorreo({ to, subject, html }) {
        try {
            const mailOptions = {
                from: `"Biblioteca Escolar" <${process.env.SMTP_USER}>`,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('Correo enviado:', info.messageId);
            return info;
        } catch (error) {
            console.error('Error al enviar correo:', error);
            throw error;
        }
    },

    /**
     * Enviar una notificación con plantilla predeterminada
     */
    async enviarNotificacion(to, titulo, mensaje, tipo = 'info') {
        const templateHtml = `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${titulo}</h1>
                    </div>
                    <div class="content">
                        <div class="${tipo}">
                            ${mensaje}
                        </div>
                    </div>
                    <div class="footer">
                        <p>Este es un mensaje automático del sistema de Biblioteca Escolar</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.enviarCorreo({
            to,
            subject: titulo,
            html: templateHtml
        });
    }
};

module.exports = emailService;