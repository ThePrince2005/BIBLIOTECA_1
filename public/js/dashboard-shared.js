/**
 * ========================================================================
 * BIBLIOTECA ESCOLAR DANIEL HERNÁNDEZ
 * Archivo: /public/js/dashboard-shared.js
 * Propósito: JavaScript compartido para todas las vistas de dashboard
 * ========================================================================
 */

(function () {
    // ========================================================================
    // CONSTANTES Y CONFIGURACIÓN
    // ========================================================================

    const STORAGE_KEYS = {
        THEME: 'biblioteca:theme-preference',
        FONT_SCALE: 'biblioteca:font-scale',
        CONTRAST: 'biblioteca:contrast'
    };

    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    };

    // ========================================================================
    // SINCRONIZACIÓN DE TEMA
    // ========================================================================

    /**
     * Aplica el tema al dashboard sincronizando con configuración global
     */
    function applyDashboardTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || THEMES.AUTO;
        const savedFontScale = localStorage.getItem(STORAGE_KEYS.FONT_SCALE) || '0';
        const savedContrast = localStorage.getItem(STORAGE_KEYS.CONTRAST) === 'true';

        const body = document.querySelector('.dashboard-body') || document.body;

        // Aplicar tema
        let effectiveTheme = savedTheme;

        if (savedTheme === THEMES.AUTO) {
            // Detectar preferencia del sistema
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            effectiveTheme = prefersDark ? THEMES.DARK : THEMES.LIGHT;
        }

        // Aplicar clases de tema
        body.classList.remove('theme-light', 'theme-dark');
        body.classList.add(`theme-${effectiveTheme}`);

        // Aplicar escala de fuente
        if (savedFontScale !== '0') {
            body.setAttribute('data-font-scale', savedFontScale);
        } else {
            body.removeAttribute('data-font-scale');
        }

        // Aplicar contraste
        body.classList.toggle('contrast-boost', savedContrast);

        // Actualizar documentElement también para consistencia
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        document.documentElement.style.colorScheme = effectiveTheme;
    }

    /**
     * Escucha cambios en el tema del sistema
     */
    function watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        mediaQuery.addEventListener('change', (e) => {
            const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
            if (savedTheme === THEMES.AUTO || !savedTheme) {
                applyDashboardTheme();
            }
        });
    }

    // ========================================================================
    // ANIMACIONES DE ENTRADA
    // ========================================================================

    /**
     * Inicializa las animaciones AOS (Animate On Scroll)
     */
    function initDashboardAnimations() {
        // Verificar si AOS está disponible
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                easing: 'ease-out-cubic',
                once: true,
                offset: 50,
                delay: 100
            });
        }

        // Animación de entrada para el hero
        const hero = document.querySelector('.dashboard-hero');
        if (hero) {
            setTimeout(() => {
                hero.style.opacity = '1';
                hero.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    /**
     * Anima los números de las estadísticas
     */
    function animateStatNumbers() {
        const statValues = document.querySelectorAll('.stat-card__value, .hero-highlight__value');

        statValues.forEach(stat => {
            const finalValueText = stat.textContent;
            const finalValue = parseInt(finalValueText.replace(/[^0-9]/g, '')) || 0;

            if (finalValue === 0) return;

            let currentValue = 0;
            const increment = Math.ceil(finalValue / 30);
            const duration = 1000;
            const stepTime = Math.max(duration / (finalValue / increment), 20);

            const counter = setInterval(() => {
                currentValue += increment;
                if (currentValue >= finalValue) {
                    stat.textContent = finalValueText; // Restaurar formato original
                    clearInterval(counter);
                } else {
                    stat.textContent = currentValue;
                }
            }, stepTime);
        });
    }

    // ========================================================================
    // EFECTOS INTERACTIVOS
    // ========================================================================

    /**
     * Inicializa efectos de hover mejorados en tarjetas
     */
    function initCardHoverEffects() {
        const cards = document.querySelectorAll('.stat-card, .dash-panel');

        cards.forEach(card => {
            card.addEventListener('mouseenter', function () {
                this.style.transform = 'translateY(-8px) scale(1.01)';
            });

            card.addEventListener('mouseleave', function () {
                this.style.transform = '';
            });
        });
    }

    /**
     * Efecto parallax suave en glow orbs con movimiento del mouse
     */
    function initGlowOrbsParallax() {
        const orbs = document.querySelectorAll('.glow-orb');
        if (orbs.length === 0) return;

        let mouseX = 0;
        let mouseY = 0;
        let currentX = 0;
        let currentY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animate() {
            // Suavizar el movimiento
            currentX += (mouseX - currentX) * 0.05;
            currentY += (mouseY - currentY) * 0.05;

            orbs.forEach((orb, index) => {
                const speed = (index + 1) * 0.015;
                const x = (currentX * speed) / 10;
                const y = (currentY * speed) / 10;

                orb.style.setProperty('--glow-shift-x', `${x}px`);
                orb.style.setProperty('--glow-shift-y', `${y}px`);
            });

            requestAnimationFrame(animate);
        }

        animate();
    }

    /**
     * Efecto de inclinación 3D en el hero
     */
    function initHeroTiltEffect() {
        const hero = document.querySelector('.dashboard-hero');
        if (!hero) return;

        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -2;
            const rotateY = ((x - centerX) / centerX) * 2;

            hero.style.setProperty('--tilt-x', `${rotateX}deg`);
            hero.style.setProperty('--tilt-y', `${rotateY}deg`);
        });

        hero.addEventListener('mouseleave', () => {
            hero.style.setProperty('--tilt-x', '0deg');
            hero.style.setProperty('--tilt-y', '0deg');
        });
    }

    // ========================================================================
    // GESTIÓN DE PREFERENCIAS
    // ========================================================================

    /**
     * Carga todas las preferencias del usuario
     */
    function loadUserPreferences() {
        applyDashboardTheme();
        watchSystemTheme();
    }

    /**
     * Escucha cambios en localStorage desde otras pestañas
     */
    function watchStorageChanges() {
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEYS.THEME ||
                e.key === STORAGE_KEYS.FONT_SCALE ||
                e.key === STORAGE_KEYS.CONTRAST) {
                applyDashboardTheme();
            }
        });
    }

    // ========================================================================
    // INICIALIZACIÓN AUTOMÁTICA
    // ========================================================================

    document.addEventListener('DOMContentLoaded', () => {
        console.log('🎨 Dashboard Shared JS - Inicializando...');

        // Cargar preferencias
        loadUserPreferences();
        watchStorageChanges();

        // Inicializar animaciones
        initDashboardAnimations();

        // Efectos interactivos
        initCardHoverEffects();
        initGlowOrbsParallax();
        initHeroTiltEffect();

        // Animar números después de un breve delay
        setTimeout(() => {
            animateStatNumbers();
        }, 500);

        console.log('✅ Dashboard Shared JS - Listo');
    });

    // ========================================================================
    // EXPORTAR FUNCIONES PARA USO EXTERNO
    // ========================================================================

    window.DashboardUtils = {
        applyTheme: applyDashboardTheme
    };

})();
