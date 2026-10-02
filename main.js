(() => {
    'use strict';

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
        setPanelOpen(false);
    });

    setPanelOpen(wrapper.classList.contains('ai-opened'));
})();
