/**
 * ========================================================================
 * BIBLIOTECA ESCOLAR - GESTOR DE TEMAS
 * Archivo: theme.js
 * Propósito: Manejo de tema oscuro/claro con persistencia
 * ========================================================================
 */

(function () {
    'use strict';

    const THEME_KEY = 'biblioteca:theme-preference';
    const THEMES = { LIGHT: 'light', DARK: 'dark', AUTO: 'auto' };

    class ThemeManager {
        constructor() {
            this.root = document.documentElement;
            this.currentTheme = this.getStoredTheme() || THEMES.AUTO;
            this.systemPreference = this.getSystemPreference();
            this.listeners = [];
            this.init();
        }

        init() {
            this.applyTheme(this.currentTheme);
            this.watchSystemPreference();
            this.createToggleButton();
            console.log('✅ Theme Manager inicializado');
        }

        getSystemPreference() {
            if (window.matchMedia) {
                return window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? THEMES.DARK : THEMES.LIGHT;
            }
            return THEMES.LIGHT;
        }

        getStoredTheme() {
            try {
                return localStorage.getItem(THEME_KEY);
            } catch (err) {
                console.warn('No se pudo acceder a localStorage:', err);
                return null;
            }
        }

        storeTheme(theme) {
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (err) {
                console.warn('No se pudo guardar en localStorage:', err);
            }
        }

        applyTheme(theme) {
            let effectiveTheme = theme;
            if (theme === THEMES.AUTO) {
                effectiveTheme = this.systemPreference;
            }

            const isDark = effectiveTheme === THEMES.DARK;

            // 1. Tailwind (class on HTML)
            this.root.classList.toggle('dark', isDark);

            // 2. CSS Variables (attribute on HTML)
            if (isDark) {
                this.root.setAttribute('data-theme', 'dark');
            } else {
                this.root.setAttribute('data-theme', 'light');
            }

            // 3. Legacy/Specific Styles (class on Body)
            // Ensure body exists before trying to access it (in case script runs in head)
            if (document.body) {
                document.body.classList.toggle('theme-dark', isDark);
                document.body.classList.toggle('theme-light', !isDark);
            } else {
                window.addEventListener('DOMContentLoaded', () => {
                    document.body.classList.toggle('theme-dark', isDark);
                    document.body.classList.toggle('theme-light', !isDark);
                });
            }

            this.currentTheme = theme;
            this.notifyListeners(effectiveTheme);
            this.updateToggleButton(effectiveTheme);
        }

        setTheme(theme) {
            if (!Object.values(THEMES).includes(theme)) {
                console.error('Tema inválido:', theme);
                return;
            }
            this.applyTheme(theme);
            this.storeTheme(theme);
        }

        toggle() {
            const currentEffective = this.getCurrentEffectiveTheme();
            const newTheme = currentEffective === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
            this.setTheme(newTheme);
        }

        getCurrentEffectiveTheme() {
            return this.root.getAttribute('data-theme') || THEMES.LIGHT;
        }

        watchSystemPreference() {
            if (!window.matchMedia) return;
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e) => {
                this.systemPreference = e.matches ? THEMES.DARK : THEMES.LIGHT;
                if (this.currentTheme === THEMES.AUTO) {
                    this.applyTheme(THEMES.AUTO);
                }
            };
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handler);
            } else {
                mediaQuery.addListener(handler);
            }
        }

        createToggleButton() {
            const containers = document.querySelectorAll('[data-theme-toggle-container]');
            if (!containers.length) return;

            containers.forEach(container => {
                // Prevent duplicate buttons if called multiple times
                if (container.querySelector('.theme-toggle')) return;

                const button = document.createElement('button');
                button.className = 'theme-toggle';
                button.setAttribute('aria-label', 'Cambiar tema');
                button.setAttribute('title', 'Cambiar tema');
                button.innerHTML = `
                    <div class="theme-toggle__slider">
                        <i class="theme-toggle__icon fas fa-sun"></i>
                    </div>
                `;
                button.addEventListener('click', () => this.toggle());
                container.appendChild(button);
            });
        }

        updateToggleButton(theme) {
            const buttons = document.querySelectorAll('.theme-toggle');
            if (!buttons.length) return;

            buttons.forEach(button => {
                const icon = button.querySelector('.theme-toggle__icon');
                if (!icon) return;

                if (theme === THEMES.DARK) {
                    icon.className = 'theme-toggle__icon fas fa-moon';
                    button.setAttribute('aria-label', 'Cambiar a tema claro');
                } else {
                    icon.className = 'theme-toggle__icon fas fa-sun';
                    button.setAttribute('aria-label', 'Cambiar a tema oscuro');
                }
            });
        }

        onChange(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        }

        notifyListeners(theme) {
            this.listeners.forEach(callback => {
                try {
                    callback(theme);
                } catch (err) {
                    console.error('Error en listener de tema:', err);
                }
            });
        }
    }

    // Crear instancia global
    window.ThemeManager = new ThemeManager();

    // API pública
    window.setTheme = (theme) => window.ThemeManager.setTheme(theme);
    window.toggleTheme = () => window.ThemeManager.toggle();
    window.getCurrentTheme = () => window.ThemeManager.getCurrentEffectiveTheme();

    // Atajo de teclado: Ctrl/Cmd + Shift + T
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            window.ThemeManager.toggle();
            showThemeNotification();
        }
    });

    function showThemeNotification() {
        const theme = window.ThemeManager.getCurrentEffectiveTheme();
        const message = theme === 'dark' ? '🌙 Tema oscuro activado' : '☀️ Tema claro activado';
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: var(--card-bg);
            border: 1px solid var(--border-primary);
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            z-index: 9999;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Integración con Chart.js
    window.ThemeManager.onChange((theme) => {
        if (typeof Chart !== 'undefined') {
            const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
            const gridColor = theme === 'dark'
                ? 'rgba(148, 224, 239, 0.1)'
                : 'rgba(148, 224, 239, 0.2)';
            Chart.defaults.color = textColor;
            Chart.defaults.borderColor = gridColor;
            Object.values(Chart.instances).forEach(chart => {
                if (chart.options.scales) {
                    Object.values(chart.options.scales).forEach(scale => {
                        if (scale.ticks) scale.ticks.color = textColor;
                        if (scale.grid) scale.grid.color = gridColor;
                    });
                }
                chart.update();
            });
        }
    });

    console.log('🎨 Sistema de temas cargado');
})();
