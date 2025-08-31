class GraphBuilder {
  buildFromPosts(posts, maxNodes) {
    const nodeCount = new Map();
    const edgeCount = new Map();
    for (const post of posts) {
      const tags = Array.isArray(post.tags) ? [...new Set(post.tags.map(t => String(t).toLowerCase()))] : [];
      if (tags.length === 0) continue;
      for (const t of tags) nodeCount.set(t, (nodeCount.get(t) || 0) + 1);
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const a = tags[i]; const b = tags[j];
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        }
      }
    }
    const sortedNodes = Array.from(nodeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxNodes);
    const allowed = new Set(sortedNodes.map(([id]) => id));
    const nodes = sortedNodes.map(([id, count]) => ({ id, count }));
    const edges = Array.from(edgeCount.entries())
      .map(([key, weight]) => { const [source, target] = key.split('|'); return { source, target, weight }; })
      .filter(e => allowed.has(e.source) && allowed.has(e.target));
    return { nodes, edges };
  }
}

module.exports = GraphBuilder;
