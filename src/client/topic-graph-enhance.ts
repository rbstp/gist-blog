/* eslint-env browser */

import type { GraphData } from '../lib/types.ts';

export {};

interface Point {
  x: number;
  y: number;
}

interface NodeRef {
  g: Element;
  circle: Element;
  text: Element;
  radius: number;
}

interface TopicGraphContext {
  svg: SVGSVGElement;
  root: SVGGElement;
}

// Enhances the small topic graph in the post sidebar with node dragging, neighbor compensation, and layout reset.
(function () {
  function whenTopicGraphReady(timeoutMs = 3000): Promise<TopicGraphContext | null> {
    const start = performance.now();
    return new Promise((resolve) => {
      function check() {
        const svg = document.getElementById('topic-graph') as SVGSVGElement | null;
        const root = (svg && svg.querySelector('g#graph-root')) as SVGGElement | null;
        const nodes = root && root.querySelectorAll('.graph-node');
        const links = root && root.querySelectorAll('.graph-link');
        if (svg && root && nodes && nodes.length > 0 && links) { resolve({ svg, root }); return; }
        if (performance.now() - start > timeoutMs) { resolve(null); return; }
        requestAnimationFrame(check);
      }
      check();
    });
  }
  function parseScaleFromTransform(transform: string | null): number {
    if (!transform) return 1;
    const m = /scale\(\s*([0-9.]+)\s*\)/.exec(transform);
    return m ? parseFloat(m[1] ?? '') || 1 : 1;
  }
  function keyFor(a: string, b: string): string { return a < b ? a + '|' + b : b + '|' + a; }
  function closestNodeIdToPoint(nodesPos: Map<string, Point>, x: number, y: number): string | null {
    let bestId: string | null = null, bestD = Infinity;
    nodesPos.forEach((p, id) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bestD) { bestD = d; bestId = id; } });
    return bestId;
  }

  function enhanceTopicGraph(svg: SVGSVGElement, root: SVGGElement): void {
    if (!svg || !root) return;
    const container = svg.closest('.graph-content');
    const centerId = container ? (container.getAttribute('data-current-topic') || '').toLowerCase() : '';

    // Gather node refs & positions from DOM
    const nodeRefs = new Map<string, NodeRef>();
    const positions = new Map<string, Point>();
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
    const initialPositions = new Map<string, Point>(); positions.forEach((p, id) => initialPositions.set(id, { x: p.x, y: p.y }));

    // Build link map by nearest endpoints
    const linkMap = new Map<string, Element>();
    const lines = root.querySelectorAll('.graph-link');
    lines.forEach(line => {
      const x1 = parseFloat(line.getAttribute('x1') || '0'); const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0'); const y2 = parseFloat(line.getAttribute('y2') || '0');
      const a = closestNodeIdToPoint(positions, x1, y1); const b = closestNodeIdToPoint(positions, x2, y2);
      if (a && b && a !== b) linkMap.set(keyFor(a, b), line);
    });

    const neighbors = new Map<string, Set<string>>(); function ensureSet(id: string): Set<string> { if (!neighbors.has(id)) neighbors.set(id, new Set()); return neighbors.get(id)!; }
    function addAdj(a: string, b: string): void { ensureSet(a).add(b); ensureSet(b).add(a); }

    const ts = document.body.getAttribute('data-build-ts') || '';
    fetch('/graph.json?v=' + ts)
      .then(r => r.ok ? r.json() : null)
      .then((graph: GraphData | null) => {
        if (!graph || !graph.nodes) return;
        const allAdj = new Map<string, Set<string>>(); graph.nodes.forEach(n => allAdj.set(n.id, new Set()));
        graph.edges.forEach(e => { allAdj.get(e.source)?.add(e.target); allAdj.get(e.target)?.add(e.source); });
        const centerNeigh = new Set(allAdj.get(centerId) || []);
        const visible = new Set([centerId, ...centerNeigh]);
        graph.edges.forEach(e => { if (visible.has(e.source) && visible.has(e.target)) addAdj(e.source, e.target); });

        function updateEdgesForNode(id: string): void {
          const set = neighbors.get(id); if (!set) return; set.forEach(nid => {
            const p1 = positions.get(id), p2 = positions.get(nid); if (!p1 || !p2) return;
            const line = linkMap.get(keyFor(id, nid)); if (line) { line.setAttribute('x1', String(p1.x)); line.setAttribute('y1', String(p1.y)); line.setAttribute('x2', String(p2.x)); line.setAttribute('y2', String(p2.y)); }
          });
        }
        function setNodePosition(id: string, x: number, y: number): void {
          positions.set(id, { x, y }); const ref = nodeRefs.get(id);
          if (ref) { ref.circle.setAttribute('cx', String(x)); ref.circle.setAttribute('cy', String(y)); ref.text.setAttribute('x', String(x + ref.radius + 2)); ref.text.setAttribute('y', String(y + 3)); }
          updateEdgesForNode(id);
        }
        function moveNodeAndNeighbors(id: string, dx: number, dy: number, factor = 0.25): void {
          const p = positions.get(id); if (p) setNodePosition(id, p.x + dx, p.y + dy);
          const neigh = neighbors.get(id); if (neigh) neigh.forEach(nid => { const pn = positions.get(nid); if (pn) setNodePosition(nid, pn.x + dx * factor, pn.y + dy * factor); });
        }

        // Drag wiring
        let isDraggingNode = false, blockClickNav = false;
        nodeRefs.forEach((ref, id) => {
          // Cache the SVG rect + viewBox once per drag and project client→viewBox inline, instead of
          // 4 getBoundingClientRect per pointermove. Scale is parsed fresh from the root transform (cheap).
          let movedVb = 0; const SUPPRESS_AFTER_VB = 3;
          let dragRect: DOMRect | null = null;
          let dragVb: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 };
          let dragStartVb: Point = { x: 0, y: 0 }, dragLastVb: Point = { x: 0, y: 0 };
          const projectClient = (cx: number, cy: number): Point => {
            const rect = dragRect!;
            return { x: dragVb.x + ((cx - rect.left) / rect.width) * dragVb.width, y: dragVb.y + ((cy - rect.top) / rect.height) * dragVb.height };
          };
          ref.g.addEventListener('pointerdown', (e) => { const pe = e as PointerEvent; pe.stopPropagation(); pe.preventDefault(); isDraggingNode = true; svg.classList.add('dragging-node'); ref.g.classList.add('dragging'); movedVb = 0; dragRect = svg.getBoundingClientRect(); dragVb = svg.viewBox?.baseVal ?? { x: 0, y: 0, width: svg.width.baseVal.value, height: svg.height.baseVal.value }; dragStartVb = projectClient(pe.clientX, pe.clientY); dragLastVb = dragStartVb; ref.g.setPointerCapture?.(pe.pointerId); });
          ref.g.addEventListener('pointermove', (e) => { if (!isDraggingNode) return; const pe = e as PointerEvent; pe.stopPropagation(); pe.preventDefault(); const vb1 = projectClient(pe.clientX, pe.clientY); const scale = parseScaleFromTransform(root.getAttribute('transform')) || 1; const dx = (vb1.x - dragLastVb.x) / scale, dy = (vb1.y - dragLastVb.y) / scale; movedVb = Math.max(movedVb, Math.hypot(vb1.x - dragStartVb.x, vb1.y - dragStartVb.y)); dragLastVb = vb1; if (dx || dy) moveNodeAndNeighbors(id, dx, dy, 0.25); });
          function endDrag(e: Event): void { if (!isDraggingNode) return; const pe = e as PointerEvent; pe.stopPropagation(); pe.preventDefault(); isDraggingNode = false; ref.g.releasePointerCapture?.(pe.pointerId); svg.classList.remove('dragging-node'); ref.g.classList.remove('dragging'); if (movedVb > SUPPRESS_AFTER_VB) { blockClickNav = true; setTimeout(() => { blockClickNav = false; }, 0); } }
          ref.g.addEventListener('pointerup', endDrag); ref.g.addEventListener('pointercancel', endDrag); ref.g.addEventListener('click', (e) => { if (blockClickNav) { e.stopPropagation(); e.preventDefault(); } }, true);
        });

        // Layout reset (camera reset is handled by small pan/zoom utility)
        const resetBtn = document.querySelector('.graph-reset-btn[data-target="topic-graph"]');
        if (resetBtn) { resetBtn.addEventListener('click', () => { initialPositions.forEach((p, id) => setNodePosition(id, p.x, p.y)); root.querySelectorAll('.graph-node').forEach(el => el.classList.remove('active', 'dimmed')); root.querySelectorAll('.graph-link').forEach(el => el.classList.remove('dimmed')); }); }
      })
      .catch(() => { /* enhancement only */ });
  }

  const ready = () => whenTopicGraphReady().then(ctx => { if (ctx) enhanceTopicGraph(ctx.svg, ctx.root); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
