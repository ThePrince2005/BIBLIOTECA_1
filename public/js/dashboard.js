(function () {
    const body = document.querySelector('.dashboard-body');
    if (!body) return;

    // Debug logging
    console.log('Dashboard script loaded');
    console.log('Body element found:', !!body);

    const hero = document.querySelector('.dashboard-hero');
    const statCards = document.querySelectorAll('.stat-card');
    const dashPanels = document.querySelectorAll('.dash-panel');
    const counters = document.querySelectorAll('[data-count]');
    const heroStatus = document.querySelector('.hero-highlight');
    const heroMetaChips = document.querySelectorAll('.dashboard-hero__meta .meta-chip');
    const glowOrbs = document.querySelectorAll('.glow-orb');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const numberFormatter = new Intl.NumberFormat('es-PE');

    // Debug element counts
    console.log('Elements found:', {
        hero: !!hero,
        statCards: statCards.length,
        dashPanels: dashPanels.length,
        counters: counters.length,
        heroStatus: !!heroStatus,
        heroMetaChips: heroMetaChips.length,
        glowOrbs: glowOrbs.length
    });

    body.classList.add('dashboard-animated');

    const animateCounter = (element) => {
        if (!element || element.dataset.animating === 'true') return;
        const target = Number(element.dataset.count || element.textContent || 0);
        if (!Number.isFinite(target)) return;

        element.dataset.animating = 'true';
        const duration = 1400;
        const easeOutQuad = (t) => t * (2 - t);
        let startTime = null;

        const step = (timestamp) => {
            if (startTime === null) {
                startTime = timestamp;
            }
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased = easeOutQuad(progress);
            const current = Math.round(target * eased);
            element.textContent = numberFormatter.format(current);

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                element.textContent = numberFormatter.format(target);
            }
        };

        requestAnimationFrame(step);
    };

    const counterObserver = new IntersectionObserver((entries, self) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                self.unobserve(entry.target);
            }
        });
    }, { threshold: 0.65 });

    counters.forEach((el) => counterObserver.observe(el));

    const revealObserver = new IntersectionObserver((entries, self) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                self.unobserve(entry.target);
            }
        });
    }, { threshold: 0.35 });

    [...statCards, ...dashPanels, heroStatus, ...heroMetaChips].forEach((el) => {
        if (el) {
            revealObserver.observe(el);
        }
    });

    const runMetaPulse = () => {
        if (!heroMetaChips.length || prefersReducedMotion.matches) return;
        let index = 0;
        setInterval(() => {
            heroMetaChips.forEach((chip, chipIndex) => {
                chip.classList.toggle('is-active', chipIndex === index);
            });
            index = (index + 1) % heroMetaChips.length;
        }, 3200);
    };

    runMetaPulse();

    const parallaxHandler = (event) => {
        if (!hero) return;
        const rect = hero.getBoundingClientRect();
        const relativeX = (event.clientX - rect.left) / rect.width;
        const relativeY = (event.clientY - rect.top) / rect.height;
        const rotateX = (0.5 - relativeY) * 8;
        const rotateY = (relativeX - 0.5) * 8;

        hero.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
        hero.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
        hero.style.setProperty('--glow-shift-x', `${(relativeX - 0.5) * 30}%`);
        hero.style.setProperty('--glow-shift-y', `${(relativeY - 0.5) * 30}%`);
    };

    if (hero && !prefersReducedMotion.matches) {
        hero.setAttribute('data-parallax-ready', 'true');
        hero.addEventListener('pointermove', parallaxHandler);
        hero.addEventListener('pointerleave', () => {
            hero.style.removeProperty('--tilt-x');
            hero.style.removeProperty('--tilt-y');
            hero.style.removeProperty('--glow-shift-x');
            hero.style.removeProperty('--glow-shift-y');
        });
    }

    const animateGlowOrbs = () => {
        if (!glowOrbs.length || prefersReducedMotion.matches) return;
        let frame = 0;

        const loop = () => {
            frame += 0.005;
            glowOrbs.forEach((orb, index) => {
                const offset = frame + index * 0.6;
                const translateX = Math.sin(offset) * 14;
                const translateY = Math.cos(offset) * 18;
                orb.style.transform = `translate(${translateX}px, ${translateY}px)`;
                orb.style.opacity = `${0.65 + Math.sin(offset) * 0.2}`;
            });
            requestAnimationFrame(loop);
        };

        loop();
    };

    animateGlowOrbs();

    if (heroStatus && !prefersReducedMotion.matches) {
        heroStatus.classList.add('is-pulsing');
    }

    if (window.AOS) {
        window.AOS.init({
            duration: 900,
            easing: 'ease-out-cubic',
            once: true,
            offset: 30
        });
    }
})();
