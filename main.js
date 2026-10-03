(() => {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    // =============================
    //  1. Toggeling The AI Chat Panel
    // ==============================
    const wrapper = document.querySelector('.spire-wrapper');

    if (!wrapper) return;

    const firstPanel = wrapper.querySelector('.panel-widgets');
    const chatPanel = wrapper.querySelector('.panel-chat');
    const closeButton = chatPanel?.querySelector('.panel__close');
    const panelControls = document.querySelectorAll('[aria-controls="ai-panel"]');

    if (!firstPanel || !chatPanel || !closeButton) return;

    const setPanelOpen = (isOpen) => {
        const wasOpen = wrapper.classList.contains('ai-opened');
        wrapper.classList.toggle('ai-opened', isOpen);
        chatPanel.setAttribute('aria-hidden', String(!isOpen));

        panelControls.forEach((control) => {
            control.setAttribute('aria-expanded', String(isOpen));
        });

        if (isOpen && !wasOpen) startConversation();
        if (!isOpen) stopConversation();
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

    panelControls.forEach((control) => {
        control.addEventListener('click', () => setPanelOpen(true));
    });

    /* ======================================================================
       2. Scripted chat demo
       ====================================================================== */
    const FIRST_QUESTION = 'Out of Gate Analysis for 22-27 March';
    const DOC_SUGGESTIONS = [
        'Summarize this document',
        'Where does it talk about eligibility?',
        'What are the key points?',
    ];
    const OPEN_DELAY_MS = 500;
    const MESSAGE_ENTER_MS = 250;
    const THINKING_MS = 2500;
    const SOURCES_SHOWN = 2;
    const chatLog = $('.msgs__list', chatPanel);
    const composer = $('.composer', chatPanel);
    const composerInput = $('.composer__input', composer);
    const sendButton = $('.composer__send', composer);
    const templates = {
        user: $('#tpl-user-msg'),
        thinking: $('#tpl-thinking'),
        ai: $('#tpl-ai-msg'),
        chip: $('#tpl-chip'),
        sources: $('#tpl-sources-toggle'),
    };
    const chatTimers = new Set();
    let busy = false;
    let turn = 0;

    const clone = (template) => template.content.firstElementChild.cloneNode(true);
    const nearBottom = () => chatLog.scrollHeight - chatLog.clientHeight - chatLog.scrollTop < 48;
    const scrollToEnd = () => chatLog.scrollTo({
        top: chatLog.scrollHeight,
        behavior: reducedMotionMq.matches ? 'auto' : 'smooth',
    });

    function scheduleChat(callback, delay) {
        const timer = window.setTimeout(() => {
            chatTimers.delete(timer);
            if (wrapper.classList.contains('ai-opened')) callback();
        }, delay);
        chatTimers.add(timer);
    }

    function setBusy(value) {
        busy = value;
        composer.setAttribute('aria-busy', String(value));
        sendButton.disabled = value;
        $$('[data-suggest]', chatLog).forEach((button) => {
            button.disabled = value || turn >= 2;
        });
    }

    function appendMessage(message, follow = nearBottom()) {
        chatLog.append(message);
        if (follow) scrollToEnd();
    }

    function renderReply(initial) {
        const message = clone(templates.ai);
        const cites = $('[data-cites]', message);
        const sources = initial ? [1] : [1, 3, 3, 1];
        sources.forEach((number, index) => {
            const cite = document.createElement('sup');
            cite.className = 'cite';
            const label = document.createElement('span');
            label.className = 'visually-hidden';
            label.textContent = 'source ';
            cite.append(label, String(number));
            cite.hidden = index >= SOURCES_SHOWN;
            cites.append(cite);
        });
        if (sources.length > SOURCES_SHOWN) {
            const toggle = clone(templates.sources);
            toggle.setAttribute('aria-label', `Show all ${sources.length} sources`);
            cites.append(toggle);
        }
        const actions = $('[data-actions]', message);
        if (initial) {
            DOC_SUGGESTIONS.forEach((text, index) => {
                const chip = clone(templates.chip);
                $('.chip__text', chip).textContent = text;
                chip.style.setProperty('--message-delay', `${(index + 1) * 80}ms`);
                actions.append(chip);
            });
        } else {
            actions.remove();
        }
        return message;
    }

    function sendMessage(text, { fromSuggestion = false } = {}) {
        text = text.trim();
        if (!text || busy || !wrapper.classList.contains('ai-opened')) return false;
        const initial = turn === 0;
        turn += 1;
        setBusy(true);
        chatPanel.dataset.chatState = 'user';
        const user = clone(templates.user);
        $('.msg__text', user).textContent = text;
        $('.msg__icon', user).hidden = !fromSuggestion;
        appendMessage(user, true);
        if (initial) setFilesVisible(true);

        scheduleChat(() => {
            chatPanel.dataset.chatState = 'thinking';
            const thinking = clone(templates.thinking);
            appendMessage(thinking);
            scheduleChat(() => {
                const follow = nearBottom();
                thinking.remove();
                appendMessage(renderReply(initial), follow);
                setBusy(false);
                chatPanel.dataset.chatState = initial ? 'suggestions' : 'complete';
            }, THINKING_MS);
        }, reducedMotionMq.matches ? 0 : MESSAGE_ENTER_MS);
        return true;
    }

    function stopConversation() {
        chatTimers.forEach((timer) => window.clearTimeout(timer));
        chatTimers.clear();
        closeFiles();
        setFilesVisible(false);
        $('.msg--thinking', chatLog)?.remove();
        setBusy(false);
        chatPanel.dataset.chatState = 'idle';
    }

    function startConversation() {
        stopConversation();
        chatLog.replaceChildren();
        chatLog.scrollTop = 0;
        turn = 0;
        setBusy(true);
        chatPanel.dataset.chatState = 'waiting';
        scheduleChat(() => {
            setBusy(false);
            sendMessage(FIRST_QUESTION);
        }, OPEN_DELAY_MS);
    }

    chatLog.addEventListener('click', (event) => {
        const suggestion = event.target.closest('[data-suggest]');
        if (suggestion && !suggestion.disabled) {
            if (sendMessage($('.chip__text', suggestion).textContent, { fromSuggestion: true })) {
                composerInput.focus({ preventScroll: true });
            }
            return;
        }
        const toggle = event.target.closest('[data-sources-toggle]');
        if (!toggle) return;
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        const cites = $$('.cite', toggle.parentElement);
        cites.forEach((cite, index) => { cite.hidden = !expanded && index >= SOURCES_SHOWN; });
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? 'Show fewer sources' : `Show all ${cites.length} sources`);
    });

    composer.addEventListener('submit', (event) => {
        event.preventDefault();
        if (sendMessage(composerInput.value)) composerInput.value = '';
    });



    /* ======================================================================
       3. Files-in-context tray
       ====================================================================== */
    const files = $('[data-files]');
    const filesToggle = $('[data-files-toggle]');
    const filesList = $('#ai-files-list');

    const isFilesOpen = () => filesToggle.getAttribute('aria-expanded') === 'true';

    function setFilesVisible(visible) {
        files.classList.toggle('is-visible', visible);
        files.inert = !visible;
        files.setAttribute('aria-hidden', String(!visible));
    }

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

    const initiallyOpen = wrapper.classList.contains('ai-opened');
    setPanelOpen(initiallyOpen);
    if (initiallyOpen) startConversation();

})();
