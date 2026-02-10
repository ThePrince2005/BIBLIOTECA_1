// src/services/book.service.js
const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

const GoogleBooksService = {
  async searchVolumes(query, startIndex = 0, maxResults = 20) {
    const url = new URL(GOOGLE_BOOKS_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('startIndex', startIndex.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('printType', 'books');
    url.searchParams.set('langRestrict', 'es');

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error('Error al llamar a Google Books');
    }
    return res.json();
  },

  async getVolumeById(volumeId) {
    const res = await fetch(`${GOOGLE_BOOKS_BASE_URL}/${volumeId}`);
    if (!res.ok) {
      throw new Error('Error al obtener detalle de Google Books');
    }
    return res.json();
  },
};

module.exports = GoogleBooksService;
