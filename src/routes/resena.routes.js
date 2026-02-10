const express = require('express');
const { body } = require('express-validator');
const ResenaController = require('../controllers/resena.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

const resenaRouter = express.Router();
const adminRouter = express.Router();

const crearValidaciones = [
    body('libro_id').isInt({ min: 1 }).withMessage('Libro inválido'),
    body('calificacion').isInt({ min: 1, max: 5 }).withMessage('La calificación debe estar entre 1 y 5'),
    body('comentario').trim().isLength({ min: 10 }).withMessage('El comentario debe tener al menos 10 caracteres')
];

const actualizarValidaciones = [
    body('calificacion').isInt({ min: 1, max: 5 }).withMessage('La calificación debe estar entre 1 y 5'),
    body('comentario').trim().isLength({ min: 10 }).withMessage('El comentario debe tener al menos 10 caracteres')
];

// REST: /resenas
resenaRouter.get('/libro/:id', ResenaController.listarPorLibro);

resenaRouter.get('/contexto/:libroId', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    ResenaController.obtenerContexto
]);

resenaRouter.post('/', [
    verifyToken,
    checkRole(['estudiante', 'docente']),
    ...crearValidaciones
], ResenaController.crear);

resenaRouter.put('/:id', [
    verifyToken,
    checkRole(['estudiante', 'docente', 'admin']),
    ...actualizarValidaciones
], ResenaController.actualizar);

resenaRouter.delete('/:id', [
    verifyToken,
    checkRole(['estudiante', 'docente', 'admin']),
    ResenaController.eliminar
]);

// Admin panel: /admin/resenas
adminRouter.get('/resenas', [
    verifyToken,
    checkRole(['docente', 'admin']),
    ResenaController.panelAdmin
]);

module.exports = {
    resenaRouter,
    resenaAdminRouter: adminRouter
};
