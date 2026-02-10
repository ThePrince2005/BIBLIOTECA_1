const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    /**
     * Envía un correo electrónico genérico.
     * @param {string} destinatario - El email del destinatario.
     * @param {string} asunto - El asunto del correo.
     * @param {string} html - El contenido HTML del correo.
     * @returns {Promise<boolean>} - True si el correo se envió, de lo contrario false.
     */
    async enviarEmail(destinatario, asunto, html) {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: asunto,
            html: html
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Correo enviado a: ${destinatario} con asunto: "${asunto}"`);
            return true;
        } catch (error) {
            console.error(`Error al enviar correo a ${destinatario}:`, error);
            return false;
        }
    }

    async enviarEmailRecuperacion(email, token) {
        const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${token}`;
        
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Recuperación de contraseña - Biblioteca Escolar',
            html: `
                <h1>Recuperación de contraseña</h1>
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>Este enlace expirará en 1 hora.</p>
                <p>Si no solicitaste este cambio, ignora este correo.</p>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('Email de recuperación enviado a:', email);
            return true;
        } catch (error) {
            console.error('Error al enviar email de recuperación:', error);
            return false;
        }
    }

    async enviarEmailBienvenida(email, nombre) {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: '¡Bienvenido a la Biblioteca Escolar!',
            html: `
                <h1>¡Bienvenido ${nombre}!</h1>
                <p>Tu cuenta ha sido creada exitosamente.</p>
                <p>Ya puedes acceder a la biblioteca digital y disfrutar de todos nuestros servicios.</p>
                <a href="${process.env.APP_URL}/auth/login">Iniciar sesión</a>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('Email de bienvenida enviado a:', email);
            return true;
        } catch (error) {
            console.error('Error al enviar email de bienvenida:', error);
            return false;
        }
    }
}

module.exports = new EmailService();