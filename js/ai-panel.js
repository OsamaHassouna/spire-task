(function registerAiPanel(SpireApp) {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    function initAiPanel({ wrapper, mobileNavMq, chat, filesTray }) {
        const firstPanel = $('.panel-widgets', wrapper);
        const chatPanel = $('.panel-chat', wrapper);
        const closeButton = $('.panel__close', chatPanel);
        const panelControls = $$('[aria-controls="ai-panel"]');
        const aiPanel = $('.spr-ai');
        const welcomePanel = $('.panel-welcome');
        const welcomeClose = $('.welcome__close');
        const welcomeForm = $('.welcome__composer');
        const welcomeInput = $('#welcome-ai-input');
        const aiBackdrop = $('.ai-backdrop');
        const heroForm = $('.ask');
        const heroInput = $('#hero-ask');
        const heroButton = $('.ask__cta');

        if (!firstPanel || !chatPanel || !closeButton) return;

        let aiDrawerOpen = false;
        let aiReturnFocus = null;
        const aiBackgroundState = new Map();

        // --- Chat State ---
        const setPanelOpen = (isOpen, initialQuestion) => {
            const wasOpen = wrapper.classList.contains('ai-opened');
            wrapper.classList.toggle('ai-opened', isOpen);
            chatPanel.setAttribute('aria-hidden', String(!isOpen));
            welcomePanel.setAttribute('aria-hidden', String(isOpen || !aiDrawerOpen));
            panelControls.forEach((control) => {
                control.setAttribute('aria-expanded', String(mobileNavMq.matches ? aiDrawerOpen : isOpen));
            });

            if (isOpen && !wasOpen) chat.start(initialQuestion);
            if (!isOpen) chat.stop();
        };

        // --- Drawer State ---
        const setAiDrawerOpen = (open, trigger = null) => {
            aiDrawerOpen = open && mobileNavMq.matches;
            wrapper.classList.toggle('ai-drawer-open', aiDrawerOpen);
            document.documentElement.classList.toggle('ai-drawer-open', aiDrawerOpen);
            if (aiDrawerOpen) {
                aiReturnFocus = trigger || document.activeElement;
                aiPanel.inert = false;
                aiPanel.removeAttribute('aria-hidden');
                aiPanel.setAttribute('role', 'dialog');
                aiPanel.setAttribute('aria-modal', 'true');
                setPanelOpen(false);
                welcomeClose.focus({ preventScroll: true });
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (aiDrawerOpen && !wrapper.classList.contains('ai-opened')) {
                        welcomeClose.focus({ preventScroll: true });
                    }
                }));
                $$('.spr-content, .skip-link').forEach((element) => {
                    aiBackgroundState.set(element, element.inert);
                    element.inert = true;
                });
            } else {
                chat.stop();
                aiBackgroundState.forEach((inert, element) => { element.inert = inert; });
                aiBackgroundState.clear();
                if (aiPanel.contains(document.activeElement)) {
                    const target = aiReturnFocus?.getClientRects().length ? aiReturnFocus : $('.ask__cta');
                    target?.focus({ preventScroll: true });
                }
                aiPanel.removeAttribute('role');
                aiPanel.removeAttribute('aria-modal');
                aiPanel.inert = mobileNavMq.matches;
                if (mobileNavMq.matches) aiPanel.setAttribute('aria-hidden', 'true');
                else aiPanel.removeAttribute('aria-hidden');
                panelControls.forEach((control) => control.setAttribute('aria-expanded', 'false'));
            }
        };

        const openDesktopPanel = (trigger, initialQuestion) => {
            aiReturnFocus = trigger;
            setPanelOpen(true, initialQuestion);
            closeButton.focus({ preventScroll: true });
        };

        const closeDesktopPanel = () => {
            setPanelOpen(false);
            const target = aiReturnFocus?.getClientRects().length ? aiReturnFocus : $('.widget__add');
            target?.focus({ preventScroll: true });
        };

        // --- Events ---
        firstPanel.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            if (!wrapper.classList.contains('ai-opened')) openDesktopPanel($('.widget__add'));
        });

        closeButton.addEventListener('click', () => {
            filesTray.close();
            if (mobileNavMq.matches) setAiDrawerOpen(false);
            else closeDesktopPanel();
        });

        panelControls.forEach((control) => {
            if (control === heroButton) return;
            control.addEventListener('click', () => {
                if (mobileNavMq.matches) setAiDrawerOpen(true, control);
                else openDesktopPanel(control);
            });
        });

        heroForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const question = heroInput.value.trim();
            if (mobileNavMq.matches) {
                setAiDrawerOpen(true, heroButton);
                if (question) {
                    setPanelOpen(true, question);
                    closeButton.focus({ preventScroll: true });
                }
            } else if (wrapper.classList.contains('ai-opened') && question) {
                if (!chat.send(question)) return;
                chat.composerInput.focus({ preventScroll: true });
            } else {
                openDesktopPanel(heroButton, question || undefined);
            }
            heroInput.value = '';
        });

        welcomeClose.addEventListener('click', () => setAiDrawerOpen(false));
        $('[data-ai-back]').addEventListener('click', () => {
            setPanelOpen(false);
            welcomeClose.focus({ preventScroll: true });
        });
        aiBackdrop.addEventListener('click', () => setAiDrawerOpen(false));
        welcomeForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            const question = welcomeInput.value.trim();
            setPanelOpen(true, question || undefined);
            welcomeInput.value = '';
            closeButton.focus({ preventScroll: true });
        });

        document.addEventListener('keydown', (event) => {
            if (!aiDrawerOpen && !wrapper.classList.contains('ai-opened')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                if (filesTray.isOpen()) {
                    filesTray.close();
                    filesTray.focusToggle();
                } else if (aiDrawerOpen) setAiDrawerOpen(false);
                else if (!mobileNavMq.matches) closeDesktopPanel();
            } else if (event.key === 'Tab' && aiDrawerOpen) {
                const items = $$('button, a[href], input, [tabindex="0"]', aiPanel)
                    .filter((element) => !element.disabled
                        && !element.closest('[inert]')
                        && element.getClientRects().length);
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
            setAiDrawerOpen(false);
            setPanelOpen(false);
        });

        // --- Initial State ---
        const initiallyOpen = wrapper.classList.contains('ai-opened');
        setPanelOpen(initiallyOpen);
        if (initiallyOpen) chat.start();
        if (mobileNavMq.matches) setAiDrawerOpen(false);
    }

    SpireApp.initAiPanel = initAiPanel;
}(window.SpireApp = window.SpireApp || {}));
