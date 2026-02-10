const express = require('express');
const router = express.Router();
const LibroLeidoController = require('../controllers/libroLeido.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Listar libros leídos
router.get('/', [
    verifyToken,
    LibroLeidoController.listar
]);

// Mostrar formulario de validación
router.get('/validar/:tipo/:id', [
    verifyToken,
    LibroLeidoController.mostrarFormularioValidacion
]);

// Procesar validación
router.post('/validar/:tipo/:id', [
    verifyToken,
    LibroLeidoController.validar
]);

module.exports = router;
