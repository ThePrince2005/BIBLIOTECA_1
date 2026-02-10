/**
 * perfil.js - Gestión de la interfaz de perfil
 * Integra el sistema de temas claro/oscuro y animaciones
 */

(function() {
    // Esperar a que el DOM esté completamente cargado
    document.addEventListener('DOMContentLoaded', function() {
        // Obtener el body y aplicar la clase de configuración
        const body = document.body;
        body.classList.add('configuracion-body');
        
        // Aplicar tema guardado o tema por defecto
        const savedTheme = localStorage.getItem('biblioteca:theme-preference') || 'light';
        applyTheme(savedTheme);
        
        // Aplicar tamaño de fuente guardado
        const savedFontScale = localStorage.getItem('biblioteca:font-scale') || '0';
        applyFontScale(parseInt(savedFontScale, 10));
        
        // Aplicar contraste mejorado
        const savedContrast = localStorage.getItem('biblioteca:contrast') === 'true';
        if (savedContrast) {
            body.classList.add('contrast-boost');
        }
        
        // Inicializar animaciones AOS si está disponible
        if (window.AOS) {
            AOS.init({
                duration: 800,
                once: true,
                easing: 'ease-out-cubic'
            });
        }
        
        // Aplicar animaciones a los elementos del perfil
        animateProfileElements();
    });
    
    /**
     * Aplica el tema seleccionado
     * @param {string} theme - 'light', 'dark' o 'auto'
     */
    function applyTheme(theme) {
        const body = document.body;
        const isDark = theme === 'dark' || 
                      (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        body.classList.toggle('theme-dark', isDark);
        body.classList.toggle('theme-light', !isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    }
    
    /**
     * Aplica la escala de fuente seleccionada
     * @param {number} scale - Valor de escala (-1 a 2)
     */
    function applyFontScale(scale) {
        const body = document.body;
        const clampedScale = Math.max(-1, Math.min(2, scale));
        
        // Eliminar clases de escala anteriores
        body.removeAttribute('data-font-scale');
        
        // Aplicar nueva escala si no es la predeterminada (0)
        if (clampedScale !== 0) {
            body.setAttribute('data-font-scale', String(clampedScale));
        }
    }
    
    /**
     * Aplica animaciones a los elementos del perfil
     */
    function animateProfileElements() {
        // Animación para la tarjeta principal
        const mainCard = document.querySelector('.bg-white.rounded-lg');
        if (mainCard) {
            mainCard.style.opacity = '0';
            mainCard.style.transform = 'translateY(20px)';
            mainCard.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            
            // Forzar reflow para activar la transición
            void mainCard.offsetWidth;
            
            mainCard.style.opacity = '1';
            mainCard.style.transform = 'translateY(0)';
        }
        
        // Animación para las estadísticas
        const stats = document.querySelectorAll('.stat-card');
        stats.forEach((stat, index) => {
            stat.style.animationDelay = `${index * 0.1}s`;
            stat.classList.add('animate-fade-in-up');
        });
        
        // Animación para los botones
        const buttons = document.querySelectorAll('.btn-animated');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            });
        });
    }
    
    // Escuchar cambios en el tema del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        const savedTheme = localStorage.getItem('biblioteca:theme-preference') || 'light';
        if (savedTheme === 'auto') {
            applyTheme('auto');
        }
    });
    
    // Hacer las funciones accesibles globalmente si es necesario
    window.perfil = {
        applyTheme,
        applyFontScale,
        animateProfileElements
    };
})();
