// src/controllers/libroVirtual.controller.js
const GoogleBooksService = require('../services/book.service'); // usa tu book.service.js
const LibroVirtual = require('../models/libroVirtual.model');
const LecturaVirtual = require('../models/lecturaVirtual.model');

const LibroVirtualController = {
  // Vista principal (EJS)
  async vistaLibrosVirtuales(req, res) {
    return res.render('libros/virtual', {
      tituloPagina: 'Libros virtuales',
    });
  },

  // Búsqueda en Google Books (JSON)
  async buscar(req, res) {
    try {
      const { q, page = 1 } = req.query;
      if (!q || q.trim() === '') {
        return res.status(400).json({ message: 'Falta parámetro q' });
      }

      const porPagina = 20;
      const startIndex = (parseInt(page) - 1) * porPagina;

      const data = await GoogleBooksService.searchVolumes(q, startIndex, porPagina);
      return res.json(data);
    } catch (error) {
      console.error('Error buscando en Google Books:', error.message);
      return res
        .status(500)
        .json({ message: 'Error al buscar libros virtuales' });
    }
  },

  // Registrar lectura y devolver link para abrir en pestaña nueva
  async abrir(req, res) {
    try {
      const usuarioId = req.user?.id; // viene del middleware de auth
      const { volumeId } = req.body;

      if (!usuarioId) {
        return res.status(401).json({ message: 'No autenticado' });
      }
      if (!volumeId) {
        return res.status(400).json({ message: 'Falta volumeId' });
      }

      // Obtener info del libro desde Google Books
      const volume = await GoogleBooksService.getVolumeById(volumeId);

      const info = volume.volumeInfo || {};
      const imageLinks = info.imageLinks || {};
      const industry = info.industryIdentifiers || [];
      const access = volume.accessInfo || {};

      const isbn =
        industry.find((i) => i.type === 'ISBN_13')?.identifier ||
        industry.find((i) => i.type === 'ISBN_10')?.identifier ||
        null;

      const previewLink =
        access.webReaderLink || info.previewLink || volume.selfLink;

      // Guardar / obtener libro_virtual
      const libroVirtual = await LibroVirtual.findOrCreateByVolume({
        google_volume_id: volume.id,
        titulo: info.title || 'Sin título',
        autor: (info.authors && info.authors.join(', ')) || null,
        editorial: info.publisher || null,
        isbn,
        categoria: (info.categories && info.categories[0]) || null,
        anio_publicacion: info.publishedDate
          ? parseInt(info.publishedDate.slice(0, 4))
          : null,
        portada_url: imageLinks.thumbnail || imageLinks.smallThumbnail || null,
        preview_link: previewLink,
        descripcion: info.description || null,
      });

      // Registrar lectura del usuario
      await LecturaVirtual.registrarLectura(usuarioId, libroVirtual.id);

      // Devolver URL para abrir en otra pestaña
      return res.json({
        preview_link: previewLink,
      });
    } catch (error) {
      console.error('Error al abrir libro virtual:', error.message);
      return res
        .status(500)
        .json({ message: 'Error al abrir libro virtual' });
    }
  },
};

module.exports = LibroVirtualController;
