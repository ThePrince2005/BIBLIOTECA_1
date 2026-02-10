/**
 * favoritos.js
 * Lógica para la gestión de libros favoritos con SweetAlert2.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-out-cubic',
            once: true,
            offset: 50
        });
    }

    // Manejar eliminación de favoritos
    const removeButtons = document.querySelectorAll('.favorite-card__remove');

    removeButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const libroId = btn.dataset.libroId;
            const card = btn.closest('.favorite-card');

            const result = await Swal.fire({
                title: '¿Quitar de favoritos?',
                text: '¿Estás seguro de que deseas quitar este libro de tus favoritos?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#EF4444',
                cancelButtonColor: '#64748B',
                confirmButtonText: 'Sí, quitar',
                cancelButtonText: 'Cancelar'
            });

            if (!result.isConfirmed) return;

            try {
                const response = await fetch(`/favoritos/${libroId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    // Animación de salida
                    card.style.transform = 'scale(0.9)';
                    card.style.opacity = '0';

                    setTimeout(() => {
                        card.remove();
                        // Verificar si quedan elementos, si no, recargar para mostrar estado vacío
                        if (document.querySelectorAll('.favorite-card').length === 0) {
                            window.location.reload();
                        }
                    }, 300);

                    // Toast de éxito
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Libro eliminado de favoritos',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'Error al eliminar',
                        confirmButtonColor: '#00B4D8'
                    });
                }
            } catch (error) {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error de conexión',
                    confirmButtonColor: '#00B4D8'
                });
            }
        });
    });
});