/* eslint-disable no-empty */
export {};

// Search dialog: fuzzy finder for posts, topics and navigation.
// Activated with Cmd/Ctrl+K.

// Local shapes for the data this client script works with
interface PaletteCommand {
  type: string;
  title: string;
  /** Secondary line shown under the title. */
  subtitle: string;
  url: string;
  /** Id of a symbol in the page's inline SVG sprite. */
  icon: string;
}

/** One entry of dist/search.json (see BlogGenerator.generateSearchIndex). */
interface PalettePost {
  id?: string;
  title?: string;
  summary?: string;
  tags?: string[];
  date?: string;
}

interface PaletteData {
  posts: PalettePost[];
  tags: string[];
  commands: PaletteCommand[];
}

interface PaletteResult {
  type: string;
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  score: number;
  matchType: string;
}

(function () {
  let paletteData: PaletteData | null = null;
  let isOpen = false;
  let selectedIndex = 0;
  let filteredResults: PaletteResult[] = [];

  // Fetch the data we need for search
  async function loadPaletteData(): Promise<PaletteData> {
    if (paletteData) return paletteData;

    try {
      // Cache-bust per build (matches main.ts / topic-graph / graph-page) so the palette
      // never reads a stale index after a deploy and shares the HTTP cache entry.
      const version = document.body.getAttribute('data-build-ts') || '';
      // Topics come from the graph, posts from the build-time search index.
      const [graphData, searchIndex] = await Promise.all([
        fetchJson<{ nodes?: Array<{ id?: string }> }>(`/graph.json?v=${version}`),
        fetchJson<PalettePost[]>(`/search.json?v=${version}`),
      ]);

      const posts: PalettePost[] = Array.isArray(searchIndex) ? searchIndex : [];
      const tags = new Set<string>();
      graphData?.nodes?.forEach((node) => {
        if (node.id) tags.add(node.id);
      });

      // Build commands list
      const commands: PaletteCommand[] = [
        { type: 'nav', title: 'Writing', subtitle: 'All posts', url: '/', icon: 'icon-doc' },
        { type: 'nav', title: 'Topics', subtitle: 'Explore the topic graph', url: '/graph.html', icon: 'icon-compass' },
        { type: 'nav', title: 'RSS feed', subtitle: 'Subscribe', url: '/feed.xml', icon: 'icon-rss' },
        { type: 'nav', title: 'GitHub', subtitle: 'Source of this site', url: 'https://github.com/rbstp/gist-blog', icon: 'icon-github' },
      ];

      paletteData = { posts, tags: Array.from(tags), commands };
      return paletteData;
    } catch (err) {
      console.warn('Failed to load palette data:', err);
      return { posts: [], tags: [], commands: [] };
    }
  }

  /** Fetch JSON, resolving to null on any transport or parse failure. */
  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.json() as T;
    } catch {
      return null;
    }
  }

  // Fuzzy match scoring
  function fuzzyScore(str: string, query: string): number {
    str = str.toLowerCase();
    query = query.toLowerCase();

    if (str.includes(query)) return 100; // Exact substring match

    let score = 0;
    let strIdx = 0;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      if (char === undefined) return 0;
      const foundIdx = str.indexOf(char, strIdx);

      if (foundIdx === -1) return 0; // No match

      // Bonus for consecutive chars
      if (foundIdx === strIdx) score += 5;
      score += 1;
      strIdx = foundIdx + 1;
    }

    return score;
  }

  /** Result row for a post from the search index. */
  function postResult(post: PalettePost, score: number): PaletteResult {
    return {
      type: 'post',
      title: post.title || 'Untitled',
      subtitle: post.summary || post.date || 'Post',
      url: `/posts/${post.id}.html`,
      icon: 'icon-doc',
      score,
      matchType: 'post',
    };
  }

  /** With an empty query the dialog is a jump list of the most recent writing. */
  function recentPosts(): PaletteResult[] {
    if (!paletteData) return [];
    // The index is generated newest-first.
    return paletteData.posts.slice(0, 5).map((post) => postResult(post, 0));
  }

  // Filter and rank results
  function search(query: string): PaletteResult[] {
    if (!paletteData) return [];
    if (!query.trim()) return recentPosts();

    const results: PaletteResult[] = [];

    // Search commands
    paletteData.commands.forEach((cmd) => {
      const score = Math.max(fuzzyScore(cmd.title, query), fuzzyScore(cmd.subtitle, query));
      if (score > 0) {
        results.push({ ...cmd, score, matchType: 'page' });
      }
    });

    // Search tags
    paletteData.tags.forEach((tag) => {
      const score = fuzzyScore(tag, query);
      if (score > 0) {
        results.push({
          type: 'tag',
          title: tag,
          subtitle: 'Filter posts by this topic',
          url: `/?tag=${encodeURIComponent(tag)}`,
          icon: 'icon-hash',
          score,
          matchType: 'topic'
        });
      }
    });

    // Search posts: titles rank above summaries and topics so exact-ish title hits win.
    paletteData.posts.forEach((post) => {
      const score = Math.max(
        post.title ? fuzzyScore(post.title, query) * 2 : 0,
        post.summary ? fuzzyScore(post.summary, query) : 0,
        ...(post.tags ?? []).map((tag) => fuzzyScore(tag, query))
      );

      if (score > 0) results.push(postResult(post, score));
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Limit to top 8 results
    return results.slice(0, 8);
  }

  // Create and inject the palette UI
  function createPaletteUI(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'command-palette-overlay';
    overlay.className = 'command-palette-overlay';
    overlay.innerHTML = `
      <div class="command-palette-panel" role="dialog" aria-modal="true" aria-label="Search">
        <div class="palette-search">
          <svg aria-hidden="true"><use href="#icon-search"/></svg>
          <input
            type="text"
            id="command-palette-input"
            placeholder="Search posts and topics…"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search posts and topics"
          />
        </div>
        <div class="command-palette-results" id="command-palette-results" role="listbox"></div>
        <div class="command-palette-footer">
          <span class="palette-shortcut"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span class="palette-shortcut"><kbd>↵</kbd> open</span>
          <span class="palette-shortcut"><kbd>Esc</kbd> close</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  // Render results
  function renderResults(results: PaletteResult[], query: string = ''): void {
    const container = document.getElementById('command-palette-results');
    if (!container) return;

    if (results.length === 0) {
      // Nothing to jump to yet vs. a query that genuinely matched nothing.
      container.innerHTML = query.trim()
        ? '<p class="palette-no-results">No matches found.</p>'
        : '<p class="palette-hint">Start typing to search posts, topics and pages.</p>';
      return;
    }

    container.innerHTML = results.map((result, idx) => `
      <div
        class="palette-result ${idx === selectedIndex ? 'selected' : ''}"
        data-index="${idx}"
        role="option"
        aria-selected="${idx === selectedIndex}"
      >
        <span class="result-icon"><svg aria-hidden="true"><use href="#${escapeHtml(result.icon)}"/></svg></span>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
        </div>
        <span class="result-type">${escapeHtml(result.matchType)}</span>
      </div>
    `).join('');

    // Scroll selected into view
    const selected = container.querySelector('.palette-result.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // Simple HTML escape
  function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Handle selection
  function selectResult(index: number): void {
    if (index < 0 || index >= filteredResults.length) return;

    const result = filteredResults[index];
    if (result && result.url) {
      closePalette();

      // Handle tag preselection
      if (result.type === 'tag' && result.url.includes('?tag=')) {
        try {
          const tag = result.url.split('tag=')[1];
          if (tag) {
            localStorage.setItem('preselectedTags', JSON.stringify([decodeURIComponent(tag)]));
          }
        } catch { }
      }

      // Navigate
      if (result.url.startsWith('http')) {
        window.open(result.url, '_blank');
      } else {
        window.location.href = result.url;
      }
    }
  }

  // Open palette
  async function openPalette(): Promise<void> {
    if (isOpen) return;

    // Load data if needed
    await loadPaletteData();

    // Create UI if not exists
    let overlay = document.getElementById('command-palette-overlay') as HTMLDivElement | null;
    if (!overlay) {
      overlay = createPaletteUI();
    }

    // Show and focus
    overlay.style.display = 'flex';
    isOpen = true;
    selectedIndex = 0;
    filteredResults = recentPosts();
    renderResults(filteredResults);

    const input = document.getElementById('command-palette-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.focus();
    }

    // Add escape key handler
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closePalette();
      }
    });
  }

  // Close palette
  function closePalette(): void {
    const overlay = document.getElementById('command-palette-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    isOpen = false;
  }

  // Setup event listeners
  function setupEventListeners(): void {
    // Global keyboard shortcut
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openPalette();
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        closePalette();
      }
    });

    // Input changes
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement | null;
      if (target && target.id === 'command-palette-input') {
        const query = target.value;
        filteredResults = search(query);
        selectedIndex = 0;
        renderResults(filteredResults, query);
      }
    });

    // Navigation and selection
    document.addEventListener('keydown', (e) => {
      if (!isOpen) return;

      const input = document.getElementById('command-palette-input');
      if (!input || document.activeElement !== input) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, filteredResults.length - 1);
          renderResults(filteredResults);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          renderResults(filteredResults);
          break;
        case 'Enter':
          e.preventDefault();
          selectResult(selectedIndex);
          break;
      }
    });

    // Click selection
    document.addEventListener('click', (e) => {
      if (!isOpen) return;

      const target = e.target as Element | null;
      const result = target ? target.closest('.palette-result') : null;
      if (result) {
        const index = parseInt((result as HTMLElement).dataset.index ?? '', 10);
        if (!isNaN(index)) {
          selectResult(index);
        }
      }
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
  } else {
    setupEventListeners();
  }

  // Preload data on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadPaletteData());
  } else {
    setTimeout(() => loadPaletteData(), 1000);
  }
})();
