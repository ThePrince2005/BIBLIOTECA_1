// src/routes/libroVirtual.routes.js
const express = require('express');
const router = express.Router();

const LibroVirtualController = require('../controllers/libroVirtual.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware'); // <-- destructuring correcto


router.get(
  '/',
  isAuthenticated,                 // antes ponías algo undefined como ensureAuthenticated
  LibroVirtualController.vistaLibrosVirtuales
);

router.get(
  '/buscar',
  isAuthenticated,
  LibroVirtualController.buscar
);

router.post(
  '/abrir',
  isAuthenticated,
  LibroVirtualController.abrir
);

module.exports = router;
