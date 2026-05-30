import type { Post, GraphData, GraphNode, GraphEdge } from './types.ts';

class GraphBuilder {
  buildFromPosts(posts: Post[], maxNodes: number): GraphData {
    const nodeCount = new Map<string, number>();
    const edgeCount = new Map<string, number>();
    for (const post of posts) {
      const tags = Array.isArray(post.tags) ? [...new Set(post.tags.map(t => String(t).toLowerCase()))] : [];
      if (tags.length === 0) continue;
      for (const t of tags) nodeCount.set(t, (nodeCount.get(t) || 0) + 1);
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const a = tags[i]!; const b = tags[j]!;
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        }
      }
    }
    const sortedNodes = Array.from(nodeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxNodes);
    const allowed = new Set(sortedNodes.map(([id]) => id));
    const nodes: GraphNode[] = sortedNodes.map(([id, count]) => ({ id, count }));
    const edges: GraphEdge[] = Array.from(edgeCount.entries())
      .map(([key, weight]) => { const [source, target] = key.split('|'); return { source: source ?? '', target: target ?? '', weight }; })
      .filter(e => allowed.has(e.source) && allowed.has(e.target));
    return { nodes, edges };
  }
}

export default GraphBuilder;
