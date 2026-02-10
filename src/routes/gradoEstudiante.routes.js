const express = require('express');
const router = express.Router();
const GradoEstudianteController = require('../controllers/gradoEstudiante.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Rutas protegidas
router.use(verifyToken);

// Obtener estadísticas de grados
router.get('/estadisticas', GradoEstudianteController.obtenerEstadisticas);

// Actualizar grado de un estudiante específico
router.post('/actualizar/:estudianteId', GradoEstudianteController.actualizarGradoEstudiante);

// Ejecutar actualización masiva de grados
router.post('/actualizar-masiva', GradoEstudianteController.ejecutarActualizacionMasiva);

// Obtener estado del servicio de actualización
router.get('/estado-servicio', GradoEstudianteController.obtenerEstadoServicio);

module.exports = router;