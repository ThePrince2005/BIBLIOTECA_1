/**
 * BIBLIOTECA ESCOLAR DANIEL HERNÁNDEZ
 * Archivo: /public/js/auth-shared.js
 * Propósito: Funciones compartidas para todas las vistas de autenticación
 */

(function () {
    'use strict';

    // ========================================================================
    // CONSTANTES
    // ========================================================================

    const THEME_KEY = 'biblioteca:theme-preference';
    const CONTRAST_KEY = 'biblioteca:contrast';
    const FONT_KEY = 'biblioteca:font-scale';

    // ========================================================================
    // SISTEMA DE NOTIFICACIONES (TOAST)
    // ========================================================================

    /**
     * Muestra un mensaje toast
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de mensaje: 'success' o 'error'
     * @param {number} duration - Duración en milisegundos (default: 3000)
     */
    window.showToast = function (message, type = 'error', duration = 4000) {
        let toast = document.getElementById('authToast');

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'authToast';
            document.body.appendChild(toast);
        }

        // ==========================================
        // CONFIGURACIÓN DE DISEÑO PRO
        // ==========================================
        const isError = type === 'error';
        const iconClass = isError ? 'fa-circle-exclamation' : 'fa-circle-check';
        const titleText = isError ? 'Atención' : '¡Éxito!';
        const primaryColor = isError ? '#EF4444' : '#10B981'; // Rojo / Verde
        const bgColor = isError ? '#FEF2F2' : '#ECFDF5'; // Fondos suaves
        const borderColor = isError ? '#FCA5A5' : '#6EE7B7';

        // RECONSTRUCCIÓN DOM (Rich Toast)
        toast.className = 'toast-pro';
        toast.innerHTML = '';

        // Contenedor principal flex
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-left: 5px solid ${primaryColor};
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.05);
            min-width: 320px;
            max-width: 420px;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        // 1. Icono
        const iconDiv = document.createElement('div');
        iconDiv.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
        iconDiv.style.cssText = `
            font-size: 24px;
            color: ${primaryColor};
            flex-shrink: 0;
            margin-top: 2px;
        `;

        // 2. Contenido de Texto
        const textDiv = document.createElement('div');
        textDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
        `;

        const titleEl = document.createElement('h4');
        titleEl.textContent = titleText;
        titleEl.style.cssText = `
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
            line-height: 1.2;
        `;

        const msgEl = document.createElement('p');
        msgEl.textContent = message;
        msgEl.style.cssText = `
            margin: 0;
            font-size: 14px;
            color: #64748b;
            line-height: 1.4;
            font-weight: 500;
        `;

        // Ensamblar
        textDiv.appendChild(titleEl);
        textDiv.appendChild(msgEl);
        container.appendChild(iconDiv);
        container.appendChild(textDiv);
        toast.appendChild(container);

        // Posicionamiento fijo del contenedor padre
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 100000;
            pointer-events: none; /* Click through */
        `;

        container.style.pointerEvents = 'auto'; // Permitir clicks en el toast

        // LOGICA DE ANIMACIÓN
        // 1. Entrada
        requestAnimationFrame(() => {
            container.style.transform = 'translateY(0)';
            container.style.opacity = '1';
        });

        // 2. Salida
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        window.toastTimeout = setTimeout(() => {
            container.style.transform = 'translateY(20px) scale(0.95)';
            container.style.opacity = '0';
            setTimeout(() => {
                // Limpiar si el elemento sigue ahí
                if (container.parentNode === toast) {
                    toast.removeChild(container);
                }
            }, 400);
        }, duration);
    };

    // ========================================================================
    // TOGGLE PASSWORD VISIBILITY
    // ========================================================================

    /**
     * Inicializa el toggle de visibilidad de contraseña
     * @param {string} inputId - ID del input de contraseña
     * @param {string} buttonId - ID del botón toggle
     */
    window.initPasswordToggle = function (inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);

        if (!input || !button) return;

        button.addEventListener('click', () => {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);

            const icon = button.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    };

    // ========================================================================
    // SINCRONIZACIÓN DE TEMA
    // ========================================================================

    /**
     * Aplica el tema guardado al body
     */
    window.applyAuthTheme = function () {
        const body = document.querySelector('.auth-body');
        if (!body) return;

        try {
            const storedTheme = localStorage.getItem(THEME_KEY);
            const storedContrast = localStorage.getItem(CONTRAST_KEY) === 'true';
            const storedFont = localStorage.getItem(FONT_KEY);

            // Aplicar tema
            if (storedTheme === 'dark') {
                body.classList.add('theme-dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            } else if (storedTheme === 'light') {
                body.classList.remove('theme-dark');
                document.documentElement.setAttribute('data-theme', 'light');
            } else {
                // Auto: usar preferencia del sistema
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                    body.classList.add('theme-dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                }
            }

            // Aplicar contraste
            if (storedContrast) {
                body.classList.add('contrast-boost');
                document.documentElement.classList.add('contrast-boost');
            }

            // Aplicar escala de fuente
            if (storedFont && storedFont !== '0') {
                document.documentElement.setAttribute('data-font-scale', storedFont);
            }
        } catch (err) {
            console.warn('No se pudieron cargar las preferencias de tema:', err);
        }
    };

    // ========================================================================
    // VALIDACIÓN DE FORMULARIOS
    // ========================================================================

    /**
     * Valida un email
     * @param {string} email - Email a validar
     * @returns {boolean}
     */
    window.validateEmail = function (email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    /**
     * Valida una contraseña
     * @param {string} password - Contraseña a validar
     * @returns {object} - { valid: boolean, errors: string[] }
     */
    window.validatePassword = function (password) {
        const errors = [];

        if (password.length < 8) {
            errors.push('La contraseña debe tener al menos 8 caracteres');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Debe incluir al menos una letra mayúscula');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Debe incluir al menos una letra minúscula');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Debe incluir al menos un número');
        }
        if (!/[@$!%*?&]/.test(password)) {
            errors.push('Debe incluir al menos un carácter especial (@, $, !, %, *, ?, &)');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    };

    // ========================================================================
    // ANIMACIONES AOS
    // ========================================================================

    /**
     * Inicializa AOS si está disponible
     */
    window.initAuthAOS = function () {
        if (window.AOS) {
            AOS.init({
                duration: 600,
                once: true,
                easing: 'ease-out-cubic',
                offset: 50
            });
        }
    };

    // ========================================================================
    // MANEJO DE ERRORES DE FETCH
    // ========================================================================

    /**
     * Maneja errores de fetch y muestra mensajes apropiados
     * @param {Response} response - Respuesta del fetch
     * @returns {Promise}
     */
    window.handleFetchError = async function (response) {
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            let errorMessage = data.message || 'Error en la solicitud';

            // Support for express-validator errors array
            if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                errorMessage = data.errors.map(e => e.msg).join('. ');
            }

            throw new Error(errorMessage);
        }
        return response.json();
    };

    // ========================================================================
    // INICIALIZACIÓN AUTOMÁTICA
    // ========================================================================

    document.addEventListener('DOMContentLoaded', () => {
        // Aplicar tema guardado
        applyAuthTheme();

        // Inicializar AOS
        initAuthAOS();

        // Escuchar cambios en preferencias del sistema
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeQuery.addEventListener('change', (e) => {
            const storedTheme = localStorage.getItem(THEME_KEY);
            if (!storedTheme || storedTheme === 'auto') {
                applyAuthTheme();
            }
        });
    });

})();
