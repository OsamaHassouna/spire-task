/**
 * Spire – page behaviour
 *  1. Spire AI side panel: open / close
 *     desktop: the panel takes the rail's column and pushes the main content
 *     mobile:  a full-screen sheet that slides in from the right (modal)
 *  2. Chat: a scripted conversation that restarts on every open
 *  3. Files-in-context tray
 *  4. Mobile navigation drawer
 */
(() => {
  'use strict';

  const desktopMq = window.matchMedia('(min-width: 1024px)');
  const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /** Run `done` when `el`'s own transition ends (with a safety timeout). */
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
  // everything outside the panel that is inert while the mobile sheet is open
  const pageRegions = $$('.skip-link, .topbar, .sidenav, .main, .rail');

  let lastTrigger = null;
  // source of truth for the panel; the classes follow it a frame later
  let panelOpen = false;

  const setExpanded = (open) => {
    openers.forEach((btn) => btn.setAttribute('aria-expanded', String(open)));
  };

  /**
   * Mobile: modal sheet, the page behind it is inert and can't scroll.
   * Desktop: part of the layout; only the rail it replaces is inert.
   */
  const applyPanelMode = () => {
    const modal = panelOpen && !desktopMq.matches;
    panel.setAttribute('aria-modal', String(modal));
    pageRegions.forEach((region) => { region.inert = modal; });
    rail.inert = panelOpen;
    setLocked(modal || isNavOpen());
  };

  /**
   * @param trigger  element to return focus to on close
   * @param question optional text typed before opening (hero input)
   */
  /** Returns false if `question` couldn't be sent (a reply is still pending). */
  const openPanel = (trigger, question = '') => {
    if (panelOpen) {
      composerInput.focus();
      return question ? sendMessage(question) : true;
    }
    panelOpen = true;
    lastTrigger = trigger || null;

    // every open starts a fresh conversation
    resetChat();
    if (question) sendMessage(question);
    else if (desktopMq.matches) startConversation();

    panel.hidden = false;
    setExpanded(true);
    applyPanelMode();
    // next frame, so the closed state is painted before the transition runs
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!panelOpen) return; // closed again before we got here
        app.classList.add('is-ai-open');
        panel.classList.add('is-open');
        // welcome screen (mobile): focus its start button, so the on-screen
        // keyboard doesn't cover the greeting; otherwise the message input
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

    // desktop animates the grid column, mobile slides the sheet
    afterTransition(desktopMq.matches ? app : panel, () => {
      if (!panelOpen) panel.hidden = true;
    });

    // return focus to whatever opened the panel, if it is still visible
    const fallback = desktopMq.matches ? $('.rail__open') : $('.topbar__ai');
    const target = lastTrigger && lastTrigger.offsetParent !== null ? lastTrigger : fallback;
    if (target) target.focus({ preventScroll: true });
  };

  openers.forEach((btn) => {
    btn.addEventListener('click', () => {
      // the hero pill's button also sends whatever was typed next to it;
      // the text is only cleared once it was actually sent
      const typed = btn.closest('[data-ask-form]') ? heroInput.value.trim() : '';
      if (openPanel(btn, typed) && typed) heroInput.value = '';
    });
  });

  // Hero pill: typing + Enter opens the panel with that question
  $('[data-ask-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const typed = heroInput.value.trim();
    if (openPanel(heroInput, typed) && typed) heroInput.value = '';
  });

  $$('[data-ai-close]').forEach((btn) => btn.addEventListener('click', closePanel));

  desktopMq.addEventListener('change', applyPanelMode);

  /* ======================================================================
     2. Chat
     The first question gets an answer with document suggestions; picking
     one (or asking anything else) gets an answer citing several sources.
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
  const THINKING_MS = 4000;
  const SOURCES_SHOWN = 2; // the rest hide behind a "more" button

  const chatLog = $('[data-chat-log]');
  const tplUser = $('#tpl-user-msg');
  const tplThinking = $('#tpl-thinking');
  const tplAi = $('#tpl-ai-msg');
  const tplChip = $('#tpl-chip');

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
    // new text on the next tick so repeated messages are read again
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

  /** "1 3 •••" – the first sources, plus a toggle for the rest */
  function renderSources(container, sources) {
    sources.forEach((number, index) => {
      const cite = document.createElement('sup');
      cite.className = 'cite';
      cite.innerHTML = `<span class="visually-hidden">source </span>${number}`;
      if (index >= SOURCES_SHOWN) cite.hidden = true;
      container.append(cite);
    });

    if (sources.length > SOURCES_SHOWN) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'cite-more';
      more.dataset.sourcesToggle = '';
      more.setAttribute('aria-expanded', 'false');
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

  /**
   * Adds the user's bubble, shows "Thinking" and then the scripted reply.
   * Returns false (so callers keep their text) while a reply is pending.
   */
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

  // Mobile welcome screen: tapping the greeting starts the conversation
  $('[data-ai-start]').addEventListener('click', () => {
    startConversation();
    composerInput.focus({ preventScroll: true });
  });

  // Mobile "back": return to the welcome screen
  $('[data-ai-back]').addEventListener('click', () => {
    resetChat();
    $('[data-ai-start]').focus();
  });

  // Delegated handlers for content rendered from templates
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

  // Search is out of scope for the task: keep Enter from navigating away
  $('.search').addEventListener('submit', (event) => event.preventDefault());

  // Voice buttons: visual toggle only (no speech API in scope)
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

  function setFilesOpen(open) {
    filesToggle.setAttribute('aria-expanded', String(open));
    filesList.hidden = !open;
    files.classList.toggle('is-open', open);
  }

  function closeFiles() {
    if (isFilesOpen()) setFilesOpen(false);
  }

  filesToggle.addEventListener('click', () => setFilesOpen(!isFilesOpen()));

  /* ======================================================================
     4. Mobile navigation drawer
     ====================================================================== */
  const nav = $('#sidenav');
  const navToggle = $('[data-nav-toggle]');
  const scrim = $('.scrim');

  function isNavOpen() {
    return nav.classList.contains('is-open');
  }

  // what sits behind the drawer
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

  // Keep Tab inside the drawer while it is open on mobile
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
     Global: Escape closes whatever is on top
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
