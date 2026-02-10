const express = require('express');
const router = express.Router();
const ReporteController = require('../controllers/reporte.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// Ruta para generar reportes de préstamos
router.get('/prestamos', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.generarReportePrestamos
]);

// Ruta para generar reportes de estudiantes
router.get('/estudiantes', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.generarReporteEstudiantes
]);

// Nuevas rutas de exportación profesional
router.get('/libros', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarLibros
]);

router.get('/resenas', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarResenas
]);

router.get('/top-lectores', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarTopLectores
]);

// Rutas adicionales para dashboard
router.get('/libros-populares', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarLibrosPopulares
]);

router.get('/prestamos-grado', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarPrestamosPorGrado
]);

// Nuevas rutas para gráficos del dashboard
router.get('/libros-por-semana', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarLibrosPorSemana
]);

router.get('/actividad-mensual', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarActividadMensual
]);

router.get('/lectura-por-grado', [
    verifyToken,
    checkRole(['admin', 'docente']),
    ReporteController.exportarLecturaPorGrado
]);

module.exports = router;