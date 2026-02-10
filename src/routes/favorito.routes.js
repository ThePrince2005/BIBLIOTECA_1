const express = require('express');
const router = express.Router();
const FavoritoController = require('../controllers/favorito.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);
router.use(checkRole(['estudiante', 'docente']));

// Obtener lista de favoritos
router.get('/', FavoritoController.listar);

// Agregar a favoritos
router.post('/', FavoritoController.agregar);

// Eliminar de favoritos
router.delete('/:libro_id', FavoritoController.eliminar);

// Verificar si un libro está en favoritos
router.get('/verificar/:libro_id', FavoritoController.verificar);

module.exports = router;