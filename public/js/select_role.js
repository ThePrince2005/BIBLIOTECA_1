/* /public/js/select_role.js */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar la librería de animaciones (AOS)
    AOS.init({
        once: true, // La animación se ejecuta solo una vez
        duration: 800, // Duración de la animación
        easing: 'ease-in-out', // Curva de aceleración
    });

    // 2. Gestionar el loader
    const loader = document.getElementById('loader');
    // Ocultar el loader cuando la página esté completamente cargada
    window.addEventListener('load', () => {
        if (loader) {
            loader.style.opacity = '0';
            // Eliminar el loader del DOM después de la transición para no interferir
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500); // Coincide con la duración de la transición en el CSS
        }
    });

    // 3. Lógica de las tarjetas de rol
    const roleCards = document.querySelectorAll('.role-card');

    roleCards.forEach(card => {
        const role = card.dataset.role;
        if (!role) return;

        const handleRedirect = () => {
            // Añadir clase para la animación de salida
            card.classList.add('fade-out-slide');

            // Esperar a que la animación termine antes de redirigir
            setTimeout(() => {
                window.location.href = `/auth/login?role=${role}`;
            }, 400); // Duración de la animación de salida
        };

        // Evento de clic
        card.addEventListener('click', handleRedirect);

        // Evento de teclado (para accesibilidad)
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevenir scroll en caso de la barra espaciadora
                handleRedirect();
            }
        });
    });
});
