const express = require('express');
const router = express.Router();
const AuditoriaController = require('../controllers/auditoria.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación y rol de administrador
router.use(verifyToken, checkRole(['admin']));

// Vista principal de auditoría
router.get('/', AuditoriaController.index);

// Exportar registros
router.get('/exportar', AuditoriaController.exportar);

module.exports = router;