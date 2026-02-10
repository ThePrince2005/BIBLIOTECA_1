const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Rutas de vista
router.get('/login', AuthController.showLogin);
router.get('/registro', AuthController.showRegistro);

// Validaciones comunes
const validacionesRegistro = [
    body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
    body('correo').isEmail().withMessage('Correo electrónico inválido'),
    body('contrasena')
        .isLength({ min: 8 })
        .withMessage('La contraseña debe tener al menos 8 caracteres.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).*$/)
        .withMessage('Debe incluir al menos una letra mayúscula, una minúscula, un número y un símbolo especial.'),
    body('dni')
        .isLength({ min: 8, max: 8 })
        .isNumeric()
        .withMessage('El DNI debe tener 8 dígitos'),
    body('rol')
        .isIn(['estudiante', 'docente', 'admin'])
        .withMessage('Rol inválido'),
    body('grado')
        .custom((value, { req }) => {
            // Si es estudiante, el grado es requerido
            if (req.body.rol === 'estudiante') {
                if (!value || !Number.isInteger(Number(value)) || value < 1 || value > 11) {
                    throw new Error('Grado es requerido y debe estar entre 1 y 11 para estudiantes');
                }
            }
            return true;
        }),
    body('seccion')
        .custom((value, { req }) => {
            // Si es estudiante, la sección es requerida
            if (req.body.rol === 'estudiante') {
                if (!value || value.length !== 1) {
                    throw new Error('Sección es requerida y debe ser una letra para estudiantes');
                }
            }
            return true;
        }),
    body('anio_ingreso')
        .optional()
        .isInt()
        .withMessage('Año de ingreso inválido'),
    body('area_docente')
        .custom((value, { req }) => {
            // Si es docente, el área es requerida
            if (req.body.rol === 'docente' && !value) {
                throw new Error('Área docente es requerida para docentes');
            }
            return true;
        })
];

// Rutas
router.post('/registro', validacionesRegistro, AuthController.registro);

router.post('/login', [
    body('correo').isEmail().withMessage('Correo electrónico inválido'),
    body('contrasena').notEmpty().withMessage('La contraseña es requerida')
], AuthController.login);

router.post('/logout', AuthController.logout);

router.get('/perfil', verifyToken, AuthController.perfil);

module.exports = router;