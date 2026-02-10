const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const UsuarioController = require('../controllers/usuario.controller');
const { isAdmin } = require('../middlewares/auth.middleware');

// Configuración de multer para manejar la subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'estudiantes_' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// Lista de alumnos + personal
router.get('/admin/alumnos', isAdmin, UsuarioController.listarAlumnosAdmin);

// Eliminar alumno
router.post(
  '/admin/alumnos/:id/eliminar',
  isAdmin,
  UsuarioController.eliminarAlumnoAdmin
);

// Lista de alumnos para docente
router.get(
  '/docente/alumnos',
  (req, res, next) => {
    if (req.user && req.user.rol === 'docente') {
      next();
    } else {
      res.redirect('/dashboard');
    }
  },
  UsuarioController.listarAlumnosDocente
);

// Eliminar docente/admin
router.post(
  '/admin/personal/:id/eliminar',
  isAdmin,
  UsuarioController.eliminarPersonalAdmin
);

// Formulario para crear un nuevo usuario (admin)
router.get('/admin/usuarios/crear', isAdmin, UsuarioController.crearUsuarioForm);
// Procesar la creación de un nuevo usuario (admin)
router.post(
  '/admin/usuarios/crear',
  isAdmin,
  UsuarioController.crearUsuario
);

// Historial de lectura de un usuario (solo admin)
router.get(
  '/admin/usuarios/:id/historial',
  isAdmin,
  UsuarioController.verHistorialUsuario
);

// Exportar historial de usuario (solo admin)
router.get(
  '/admin/usuarios/:id/historial/exportar',
  isAdmin,
  UsuarioController.exportarHistorialUsuario
);

// Historial de lectura para docente
router.get(
  '/docente/usuarios/:id/historial',
  (req, res, next) => {
    if (req.user && req.user.rol === 'docente') {
      next();
    } else {
      res.redirect('/dashboard');
    }
  },
  UsuarioController.verHistorialUsuario
);

// Ruta para mostrar el formulario de importación
router.get('/admin/estudiantes/importar', isAdmin, (req, res) => {
    res.render('admin/importar-estudiantes', { 
        title: 'Importar Estudiantes',
        user: req.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
});

// Ruta para procesar el archivo de importación
router.post('/admin/estudiantes/importar', 
    isAdmin, 
    upload.single('archivo'),
    UsuarioController.importarEstudiantes
);

module.exports = router;
