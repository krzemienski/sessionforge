/* ============================================================
   Minimal Portfolio Theme — SessionForge Static Site Export
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  var STORAGE_KEY = 'sf-theme';
  var ATTR_THEME = 'data-theme';
  var DARK = 'dark';
  var LIGHT = 'light';

  // ── Theme management ────────────────────────────────────────
  function getSystemPreference() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      // Storage unavailable — continue without persistence
    }
  }

  function applyTheme(theme) {
    var html = document.documentElement;
    html.setAttribute(ATTR_THEME, theme);

    // Sync highlight.js stylesheets
    var hljsLight = document.getElementById('hljs-light');
    var hljsDark = document.getElementById('hljs-dark');
    if (hljsLight && hljsDark) {
      hljsLight.disabled = (theme === DARK);
      hljsDark.disabled = (theme !== DARK);
    }

    // Update toggle button aria-pressed state
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === DARK));
      toggle.setAttribute('aria-label', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute(ATTR_THEME) || LIGHT;
    var next = current === DARK ? LIGHT : DARK;
    applyTheme(next);
    saveTheme(next);
  }

  // ── Initialise theme immediately (before paint) ─────────────
  // This runs synchronously to prevent flash of wrong theme.
  applyTheme(getSavedTheme() || getSystemPreference());

  // ── DOM-ready setup ─────────────────────────────────────────
  function onDOMReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onDOMReady(function () {
    // Wire up toggle button
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
    }

    // Respect OS-level preference changes
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) {
      mq.addEventListener('change', function (e) {
        // Only follow system if user has not set an explicit preference
        if (!getSavedTheme()) {
          applyTheme(e.matches ? DARK : LIGHT);
        }
      });
    }

    // ── Syntax highlighting ───────────────────────────────────
    // highlight.js is loaded with defer — wait until it is available.
    function initHighlight() {
      if (typeof hljs !== 'undefined') {
        hljs.configure({ ignoreUnescapedHTML: true });
        hljs.highlightAll();
      }
    }

    // Try immediately (script may already be loaded), then fall back to
    // polling for the deferred script to finish loading.
    if (typeof hljs !== 'undefined') {
      initHighlight();
    } else {
      var attempts = 0;
      var maxAttempts = 20;
      var pollInterval = setInterval(function () {
        attempts += 1;
        if (typeof hljs !== 'undefined') {
          clearInterval(pollInterval);
          initHighlight();
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
        }
      }, 150);
    }

    // ── Smooth anchor scroll with header offset ───────────────
    var header = document.querySelector('.site-header');
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var targetId = anchor.getAttribute('href').slice(1);
        if (!targetId) return;
        var target = document.getElementById(targetId);
        if (!target) return;
        e.preventDefault();
        var headerHeight = header ? header.getBoundingClientRect().height : 0;
        var top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
        // Update URL without triggering scroll
        history.pushState(null, '', '#' + targetId);
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });

    // ── External link safety ──────────────────────────────────
    document.querySelectorAll('a[href^="http"]').forEach(function (link) {
      var url = link.getAttribute('href');
      var isSameOrigin = url.indexOf(window.location.origin) === 0;
      if (!isSameOrigin) {
        if (!link.hasAttribute('target')) {
          link.setAttribute('target', '_blank');
        }
        if (!link.hasAttribute('rel')) {
          link.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });
  });
})();
