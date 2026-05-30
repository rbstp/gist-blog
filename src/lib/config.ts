// Centralized configuration and defaults
// Note: Behavior preserved. Environment variables continue to override where applicable.

export const USER_AGENT = 'gist-blog-generator';
export const RATE_LIMIT_DELAY_MS = 60_000;

// Pagination
export const POSTS_PER_PAGE = Number(process.env.POSTS_PER_PAGE || 6);

// Caching
export const CACHE_DIR = '.cache';
export const ENABLE_CACHE = String(process.env.GIST_CACHE || 'true').toLowerCase() !== 'false';
export const TTL_LIST_MS = Number(process.env.GIST_CACHE_TTL_LIST_MS || 10 * 60 * 1000); // 10m
export const TTL_GIST_MS = Number(process.env.GIST_CACHE_TTL_GIST_MS || 60 * 60 * 1000); // 60m

// GitHub
export const DEFAULT_GIST_USERNAME = process.env.GIST_USERNAME || 'rbstp';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Graph
export const GRAPH_MAX_NODES = Number(process.env.GRAPH_MAX_NODES || 20);

// Fetch concurrency
export const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY || 5);
