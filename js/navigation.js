(function registerNavigation(SpireApp) {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    function initNavigation({ mobileNavMq }) {
        const sidenav = $('.spr-sidenav');
        const navToggle = $('.nav-toggle');
        const navClose = $('.sidenav__close');
        const navBackdrop = $('.nav-backdrop');

        if (!sidenav || !navToggle || !navClose || !navBackdrop) return;

        let navOpen = false;
        const backgroundState = new Map();
        const focusableLinks = () => $$('button, a[href]', sidenav)
            .filter((element) => !element.disabled && element.getClientRects().length);

        // --- State ---
        const setNavOpen = (open, restoreFocus = true) => {
            navOpen = open && mobileNavMq.matches;
            document.documentElement.classList.toggle('nav-open', navOpen);
            navToggle.setAttribute('aria-expanded', String(navOpen));

            if (navOpen) {
                sidenav.inert = false;
                sidenav.removeAttribute('aria-hidden');
                sidenav.setAttribute('role', 'dialog');
                sidenav.setAttribute('aria-modal', 'true');
                navClose.focus({ preventScroll: true });
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (navOpen) navClose.focus({ preventScroll: true });
                }));
                $$('.spr-header, .content-wrapper, .spr-ai, .skip-link').forEach((element) => {
                    if (!backgroundState.has(element)) backgroundState.set(element, element.inert);
                    element.inert = true;
                });
            } else {
                backgroundState.forEach((inert, element) => { element.inert = inert; });
                backgroundState.clear();
                if (restoreFocus && mobileNavMq.matches) navToggle.focus({ preventScroll: true });
                if (!mobileNavMq.matches && document.activeElement === navClose) {
                    $('.sidenav__link', sidenav)?.focus({ preventScroll: true });
                }
                sidenav.removeAttribute('role');
                sidenav.removeAttribute('aria-modal');
                sidenav.inert = mobileNavMq.matches;
                if (mobileNavMq.matches) sidenav.setAttribute('aria-hidden', 'true');
                else sidenav.removeAttribute('aria-hidden');
            }
        };

        // --- Events ---
        navToggle.addEventListener('click', () => setNavOpen(!navOpen));
        navClose.addEventListener('click', () => setNavOpen(false));
        navBackdrop.addEventListener('click', () => setNavOpen(false));
        sidenav.addEventListener('click', (event) => {
            if (navOpen && event.target.closest('a[href]')) setNavOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (!navOpen) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                setNavOpen(false);
            } else if (event.key === 'Tab') {
                const items = focusableLinks();
                const first = items[0];
                const last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
        mobileNavMq.addEventListener('change', () => {
            const focusInNav = sidenav.contains(document.activeElement);
            setNavOpen(false, focusInNav);
        });
        setNavOpen(false, false);
    }

    SpireApp.initNavigation = initNavigation;
}(window.SpireApp = window.SpireApp || {}));
