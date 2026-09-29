/**
 * Spire – page behaviour
 */
(() => {
  'use strict';

  const desktopMq = window.matchMedia('(min-width: 1024px)');
  const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const afterTransition = (el, done, timeout = 650) => {
    let finished = false;
    const finish = (event) => {
      if (finished || (event && event.target !== el)) return;
      finished = true;
      el.removeEventListener('transitionend', finish);
      done();
    };
    el.addEventListener('transitionend', finish);
    window.setTimeout(finish, reducedMotionMq.matches ? 0 : timeout);
  };

  const setLocked = (locked) => document.body.classList.toggle('is-locked', locked);

  /* ======================================================================
     1. Spire AI panel
     ====================================================================== */
  const app = $('.app');
  const panel = $('#ai-panel');
  const rail = $('.rail');
  const openers = $$('[data-ai-open]');
  const composer = $('[data-composer]');
  const composerInput = $('#ai-input');
  const heroInput = $('#hero-ask');
  const pageRegions = $$('.skip-link, .topbar, .sidenav, .main, .rail');

  let lastTrigger = null;
  let panelOpen = false;

  const setExpanded = (open) => {
    openers.forEach((btn) => btn.setAttribute('aria-expanded', String(open)));
  };

  const applyPanelMode = () => {
    const modal = panelOpen && !desktopMq.matches;
    panel.setAttribute('aria-modal', String(modal));
    pageRegions.forEach((region) => { region.inert = modal; });
    rail.inert = panelOpen;
    setLocked(modal || isNavOpen());
  };

  const openPanel = (trigger, question = '') => {
    if (panelOpen) {
      composerInput.focus();
      return question ? sendMessage(question) : true;
    }
    panelOpen = true;
    lastTrigger = trigger || null;

    resetChat();
    if (question) sendMessage(question);
    else if (desktopMq.matches) startConversation();

    panel.hidden = false;
    setExpanded(true);
    applyPanelMode();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!panelOpen) return;
        app.classList.add('is-ai-open');
        panel.classList.add('is-open');
        const target = panel.dataset.state === 'welcome' ? $('[data-ai-start]') : composerInput;
        target.focus({ preventScroll: true });
      });
    });
    return true;
  };

  const closePanel = () => {
    if (!panelOpen) return;
    panelOpen = false;
    stopReply();
    closeFiles();
    app.classList.remove('is-ai-open');
    panel.classList.remove('is-open');
    setExpanded(false);
    applyPanelMode();

    afterTransition(desktopMq.matches ? app : panel, () => {
      if (!panelOpen) panel.hidden = true;
    });

    const fallback = desktopMq.matches ? $('.rail__open') : $('.topbar__ai');
    const target = lastTrigger && lastTrigger.offsetParent !== null ? lastTrigger : fallback;
    if (target) target.focus({ preventScroll: true });
  };

  openers.forEach((btn) => {
    btn.addEventListener('click', () => {
      const typed = btn.closest('[data-ask-form]') ? heroInput.value.trim() : '';
      if (openPanel(btn, typed) && typed) heroInput.value = '';
    });
  });

  $('[data-ask-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const typed = heroInput.value.trim();
    if (openPanel(heroInput, typed) && typed) heroInput.value = '';
  });

  $$('[data-ai-close]').forEach((btn) => btn.addEventListener('click', closePanel));

  desktopMq.addEventListener('change', applyPanelMode);

  /* ======================================================================
     2. Chat
     ====================================================================== */
  const FIRST_QUESTION = 'Out of Gate Analysis for 22-27 March';
  const DOC_SUGGESTIONS = [
    'Summarize this document',
    'Where does it talk about eligibility?',
    'What are the key points?',
  ];
  const REPLIES = [
    { sources: [1], suggestions: DOC_SUGGESTIONS },
    { sources: [1, 3, 3, 1], suggestions: [] },
  ];
  const THINKING_MS = 2500;
  const SOURCES_SHOWN = 2;

  const chatLog = $('[data-chat-log]');
  const tplUser = $('#tpl-user-msg');
  const tplThinking = $('#tpl-thinking');
  const tplAi = $('#tpl-ai-msg');
  const tplChip = $('#tpl-chip');
  const tplSourcesToggle = $('#tpl-sources-toggle');

  let turn = 0;
  let replyTimer = 0;

  const setView = (view) => { panel.dataset.state = view; };

  const scrollChatToEnd = () => {
    chatLog.scrollTo({
      top: chatLog.scrollHeight,
      behavior: reducedMotionMq.matches ? 'auto' : 'smooth',
    });
  };

  const clone = (template) => template.content.firstElementChild.cloneNode(true);

  const append = (node) => {
    chatLog.append(node);
    scrollChatToEnd();
    return node;
  };

  const announcer = $('[data-announcer]');
  const announce = (message) => {
    announcer.textContent = '';
    window.setTimeout(() => { announcer.textContent = message; }, 50);
  };

  const isBusy = () => composer.getAttribute('aria-busy') === 'true';

  const stopReply = () => {
    window.clearTimeout(replyTimer);
    composer.removeAttribute('aria-busy');
  };

  const resetChat = () => {
    stopReply();
    turn = 0;
    chatLog.replaceChildren();
    closeFiles();
    setView('welcome');
  };

  function startConversation() {
    sendMessage(FIRST_QUESTION);
  }

  function renderSources(container, sources) {
    sources.forEach((number, index) => {
      const cite = document.createElement('sup');
      cite.className = 'cite';
      cite.innerHTML = `<span class="visually-hidden">source </span>${number}`;
      if (index >= SOURCES_SHOWN) cite.hidden = true;
      container.append(cite);
    });

    if (sources.length > SOURCES_SHOWN) {
      const more = clone(tplSourcesToggle);
      more.setAttribute('aria-label', `Show all ${sources.length} sources`);
      container.append(more);
    }
  }

  function renderReply({ sources, suggestions }) {
    const reply = clone(tplAi);
    renderSources($('[data-cites]', reply), sources);

    const actions = $('[data-actions]', reply);
    suggestions.forEach((text) => {
      const chip = clone(tplChip);
      $('.chip__text', chip).textContent = text;
      actions.append(chip);
    });
    if (!suggestions.length) actions.remove();

    return reply;
  }

  function sendMessage(text, { fromSuggestion = false } = {}) {
    if (isBusy()) {
      nudge(composer);
      announce('Please wait for Spire AI to finish replying.');
      return false;
    }

    setView('chat');
    const userMsg = clone(tplUser);
    $('.msg__text', userMsg).textContent = text;
    $('.msg__icon', userMsg).hidden = !fromSuggestion;
    append(userMsg);

    composer.setAttribute('aria-busy', 'true');
    const thinking = append(clone(tplThinking));

    const reply = REPLIES[Math.min(turn, REPLIES.length - 1)];
    turn += 1;

    replyTimer = window.setTimeout(() => {
      thinking.remove();
      append(renderReply(reply));
      composer.removeAttribute('aria-busy');
    }, THINKING_MS);

    return true;
  }

  function nudge(el) {
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
      { duration: reducedMotionMq.matches ? 0 : 280, easing: 'ease-in-out' },
    );
  }

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = composerInput.value.trim();
    if (!text) {
      nudge(composer);
      composerInput.focus();
      return;
    }
    if (sendMessage(text)) composerInput.value = '';
  });

  $('[data-ai-start]').addEventListener('click', () => {
    startConversation();
    composerInput.focus({ preventScroll: true });
  });

  $('[data-ai-back]').addEventListener('click', () => {
    resetChat();
    $('[data-ai-start]').focus();
  });

  chatLog.addEventListener('click', (event) => {
    const suggestion = event.target.closest('[data-suggest]');
    if (suggestion) {
      sendMessage($('.chip__text', suggestion).textContent, { fromSuggestion: true });
      return;
    }

    const toggle = event.target.closest('[data-sources-toggle]');
    if (toggle) {
      const expand = toggle.getAttribute('aria-expanded') !== 'true';
      const cites = $$('.cite', toggle.parentElement);
      cites.forEach((cite, index) => { cite.hidden = !expand && index >= SOURCES_SHOWN; });
      toggle.setAttribute('aria-expanded', String(expand));
      toggle.setAttribute('aria-label', expand ? 'Show fewer sources' : `Show all ${cites.length} sources`);
    }
  });

  $('.search').addEventListener('submit', (event) => event.preventDefault());

  $$('[data-mic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!pressed));
    });
  });

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

  /* ======================================================================
     4. Service cards drag
     ====================================================================== */
  const slider = $('.services__list');
  const DRAG_THRESHOLD = 5;
  let drag = null;

  slider.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, startX: event.clientX, startScroll: slider.scrollLeft, moved: false };
  });

  slider.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      drag.moved = true;
      slider.setPointerCapture(drag.id);
      slider.classList.add('is-dragging');
    }
    if (drag.moved) slider.scrollLeft = drag.startScroll - dx;
  });

  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      slider.classList.remove('is-dragging');
      const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
      slider.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => slider.removeEventListener('click', swallow, { capture: true }), 0);
    }
    drag = null;
  };

  slider.addEventListener('pointerup', endDrag);
  slider.addEventListener('pointercancel', endDrag);
  slider.addEventListener('dragstart', (event) => event.preventDefault());

  /* ======================================================================
     5. Mobile navigation drawer
     ====================================================================== */
  const nav = $('#sidenav');
  const navToggle = $('[data-nav-toggle]');
  const scrim = $('.scrim');

  function isNavOpen() {
    return nav.classList.contains('is-open');
  }

  const navBackdropRegions = $$('.skip-link, .topbar, .main');

  const setNavModal = (modal) => {
    navBackdropRegions.forEach((region) => { region.inert = modal; });
    setLocked(modal || (panelOpen && !desktopMq.matches));
  };

  const openNav = () => {
    nav.classList.add('is-open');
    scrim.hidden = false;
    navToggle.setAttribute('aria-expanded', 'true');
    setNavModal(true);
    $('.sidenav__close', nav).focus();
  };

  const closeNav = ({ restoreFocus = true } = {}) => {
    if (!isNavOpen()) return;
    nav.classList.remove('is-open');
    scrim.hidden = true;
    navToggle.setAttribute('aria-expanded', 'false');
    setNavModal(false);
    if (restoreFocus) navToggle.focus();
  };

  navToggle.addEventListener('click', () => (isNavOpen() ? closeNav() : openNav()));
  $$('[data-nav-close]').forEach((el) => el.addEventListener('click', () => closeNav()));

  desktopMq.addEventListener('change', (event) => {
    if (event.matches) closeNav({ restoreFocus: false });
  });

  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !isNavOpen()) return;
    const focusable = $$('a[href], button:not([disabled])', nav);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ======================================================================
     6. Escape key
     ====================================================================== */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isNavOpen()) closeNav();
    else if (isFilesOpen()) {
      setFilesOpen(false);
      filesToggle.focus();
    } else if (panelOpen) closePanel();
  });
})();
