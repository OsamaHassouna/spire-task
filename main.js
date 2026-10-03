(() => {
    'use strict';

    // ==============================
    //  Shared Helpers
    // ==============================

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    // ==============================
    //  1. Side Navigation Drawer
    // ==============================

    // Mobile navigation uses the same links as the desktop sidebar.
    const sidenav = $('.spr-sidenav');
    const navToggle = $('.nav-toggle');
    const navClose = $('.sidenav__close');
    const navBackdrop = $('.nav-backdrop');
    // Keep this breakpoint aligned with the compact layout in styles.css.
    const mobileNavMq = window.matchMedia('(max-width: 1023.98px)');

    if (sidenav && navToggle && navClose && navBackdrop) {
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
                // Focus after the visibility change has reached the rendered frame.
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
                // A resize must not leave focus on the now-hidden close button.
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

    // ==============================
    //  2. AI Chat Panel & Drawer
    // ==============================

    const wrapper = document.querySelector('.spire-wrapper');

    if (!wrapper) return;

    const firstPanel = wrapper.querySelector('.panel-widgets');
    const chatPanel = wrapper.querySelector('.panel-chat');
    const closeButton = chatPanel?.querySelector('.panel__close');
    const panelControls = document.querySelectorAll('[aria-controls="ai-panel"]');
    const aiPanel = $('.spr-ai');
    const welcomePanel = $('.panel-welcome');
    const welcomeClose = $('.welcome__close');
    const aiBackdrop = $('.ai-backdrop');
    let aiDrawerOpen = false;
    let aiReturnFocus = null;
    const aiBackgroundState = new Map();

    if (!firstPanel || !chatPanel || !closeButton) return;

    // --- Chat State ---
    const setPanelOpen = (isOpen) => {
        const wasOpen = wrapper.classList.contains('ai-opened');
        wrapper.classList.toggle('ai-opened', isOpen);
        chatPanel.setAttribute('aria-hidden', String(!isOpen));

        welcomePanel.setAttribute('aria-hidden', String(isOpen || !aiDrawerOpen));
        panelControls.forEach((control) => {
            control.setAttribute('aria-expanded', String(mobileNavMq.matches ? aiDrawerOpen : isOpen));
        });

        if (isOpen && !wasOpen) startConversation();
        if (!isOpen) stopConversation();
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
            // Opening the drawer always starts on the welcome screen.
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
            stopConversation();
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
            // Keep the current screen painted while the drawer slides out.
        }
    };

    // --- Events ---
    firstPanel.addEventListener('click', () => {
        if (!wrapper.classList.contains('ai-opened')) {
            setPanelOpen(true);
        }
    });

    closeButton.addEventListener('click', () => {
        closeFiles();
        if (mobileNavMq.matches) setAiDrawerOpen(false);
        else setPanelOpen(false);
    });

    panelControls.forEach((control) => {
        control.addEventListener('click', () => {
            if (mobileNavMq.matches) setAiDrawerOpen(true, control);
            else setPanelOpen(true);
        });
    });

    welcomeClose.addEventListener('click', () => setAiDrawerOpen(false));
    aiBackdrop.addEventListener('click', () => setAiDrawerOpen(false));
    $('[data-ai-start]').addEventListener('click', () => {
        setPanelOpen(true);
        closeButton.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', (event) => {
        if (!aiDrawerOpen) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            setAiDrawerOpen(false);
        } else if (event.key === 'Tab') {
            const items = $$('button, a[href], input, [tabindex="0"]', aiPanel)
                .filter((element) => !element.disabled && !element.closest('[inert]') && element.getClientRects().length);
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

    // ==============================
    //  3. Scripted Chat Demo
    // ==============================
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

    // --- Timing & Rendering ---
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

    // --- Conversation Flow ---
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

    // --- Events ---
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

    // ==============================
    //  4. Files-in-Context Tray
    // ==============================
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

    // --- Events ---
    filesToggle.addEventListener('click', () => setFilesOpen(!isFilesOpen()));

    // ==============================
    //  5. Initial State
    // ==============================

    const initiallyOpen = wrapper.classList.contains('ai-opened');
    setPanelOpen(initiallyOpen);
    if (initiallyOpen) startConversation();
    if (mobileNavMq.matches) setAiDrawerOpen(false);

})();
