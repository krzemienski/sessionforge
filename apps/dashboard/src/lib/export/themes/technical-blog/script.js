/* ============================================================
   Technical Blog Theme — SessionForge Static Site Export
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

    // ── Copy-to-clipboard buttons for code blocks ─────────────
    var codeBlocks = document.querySelectorAll('.prose pre');
    codeBlocks.forEach(function (pre) {
      var btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.setAttribute('type', 'button');
      btn.textContent = 'Copy';

      btn.addEventListener('click', function () {
        var code = pre.querySelector('code');
        var text = code ? code.textContent : pre.textContent;
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          // Clipboard write failed — silently ignore
        });
      });

      pre.appendChild(btn);
    });

    // ── Table of contents generation ──────────────────────────
    var postBody = document.getElementById('post-body');
    if (postBody) {
      var headings = postBody.querySelectorAll('h2, h3, h4');
      if (headings.length > 2) {
        var tocDesktop = document.getElementById('toc-desktop-list');
        var tocMobile = document.getElementById('toc-mobile-list');
        var tocMobileWrapper = document.getElementById('toc-mobile');

        // Build TOC items
        headings.forEach(function (heading, index) {
          // Ensure heading has an id for anchor navigation
          if (!heading.id) {
            heading.id = 'heading-' + index;
          }

          var level = heading.tagName.toLowerCase();
          var text = heading.textContent;
          var href = '#' + heading.id;

          if (tocDesktop) {
            var li = document.createElement('li');
            li.className = 'toc-item toc-item--' + level;
            var a = document.createElement('a');
            a.className = 'toc-link';
            a.href = href;
            a.textContent = text;
            li.appendChild(a);
            tocDesktop.appendChild(li);
          }

          if (tocMobile) {
            var liM = document.createElement('li');
            liM.className = 'toc-item toc-item--' + level;
            var aM = document.createElement('a');
            aM.className = 'toc-link';
            aM.href = href;
            aM.textContent = text;
            liM.appendChild(aM);
            tocMobile.appendChild(liM);
          }
        });

        // Show mobile TOC wrapper when there are enough headings
        if (tocMobileWrapper) {
          tocMobileWrapper.removeAttribute('hidden');
        }

        // ── Mobile TOC toggle ────────────────────────────────
        var tocToggle = document.getElementById('toc-toggle');
        if (tocToggle && tocMobile) {
          tocToggle.addEventListener('click', function () {
            var isExpanded = tocToggle.getAttribute('aria-expanded') === 'true';
            tocToggle.setAttribute('aria-expanded', String(!isExpanded));
            if (isExpanded) {
              tocMobile.setAttribute('hidden', '');
            } else {
              tocMobile.removeAttribute('hidden');
            }
          });
        }

        // ── Active TOC link tracking via IntersectionObserver ─
        if ('IntersectionObserver' in window) {
          var activeId = null;
          var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                activeId = entry.target.id;
              }
            });
            updateActiveTocLink(activeId);
          }, {
            rootMargin: '-64px 0px -70% 0px',
            threshold: 0
          });

          headings.forEach(function (heading) {
            observer.observe(heading);
          });
        }
      }
    }

    function updateActiveTocLink(id) {
      if (!id) return;
      var allTocLinks = document.querySelectorAll('.toc-link');
      allTocLinks.forEach(function (link) {
        if (link.getAttribute('href') === '#' + id) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    // ── Reading progress bar ──────────────────────────────────
    var progressBar = document.getElementById('reading-progress-bar');
    var progressWrapper = document.getElementById('reading-progress');
    if (progressBar && postBody) {
      function updateProgress() {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var scrolled = window.scrollY;
        var pct = docHeight > 0 ? Math.min(100, (scrolled / docHeight) * 100) : 0;
        progressBar.style.width = pct + '%';
      }

      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    } else if (progressWrapper) {
      // Hide progress bar on non-post pages
      progressWrapper.style.display = 'none';
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
        // Update URL without triggering native scroll
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
