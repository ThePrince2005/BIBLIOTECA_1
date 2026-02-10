// Perfil UI enhancements (glassmorphism module)
(function () {
    const body = document.querySelector('.perfil-body');
    if (!body) return;

    const THEME_KEY = 'biblioteca:theme-preference';
    const CONTRAST_KEY = 'biblioteca:contrast';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (selection) => {
        let mode = selection;
        if (selection === 'auto') {
            mode = prefersDark.matches ? 'dark' : 'light';
        }

        body.classList.toggle('theme-dark', mode === 'dark');
        body.classList.toggle('theme-light', mode !== 'dark');
        document.documentElement.style.colorScheme = mode;
    };

    const storedTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(storedTheme);

    prefersDark.addEventListener('change', () => {
        if ((localStorage.getItem(THEME_KEY) || 'light') === 'auto') {
            applyTheme('auto');
        }
    });



    const contrast = localStorage.getItem(CONTRAST_KEY) === 'true';
    body.classList.toggle('contrast-boost', contrast);

    const animateCounters = () => {
        const counters = document.querySelectorAll('[data-stat-value]');
        if (!counters.length) return;

        const ease = (t) => 1 - Math.pow(1 - t, 3);

        counters.forEach((counter) => {
            const target = Number(counter.dataset.statValue) || 0;
            const duration = 900;
            const start = performance.now();

            const tick = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const value = Math.round(target * ease(progress));
                counter.textContent = value.toLocaleString('es-PE');
                if (progress < 1) requestAnimationFrame(tick);
            };

            requestAnimationFrame(tick);
        });
    };

    const hydrateProgress = () => {
        document.querySelectorAll('.progress-fill[data-progress]').forEach((bar) => {
            const value = Math.max(0, Math.min(100, Number(bar.dataset.progress) || 0));
            requestAnimationFrame(() => {
                bar.style.width = `${value}%`;
            });
        });
    };

    const bindHoverLight = () => {
        document.querySelectorAll('[data-hover-light]').forEach((el) => {
            const handleMove = (evt) => {
                const rect = el.getBoundingClientRect();
                const x = ((evt.clientX - rect.left) / rect.width) * 100;
                const y = ((evt.clientY - rect.top) / rect.height) * 100;
                el.style.setProperty('--hover-x', `${x}%`);
                el.style.setProperty('--hover-y', `${y}%`);
                el.classList.add('is-hovered');
            };

            el.addEventListener('pointermove', handleMove);
            el.addEventListener('pointerleave', () => el.classList.remove('is-hovered'));
        });
    };

    const bindAvatarTilt = () => {
        const avatar = document.querySelector('[data-avatar-tilt]');
        if (!avatar) return;

        const maxTilt = 12;

        avatar.addEventListener('pointermove', (evt) => {
            const rect = avatar.getBoundingClientRect();
            const x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
            const y = ((evt.clientY - rect.top) / rect.height) * 2 - 1;
            avatar.style.transform = `rotateX(${(-y * maxTilt).toFixed(2)}deg) rotateY(${(x * maxTilt).toFixed(2)}deg)`;
        });

        avatar.addEventListener('pointerleave', () => {
            avatar.style.transform = '';
        });
    };

    const init = () => {
        animateCounters();
        hydrateProgress();
        bindHoverLight();
        bindAvatarTilt();

        if (window.AOS) {
            window.AOS.init({
                duration: 850,
                once: true,
                easing: 'ease-out-cubic'
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
