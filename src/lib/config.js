// Centralized configuration and defaults
// Note: Behavior preserved. Environment variables continue to override where applicable.

module.exports = {
  USER_AGENT: 'gist-blog-generator',
  RATE_LIMIT_DELAY_MS: 60_000,

  // Pagination
  POSTS_PER_PAGE: Number(process.env.POSTS_PER_PAGE || 6),

  // Caching
  CACHE_DIR: '.cache',
  ENABLE_CACHE: String(process.env.GIST_CACHE || 'true').toLowerCase() !== 'false',
  TTL_LIST_MS: Number(process.env.GIST_CACHE_TTL_LIST_MS || 10 * 60 * 1000), // 10m
  TTL_GIST_MS: Number(process.env.GIST_CACHE_TTL_GIST_MS || 60 * 60 * 1000), // 60m

  // GitHub
  DEFAULT_GIST_USERNAME: process.env.GIST_USERNAME || 'rbstp',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',

  // Graph
  GRAPH_MAX_NODES: Number(process.env.GRAPH_MAX_NODES || 20),

  // Fetch concurrency
  FETCH_CONCURRENCY: Number(process.env.FETCH_CONCURRENCY || 5),
};
