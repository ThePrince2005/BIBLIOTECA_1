const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfil.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware.verifyToken);

// Vista del perfil
router.get('/', perfilController.mostrarPerfil);

// Vista para editar el perfil
router.get('/editar', perfilController.mostrarFormularioEditar);

// Vista para cambiar la contraseña
router.get('/password', perfilController.mostrarFormularioPassword);

// Actualizar datos del perfil
router.put('/', perfilController.actualizarPerfil);

// Actualizar foto de perfil
router.post('/foto', perfilController.actualizarFoto);

// Cambiar contraseña
router.put('/password', perfilController.actualizarPassword);

module.exports = router;
