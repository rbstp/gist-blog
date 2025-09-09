/* eslint-env browser */
/* eslint-disable no-empty */
// Main client script: shared behaviors across pages
// - Theme management and toggle
// - Conditional highlight.js loader
// - Index page: filtering, pagination, terminal controls
// - Post page: small topic graph rendering (base)
// - ToC active highlighting and sidebar layout adjustments
// - Tag preselection bridging from graph page

(function () {
  // Utilities
  function loadScript(src, { defer = true } = {}) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.defer = defer; s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Conditionally load highlight.js only if code blocks exist
  (function maybeLoadHighlight() {
    try {
      if (document.querySelector('pre code')) {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js')
          .then(() => { try { if (window.hljs && typeof window.hljs.highlightAll === 'function') { window.hljs.highlightAll(); } } catch { } })
          .catch(() => { /* ignore */ });
      }
    } catch { /* ignore */ }
  })();

  // Theme management - initialize ASAP to avoid FOUC
  (function setupTheme() {
    const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const getStoredTheme = () => {
      try { return localStorage.getItem('theme'); } catch { return null; }
    };
    const setTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
      const themeIcon = document.getElementById('theme-icon');
      if (themeIcon) themeIcon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    };

    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme || getSystemTheme();
    setTheme(initialTheme);

    const mql = window.matchMedia('(prefers-color-scheme: light)');
  try { mql.addEventListener('change', (e) => { if (!getStoredTheme()) setTheme(e.matches ? 'light' : 'dark'); }); } catch { /* ignore */ }

    // Expose toggle for button
    window.toggleTheme = function () {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme === 'light' ? 'dark' : 'light');
    };
  })();

  // Small topic graph base: draw center + neighbors and wire simple pan/zoom
  function initTopicGraph() {
    const svg = document.getElementById('topic-graph');
    if (!svg) return; // not on post page
    const container = svg.parentElement;
    const currentTopic = (container && container.getAttribute('data-current-topic')) ? container.getAttribute('data-current-topic') : '';
    const allTopicsCsv = container && container.getAttribute('data-all-topics');
    const topicsSet = new Set((allTopicsCsv || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

    fetch('/graph.json?v=' + (document.body.getAttribute('data-build-ts') || ''))
      .then(r => r.ok ? r.json() : null)
      .then(graph => {
        if (!graph || !graph.nodes) return;

        const width = 220, height = 232, cx = width / 2, cy = height / 2;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        root.setAttribute('id', 'graph-root'); svg.appendChild(root);

        const neighbors = new Map();
        graph.nodes.forEach(n => neighbors.set(n.id, new Set()));
        graph.edges.forEach(e => { neighbors.get(e.source)?.add(e.target); neighbors.get(e.target)?.add(e.source); });

        const centerId = (currentTopic && neighbors.has(currentTopic)) ? currentTopic : (graph.nodes[0]?.id || '');
        const neighborIds = Array.from(neighbors.get(centerId) || []);
        const visibleIds = [centerId, ...neighborIds];
        const visibleSet = new Set(visibleIds);

        const nodesPos = new Map();
        nodesPos.set(centerId, { x: cx, y: cy });
        const radius = 70;
        neighborIds.forEach((id, i) => {
          const angle = (i / Math.max(1, neighborIds.length)) * Math.PI * 2 - Math.PI / 2;
          nodesPos.set(id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
        });

        const maxWeight = Math.max(1, ...graph.edges.map(e => e.weight || 1));
        const linkMap = new Map();
        const visibleEdges = graph.edges.filter(e => visibleSet.has(e.source) && visibleSet.has(e.target));
        visibleEdges.forEach(e => {
          const p1 = nodesPos.get(e.source), p2 = nodesPos.get(e.target); if (!p1 || !p2) return;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y); line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
          line.setAttribute('class', 'graph-link');
          line.setAttribute('stroke-width', String(0.5 + 1.5 * ((e.weight || 1) / maxWeight)));
          const opacity = 0.2 + 0.6 * ((e.weight || 1) / maxWeight); line.setAttribute('stroke-opacity', String(opacity));
          root.appendChild(line);
          const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`; linkMap.set(key, line);
        });

        const maxCount = Math.max(1, ...graph.nodes.map(n => n.count));
        visibleIds.forEach(nid => {
          const n = graph.nodes.find(nn => nn.id === nid) || { id: nid, count: 1 };
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('class', 'graph-node'); g.setAttribute('data-id', n.id);
          if (topicsSet.has(n.id)) g.classList.add('topic');
          const { x, y } = nodesPos.get(n.id);
          const r = 3 + 6 * (n.count / maxCount);
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', String(r));
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', String(x + r + 2)); t.setAttribute('y', String(y + 3)); t.textContent = n.id;
          g.appendChild(c); g.appendChild(t); root.appendChild(g);
          g.addEventListener('mouseenter', () => setHighlight(n.id));
          g.addEventListener('mouseleave', () => clearHighlight());
          if (n.id !== centerId) { g.addEventListener('click', () => navigateWithTag(n.id)); }
        });

        function setHighlight(id) {
          const neighborSet = neighbors.get(id) || new Set();
          const groups = root.querySelectorAll('.graph-node'); const links = root.querySelectorAll('.graph-link');
          groups.forEach(el => {
            const nid = el.getAttribute('data-id'); const active = nid === id || neighborSet.has(nid);
            el.classList.toggle('active', active); el.classList.toggle('dimmed', !active);
          });
          links.forEach(l => l.classList.add('dimmed'));
          const eq = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
          visibleEdges.forEach(e => {
            if (e.source === id || e.target === id || neighborSet.has(e.source) || neighborSet.has(e.target)) {
              const line = linkMap.get(eq(e.source, e.target)); if (line) line.classList.remove('dimmed');
            }
          });
        }
        function clearHighlight() {
          root.querySelectorAll('.graph-node').forEach(el => el.classList.remove('active', 'dimmed'));
          root.querySelectorAll('.graph-link').forEach(el => el.classList.remove('dimmed'));
        }
        function navigateWithTag(tag) {
          try { localStorage.setItem('preselectedTags', JSON.stringify([tag])); } catch { }
          window.location.href = '/';
        }
        enablePanZoomSmall(svg, root);
      })
      .catch(() => { /* ignore */ });
  }

  // Simple pan/zoom used by the small topic graph
  function enablePanZoomSmall(svg, root) {
    let scale = 1, tx = 0, ty = 0; let panning = false; let lastX = 0, lastY = 0; let startX = 0, startY = 0;
    let dragCandidate = false; const DRAG_THRESHOLD = 4; const pointers = new Map(); let pinch = null; let lastTapTime = 0;
  const apply = () => root.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
    function clientToViewBox(cx, cy) {
      const rect = svg.getBoundingClientRect(); const vb = svg.viewBox?.baseVal || { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value };
      return { x: vb.x + ((cx - rect.left) / rect.width) * vb.width, y: vb.y + ((cy - rect.top) / rect.height) * vb.height };
    }
    function clampPan() {
      const vb = svg.viewBox?.baseVal || { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value };
      const isSmall = (vb.width || 0) <= 240; const bleed = isSmall ? 1.25 : 0.4; const minX = -vb.width * bleed, minY = -vb.height * bleed, maxX = vb.width * bleed, maxY = vb.height * bleed;
      tx = Math.max(minX, Math.min(maxX, tx)); ty = Math.max(minY, Math.min(maxY, ty));
    }
    function tryStartPinch() {
      if (pointers.size !== 2 || pinch) return; const pts = Array.from(pointers.values());
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2; const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y; const d0 = Math.hypot(dx, dy) || 1;
      const midVB = clientToViewBox(mx, my); const world = { x: (midVB.x - tx) / scale, y: (midVB.y - ty) / scale }; pinch = { s0: scale, t0: { x: tx, y: ty }, d0, world }; panning = false;
    }
    function updatePinch() {
      if (!pinch || pointers.size !== 2) return; const pts = Array.from(pointers.values());
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2; const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y; const d = Math.hypot(dx, dy) || 1;
      let next = pinch.s0 * (d / pinch.d0); next = Math.max(0.6, Math.min(2.5, next)); const midVB = clientToViewBox(mx, my);
      tx = midVB.x - next * pinch.world.x; ty = midVB.y - next * pinch.world.y; scale = next; apply();
    }
    svg.addEventListener('wheel', (e) => {
      e.preventDefault(); const factor = e.deltaY < 0 ? 1.1 : 0.9; const old = scale; const next = Math.max(0.6, Math.min(2.5, old * factor)); if (next === old) return;
      const { x: px, y: py } = clientToViewBox(e.clientX, e.clientY); const ratio = next / old; tx = px - ratio * (px - tx); ty = py - ratio * (py - ty); scale = next; apply();
    }, { passive: false });
    svg.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        const now = performance.now();
        if (now - lastTapTime < 300) {
          const { x: px, y: py } = clientToViewBox(e.clientX, e.clientY); const old = scale; const next = Math.max(0.6, Math.min(2.5, old * 1.6));
          const ratio = next / old; tx = px - ratio * (px - tx); ty = py - ratio * (py - ty); scale = next; apply(); lastTapTime = 0;
        } else { lastTapTime = now; }
        dragCandidate = true; panning = false; startX = lastX = e.clientX; startY = lastY = e.clientY;
      } else if (pointers.size === 2) { tryStartPinch(); }
    });
    svg.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch) { updatePinch(); return; }
      const rect0 = clientToViewBox(lastX, lastY), rect1 = clientToViewBox(e.clientX, e.clientY); const dxVB = rect1.x - rect0.x, dyVB = rect1.y - rect0.y;
      if (dragCandidate && !panning) { const movedPx = Math.hypot(e.clientX - startX, e.clientY - startY); if (movedPx > DRAG_THRESHOLD) { panning = true; dragCandidate = false; svg.setPointerCapture?.(e.pointerId); svg.classList.add('panning'); } else { return; } }
      lastX = e.clientX; lastY = e.clientY; if (!panning) return; tx += dxVB; ty += dyVB; clampPan(); apply();
    });
    function endInteraction(e) {
      if (pointers.has(e.pointerId)) pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (pointers.size === 0) { dragCandidate = false; panning = false; svg.classList.remove('panning'); }
    }
    svg.addEventListener('pointerup', endInteraction); svg.addEventListener('pointercancel', endInteraction); svg.addEventListener('pointerleave', () => { panning = false; svg.classList.remove('panning'); });
    const resetButtons = document.querySelectorAll('.graph-reset-btn');
    resetButtons.forEach(btn => { const targetId = btn.getAttribute('data-target'); if (targetId === svg.id) { btn.addEventListener('click', () => { scale = 1; tx = 0; ty = 0; apply(); }); } });
    apply();
  }

  // Client-side pagination and filtering (index page only)
  function initIndexFilteringAndPagination() {
    const section = document.querySelector('.pipeline-section');
    const isIndexPage = !!section; if (!isIndexPage) return;
    const POSTS_PER_PAGE = 6;
    const allPosts = Array.from(document.querySelectorAll('.post-card'));
    let activeTags = []; let currentPage = 1;
    const paginationSection = document.getElementById('pagination-section');
    const paginationCommand = document.getElementById('pagination-command');
    const paginationPages = document.getElementById('pagination-pages');
    const prevBtn = document.getElementById('prev-btn'); const nextBtn = document.getElementById('next-btn');
    let filterStatus = document.createElement('div'); filterStatus.className = 'filter-status'; filterStatus.style.display = 'none'; section.insertBefore(filterStatus, section.querySelector('.posts-grid'));

    // Escape HTML for safe insertion
    function escapeHTML(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\//g, '&#x2F;');
    }

    function getFilteredPosts() {
      if (activeTags.length === 0) return allPosts;
      return allPosts.filter(post => {
        const postTags = post.querySelectorAll('.tag'); const postTagNames = Array.from(postTags).map(t => t.getAttribute('data-tag'));
        return activeTags.every(tag => postTagNames.includes(tag));
      });
    }
    function updatePagination() {
      const filtered = getFilteredPosts(); const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
      allPosts.forEach(p => p.style.display = 'none');
      const startIndex = (currentPage - 1) * POSTS_PER_PAGE; const endIndex = startIndex + POSTS_PER_PAGE; filtered.slice(startIndex, endIndex).forEach(p => { p.style.display = 'block'; });
      if (paginationSection && (totalPages > 1 || activeTags.length > 0)) {
        paginationSection.style.display = 'block';
        if (paginationCommand) paginationCommand.textContent = totalPages > 1 ? `ls posts | less :${currentPage}/${totalPages}` : `ls posts | head -${filtered.length}`;
        if (prevBtn) { if (totalPages > 1) { prevBtn.style.display = 'flex'; prevBtn.disabled = currentPage === 1; } else { prevBtn.style.display = 'none'; } }
        if (nextBtn) { if (totalPages > 1) { nextBtn.style.display = 'flex'; nextBtn.disabled = currentPage === totalPages; } else { nextBtn.style.display = 'none'; } }
        if (paginationPages) {
          if (totalPages > 1) {
            paginationPages.style.display = 'flex'; paginationPages.innerHTML = '';
            const maxVisible = 5; let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2)); let endPage = Math.min(totalPages, startPage + maxVisible - 1);
            if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);
            for (let i = startPage; i <= endPage; i++) { const pageBtn = document.createElement('button'); pageBtn.className = 'pagination-page' + (i === currentPage ? ' current' : ''); pageBtn.textContent = i; pageBtn.addEventListener('click', () => { currentPage = i; updatePagination(); }); paginationPages.appendChild(pageBtn); }
          } else { paginationPages.style.display = 'none'; }
        }
      } else if (paginationSection) { paginationSection.style.display = 'none'; }
    }
    function updateFilterStatus() {
      if (activeTags.length === 0) { filterStatus.style.display = 'none'; return; }
      const filteredCount = getFilteredPosts().length; const tagsDisplay = activeTags.map(tag => `<span class="filter-tag clickable-filter-tag" data-tag="${escapeHTML(tag)}">#${escapeHTML(tag)}</span>`).join(' ');
      filterStatus.innerHTML = `<div class="filter-info"><span class="filter-prompt">$</span><span>grep --tag</span>${tagsDisplay}<span class="filter-count">→ ${filteredCount} result${filteredCount !== 1 ? 's' : ''}</span><button class="clear-filter" data-clear>clear</button></div>`;
      filterStatus.style.display = 'block';
      filterStatus.querySelector('[data-clear]')?.addEventListener('click', () => { activeTags = []; currentPage = 1; document.querySelectorAll('.tag').forEach(t => t.classList.remove('active')); updateFilterStatus(); updatePagination(); });
      filterStatus.querySelectorAll('.clickable-filter-tag').forEach(el => {
        el.addEventListener('click', () => {
          const tagName = el.getAttribute('data-tag'); const idx = activeTags.indexOf(tagName);
          if (idx > -1) { activeTags.splice(idx, 1); document.querySelectorAll('.tag').forEach(t => { if (t.getAttribute('data-tag') === tagName) t.classList.remove('active'); }); }
          currentPage = 1; updateFilterStatus(); updatePagination();
        });
      });
    }
    document.querySelectorAll('.tag').forEach(tagEl => {
      tagEl.addEventListener('click', () => {
        const tagName = tagEl.getAttribute('data-tag'); const idx = activeTags.indexOf(tagName);
        if (idx > -1) { activeTags.splice(idx, 1); document.querySelectorAll('.tag').forEach(t => { if (t.getAttribute('data-tag') === tagName) t.classList.remove('active'); }); }
        else { activeTags.push(tagName); document.querySelectorAll('.tag').forEach(t => { if (t.getAttribute('data-tag') === tagName) t.classList.add('active'); }); }
        currentPage = 1; updateFilterStatus(); updatePagination();
      });
    });
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; updatePagination(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(getFilteredPosts().length / POSTS_PER_PAGE); if (currentPage < totalPages) { currentPage++; updatePagination(); }
    });
    updatePagination();
    // Apply preselected tags if any
    (function applyPreselectedTags() {
      let preload = null; try { preload = JSON.parse(localStorage.getItem('preselectedTags') || 'null'); } catch { preload = null; }
      if (!Array.isArray(preload) || preload.length === 0) return;
      const set = new Set(preload); const allTags = document.querySelectorAll('.tag'); allTags.forEach(t => { const name = t.getAttribute('data-tag'); if (set.has(name)) t.classList.add('active'); });
      preload.forEach(name => { const el = Array.from(allTags).find(e => e.getAttribute('data-tag') === name); if (el) el.click(); });
      try { localStorage.removeItem('preselectedTags'); } catch { }
    })();
  }

  // Terminal controls (close/minimize/maximize) and dev-mode easter egg
  function initTerminalsAndEasterEgg() {
    const themeToggle = document.getElementById('theme-toggle'); if (themeToggle) themeToggle.addEventListener('click', window.toggleTheme);
    const terminals = document.querySelectorAll('.hero-terminal, .pagination-section');
    terminals.forEach(terminal => {
      const closeBtn = terminal.querySelector('.control.close'); const minimizeBtn = terminal.querySelector('.control.minimize'); const maximizeBtn = terminal.querySelector('.control.maximize'); const terminalWindow = terminal.querySelector('.terminal-window, .pagination-terminal');
      if (closeBtn) { closeBtn.style.cursor = 'pointer'; closeBtn.addEventListener('click', () => { terminal.style.display = 'none'; }); }
      if (minimizeBtn && terminalWindow) {
        minimizeBtn.style.cursor = 'pointer'; minimizeBtn.addEventListener('click', () => {
          const body = terminalWindow.querySelector('.terminal-body, .pagination-body'); if (!body) return; const isMin = terminalWindow.dataset.minimized === 'true';
          body.style.display = isMin ? 'block' : 'none'; terminalWindow.dataset.minimized = isMin ? 'false' : 'true';
        });
      }
      if (maximizeBtn && terminalWindow) {
        maximizeBtn.style.cursor = 'pointer'; maximizeBtn.addEventListener('click', () => {
          const tagsSection = terminal.querySelector('#pagination-tags-section'); const heroExpanded = terminal.querySelector('#hero-terminal-expanded');
          const isMax = terminalWindow.dataset.maximized === 'true';
          if (isMax) { terminalWindow.style.width = ''; terminalWindow.style.maxWidth = ''; terminalWindow.dataset.maximized = 'false'; if (tagsSection) tagsSection.style.display = 'none'; if (heroExpanded) heroExpanded.style.display = 'none'; }
          else { terminalWindow.style.width = '100%'; terminalWindow.style.maxWidth = 'none'; terminalWindow.dataset.maximized = 'true'; if (tagsSection) tagsSection.style.display = 'block'; if (heroExpanded) heroExpanded.style.display = 'block'; }
        });
      }
    });

    // Dev mode easter egg toggle on clicking the "main" button
    let isDevMode = false; const mainButton = document.querySelector('a.nav-item[href="/"]');
    function activateDevMode() {
      document.body.classList.add('dev-mode');
      if (!window.originalContent) window.originalContent = { title: document.title };
      document.title = 'SYSTEM FAILURE - rbstp.dev';
      const buildStatus = document.querySelector('.build-status'); if (buildStatus) { buildStatus.className = 'build-status error'; buildStatus.innerHTML = '✗ Build Failed'; }
      const heroTerminalBody = document.querySelector('.hero-terminal .terminal-body'); if (heroTerminalBody) {
        heroTerminalBody.innerHTML = '<div class="terminal-line"><span class="prompt">rbstp@devops:~$</span><span class="command">deploy --production</span></div>' +
          '<div class="terminal-output error-output"><span class="output-text error">ERROR: Deployment failed at 2025-07-30T15:42:31Z</span></div>' +
          '<div class="terminal-output error-output"><span class="output-text error">CRITICAL: Database connection lost</span></div>' +
          '<div class="terminal-line"><span class="prompt">rbstp@devops:~$</span><span class="command">rollback --emergency</span></div>' +
          '<div class="terminal-output error-output"><span class="output-text warning">INITIATING EMERGENCY ROLLBACK...</span></div>' +
          '<div class="terminal-output error-output"><span class="output-text error">47 services affected</span></div>';
      }
      const footerStatus = document.querySelector('.status-bar'); if (footerStatus) {
        footerStatus.innerHTML = '<span class="status-item"><span class="status-dot error"></span><span>system: degraded</span></span>' +
          '<span class="status-item"><span class="status-dot error"></span><span>alerts: <a href="#" style="color: var(--accent-error);">47 active</a></span></span>' +
          '<span class="status-item"><span class="status-dot warning"></span><span>rollback: in progress</span></span>';
      }
      document.querySelectorAll('.post-card').forEach(card => {
        card.querySelector('.status-indicator')?.classList.add('error');
        const st = card.querySelector('.status-text'); if (st) { st.textContent = 'failed'; st.style.color = 'var(--accent-error)'; }
        const bn = card.querySelector('.branch-name'); if (bn) bn.textContent = 'dev';
      });
      const sectionTitle = document.querySelector('.section-title'); if (sectionTitle) sectionTitle.textContent = 'Failed Deployments';
      const pipelineStatus = document.querySelector('.pipeline-status'); if (pipelineStatus) pipelineStatus.innerHTML = '<span class="build-status error">✗ Build Failed</span><span class="deploy-time">Last failure: <span class="local-time">2 min ago</span></span>';
      const mainButtonSpan = document.querySelector('a.nav-item[href="/"] span'); if (mainButtonSpan) mainButtonSpan.textContent = 'dev';
    }
    function deactivateDevMode() { document.body.classList.remove('dev-mode'); if (window.originalContent) { document.title = window.originalContent.title; window.location.reload(); } }
    function toggleDevMode() { isDevMode = !isDevMode; if (isDevMode) activateDevMode(); else deactivateDevMode(); }
    if (mainButton) { mainButton.addEventListener('click', (e) => { e.preventDefault(); toggleDevMode(); }); }
  }

  // ToC active section highlighting and sidebar layout adjustments (post pages)
  function initTocBehaviors() {
    // Active highlighting
    const tocLinks = document.querySelectorAll('.toc-link'); if (!tocLinks.length) return;
    const headings = Array.from(document.querySelectorAll('h2[id], h3[id], h4[id], h5[id], h6[id]')); if (!headings.length) return;
    const sidebar = document.querySelector('.toc-sidebar');
    function ensureVisible(link, center = false) {
      if (!sidebar || !link) return; const sbRect = sidebar.getBoundingClientRect(); const lRect = link.getBoundingClientRect(); const margin = 8;
      if (center) { const sbCenter = (sbRect.top + sbRect.bottom) / 2; const lCenter = (lRect.top + lRect.bottom) / 2; sidebar.scrollTop += (lCenter - sbCenter); }
      else if (lRect.top < sbRect.top + margin) { sidebar.scrollTop -= (sbRect.top + margin) - lRect.top; }
      else if (lRect.bottom > sbRect.bottom - margin) { sidebar.scrollTop += lRect.bottom - (sbRect.bottom - margin); }
    }
    let lastScrollY = window.scrollY;
    function updateActiveLink() {
      const scrollPosition = window.scrollY + 100; let activeHeading = null; for (const h of headings) { if (h.offsetTop <= scrollPosition) activeHeading = h; else break; }
      tocLinks.forEach(l => l.classList.remove('active'));
      if (activeHeading) {
        const activeLink = document.querySelector(`.toc-link[href="#${activeHeading.id}"]`); if (activeLink) { activeLink.classList.add('active'); const up = window.scrollY < lastScrollY; ensureVisible(activeLink, up);
          if (!up && sidebar) {
            const arr = Array.from(tocLinks); const idx = arr.indexOf(activeLink); if (idx === arr.length - 1) { const tocTerminal = document.querySelector('.toc-terminal'); const sbRect = sidebar.getBoundingClientRect(); const margin = 8; sidebar.scrollTop = sidebar.scrollHeight; if (tocTerminal) { const tRect = tocTerminal.getBoundingClientRect(); if (tRect.bottom > sbRect.bottom - margin) { const delta = tRect.bottom - (sbRect.bottom - margin); sidebar.scrollTop += Math.max(0, delta); } } }
          }
        }
      }
      lastScrollY = window.scrollY;
    }
    let ticking = false; function throttledUpdate() { if (!ticking) { requestAnimationFrame(() => { updateActiveLink(); ticking = false; }); ticking = true; } }
    window.addEventListener('scroll', throttledUpdate, { passive: true }); updateActiveLink();

    // Sidebar position/height responsive adjustments
    function adjustTocSidebar() {
      const sidebar = document.querySelector('.toc-sidebar'); const header = document.querySelector('header'); if (!sidebar) return; const gap = 16; const container = document.querySelector('main.container');
      const headerRect = header ? header.getBoundingClientRect() : null; const headerBottom = headerRect ? Math.ceil(headerRect.bottom) : 0; const top = Math.max(gap, headerBottom + gap); sidebar.style.top = top + 'px';
      let maxH = Math.max(120, window.innerHeight - top - gap); const footer = document.querySelector('footer'); if (footer) { const fRect = footer.getBoundingClientRect(); if (fRect.top < window.innerHeight) { const available = Math.max(80, fRect.top - top - gap); maxH = Math.max(80, Math.min(maxH, available)); } }
      sidebar.style.maxHeight = maxH + 'px';
      if (container) {
        const cRect = container.getBoundingClientRect(); const postContainer = document.querySelector('.post-container'); const availableRight = Math.max(0, window.innerWidth - cRect.right - gap);
        const minW = 240; const maxW = 360; const ideal = Math.round(Math.min(maxW, Math.max(minW, window.innerWidth * 0.22))); const fitWidth = Math.max(minW, Math.min(ideal, availableRight)); if (postContainer) postContainer.style.marginRight = '';
        if (availableRight >= minW + 4) { sidebar.style.display = 'block'; sidebar.style.right = 'auto'; sidebar.style.left = Math.max(gap, Math.min(cRect.right + gap, window.innerWidth - fitWidth - gap)) + 'px'; sidebar.style.width = fitWidth + 'px'; sidebar.style.minWidth = minW + 'px'; sidebar.style.maxWidth = maxW + 'px'; }
        else { const fallbackWidth = Math.round(Math.min(maxW, Math.max(220, ideal))); if (window.innerWidth >= 1160) { sidebar.style.display = 'block'; sidebar.style.left = ''; sidebar.style.right = gap + 'px'; sidebar.style.width = fallbackWidth + 'px'; sidebar.style.minWidth = '220px'; sidebar.style.maxWidth = maxW + 'px'; if (postContainer) postContainer.style.marginRight = (fallbackWidth + gap) + 'px'; } else { sidebar.style.display = 'none'; } }
      }
      if ((window.scrollY || document.documentElement.scrollTop || 0) <= 2) sidebar.scrollTop = 0;
      const docEl = document.documentElement; const atBottom = (window.innerHeight + window.scrollY) >= (docEl.scrollHeight - 2); if (atBottom) sidebar.scrollTop = sidebar.scrollHeight;
    }
    let rafId = null; function scheduleAdjust() { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = null; adjustTocSidebar(); }); }
    adjustTocSidebar(); window.addEventListener('resize', scheduleAdjust, { passive: true }); window.addEventListener('scroll', scheduleAdjust, { passive: true });
  }

  // Page-specific dynamic loaders (keep templates clean)
  document.addEventListener('DOMContentLoaded', () => {
    initIndexFilteringAndPagination();
    initTerminalsAndEasterEgg();
    initTocBehaviors();
    initTopicGraph();

    const rawTs = document.body.getAttribute('data-build-ts') || '';
    const ts = encodeURIComponent(rawTs);
    // Load graph page script if on graph page
    if (document.querySelector('.graph-page')) { loadScript(`/assets/graph-page.js?v=${ts}`).catch(() => { /* ignore */ }); }
    // Load topic-graph enhancement when topic graph exists
    if (document.getElementById('topic-graph')) { loadScript(`/assets/topic-graph-enhance.js?v=${ts}`).catch(() => { /* ignore */ }); }
  });
})();
