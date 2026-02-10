const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const LibroController = require('../controllers/libro.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// Validaciones comunes para libros
const validacionesLibro = [
    body('titulo').trim().notEmpty().withMessage('El título es requerido'),
    body('autor').trim().notEmpty().withMessage('El autor es requerido'),
    body('editorial').trim().notEmpty().withMessage('La editorial es requerida'),
    body('isbn')
        .optional()
        .isLength({ min: 10, max: 13 })
        .withMessage('ISBN debe tener entre 10 y 13 caracteres'),
    body('area').trim().notEmpty().withMessage('El área es requerida'),
    body('grado_recomendado')
        .optional()
        .isInt({ min: 1, max: 11 })
        .withMessage('Grado recomendado debe estar entre 1 y 11'),
    body('anio_publicacion')
        .optional()
        .isInt({ min: 1800, max: new Date().getFullYear() })
        .withMessage('Año de publicación inválido'),
    body('ejemplares_totales')
        .isInt({ min: 1 })
        .withMessage('Debe haber al menos un ejemplar'),
    body('ubicacion').trim().notEmpty().withMessage('La ubicación es requerida')
];

// Rutas públicas
router.get('/', LibroController.obtenerLibros);
router.get('/libro/:id', LibroController.obtenerLibro);
router.get('/disponibilidad/:id', LibroController.verificarDisponibilidad);

// Rutas protegidas solo para administradores
router.get('/crear', [
    verifyToken,
    checkRole(['admin']),
    LibroController.mostrarFormularioCrear
]);

router.post('/', [
    verifyToken,
    checkRole(['admin']),
    ...validacionesLibro,
    LibroController.crearLibro
]);

router.get('/editar/:id', [
    verifyToken,
    checkRole(['admin']),
    LibroController.mostrarFormularioEditar
]);

router.put('/:id', [
    verifyToken,
    checkRole(['admin']),
    ...validacionesLibro,
    LibroController.actualizarLibro
]);

router.delete('/:id', [
    verifyToken,
    checkRole(['admin']),
    LibroController.eliminarLibro
]);

module.exports = router;