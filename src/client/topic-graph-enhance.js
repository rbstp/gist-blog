/* eslint-env browser */

// Enhances the small topic graph in the post sidebar with node dragging, neighbor compensation, and layout reset.
(function () {
  function whenTopicGraphReady(timeoutMs = 3000) {
    const start = performance.now();
    return new Promise((resolve) => {
      function check() {
        const svg = document.getElementById('topic-graph');
        const root = svg && svg.querySelector('g#graph-root');
        const nodes = root && root.querySelectorAll('.graph-node');
        const links = root && root.querySelectorAll('.graph-link');
        if (svg && root && nodes && nodes.length > 0 && links) { resolve({ svg, root }); return; }
        if (performance.now() - start > timeoutMs) { resolve(null); return; }
        requestAnimationFrame(check);
      }
      check();
    });
  }
  function parseScaleFromTransform(transform) {
    if (!transform) return 1;
    const m = /scale\(\s*([0-9.]+)\s*\)/.exec(transform);
    return m ? parseFloat(m[1]) || 1 : 1;
  }
  function clientToViewBox(svg, cx, cy) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox?.baseVal || { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value };
    return { x: vb.x + ((cx - rect.left) / rect.width) * vb.width, y: vb.y + ((cy - rect.top) / rect.height) * vb.height };
  }
  function toWorldDelta(svg, root, c0x, c0y, c1x, c1y) {
    const p0 = clientToViewBox(svg, c0x, c0y), p1 = clientToViewBox(svg, c1x, c1y);
    const scale = parseScaleFromTransform(root.getAttribute('transform') || '');
    return { dx: (p1.x - p0.x) / (scale || 1), dy: (p1.y - p0.y) / (scale || 1) };
  }
  function keyFor(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function closestNodeIdToPoint(nodesPos, x, y) {
    let bestId = null, bestD = Infinity;
    nodesPos.forEach((p, id) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bestD) { bestD = d; bestId = id; } });
    return bestId;
  }

  function enhanceTopicGraph(svg, root) {
    if (!svg || !root) return;
    const container = svg.closest('.graph-content');
    const centerId = container ? (container.getAttribute('data-current-topic') || '').toLowerCase() : '';

    // Gather node refs & positions from DOM
    const nodeRefs = new Map();
    const positions = new Map();
    const groups = root.querySelectorAll('.graph-node');
    groups.forEach(g => {
      const id = (g.getAttribute('data-id') || '').toLowerCase();
      const circle = g.querySelector('circle'); const text = g.querySelector('text');
      if (!id || !circle || !text) return;
      const x = parseFloat(circle.getAttribute('cx') || '0');
      const y = parseFloat(circle.getAttribute('cy') || '0');
      const r = parseFloat(circle.getAttribute('r') || '4');
      nodeRefs.set(id, { g, circle, text, radius: r });
      positions.set(id, { x, y });
    });

    // Snapshot initial positions for layout reset
    const initialPositions = new Map(); positions.forEach((p, id) => initialPositions.set(id, { x: p.x, y: p.y }));

    // Build link map by nearest endpoints
    const linkMap = new Map();
    const lines = root.querySelectorAll('.graph-link');
    lines.forEach(line => {
      const x1 = parseFloat(line.getAttribute('x1') || '0'); const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0'); const y2 = parseFloat(line.getAttribute('y2') || '0');
      const a = closestNodeIdToPoint(positions, x1, y1); const b = closestNodeIdToPoint(positions, x2, y2);
      if (a && b && a !== b) linkMap.set(keyFor(a, b), line);
    });

    const neighbors = new Map(); function ensureSet(id) { if (!neighbors.has(id)) neighbors.set(id, new Set()); return neighbors.get(id); }
    function addAdj(a, b) { ensureSet(a).add(b); ensureSet(b).add(a); }

    const ts = document.body.getAttribute('data-build-ts') || '';
    fetch('/graph.json?v=' + ts)
      .then(r => r.ok ? r.json() : null)
      .then(graph => {
        if (!graph || !graph.nodes) return;
        const allAdj = new Map(); graph.nodes.forEach(n => allAdj.set(n.id, new Set()));
        graph.edges.forEach(e => { allAdj.get(e.source)?.add(e.target); allAdj.get(e.target)?.add(e.source); });
        const centerNeigh = new Set(allAdj.get(centerId) || []);
        const visible = new Set([centerId, ...centerNeigh]);
        graph.edges.forEach(e => { if (visible.has(e.source) && visible.has(e.target)) addAdj(e.source, e.target); });

        function updateEdgesForNode(id) {
          const set = neighbors.get(id); if (!set) return; set.forEach(nid => {
            const p1 = positions.get(id), p2 = positions.get(nid); if (!p1 || !p2) return;
            const line = linkMap.get(keyFor(id, nid)); if (line) { line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y); line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y); }
          });
        }
        function setNodePosition(id, x, y) {
          positions.set(id, { x, y }); const ref = nodeRefs.get(id);
          if (ref) { ref.circle.setAttribute('cx', x); ref.circle.setAttribute('cy', y); ref.text.setAttribute('x', String(x + ref.radius + 2)); ref.text.setAttribute('y', String(y + 3)); }
          updateEdgesForNode(id);
        }
        function moveNodeAndNeighbors(id, dx, dy, factor = 0.25) {
          const p = positions.get(id); if (p) setNodePosition(id, p.x + dx, p.y + dy);
          const neigh = neighbors.get(id); if (neigh) neigh.forEach(nid => { const pn = positions.get(nid); if (pn) setNodePosition(nid, pn.x + dx * factor, pn.y + dy * factor); });
        }

        // Drag wiring
        let isDraggingNode = false, blockClickNav = false;
        nodeRefs.forEach((ref, id) => {
          let startClient = { x: 0, y: 0 }, lastClient = { x: 0, y: 0 }, movedVb = 0; const SUPPRESS_AFTER_VB = 3;
          ref.g.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); isDraggingNode = true; svg.classList.add('dragging-node'); ref.g.classList.add('dragging'); startClient = { x: e.clientX, y: e.clientY }; lastClient = { x: e.clientX, y: e.clientY }; movedVb = 0; ref.g.setPointerCapture?.(e.pointerId); });
          ref.g.addEventListener('pointermove', (e) => { if (!isDraggingNode) return; e.stopPropagation(); e.preventDefault(); const { dx, dy } = toWorldDelta(svg, root, lastClient.x, lastClient.y, e.clientX, e.clientY); const vb0 = clientToViewBox(svg, startClient.x, startClient.y); const vb1 = clientToViewBox(svg, e.clientX, e.clientY); movedVb = Math.max(movedVb, Math.hypot(vb1.x - vb0.x, vb1.y - vb0.y)); lastClient = { x: e.clientX, y: e.clientY }; if (dx || dy) moveNodeAndNeighbors(id, dx, dy, 0.25); });
          function endDrag(e) { if (!isDraggingNode) return; e.stopPropagation(); e.preventDefault(); isDraggingNode = false; ref.g.releasePointerCapture?.(e.pointerId); svg.classList.remove('dragging-node'); ref.g.classList.remove('dragging'); if (movedVb > SUPPRESS_AFTER_VB) { blockClickNav = true; setTimeout(() => { blockClickNav = false; }, 0); } }
          ref.g.addEventListener('pointerup', endDrag); ref.g.addEventListener('pointercancel', endDrag); ref.g.addEventListener('click', (e) => { if (blockClickNav) { e.stopPropagation(); e.preventDefault(); } }, true);
        });

        // Layout reset (camera reset is handled by small pan/zoom utility)
        const resetBtn = document.querySelector('.graph-reset-btn[data-target="topic-graph"]');
        if (resetBtn) { resetBtn.addEventListener('click', () => { initialPositions.forEach((p, id) => setNodePosition(id, p.x, p.y)); root.querySelectorAll('.graph-node').forEach(el => el.classList.remove('active', 'dimmed')); root.querySelectorAll('.graph-link').forEach(el => el.classList.remove('dimmed')); }); }
      })
      .catch(() => { /* enhancement only */ });
  }

  const ready = () => whenTopicGraphReady().then(ctx => { if (ctx) enhanceTopicGraph(ctx.svg, ctx.root); });
  if (document.readyState === 'complete' || document.readyState === 'interactive') ready();
  else document.addEventListener('DOMContentLoaded', ready);
})();
