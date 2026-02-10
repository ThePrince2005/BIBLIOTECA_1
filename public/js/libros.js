/**
 * libros.js
 * Scripts específicos para la sección de gestión de libros.
 * Maneja animaciones, inicialización de componentes y efectos visuales.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Libros.js loaded');

    // Inicializar AOS (Animate On Scroll)
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-out-cubic',
            once: true,
            offset: 50
        });
    }

    // Animación de entrada para las filas de la tabla
    const tableRows = document.querySelectorAll('.data-table tbody tr');
    tableRows.forEach((row, index) => {
        row.style.animationDelay = `${index * 0.05}s`;
    });

    // Efecto de foco en inputs de búsqueda
    const searchInputs = document.querySelectorAll('.input-control');
    searchInputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });

    // --- MODAL LOGIC ---
    const modal = document.getElementById('modalNuevoLibro');
    const btnNuevoLibro = document.getElementById('btnNuevoLibro');
    const closeButtons = document.querySelectorAll('.modal-close');

    // Open Modal
    if (btnNuevoLibro && modal) {
        btnNuevoLibro.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Opening modal via listener');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    } else {
        // Debugging info if elements are missing
        if (!btnNuevoLibro) console.log('Button #btnNuevoLibro not found');
        if (!modal) console.log('Modal #modalNuevoLibro not found');
    }

    // Close Modal (Buttons - X and Cancel)
    const allCloseButtons = document.querySelectorAll('.modal-close, .btn-cancel-modal');
    allCloseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default if it's a link or submit
            const modalToClose = btn.closest('.modal-overlay');
            if (modalToClose) {
                modalToClose.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    function reloadTableAnimation() {
        const rows = document.querySelectorAll('.data-table tbody tr');
        rows.forEach(row => {
            row.style.opacity = '0';
            row.classList.remove('animate-in');
        });

        setTimeout(() => {
            rows.forEach((row, index) => {
                setTimeout(() => {
                    row.style.opacity = '1';
                    row.classList.add('animate-in');
                }, index * 50);
            });
        }, 100);
    }

    // Global helper for form success callbacks
    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };
});
