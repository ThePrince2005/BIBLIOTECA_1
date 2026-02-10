const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const PrestamoController = require('../controllers/prestamo.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// Validaciones para préstamos
const validacionesPrestamo = [
    body('libro_id').isInt().withMessage('ID de libro inválido'),
    body('tipo_prestamo')
        .isIn(['dias', 'horas'])
        .withMessage('Tipo de préstamo inválido'),
    body('duracion')
        .isInt({ min: 1 })
        .withMessage('La duración debe ser un número positivo'),
    body('observaciones')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Las observaciones no deben exceder 500 caracteres')
];

// Rutas para estudiantes
// Ruta base: redirige según el rol del usuario para evitar 404 en /prestamos
router.get('/', [
    verifyToken,
    (req, res) => {
        const rol = req.user?.rol;
        if (rol === 'estudiante' || rol === 'docente') return res.redirect('/prestamos/mis-prestamos');
        if (rol === 'admin') return res.redirect('/prestamos/admin');
        return res.redirect('/');
    }
]);

router.get('/mis-prestamos', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    PrestamoController.misPrestamos
]);

// Ruta para mostrar el formulario de creación de préstamo
router.get('/crear/:libroId', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    PrestamoController.showCrearForm // Cambiamos al nuevo método del controlador
]);

// Rutas administrativas
router.get('/admin', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.admin
]);

// Endpoint JSON para DataTable
router.get('/admin/lista/json', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.obtenerTodosJson
]);

router.post('/', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    ...validacionesPrestamo,
    PrestamoController.crearPrestamo
]);

// Rutas para reservas
router.post('/reserva', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    body('libro_id').isInt().withMessage('ID de libro inválido'),
    PrestamoController.crearReserva
]);

router.get('/admin/lista', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.admin
]);

router.post('/:id/devolucion', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.registrarDevolucion
]);

router.post('/:id/aprobar', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.aprobarPrestamo
]);

// Permitir a un estudiante o docente devolver su propio libro (ruta separada)
router.post('/:id/devolver', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    PrestamoController.registrarDevolucionUsuario
]);

// Ruta para verificación de vencimientos (protegida, solo para CRON o admin)
router.post('/verificar-vencidos', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.verificarVencidos
]);

// Ruta para ver detalles de un préstamo (solo admin)
router.get('/:id/detalle', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.verDetallePrestamo
]);

// Ruta para enviar alerta de recordatorio (solo admin)
router.post('/:id/enviar-alerta', [
    verifyToken,
    checkRole(['admin']),
    PrestamoController.enviarAlertaRecordatorio
]);

module.exports = router;