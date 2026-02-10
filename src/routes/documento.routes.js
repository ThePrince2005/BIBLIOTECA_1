const express = require('express');
const router = express.Router();
const DocumentoController = require('../controllers/documento.controller');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');

// Rutas públicas para ver documentos (accesibles para usuarios autenticados)
router.get('/material', isAuthenticated, DocumentoController.mostrarDocumentosPublicos);
router.get('/material/ver/:id', isAuthenticated, DocumentoController.verDocumento);
router.get('/material/descargar/:id', isAuthenticated, DocumentoController.descargarDocumento);

// Aplicar middleware de autenticación y verificación de rol (Admin y Docente)
const { checkRole } = require('../middlewares/auth.middleware');
router.use(checkRole(['admin', 'docente']));

// Ruta para mostrar el formulario de subida de documentos (GET)
router.get('/documentos', DocumentoController.mostrarFormulario);

// Ruta para manejar la subida de documentos (POST)
router.post('/documentos', DocumentoController.subirDocumento);

// Ruta para descargar un documento (Admin alias)
router.get('/documentos/descargar/:id', DocumentoController.descargarDocumento);

// Ruta para eliminar un documento
router.get('/documentos/eliminar/:id', DocumentoController.eliminarDocumento);

module.exports = router;
