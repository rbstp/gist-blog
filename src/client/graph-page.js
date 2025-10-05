/* eslint-env browser */
/* eslint-disable no-empty */

// Enhanced graph page with search and keyboard navigation
(function () {
  let currentFocusIndex = -1;
  let allNodeElements = [];
  
  function navigateWithTag(tag) {
    try { localStorage.setItem('preselectedTags', JSON.stringify([tag])); } catch { }
    window.location.href = '/';
  }

  // Search functionality
  function setupGraphSearch(nodes, nodeRefs, highlightFn, clearFn) {
    const searchInput = document.getElementById('graph-search-input');
    const resultsDisplay = document.getElementById('graph-search-results');
    
    if (!searchInput) return;
    
    let searchMatches = [];
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      
      if (!query) {
        clearFn();
        if (resultsDisplay) resultsDisplay.textContent = '';
        searchMatches = [];
        return;
      }
      
      // Find matching nodes
      searchMatches = nodes.filter(n => n.id.toLowerCase().includes(query));
      
      if (searchMatches.length > 0) {
        // Highlight all matches
        const matchIds = searchMatches.map(n => n.id);
        highlightMultiple(matchIds, nodeRefs);
        
        if (resultsDisplay) {
          resultsDisplay.textContent = `Found ${searchMatches.length} tag${searchMatches.length === 1 ? '' : 's'}: ${matchIds.slice(0, 5).join(', ')}${searchMatches.length > 5 ? '...' : ''}`;
        }
      } else {
        clearFn();
        if (resultsDisplay) {
          resultsDisplay.textContent = 'No matching tags found';
        }
      }
    });
    
    // Clear search on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchInput.blur();
        clearFn();
        if (resultsDisplay) resultsDisplay.textContent = '';
      }
    });
  }
  
  function highlightMultiple(ids, nodeRefs) {
    const idSet = new Set(ids);
    document.querySelectorAll('.graph-node').forEach(el => {
      const nid = el.getAttribute('data-id');
      if (idSet.has(nid)) {
        el.classList.add('active');
        el.classList.remove('dimmed');
      } else {
        el.classList.add('dimmed');
        el.classList.remove('active');
      }
    });
    
    // Also dim links that don't connect highlighted nodes
    document.querySelectorAll('.graph-link').forEach(el => {
      el.classList.add('dimmed');
    });
  }

  // Keyboard navigation
  function setupKeyboardNavigation(nodes, nodeRefs, positions) {
    allNodeElements = Array.from(document.querySelectorAll('.graph-node'));
    
    document.addEventListener('keydown', (e) => {
      // Only handle if search input is not focused
      if (document.activeElement && document.activeElement.id === 'graph-search-input') {
        return;
      }
      
      // Arrow key navigation
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        currentFocusIndex = Math.min(currentFocusIndex + 1, allNodeElements.length - 1);
        if (allNodeElements[currentFocusIndex]) {
          allNodeElements[currentFocusIndex].focus();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        currentFocusIndex = Math.max(currentFocusIndex - 1, 0);
        if (allNodeElements[currentFocusIndex]) {
          allNodeElements[currentFocusIndex].focus();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        currentFocusIndex = 0;
        if (allNodeElements[0]) {
          allNodeElements[0].focus();
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        currentFocusIndex = allNodeElements.length - 1;
        if (allNodeElements[currentFocusIndex]) {
          allNodeElements[currentFocusIndex].focus();
        }
      } else if (e.key === '?') {
        // Show help
        e.preventDefault();
        toggleHelp();
      } else if (e.key === '/') {
        // Focus search
        e.preventDefault();
        const searchInput = document.getElementById('graph-search-input');
        if (searchInput) searchInput.focus();
      }
    });
  }
  
  function toggleHelp() {
    let helpOverlay = document.getElementById('graph-help-overlay');
    
    if (helpOverlay) {
      helpOverlay.remove();
      return;
    }
    
    helpOverlay = document.createElement('div');
    helpOverlay.id = 'graph-help-overlay';
    helpOverlay.className = 'graph-help-overlay';
    helpOverlay.innerHTML = `
      <div class="graph-help-content">
        <div class="help-header">
          <span class="help-title">$ man graph-controls</span>
          <button class="help-close" aria-label="Close help">✕</button>
        </div>
        <div class="help-body">
          <div class="help-section">
            <h3>Navigation</h3>
            <div class="help-item"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>Move between tags</div>
            <div class="help-item"><kbd>Home</kbd>First tag</div>
            <div class="help-item"><kbd>End</kbd>Last tag</div>
            <div class="help-item"><kbd>Enter</kbd>Select tag</div>
          </div>
          <div class="help-section">
            <h3>Actions</h3>
            <div class="help-item"><kbd>/</kbd>Focus search</div>
            <div class="help-item"><kbd>Esc</kbd>Clear search</div>
            <div class="help-item"><kbd>?</kbd>Toggle this help</div>
          </div>
          <div class="help-section">
            <h3>Mouse</h3>
            <div class="help-item">Drag nodes to reposition</div>
            <div class="help-item">Scroll to zoom</div>
            <div class="help-item">Drag background to pan</div>
            <div class="help-item">Hover to highlight connections</div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(helpOverlay);
    
    helpOverlay.addEventListener('click', (e) => {
      if (e.target === helpOverlay || e.target.classList.contains('help-close')) {
        helpOverlay.remove();
      }
    });
  }



  // Pan/zoom utility (unchanged from original, keeping for reference)
  function enablePanZoom(svg, root, options = {}) {
    let scale = 1, tx = 0, ty = 0; let panning = false; let lastX = 0, lastY = 0;
    let dragCandidate = false; const DRAG_THRESHOLD = 4; const pointers = new Map(); let pinch = null; let lastTapTime = 0;
    let initialScale = 1, initialTx = 0, initialTy = 0;
    function apply() { root.setAttribute('transform', `scale(${scale}) translate(${tx},${ty})`); }
    function clientToViewBox(cx, cy) {
      const rect = svg.getBoundingClientRect(); const vb = svg.viewBox?.baseVal || { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value };
      return { x: vb.x + ((cx - rect.left) / rect.width) * vb.width, y: vb.y + ((cy - rect.top) / rect.height) * vb.height };
    }
    function toWorldDelta(c0x, c0y, c1x, c1y) { const p0 = clientToViewBox(c0x, c0y), p1 = clientToViewBox(c1x, c1y); return { dx: (p1.x - p0.x) / scale, dy: (p1.y - p0.y) / scale }; }
    function clampPan() {
      const vb = svg.viewBox?.baseVal || { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value };
      const bleed = 2.0; const minX = -vb.width * bleed, minY = -vb.height * bleed, maxX = vb.width * bleed, maxY = vb.height * bleed;
      tx = Math.max(minX, Math.min(maxX, tx)); ty = Math.max(minY, Math.min(maxY, ty));
    }
    function tryStartPinch() {
      if (pointers.size !== 2 || pinch) return; const pts = Array.from(pointers.values());
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2; const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y; const d0 = Math.hypot(dx, dy) || 1;
      const midVB = clientToViewBox(mx, my);
      const world = { x: (midVB.x - tx) / scale, y: (midVB.y - ty) / scale };
      pinch = { s0: scale, t0: { x: tx, y: ty }, d0, world }; panning = false;
    }
    function updatePinch() {
      if (!pinch || pointers.size !== 2) return; const pts = Array.from(pointers.values());
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2; const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y; const d = Math.hypot(dx, dy) || 1;
      let next = pinch.s0 * (d / pinch.d0); next = Math.max(0.4, Math.min(2.5, next)); const midVB = clientToViewBox(mx, my);
      tx = midVB.x - next * pinch.world.x; ty = midVB.y - next * pinch.world.y; scale = next; clampPan(); apply();
    }
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const factor = e.deltaY < 0 ? 1.1 : 0.9; const old = scale; const next = Math.max(0.4, Math.min(2.5, old * factor)); if (next === old) return;
      const r = svg.getBoundingClientRect(); const vx1 = Math.max(0, r.left), vy1 = Math.max(0, r.top); const vx2 = Math.min(window.innerWidth, r.right), vy2 = Math.min(window.innerHeight, r.bottom);
      const hasIntersection = vx2 > vx1 && vy2 > vy1; const cx = hasIntersection ? (vx1 + vx2) / 2 : (r.left + r.width / 2); const cy = hasIntersection ? (vy1 + vy2) / 2 : (r.top + r.height / 2);
      const { x: px, y: py } = clientToViewBox(cx, cy);
      tx = tx + px * (1 / next - 1 / old); ty = ty + py * (1 / next - 1 / old); scale = next; clampPan(); apply(); }, { passive: false });
    svg.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { const now = performance.now(); if (now - lastTapTime < 300) { const { x: px, y: py } = clientToViewBox(e.clientX, e.clientY); const old = scale; const next = Math.max(0.4, Math.min(2.5, old * 1.6)); tx = tx + px * (1 / next - 1 / old); ty = ty + py * (1 / next - 1 / old); scale = next; clampPan(); apply(); lastTapTime = 0; } else { lastTapTime = now; } dragCandidate = true; panning = false; lastX = e.clientX; lastY = e.clientY; }
      else if (pointers.size === 2) { tryStartPinch(); }
    });
    svg.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch) { updatePinch(); return; }
      const p0 = clientToViewBox(lastX, lastY), p1 = clientToViewBox(e.clientX, e.clientY); const dx = p1.x - p0.x, dy = p1.y - p0.y;
      if (dragCandidate && !panning) { const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY); if (moved > DRAG_THRESHOLD) { panning = true; dragCandidate = false; svg.setPointerCapture?.(e.pointerId); svg.classList.add('panning'); } else return; }
      lastX = e.clientX; lastY = e.clientY; if (!panning) return; tx += dx; ty += dy; clampPan(); apply();
    });
    function endInteraction(e) { if (pointers.has(e.pointerId)) pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (pointers.size === 0) { dragCandidate = false; panning = false; svg.classList.remove('panning'); } }
    svg.addEventListener('pointerup', endInteraction); svg.addEventListener('pointercancel', endInteraction); svg.addEventListener('pointerleave', () => { panning = false; svg.classList.remove('panning'); });
    const resetButtons = document.querySelectorAll('.graph-reset-btn'); resetButtons.forEach(btn => { const targetId = btn.getAttribute('data-target'); if (targetId === svg.id) { btn.addEventListener('click', () => { scale = initialScale; tx = initialTx; ty = initialTy; apply(); }); } });
    function fitToContent(padding = 24) {
      try { const vb = svg.viewBox?.baseVal || { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value }; const bbox = root.getBBox(); if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width === 0 || bbox.height === 0) { apply(); return; }
        const contentW = bbox.width + 2 * padding, contentH = bbox.height + 2 * padding; const s = Math.min(vb.width / contentW, vb.height / contentH); scale = Math.max(0.3, Math.min(2.5, s));
        const cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2; const ccx = bbox.x + bbox.width / 2, ccy = bbox.y + bbox.height / 2;
        tx = cx - scale * ccx; ty = cy - scale * ccy; initialScale = scale; initialTx = tx; initialTy = ty; apply();
      } catch { }
    }
    if (options.autoFit) requestAnimationFrame(() => fitToContent(options.padding ?? 24));
    apply();
    return { clientToViewBox, toWorldDelta, getScale: () => scale };
  }

  function renderGlobalGraph() {
    const svg = document.getElementById('global-tag-graph'); if (!svg) return;
    
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'graph-loading';
    loadingDiv.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">$ loading graph.json...</div>
    `;
    svg.parentElement.insertBefore(loadingDiv, svg);
    
    const ts = document.body.getAttribute('data-build-ts') || '';
    fetch('/graph.json?v=' + ts)
      .then(r => r.ok ? r.json() : null)
      .then(graph => {
        loadingDiv.remove();
        
        if (!graph || !graph.nodes) {
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', '50%'); t.setAttribute('y', '50%'); t.setAttribute('text-anchor', 'middle'); t.textContent = 'No graph data'; t.setAttribute('class', 'graph-empty'); svg.appendChild(t); return;
        }

        // Populate terminal widgets with live stats if present
        try {
          const nodesEl = document.getElementById('ee-nodes'); const edgesEl = document.getElementById('ee-edges'); if (nodesEl) nodesEl.textContent = String(graph.nodes.length); if (edgesEl) edgesEl.textContent = String(graph.edges.length);
          const tfNodes1 = document.getElementById('ee-tf-nodes'); const tfEdges1 = document.getElementById('ee-tf-edges'); const tfNodes2 = document.getElementById('ee-tf-nodes2'); const tfEdges2 = document.getElementById('ee-tf-edges2'); const sloEl = document.getElementById('ee-slo'); const ebEl = document.getElementById('ee-eb');
          const n = graph.nodes.length, e = graph.edges.length; if (tfNodes1) tfNodes1.textContent = String(n); if (tfEdges1) tfEdges1.textContent = String(e); if (tfNodes2) tfNodes2.textContent = String(n); if (tfEdges2) tfEdges2.textContent = String(e);
          const density = n > 1 ? Math.min(1, (2 * e) / (n * (n - 1))) : 0; const slo = (99.5 + 0.49 * density).toFixed(2) + '%'; const eb = Math.max(0.01, 1 - (parseFloat(slo) / 100)).toFixed(2) + '%'; if (sloEl) sloEl.textContent = slo; if (ebEl) ebEl.textContent = eb;
        } catch { }

        const width = 800, height = 520, cx = width / 2, cy = height / 2; svg.setAttribute('viewBox', `0 0 ${width} ${height}`); while (svg.firstChild) svg.removeChild(svg.firstChild);
        const root = document.createElementNS('http://www.w3.org/2000/svg', 'g'); root.setAttribute('id', 'global-graph-root'); svg.appendChild(root);
        const pz = enablePanZoom(svg, root, { autoFit: true, padding: 28 });

        // Layout: ring placement for top-N nodes
        const nodes = graph.nodes.slice().sort((a, b) => b.count - a.count);
        const maxCount = Math.max(1, ...nodes.map(n => n.count));
        const ringRadius = [0, 120, 200, 280]; const perRing = [1, 6, 8, 12];
        const positions = new Map(); const nodeRefs = new Map(); const neighbors = new Map(); function addNeighbor(a, b) { if (!neighbors.has(a)) neighbors.set(a, new Set()); neighbors.get(a).add(b); }
        let idx = 0;
        for (let r = 0; r < ringRadius.length; r++) {
          const radius = ringRadius[r]; const nThisRing = perRing[r];
          for (let i = 0; i < nThisRing && idx < nodes.length; i++, idx++) {
            const n = nodes[idx]; const angle = nThisRing === 1 ? -Math.PI / 2 : (i / nThisRing) * Math.PI * 2 - Math.PI / 2; const x = cx + radius * Math.cos(angle), y = cy + radius * Math.sin(angle); positions.set(n.id, { x, y });
          }
        }
        const outerR = ringRadius[ringRadius.length - 1] + 80; let extra = 0; while (idx < nodes.length) { const n = nodes[idx++]; const angle = (extra / 16) * Math.PI * 2 - Math.PI / 2; const x = cx + outerR * Math.cos(angle), y = cy + outerR * Math.sin(angle); positions.set(n.id, { x, y }); extra++; }

        const initialPositions = new Map(); positions.forEach((p, id) => initialPositions.set(id, { x: p.x, y: p.y }));

        // Draw edges
        const linkMap = new Map(); const maxWeight = Math.max(1, ...graph.edges.map(e => e.weight || 1));
        graph.edges.forEach(e => {
          addNeighbor(e.source, e.target); addNeighbor(e.target, e.source);
          const p1 = positions.get(e.source), p2 = positions.get(e.target); if (!p1 || !p2) return; const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y); line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y); line.setAttribute('class', 'graph-link'); line.setAttribute('stroke-width', String(0.5 + 1.5 * ((e.weight || 1) / maxWeight))); root.appendChild(line);
          const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`; linkMap.set(key, line);
        });

        function updateEdgesForNode(id) {
          const set = neighbors.get(id) || new Set(); set.forEach(nid => { const p1 = positions.get(id), p2 = positions.get(nid); if (!p1 || !p2) return; const key = id < nid ? `${id}|${nid}` : `${nid}|${id}`; const line = linkMap.get(key); if (line) { line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y); line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y); } });
        }
        function setNodePosition(id, x, y) { positions.set(id, { x, y }); const ref = nodeRefs.get(id); if (ref) { ref.circle.setAttribute('cx', x); ref.circle.setAttribute('cy', y); ref.text.setAttribute('x', String(x + ref.radius + 2)); ref.text.setAttribute('y', String(y + 3)); } updateEdgesForNode(id); }
        function moveNodeAndNeighbors(id, dx, dy, factor = 0.25) { const p = positions.get(id); if (p) setNodePosition(id, p.x + dx, p.y + dy); const neigh = neighbors.get(id); if (neigh) neigh.forEach(nid => { const pn = positions.get(nid); if (pn) setNodePosition(nid, pn.x + dx * factor, pn.y + dy * factor); }); }

        // Draw nodes and interactions
        let isDraggingNode = false; let blockClickNav = false;
        nodes.forEach(n => {
          const pos = positions.get(n.id) || { x: cx, y: cy }; const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'graph-node'); g.setAttribute('data-id', n.id); g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', `Open tag ${n.id}`);
          const r = 4 + 8 * (n.count / maxCount); const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', pos.x); c.setAttribute('cy', pos.y); c.setAttribute('r', String(r)); const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', String(pos.x + r + 2)); t.setAttribute('y', String(pos.y + 3)); t.textContent = n.id; g.appendChild(c); g.appendChild(t); root.appendChild(g); nodeRefs.set(n.id, { g, circle: c, text: t, radius: r });

          g.addEventListener('mouseenter', () => highlight(n.id)); g.addEventListener('mouseleave', () => { if (!isDraggingNode) clear(); });
          
          // Keyboard activation
          g.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigateWithTag(n.id);
            }
          });
          
          // Dragging
          let startClient = { x: 0, y: 0 }, lastClient = { x: 0, y: 0 }, movedVb = 0; const SUPPRESS_AFTER_VB = 3;
          g.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); isDraggingNode = true; svg.classList.add('dragging-node'); g.classList.add('dragging'); startClient = { x: e.clientX, y: e.clientY }; lastClient = { x: e.clientX, y: e.clientY }; movedVb = 0; g.setPointerCapture?.(e.pointerId); });
          g.addEventListener('pointermove', (e) => { if (!isDraggingNode) return; e.stopPropagation(); e.preventDefault(); const { dx, dy } = pz.toWorldDelta(lastClient.x, lastClient.y, e.clientX, e.clientY); const vb0 = pz.clientToViewBox(startClient.x, startClient.y); const vb1 = pz.clientToViewBox(e.clientX, e.clientY); movedVb = Math.max(movedVb, Math.hypot(vb1.x - vb0.x, vb1.y - vb0.y)); lastClient = { x: e.clientX, y: e.clientY }; if (dx || dy) moveNodeAndNeighbors(n.id, dx, dy, 0.25); });
          function endDrag(e) { if (!isDraggingNode) return; e.stopPropagation(); e.preventDefault(); isDraggingNode = false; g.releasePointerCapture?.(e.pointerId); svg.classList.remove('dragging-node'); g.classList.remove('dragging'); if (movedVb > SUPPRESS_AFTER_VB) { blockClickNav = true; setTimeout(() => { blockClickNav = false; }, 0); } }
          g.addEventListener('pointerup', endDrag); g.addEventListener('pointercancel', endDrag); g.addEventListener('click', (e) => { if (blockClickNav) { e.stopPropagation(); e.preventDefault(); } else { navigateWithTag(n.id); } }, true);
        });

        // Highlight helpers
        function highlight(id) {
          const neigh = neighbors.get(id) || new Set(); const active = new Set([id, ...neigh]);
          root.querySelectorAll('.graph-node').forEach(el => { const nid = el.getAttribute('data-id'); const on = active.has(nid); el.classList.toggle('active', on); el.classList.toggle('dimmed', !on); });
          root.querySelectorAll('.graph-link').forEach(el => el.classList.add('dimmed'));
          active.forEach(a => { active.forEach(b => { if (a === b) return; const key = a < b ? `${a}|${b}` : `${b}|${a}`; const line = linkMap.get(key); if (line) line.classList.remove('dimmed'); }); });
        }
        function clear() { root.querySelectorAll('.graph-node').forEach(el => el.classList.remove('active', 'dimmed')); root.querySelectorAll('.graph-link').forEach(el => el.classList.remove('dimmed')); }

        // Layout reset (positions) in addition to camera reset wired in enablePanZoom
        const resetBtn = document.querySelector('.graph-reset-btn[data-target="global-tag-graph"]'); if (resetBtn) { resetBtn.addEventListener('click', () => { initialPositions.forEach((p, id) => setNodePosition(id, p.x, p.y)); clear(); }); }

        // Setup new features
        setupGraphSearch(nodes, nodeRefs, highlight, clear);
        setupKeyboardNavigation(nodes, nodeRefs, positions);

        // Terminal title update
        try { const titleEl = document.querySelector('.terminal-title'); if (titleEl) { const n = graph.nodes.length; const e = graph.edges.length; titleEl.textContent = `graph • ${n} nodes • ${e} edges`; } } catch { }
      })
      .catch(() => {
        loadingDiv.remove();
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', '50%'); t.setAttribute('y', '50%'); t.setAttribute('text-anchor', 'middle'); t.textContent = 'Failed to load graph.json'; t.setAttribute('class', 'graph-empty'); svg.appendChild(t);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGlobalGraph);
  } else {
    renderGlobalGraph();
  }
})();
