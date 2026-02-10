const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const ConfiguracionController = require('../controllers/configuracion.controller');

router.use(authMiddleware.verifyToken);

// Vista principal
router.get('/', ConfiguracionController.index);

// Acción cerrar año escolar
router.post('/cerrar-anio', authMiddleware.isAdmin, ConfiguracionController.cerrarAnioEscolar);

module.exports = router;
