const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboard.controller');
const { verifyToken, checkRole } = require('../middlewares/auth.middleware');

// Dashboard administrativo - solo para administradores
router.get('/admin', verifyToken, checkRole('admin'), DashboardController.getAdminStats);

// Nuevo Dashboard docente - solo para docentes
router.get('/docente', verifyToken, checkRole('docente'), DashboardController.getDocenteStats);

// Promoción de año escolar - solo admin
router.post('/admin/promover-anio', verifyToken, checkRole('admin'), DashboardController.promoverEstudiantes);

// Dashboard del estudiante - solo para estudiantes
router.get('/estudiante', verifyToken, checkRole('estudiante'), DashboardController.getEstudianteStats);

// API Routes
router.get('/api/top-lectores', verifyToken, checkRole('admin', 'docente'), DashboardController.getTopLectoresAPI);
router.get('/api/prestamos-grado', verifyToken, checkRole('admin'), DashboardController.getPrestamosPorGradoAPI);

// Ruta por defecto - redirecciona según el rol
router.get('/', verifyToken, (req, res) => {
  if (req.user.rol === 'estudiante') {
    return res.redirect('/dashboard/estudiante');
  } else if (req.user.rol === 'docente') {
    return res.redirect('/dashboard/docente');
  } else {
    // admin
    return res.redirect('/dashboard/admin');
  }
});

module.exports = router;
