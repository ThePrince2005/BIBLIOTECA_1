// public/js/libros_virtual.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-busqueda-virtual');
  const input = document.getElementById('busqueda-virtual');
  const contenedor = document.getElementById('resultados-virtuales');
  const countElement = document.getElementById('resultados-count');

  if (!form || !input || !contenedor) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    // Mostrar estado de carga
    contenedor.innerHTML = `
      <div class="virtual-loading" style="grid-column: 1 / -1;">
        <div class="virtual-loading__spinner"></div>
        <p class="virtual-loading__text">Buscando libros virtuales...</p>
      </div>
    `;
    if (countElement) countElement.style.display = 'none';

    try {
      const res = await axios.get('/libros-virtuales/buscar', {
        params: { q },
      });

      const items = res.data.items || [];

      if (!items.length) {
        contenedor.innerHTML = `
          <div class="virtual-empty" style="grid-column: 1 / -1;">
            <div class="virtual-empty__icon">
              <i class="fa-solid fa-book-open-reader"></i>
            </div>
            <h3 class="virtual-empty__title">No se encontraron resultados</h3>
            <p class="virtual-empty__text">
              No encontramos libros que coincidan con "${q}". 
              Intenta con otros términos de búsqueda o verifica la ortografía.
            </p>
          </div>
        `;
        if (countElement) countElement.style.display = 'none';
        return;
      }

      // Mostrar contador
      if (countElement) {
        countElement.textContent = `${items.length} ${items.length === 1 ? 'libro encontrado' : 'libros encontrados'}`;
        countElement.style.display = 'inline-flex';
      }

      // Generar cards
      contenedor.innerHTML = '';
      items.forEach((item, index) => {
        const info = item.volumeInfo || {};
        const image = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail))
          || 'https://via.placeholder.com/300x450/667eea/ffffff?text=Sin+Portada';
        const autores = info.authors ? info.authors.join(', ') : 'Autor desconocido';
        const descripcion = info.description
          ? (info.description.length > 150 ? info.description.slice(0, 150) + '...' : info.description)
          : 'Sin descripción disponible.';
        const publishedDate = info.publishedDate ? new Date(info.publishedDate).getFullYear() : 'Fecha desconocida';
        const pageCount = info.pageCount ? `${info.pageCount} páginas` : 'Páginas no especificadas';
        const categories = info.categories ? info.categories[0] : 'Sin categoría';

        const card = document.createElement('div');
        card.className = 'v-book-card';
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <img 
              src="${image}" 
              class="v-book-cover" 
              alt="Portada de ${info.title || 'Libro'}"
              onerror="this.src='https://via.placeholder.com/300x450/667eea/ffffff?text=Sin+Portada'"
            >
            <div class="v-book-info">
                <h3 class="v-book-title">${info.title || 'Sin título'}</h3>
                <p class="v-book-author"><i class="fa-solid fa-user-pen"></i> ${autores}</p>
                <div style="flex-grow: 1;"></div> 
                <button
                  class="v-btn-read"
                  data-volume-id="${item.id}"
                >
                  <i class="fa-solid fa-book-open"></i>
                  <span>Leer ahora</span>
                </button>
            </div>
        `;

        contenedor.appendChild(card);
      });

      // Bind de botones "Leer ahora"
      contenedor.querySelectorAll('button[data-volume-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const volumeId = btn.getAttribute('data-volume-id');
          const buttonText = btn.querySelector('span');
          const originalText = buttonText.textContent;

          // Feedback visual
          btn.disabled = true;
          buttonText.textContent = 'Abriendo...';
          btn.style.opacity = '0.7';

          try {
            const resAbrir = await axios.post('/libros-virtuales/abrir', {
              volumeId,
            });
            const preview = resAbrir.data.preview_link;
            if (preview) {
              window.open(preview, '_blank');
              // Restaurar botón después de un momento
              setTimeout(() => {
                btn.disabled = false;
                buttonText.textContent = originalText;
                btn.style.opacity = '1';
              }, 1000);
            } else {
              alert('No hay vista previa disponible para este libro.');
              btn.disabled = false;
              buttonText.textContent = originalText;
              btn.style.opacity = '1';
            }
          } catch (err) {
            console.error(err);
            alert('Error al abrir el libro virtual. Por favor, intenta nuevamente.');
            btn.disabled = false;
            buttonText.textContent = originalText;
            btn.style.opacity = '1';
          }
        });
      });
    } catch (err) {
      console.error(err);
      contenedor.innerHTML = `
        <div class="virtual-error" style="grid-column: 1 / -1;">
          <div class="virtual-error__icon">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="virtual-error__title">Error al buscar libros</h3>
          <p class="virtual-error__text">
            Ocurrió un error al realizar la búsqueda. Por favor, intenta nuevamente más tarde.
          </p>
        </div>
      `;
      if (countElement) countElement.style.display = 'none';
    }
  });
});
