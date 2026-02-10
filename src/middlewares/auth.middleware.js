const jwt = require('jsonwebtoken');

/**
 * Middleware para verificar el token JWT
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Siguiente middleware
 */
const verifyToken = (req, res, next) => {
    const token = req.cookies.token || req.headers['x-access-token'];

    if (!token) {
        return res.status(403).json({ message: 'Se requiere un token para la autenticación' });
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET no está configurado');
            return res.status(500).json({ message: 'Error de configuración del servidor' });
        }
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expirado. Por favor, inicia sesión nuevamente.' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token inválido' });
        }
        return res.status(401).json({ message: 'Error al verificar el token' });
    }
};

/**
 * Middleware para verificar roles de usuario
 * @param {Array} roles - Array de roles permitidos
 */
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Se requiere autenticación' });
        }

        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ message: 'No tienes permiso para realizar esta acción' });
        }

        next();
    };
};

// Adjuntar usuario desde token si existe (no bloqueante)
const attachUser = (req, res, next) => {
    const token = (req.cookies && req.cookies.token) || req.headers['x-access-token'];
    if (!token) return next();
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET no está configurado');
            return next(); // Continuar sin autenticación si no hay secreto configurado
        }
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
    } catch (err) {
        // No hacemos nada si el token es inválido; el middleware no debe bloquear rutas públicas
        // Solo logueamos en desarrollo para debugging
        if (process.env.NODE_ENV === 'development') {
            console.log('Token inválido o expirado (ruta pública):', err.message);
        }
    }
    next();
};

const isAdmin = checkRole(['admin']);
const isEstudiante = checkRole(['estudiante']);

module.exports = {
    verifyToken,
    checkRole,
    attachUser,
    isAuthenticated: verifyToken,
    isAdmin,
    isEstudiante
};