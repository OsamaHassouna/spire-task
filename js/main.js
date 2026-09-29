/**
 * Spire – page behaviour
 *  1. Spire AI side panel: open / close, focus handling, modal on mobile
 *  2. Chat flow: user message -> "Thinking" -> canned AI answer
 *  3. Mobile navigation drawer
 */
(() => {
  'use strict';

  const desktopMq = window.matchMedia('(min-width: 1024px)');
  const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /** Wait for the element's transition to end (with a safety timeout). */
  const afterTransition = (el, done, timeout = 600) => {
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
  const panel = $('#ai-panel');
  const openers = $$('[data-ai-open]');
  const composer = $('[data-composer]');
  const composerInput = $('#ai-input');
  // everything outside the panel that should be inert while it is modal
  const pageRegions = $$('.topbar, .sidenav, .main, .rail');

  let lastTrigger = null;

  const isPanelOpen = () => panel.classList.contains('is-open');

  const setExpanded = (open) => {
    openers.forEach((btn) => btn.setAttribute('aria-expanded', String(open)));
  };

  /** Mobile: full-screen modal. Desktop: non-modal panel next to the page. */
  const applyPanelMode = () => {
    const modal = isPanelOpen() && !desktopMq.matches;
    panel.setAttribute('aria-modal', String(modal));
    pageRegions.forEach((region) => { region.inert = modal; });
    setLocked(modal);
  };

  const openPanel = (trigger) => {
    if (isPanelOpen()) {
      composerInput.focus();
      return;
    }
    lastTrigger = trigger || null;
    panel.hidden = false;
    // next frame so the closed styles are painted before the transition runs
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.add('is-open');
        setExpanded(true);
        applyPanelMode();
        composerInput.focus({ preventScroll: true });
      });
    });
  };

  const closePanel = () => {
    if (!isPanelOpen()) return;
    panel.classList.remove('is-open');
    setExpanded(false);
    applyPanelMode();
    afterTransition(panel, () => {
      if (!isPanelOpen()) panel.hidden = true;
    });

    // return focus to whatever opened the panel, if it is still visible
    const fallback = desktopMq.matches ? $('.rail__open') : $('.topbar__ai');
    const target = lastTrigger && lastTrigger.offsetParent !== null ? lastTrigger : fallback;
    if (target) target.focus({ preventScroll: true });
  };

  openers.forEach((btn) => {
    btn.addEventListener('click', () => {
      const heroInput = $('#hero-ask');
      const pending = btn.closest('[data-ask-form]') ? heroInput.value.trim() : '';
      openPanel(btn);
      if (pending) {
        heroInput.value = '';
        sendMessage(pending);
      }
    });
  });

  $$('[data-ai-close]').forEach((btn) => btn.addEventListener('click', closePanel));

  desktopMq.addEventListener('change', applyPanelMode);

  /* ======================================================================
     2. Chat
     ====================================================================== */
  const chatLog = $('[data-chat-log]');
  const filesTray = $('[data-files]');
  const tplUser = $('#tpl-user-msg');
  const tplThinking = $('#tpl-thinking');
  const tplAi = $('#tpl-ai-msg');

  const THINKING_MS = 1400;
  let replyTimer = 0;

  const setView = (view) => { panel.dataset.state = view; };

  const scrollChatToEnd = () => {
    chatLog.scrollTo({
      top: chatLog.scrollHeight,
      behavior: reducedMotionMq.matches ? 'auto' : 'smooth',
    });
  };

  const append = (template) => {
    const node = template.content.firstElementChild.cloneNode(true);
    chatLog.append(node);
    scrollChatToEnd();
    return node;
  };

  const resetChat = () => {
    window.clearTimeout(replyTimer);
    chatLog.replaceChildren();
    filesTray.hidden = true;
    composer.removeAttribute('aria-busy');
    setView('welcome');
  };

  function sendMessage(text) {
    if (composer.getAttribute('aria-busy') === 'true') return;

    setView('chat');
    const userMsg = append(tplUser);
    $('.msg__bubble', userMsg).textContent = text;

    composer.setAttribute('aria-busy', 'true');
    const thinking = append(tplThinking);

    replyTimer = window.setTimeout(() => {
      thinking.remove();
      append(tplAi);
      filesTray.hidden = false;
      composer.removeAttribute('aria-busy');
    }, reducedMotionMq.matches ? 300 : THINKING_MS);
  }

  const nudge = (el) => {
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
      { duration: reducedMotionMq.matches ? 0 : 280, easing: 'ease-in-out' },
    );
  };

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = composerInput.value.trim();
    if (!text) {
      nudge(composer);
      composerInput.focus();
      return;
    }
    composerInput.value = '';
    sendMessage(text);
  });

  // Hero pill: typing + Enter opens the panel and sends the question
  $('[data-ask-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const heroInput = $('#hero-ask');
    const text = heroInput.value.trim();
    openPanel(heroInput);
    if (text) {
      heroInput.value = '';
      sendMessage(text);
    }
  });

  $('[data-ai-back]').addEventListener('click', () => {
    resetChat();
    composerInput.focus();
  });

  // Delegated handlers for content rendered from templates
  chatLog.addEventListener('click', (event) => {
    const suggestion = event.target.closest('[data-suggest]');
    if (suggestion) {
      sendMessage(suggestion.textContent.trim());
      return;
    }

    const feedback = event.target.closest('[data-feedback]');
    if (feedback) {
      const pressed = feedback.getAttribute('aria-pressed') === 'true';
      $$('[data-feedback]', feedback.parentElement).forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
      feedback.setAttribute('aria-pressed', String(!pressed));
      return;
    }

    const copy = event.target.closest('[data-copy]');
    if (copy) {
      const answer = copy.closest('.msg__bubble').querySelector('p').textContent.replace(/\s+/g, ' ').trim();
      const label = copy.getAttribute('aria-label');
      const done = () => {
        copy.setAttribute('aria-label', 'Copied');
        copy.setAttribute('aria-pressed', 'true');
        window.setTimeout(() => {
          copy.setAttribute('aria-label', label);
          copy.removeAttribute('aria-pressed');
        }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(answer).then(done, () => {});
    }
  });

  // Voice buttons: visual toggle only (no speech API in scope)
  $$('[data-mic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!pressed));
    });
  });

  /* ======================================================================
     3. Mobile navigation drawer
     ====================================================================== */
  const nav = $('#sidenav');
  const navToggle = $('[data-nav-toggle]');
  const scrim = $('.scrim');

  const isNavOpen = () => nav.classList.contains('is-open');

  const openNav = () => {
    nav.classList.add('is-open');
    scrim.hidden = false;
    navToggle.setAttribute('aria-expanded', 'true');
    setLocked(true);
    $('.sidenav__close', nav).focus();
  };

  const closeNav = ({ restoreFocus = true } = {}) => {
    if (!isNavOpen()) return;
    nav.classList.remove('is-open');
    scrim.hidden = true;
    navToggle.setAttribute('aria-expanded', 'false');
    setLocked(false);
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
    else if (isPanelOpen()) closePanel();
  });
})();
