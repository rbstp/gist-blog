/* eslint-env browser */
// UX enhancements module
// - Copy button for code blocks
// - Jump to top button
// - Reading progress indicator
// - Keyboard shortcuts help dialog

(function () {
  'use strict';

  // 1. Copy Button for Code Blocks
  function initCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre code');
    if (!codeBlocks.length) return;

    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre || pre.querySelector('.copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = '<span class="copy-prompt">$</span> <span class="copy-text">pbcopy</span>';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.title = 'Copy code';

      btn.addEventListener('click', async () => {
        const code = codeEl.textContent;
        try {
          await navigator.clipboard.writeText(code);
          btn.classList.add('copied');
          const originalText = btn.querySelector('.copy-text').textContent;
          btn.querySelector('.copy-text').textContent = 'copied!';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('.copy-text').textContent = originalText;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });

      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }

  // 2. Jump to Top Button
  function initJumpToTop() {
    const btn = document.createElement('button');
    btn.className = 'jump-to-top';
    btn.innerHTML = '<span class="jump-prompt">$</span> <span class="jump-text">cd ~</span>';
    btn.setAttribute('aria-label', 'Jump to top');
    btn.title = 'Jump to top';
    btn.style.display = 'none';
    
    // Move to left on pages with ToC to avoid overlap with sidebar
    if (document.querySelector('.toc-sidebar')) {
      btn.classList.add('has-toc');
    }

    document.body.appendChild(btn);

    let rafId = null;
    function checkScroll() {
      const shouldShow = window.scrollY > 400;
      btn.style.display = shouldShow ? 'flex' : 'none';
    }

    function scheduleCheck() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkScroll();
      });
    }

    window.addEventListener('scroll', scheduleCheck, { passive: true });
    checkScroll();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 3. Reading Progress Indicator (for post pages)
  function initReadingProgress() {
    // Only show on post pages
    const postContent = document.querySelector('.post-content-advanced');
    if (!postContent) return;

    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="reading-progress-bar"></div>';
    document.body.appendChild(progressBar);

    const bar = progressBar.querySelector('.reading-progress-bar');

    let rafId = null;
    function updateProgress() {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercent = (scrollTop / (docHeight - winHeight)) * 100;
      bar.style.width = Math.min(100, Math.max(0, scrollPercent)) + '%';
    }

    function scheduleUpdate() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateProgress();
      });
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    updateProgress();
  }

  // 4. Keyboard Shortcuts Help Dialog
  function initKeyboardHelp() {
    // Don't show on graph page (it has its own help)
    if (document.querySelector('.graph-page')) return;
    
    // Create help button
    const helpBtn = document.createElement('button');
    helpBtn.className = 'keyboard-help-btn';
    helpBtn.textContent = '?';
    helpBtn.setAttribute('aria-label', 'Show keyboard shortcuts');
    helpBtn.title = 'Keyboard shortcuts';
    document.body.appendChild(helpBtn);

    // Create help dialog
    const dialog = document.createElement('div');
    dialog.className = 'keyboard-help-dialog';
    dialog.style.display = 'none';
    dialog.innerHTML = `
      <div class="keyboard-help-content">
        <div class="terminal-header-small">
          <div class="terminal-title-small">
            <span class="terminal-prompt">$</span><span class="terminal-command">man shortcuts</span>
          </div>
          <button class="help-close" aria-label="Close help">&times;</button>
        </div>
        <div class="keyboard-help-body">
          <div class="shortcut-section">
            <h3>Navigation</h3>
            <div class="shortcut-item">
              <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd>
              <span>Open command palette</span>
            </div>
            <div class="shortcut-item">
              <kbd>/</kbd>
              <span>Focus search (on graph page)</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>Close dialogs</span>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>Theme</h3>
            <div class="shortcut-item">
              <kbd>T</kbd>
              <span>Toggle dark/light theme</span>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>Reading</h3>
            <div class="shortcut-item">
              <kbd>↑</kbd> / <kbd>↓</kbd>
              <span>Scroll page</span>
            </div>
            <div class="shortcut-item">
              <kbd>Home</kbd>
              <span>Jump to top</span>
            </div>
            <div class="shortcut-item">
              <kbd>End</kbd>
              <span>Jump to bottom</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    const closeBtn = dialog.querySelector('.help-close');

    function showHelp() {
      dialog.style.display = 'flex';
    }

    function hideHelp() {
      dialog.style.display = 'none';
    }

    helpBtn.addEventListener('click', showHelp);
    closeBtn.addEventListener('click', hideHelp);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) hideHelp();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ? key to show help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        showHelp();
      }
      // Escape to close help
      if (e.key === 'Escape' && dialog.style.display === 'flex') {
        e.preventDefault();
        hideHelp();
      }
      // T to toggle theme
      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        if (window.toggleTheme) window.toggleTheme();
      }
    });
  }

  // 5. Breadcrumb Navigation (for post pages)
  function initBreadcrumbs() {
    const postContainer = document.querySelector('.post-container');
    if (!postContainer) return;

    const postNav = postContainer.querySelector('.post-navigation');
    if (!postNav) return;

    // Get the post title for the breadcrumb
    const titleEl = document.querySelector('.post-title-compact');
    const title = titleEl ? titleEl.textContent.trim() : 'post';
    
    // Create breadcrumb
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'breadcrumb-nav';
    
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
    
    breadcrumb.innerHTML = `
      <span class="breadcrumb-prompt">$</span>
      <span class="breadcrumb-path">
        <a href="/" class="breadcrumb-link">~</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/" class="breadcrumb-link">posts</a>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">${slug}</span>
      </span>
    `;

    // Insert breadcrumb before the post navigation
    postNav.parentNode.insertBefore(breadcrumb, postNav);
  }

  // Initialize all enhancements when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initCopyButtons();
    initJumpToTop();
    initReadingProgress();
    initKeyboardHelp();
    initBreadcrumbs();
  }
})();
