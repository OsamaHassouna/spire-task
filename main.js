(() => {
    'use strict';


    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    // =============================
    //  Toggeling The AI Chat Panel
    // ==============================
    const wrapper = document.querySelector('.spire-wrapper');

    if (!wrapper) return;

    const firstPanel = wrapper.querySelector('.panel-widgets');
    const chatPanel = wrapper.querySelector('.panel-chat');
    const closeButton = chatPanel?.querySelector('.panel__close');
    const panelControls = document.querySelectorAll('[aria-controls="ai-panel"]');

    if (!firstPanel || !chatPanel || !closeButton) return;

    const setPanelOpen = (isOpen) => {
        wrapper.classList.toggle('ai-opened', isOpen);
        chatPanel.setAttribute('aria-hidden', String(!isOpen));

        panelControls.forEach((control) => {
            control.setAttribute('aria-expanded', String(isOpen));
        });
    };

    firstPanel.addEventListener('click', () => {
        if (!wrapper.classList.contains('ai-opened')) {
            setPanelOpen(true);
        }
    });

    closeButton.addEventListener('click', () => {
        closeFiles();
        setPanelOpen(false);
    });

    setPanelOpen(wrapper.classList.contains('ai-opened'));



    /* ======================================================================
       3. Files-in-context tray
       ====================================================================== */
    const files = $('[data-files]');
    const filesToggle = $('[data-files-toggle]');
    const filesList = $('#ai-files-list');

    const isFilesOpen = () => filesToggle.getAttribute('aria-expanded') === 'true';

    function setFilesOpen(open, { animate = true } = {}) {
        filesToggle.setAttribute('aria-expanded', String(open));
        files.classList.remove('is-closing');

        if (open) {
            filesList.hidden = false;
            files.classList.add('is-open');
            return;
        }

        const finish = () => {
            if (isFilesOpen()) return;
            files.classList.remove('is-open', 'is-closing');
            filesList.hidden = true;
        };

        if (!animate || reducedMotionMq.matches) {
            finish();
            return;
        }
        files.classList.add('is-closing');
        const onEnd = (event) => {
            if (event.target !== filesList) return;
            filesList.removeEventListener('animationend', onEnd);
            finish();
        };
        filesList.addEventListener('animationend', onEnd);
        window.setTimeout(finish, 400);
    }

    function closeFiles() {
        if (isFilesOpen() || files.classList.contains('is-closing')) {
            setFilesOpen(false, { animate: false });
        }
    }

    filesToggle.addEventListener('click', () => setFilesOpen(!isFilesOpen()));

})();
