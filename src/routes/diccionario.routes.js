const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const DiccionarioController = require('../controllers/diccionario.controller');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');

// Validaciones
const validacionTermino = [
    body('termino').notEmpty().withMessage('El término es requerido').trim(),
    body('definicion').notEmpty().withMessage('La definición es requerida').trim()
];

// Rutas públicas (lectura)
router.get('/', isAuthenticated, DiccionarioController.index);

// Rutas administrativas (escritura)
router.post('/', isAuthenticated, isAdmin, validacionTermino, DiccionarioController.crear);
router.put('/:id', isAuthenticated, isAdmin, validacionTermino, DiccionarioController.actualizar);
router.delete('/:id', isAuthenticated, isAdmin, DiccionarioController.eliminar);

module.exports = router;
