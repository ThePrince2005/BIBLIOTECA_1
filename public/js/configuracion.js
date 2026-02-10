(function () {
    const body = document.querySelector('.configuracion-body');
    if (!body) return;

    // --- DOM Elements ---
    const themeToggle = document.querySelector('[data-theme-toggle]');
    const themeChips = document.querySelectorAll('[data-theme-option]');
    const autoThemeBtn = document.querySelector('[data-theme-auto]');
    const previewThemes = document.querySelectorAll('.preview-theme');
    const previewSyncBtn = document.querySelector('.preview-card__sync');

    // Contrast Logic (kept local as it seems specific to this view or not fully globalized yet)
    const CONTRAST_KEY = 'biblioteca:contrast';
    const contrastBtn = document.querySelector('[data-contrast]');
    const storedContrast = localStorage.getItem(CONTRAST_KEY) === 'true';

    // --- Theme Synchronization Logic ---

    const updateUI = (theme) => {
        // 1. Update Preview Section
        const effectiveTheme = (theme === 'auto' || !theme)
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme;

        previewThemes.forEach((preview) => {
            const isMatch = preview.classList.contains(`preview-theme--${effectiveTheme}`);
            preview.classList.toggle('is-active', isMatch);
        });

        // 2. Update Chips State
        themeChips.forEach((chip) => {
            const isSelected = chip.dataset.themeOption === theme;
            chip.classList.toggle('is-active', isSelected);
        });
        if (autoThemeBtn) {
            autoThemeBtn.classList.toggle('is-active', theme === 'auto');
        }

        // 3. Update Toggle Switch
        if (themeToggle) {
            themeToggle.checked = effectiveTheme === 'dark';
        }
    };

    // Initialize UI using global state
    if (window.ThemeManager) {
        // Initial state
        const initialTheme = window.ThemeManager.currentTheme || window.ThemeManager.getStoredTheme() || 'auto';
        updateUI(initialTheme);

        // Listen for global changes
        window.ThemeManager.onChange((newTheme) => {
            // newTheme comes from ThemeManager as the *effective* theme (dark/light)
            updateUI(newTheme);
        });
    }

    // --- Event Listeners ---

    // Toggle Switch
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            if (window.ThemeManager) window.ThemeManager.setTheme(newTheme);
        });
    }

    // Theme Chips
    themeChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const targetTheme = chip.dataset.themeOption || 'light';
            if (window.ThemeManager) window.ThemeManager.setTheme(targetTheme);
        });
    });

    // Auto Theme Button
    autoThemeBtn?.addEventListener('click', () => {
        if (window.ThemeManager) window.ThemeManager.setTheme('auto');
    });

    // Preview Sync Button (Spin animation only, logic is auto-handled)
    previewSyncBtn?.addEventListener('click', () => {
        if (!previewSyncBtn.classList.contains('is-rotating')) {
            previewSyncBtn.classList.add('is-rotating');
            setTimeout(() => previewSyncBtn.classList.remove('is-rotating'), 650);
        }
        // Force re-apply current theme to ensure sync
        if (window.ThemeManager) {
            const current = window.ThemeManager.currentTheme;
            window.ThemeManager.applyTheme(current);
        }
    });


    // --- Contrast Logic (Preserved) ---
    const setContrast = (state) => {
        body.classList.toggle('contrast-boost', state);
        contrastBtn?.classList.toggle('is-active', state);
        const label = contrastBtn?.querySelector('span');
        if (label) {
            label.textContent = state ? 'Boost activado' : 'Activar boost';
        }
        localStorage.setItem(CONTRAST_KEY, state);
    };

    setContrast(storedContrast);

    contrastBtn?.addEventListener('click', () => {
        setContrast(!body.classList.contains('contrast-boost'));
    });

    // --- AOS Init ---
    if (window.AOS) {
        window.AOS.init({
            duration: 800,
            once: true,
            easing: 'ease-out-cubic'
        });
    }
})();
