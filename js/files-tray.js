(function registerFilesTray(SpireApp) {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    function createFilesTray({ reducedMotionMq }) {
        const files = $('[data-files]');
        const toggle = $('[data-files-toggle]');
        const list = $('#ai-files-list');
        const countLabel = $('[data-files-count]', files);

        const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

        const updateCount = () => {
            const count = $$('input[type="checkbox"]:checked', list).length;
            countLabel.textContent = `${count} ${count === 1 ? 'file' : 'files'} loaded into context`;
        };

        const setVisible = (visible) => {
            files.classList.toggle('is-visible', visible);
            files.inert = !visible;
            files.setAttribute('aria-hidden', String(!visible));
        };

        const setOpen = (open, { animate = true } = {}) => {
            toggle.setAttribute('aria-expanded', String(open));
            files.classList.remove('is-closing');

            if (open) {
                list.hidden = false;
                files.classList.add('is-open');
                return;
            }

            const finish = () => {
                if (isOpen()) return;
                files.classList.remove('is-open', 'is-closing');
                list.hidden = true;
            };

            if (!animate || reducedMotionMq.matches) {
                finish();
                return;
            }

            files.classList.add('is-closing');
            const onEnd = (event) => {
                if (event.target !== list) return;
                list.removeEventListener('animationend', onEnd);
                finish();
            };
            list.addEventListener('animationend', onEnd);
            window.setTimeout(finish, 400);
        };

        const close = () => {
            if (isOpen() || files.classList.contains('is-closing')) {
                setOpen(false, { animate: false });
            }
        };

        toggle.addEventListener('click', () => setOpen(!isOpen()));
        list.addEventListener('change', (event) => {
            if (event.target.matches('input[type="checkbox"]')) updateCount();
        });
        updateCount();

        return {
            close,
            focusToggle: () => toggle.focus({ preventScroll: true }),
            isOpen,
            setVisible,
        };
    }

    SpireApp.createFilesTray = createFilesTray;
}(window.SpireApp = window.SpireApp || {}));
