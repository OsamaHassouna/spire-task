(function initializeApp(SpireApp) {
    'use strict';

    const mobileNavMq = window.matchMedia('(max-width: 1023.98px)');
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.querySelector('.skip-link')?.addEventListener('click', () => {
        document.querySelector('#main')?.focus();
    });

    document.querySelector('.search')?.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    SpireApp.initNavigation({ mobileNavMq });

    const wrapper = document.querySelector('.spire-wrapper');
    const chatPanel = wrapper?.querySelector('.panel-chat');

    if (wrapper && chatPanel) {
        const filesTray = SpireApp.createFilesTray({ reducedMotionMq });
        const chat = SpireApp.createChatDemo({ wrapper, chatPanel, reducedMotionMq, filesTray });

        SpireApp.initAiPanel({ wrapper, mobileNavMq, chat, filesTray });
    }
}(window.SpireApp = window.SpireApp || {}));
