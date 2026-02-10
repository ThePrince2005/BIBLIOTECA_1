(function () {
    const configElement = document.getElementById('resena-config');
    if (!configElement) return;

    let config;
    try {
        config = JSON.parse(configElement.textContent || '{}');
    } catch (err) {
        console.error('No se pudo parsear la configuración de reseñas:', err);
        return;
    }

    const modalId = config.modalId || 'resenaModal';
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const form = modal.querySelector('[data-resena-form], form');
    const ratingButtons = modal.querySelectorAll('[data-rating-value]');
    const comentarioInput = form ? form.querySelector('#resenaComentario') : null;
    const calificacionInput = form ? form.querySelector('#resenaCalificacion') : null;
    const libroInput = form ? form.querySelector('#resenaLibroId') : null;
    const prestamoInput = form ? form.querySelector('#resenaPrestamoId') : null;
    const resenaIdInput = form ? form.querySelector('#resenaId') : null;
    const submitButton = form ? form.querySelector('#resenaSubmit') : null;

    const state = {
        currentLibroId: null,
        currentResenaId: null,
        currentPrestamoId: null,
        contexto: null,
        scope: config.scope || 'libro'
    };

    const endpoints = config.endpoints || {};

    const replaceParam = (url, params = {}) => {
        if (!url) return '';
        return Object.entries(params).reduce((acc, [key, value]) => {
            return acc.replace(new RegExp(`:${key}`, 'g'), value);
        }, url);
    };

    const swal = (opts) => {
        if (window.Swal) {
            return window.Swal.fire(opts);
        }
        alert(opts.text || opts.title || 'Operación realizada');
        return Promise.resolve();
    };

    const showLoading = (isLoading) => {
        if (!submitButton) return;
        submitButton.disabled = isLoading;
        submitButton.dataset.originalText = submitButton.dataset.originalText || submitButton.textContent;
        submitButton.textContent = isLoading ? 'Procesando...' : submitButton.dataset.originalText;
    };

    const resetForm = () => {
        if (!form) return;
        form.reset();
        state.currentResenaId = null;
        state.currentPrestamoId = null;
        resenaIdInput && (resenaIdInput.value = '');
        prestamoInput && (prestamoInput.value = '');
        calificacionInput && (calificacionInput.value = '0');
        libroInput && (libroInput.value = state.currentLibroId || '');
        ratingButtons.forEach((btn) => btn.classList.remove('is-active'));
    };

    const openModal = () => {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        resetForm();
    };

    const setRating = (value) => {
        if (!calificacionInput) return;
        calificacionInput.value = value;
        ratingButtons.forEach((btn) => {
            if (Number(btn.dataset.ratingValue) <= value) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    };

    ratingButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            setRating(Number(btn.dataset.ratingValue));
        });
    });

    const hydrateFromResena = (resena) => {
        if (!form) return;
        state.currentResenaId = resena.id;
        state.currentPrestamoId = resena.prestamo_id;
        resenaIdInput && (resenaIdInput.value = resena.id);
        prestamoInput && (prestamoInput.value = resena.prestamo_id || '');
        comentarioInput && (comentarioInput.value = resena.comentario || '');
        libroInput && (libroInput.value = resena.libro_id || state.currentLibroId || '');
        setRating(Number(resena.calificacion || 0));
        submitButton && (submitButton.textContent = 'Actualizar reseña');
    };

    const hydrateForNew = (libroId, contexto) => {
        state.currentResenaId = null;
        state.currentPrestamoId = contexto.prestamoElegibleId || null;
        resenaIdInput && (resenaIdInput.value = '');
        prestamoInput && (prestamoInput.value = contexto.prestamoElegibleId || '');
        comentarioInput && (comentarioInput.value = '');
        libroInput && (libroInput.value = libroId);
        setRating(0);
        submitButton && (submitButton.textContent = 'Publicar reseña');
    };

    const fetchContexto = async (libroId) => {
        try {
            const url = replaceParam(endpoints.contexto, { libroId });
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (!response.ok) {
                throw new Error('No se pudo obtener el contexto para reseñar este libro.');
            }
            return await response.json();
        } catch (error) {
            await swal({ icon: 'error', title: 'Error', text: error.message });
            return null;
        }
    };

    const handleOpen = async (libroId) => {
        if (!libroId) {
            await swal({ icon: 'warning', title: 'Selecciona un libro', text: 'No se pudo identificar el libro.' });
            return;
        }
        state.currentLibroId = libroId;
        const contexto = await fetchContexto(libroId);
        if (!contexto) return;

        if (!contexto.prestamoElegibleId && !contexto.resenaEditable) {
            await swal({
                icon: 'info',
                title: 'No permitido',
                text: 'Solo puedes reseñar libros que hayas prestado o devuelto.'
            });
            return;
        }

        if (contexto.resenaEditable) {
            hydrateFromResena(contexto.resenaEditable);
        } else {
            hydrateForNew(libroId, contexto);
        }

        openModal();
    };

    const handleEditAction = (btn) => {
        const resenaId = btn.dataset.id;
        const libroId = btn.closest('[data-resena-id]')?.dataset.libroId;
        const rating = Number(btn.closest('[data-resena-id]')?.dataset.calificacion || 0);
        const comentario = decodeURIComponent(btn.closest('[data-resena-id]')?.dataset.comment || '');
        const prestamoId = btn.closest('[data-resena-id]')?.dataset.prestamoId || '';

        state.currentLibroId = libroId || state.currentLibroId;
        const snapshot = {
            id: resenaId,
            libro_id: libroId,
            calificacion: rating,
            comentario,
            prestamo_id: prestamoId
        };
        hydrateFromResena(snapshot);
        openModal();
    };

    const handleDelete = async (btn) => {
        const resenaId = btn.dataset.id;
        if (!resenaId) return;
        const confirm = await swal({
            title: 'Eliminar reseña',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirm.isConfirmed) return;

        try {
            const url = replaceParam(endpoints.eliminar, { id: resenaId });
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'No se pudo eliminar la reseña');
            }
            await swal({ icon: 'success', title: 'Reseña eliminada' });
            window.location.reload();
        } catch (error) {
            await swal({ icon: 'error', title: 'Error', text: error.message });
        }
    };

    form && form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!libroInput || !calificacionInput || !comentarioInput) return;
        const libroId = libroInput.value;
        if (!libroId) {
            await swal({ icon: 'warning', title: 'Selecciona un libro' });
            return;
        }
        const calificacion = Number(calificacionInput.value || 0);
        if (calificacion < 1) {
            await swal({ icon: 'warning', title: 'Selecciona una calificación válida' });
            return;
        }
        if ((comentarioInput.value || '').trim().length < 10) {
            await swal({ icon: 'warning', title: 'Comentario muy corto', text: 'Escribe al menos 10 caracteres.' });
            return;
        }

        const payload = {
            libro_id: libroId,
            calificacion,
            comentario: comentarioInput.value.trim(),
            prestamo_id: prestamoInput ? prestamoInput.value : null
        };

        const isEditing = Boolean(resenaIdInput && resenaIdInput.value);
        const endpoint = isEditing
            ? replaceParam(endpoints.actualizar, { id: resenaIdInput.value })
            : endpoints.crear;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            showLoading(true);
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'No se pudo guardar la reseña');
            }

            closeModal();
            await swal({ icon: 'success', title: isEditing ? 'Reseña actualizada' : 'Reseña publicada' });
            window.location.reload();
        } catch (error) {
            await swal({ icon: 'error', title: 'Error', text: error.message });
        } finally {
            showLoading(false);
        }
    });

    document.addEventListener('click', (event) => {
        const openBtn = event.target.closest('[data-resena-open]');
        if (openBtn) {
            event.preventDefault();
            handleOpen(openBtn.dataset.libroId);
            return;
        }

        const editBtn = event.target.closest('[data-resena-edit]');
        if (editBtn) {
            event.preventDefault();
            handleEditAction(editBtn);
            return;
        }

        const deleteBtn = event.target.closest('[data-resena-delete]');
        if (deleteBtn) {
            event.preventDefault();
            handleDelete(deleteBtn);
            return;
        }

        const closeBtn = event.target.closest('[data-resena-close]');
        if (closeBtn) {
            event.preventDefault();
            closeModal();
        }
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
})();
