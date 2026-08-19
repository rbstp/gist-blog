// Reading affordances
// - Copy button for code blocks
// - Back to top button
// - Reading progress indicator
// - Keyboard shortcuts dialog

export {};

declare global {
  interface Window {
    toggleTheme?: () => void;
  }
}

(function () {
  'use strict';

  // 1. Copy Button for Code Blocks
  function initCopyButtons(): void {
    const codeBlocks = document.querySelectorAll('pre code');
    if (!codeBlocks.length) return;

    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre || pre.querySelector('.copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = '<span class="copy-text">Copy</span>';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.title = 'Copy code';

      btn.addEventListener('click', async () => {
        const code = codeEl.textContent;
        try {
          await navigator.clipboard.writeText(code ?? '');
          btn.classList.add('copied');
          const copyTextEl = btn.querySelector('.copy-text');
          if (!copyTextEl) return;
          const originalText = copyTextEl.textContent;
          copyTextEl.textContent = 'Copied';
          setTimeout(() => {
            btn.classList.remove('copied');
            copyTextEl.textContent = originalText;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });

      (pre as HTMLElement).style.position = 'relative';
      pre.appendChild(btn);
    });
  }

  // 2. Jump to Top Button
  function initJumpToTop(): void {
    const btn = document.createElement('button');
    btn.className = 'jump-to-top';
    btn.type = 'button';
    btn.innerHTML = '<span class="jump-text">Back to top</span>';
    btn.setAttribute('aria-label', 'Back to top');
    btn.title = 'Back to top';
    btn.style.display = 'none';

    document.body.appendChild(btn);

    let rafId: number | null = null;
    function checkScroll(): void {
      const shouldShow = window.scrollY > 400;
      btn.style.display = shouldShow ? 'flex' : 'none';
    }

    function scheduleCheck(): void {
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
  function initReadingProgress(): void {
    // Only show on post pages
    const postContent = document.querySelector('.article-body');
    if (!postContent) return;

    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="reading-progress-bar"></div>';
    document.body.appendChild(progressBar);

    const bar = progressBar.querySelector<HTMLElement>('.reading-progress-bar');
    if (!bar) return;

    let rafId: number | null = null;
    function updateProgress(): void {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercent = (scrollTop / (docHeight - winHeight)) * 100;
      bar!.style.width = Math.min(100, Math.max(0, scrollPercent)) + '%';
    }

    function scheduleUpdate(): void {
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
  function initKeyboardHelp(): void {
    // Don't show on graph page (it has its own help)
    if (document.querySelector('.graph-page')) return;

    // Create help button
    const helpBtn = document.createElement('button');
    helpBtn.className = 'keyboard-help-btn';
    helpBtn.type = 'button';
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
        <div class="help-header">
          <h2 class="help-title">Keyboard shortcuts</h2>
          <button class="help-close" type="button" aria-label="Close help">&times;</button>
        </div>
        <div class="keyboard-help-body">
          <div class="shortcut-section">
            <h3>Navigation</h3>
            <div class="shortcut-item">
              <span>Search posts and topics</span>
              <span><kbd>Cmd</kbd><kbd>K</kbd></span>
            </div>
            <div class="shortcut-item">
              <span>Focus topic search</span>
              <kbd>/</kbd>
            </div>
            <div class="shortcut-item">
              <span>Close dialogs</span>
              <kbd>Esc</kbd>
            </div>
          </div>
          <div class="shortcut-section">
            <h3>Reading</h3>
            <div class="shortcut-item">
              <span>Toggle light / dark</span>
              <kbd>T</kbd>
            </div>
            <div class="shortcut-item">
              <span>Back to top</span>
              <kbd>Home</kbd>
            </div>
            <div class="shortcut-item">
              <span>End of page</span>
              <kbd>End</kbd>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    const closeBtn = dialog.querySelector('.help-close');

    function showHelp(): void {
      dialog.style.display = 'flex';
    }

    function hideHelp(): void {
      dialog.style.display = 'none';
    }

    helpBtn.addEventListener('click', showHelp);
    if (closeBtn) closeBtn.addEventListener('click', hideHelp);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) hideHelp();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ? key to show help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
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
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        if (window.toggleTheme) window.toggleTheme();
      }
    });
  }

  // Initialize all enhancements when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(): void {
    initCopyButtons();
    initJumpToTop();
    initReadingProgress();
    initKeyboardHelp();
  }
})();
