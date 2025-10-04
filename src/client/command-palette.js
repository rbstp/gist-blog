/* eslint-env browser */
/* eslint-disable no-empty */

// Command Palette: Terminal-style fuzzy finder for posts, tags, and navigation
// Activated with Cmd/Ctrl+K
(function () {
  let paletteData = null;
  let isOpen = false;
  let selectedIndex = 0;
  let filteredResults = [];

  // Fetch the data we need for search
  async function loadPaletteData() {
    if (paletteData) return paletteData;
    
    try {
      const response = await fetch('/graph.json');
      const graphData = await response.json();
      
      // Extract posts and tags from the graph data structure
      const posts = [];
      const tags = new Set();
      
      // Parse nodes and edges to build searchable data
      if (graphData.nodes) {
        graphData.nodes.forEach(node => {
          if (node.id) tags.add(node.id);
        });
      }
      
      // Try to get posts from localStorage or parse current page
      try {
        const postsJson = localStorage.getItem('blogPosts');
        if (postsJson) {
          const parsed = JSON.parse(postsJson);
          if (Array.isArray(parsed)) {
            posts.push(...parsed);
          }
        }
      } catch { }
      
      // Build commands list
      const commands = [
        { type: 'nav', title: 'Home', command: 'cd ~', url: '/', icon: '🏠' },
        { type: 'nav', title: 'Tag Graph', command: 'cd ~/graph', url: '/graph.html', icon: '📊' },
        { type: 'nav', title: 'RSS Feed', command: 'curl /feed.xml', url: '/feed.xml', icon: '📡' },
        { type: 'nav', title: 'GitHub Source', command: 'git clone', url: 'https://github.com/rbstp/gist-blog', icon: '🔧' },
      ];
      
      paletteData = { posts, tags: Array.from(tags), commands };
      return paletteData;
    } catch (err) {
      console.warn('Failed to load palette data:', err);
      return { posts: [], tags: [], commands: [] };
    }
  }

  // Fuzzy match scoring
  function fuzzyScore(str, query) {
    str = str.toLowerCase();
    query = query.toLowerCase();
    
    if (str.includes(query)) return 100; // Exact substring match
    
    let score = 0;
    let strIdx = 0;
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const foundIdx = str.indexOf(char, strIdx);
      
      if (foundIdx === -1) return 0; // No match
      
      // Bonus for consecutive chars
      if (foundIdx === strIdx) score += 5;
      score += 1;
      strIdx = foundIdx + 1;
    }
    
    return score;
  }

  // Filter and rank results
  function search(query) {
    if (!paletteData || !query.trim()) {
      return [];
    }
    
    const results = [];
    
    // Search commands
    paletteData.commands.forEach(cmd => {
      const titleScore = fuzzyScore(cmd.title, query);
      const commandScore = fuzzyScore(cmd.command, query);
      const score = Math.max(titleScore, commandScore);
      
      if (score > 0) {
        results.push({ ...cmd, score, matchType: 'command' });
      }
    });
    
    // Search tags
    paletteData.tags.forEach(tag => {
      const score = fuzzyScore(tag, query);
      if (score > 0) {
        results.push({
          type: 'tag',
          title: `#${tag}`,
          command: `grep --tag #${tag}`,
          url: `/?tag=${encodeURIComponent(tag)}`,
          icon: '🏷️',
          score,
          matchType: 'tag'
        });
      }
    });
    
    // Search posts (if we have them)
    paletteData.posts.forEach(post => {
      const titleScore = post.title ? fuzzyScore(post.title, query) : 0;
      const descScore = post.description ? fuzzyScore(post.description, query) : 0;
      const score = Math.max(titleScore, descScore);
      
      if (score > 0) {
        results.push({
          type: 'post',
          title: post.title || 'Untitled',
          command: `cat ${post.id}.md`,
          url: `/posts/${post.id}.html`,
          icon: '📄',
          description: post.description,
          score,
          matchType: 'post'
        });
      }
    });
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Limit to top 8 results
    return results.slice(0, 8);
  }

  // Create and inject the palette UI
  function createPaletteUI() {
    const overlay = document.createElement('div');
    overlay.id = 'command-palette-overlay';
    overlay.className = 'command-palette-overlay';
    overlay.innerHTML = `
      <div class="command-palette-terminal">
        <div class="terminal-header-small">
          <div class="terminal-controls-small">
            <span class="control close"></span>
            <span class="control minimize"></span>
            <span class="control maximize"></span>
          </div>
          <div class="terminal-title-small">command palette</div>
        </div>
        <div class="command-palette-body">
          <div class="command-palette-prompt">
            <span class="prompt-symbol">$</span>
            <input 
              type="text" 
              id="command-palette-input" 
              placeholder="search posts, tags, commands..."
              autocomplete="off"
              spellcheck="false"
              aria-label="Command palette search"
            />
          </div>
          <div class="command-palette-results" id="command-palette-results" role="listbox">
            <div class="palette-hint">
              <span class="hint-text">💡 Try: "ai", "devops", "home", or any post title</span>
            </div>
          </div>
        </div>
        <div class="command-palette-footer">
          <span class="palette-shortcut"><kbd>↑↓</kbd> navigate</span>
          <span class="palette-shortcut"><kbd>enter</kbd> select</span>
          <span class="palette-shortcut"><kbd>esc</kbd> close</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    return overlay;
  }

  // Render results
  function renderResults(results) {
    const container = document.getElementById('command-palette-results');
    if (!container) return;
    
    if (results.length === 0) {
      container.innerHTML = '<div class="palette-no-results">$ echo "No matches found" | grep -i ".*"</div>';
      return;
    }
    
    container.innerHTML = results.map((result, idx) => `
      <div 
        class="palette-result ${idx === selectedIndex ? 'selected' : ''}"
        data-index="${idx}"
        role="option"
        aria-selected="${idx === selectedIndex}"
      >
        <span class="result-icon">${result.icon}</span>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-command">${escapeHtml(result.command)}</div>
        </div>
        <span class="result-type">${result.matchType}</span>
      </div>
    `).join('');
    
    // Scroll selected into view
    const selected = container.querySelector('.palette-result.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // Simple HTML escape
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Handle selection
  function selectResult(index) {
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
  async function openPalette() {
    if (isOpen) return;
    
    // Load data if needed
    await loadPaletteData();
    
    // Create UI if not exists
    let overlay = document.getElementById('command-palette-overlay');
    if (!overlay) {
      overlay = createPaletteUI();
    }
    
    // Show and focus
    overlay.style.display = 'flex';
    isOpen = true;
    selectedIndex = 0;
    filteredResults = [];
    
    const input = document.getElementById('command-palette-input');
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
  function closePalette() {
    const overlay = document.getElementById('command-palette-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    isOpen = false;
  }

  // Setup event listeners
  function setupEventListeners() {
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
      if (e.target && e.target.id === 'command-palette-input') {
        const query = e.target.value;
        filteredResults = search(query);
        selectedIndex = 0;
        renderResults(filteredResults);
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
      
      const result = e.target.closest('.palette-result');
      if (result) {
        const index = parseInt(result.dataset.index, 10);
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
