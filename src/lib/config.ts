// Centralized configuration and defaults
// Note: Behavior preserved. Environment variables continue to override where applicable.

export const USER_AGENT = 'gist-blog-generator';
export const RATE_LIMIT_DELAY_MS = 60_000;

// Pagination
export const POSTS_PER_PAGE = Number(process.env.POSTS_PER_PAGE || 6);

// Site identity (shared by the RSS feed, page metadata and social cards)
export const SITE_URL = (process.env.SITE_URL || 'https://rbstp.dev').replace(/\/+$/, '');
export const SITE_TITLE = process.env.SITE_TITLE || 'rbstp.dev';
export const SITE_AUTHOR = process.env.SITE_AUTHOR || 'Richard Boisvert';
export const SITE_DESCRIPTION = process.env.SITE_DESCRIPTION
  || 'There and Back Again: A DevOps Engineer\'s Journey Through AI and Infrastructure';
/** Short role label shown above the name in the hero. */
export const SITE_ROLE = process.env.SITE_ROLE || 'DevOps & Context Engineer';
export const SITE_TAGLINE = process.env.SITE_TAGLINE
  || 'Notes on AI, infrastructure, and developer tooling.';

// Presentation
/** Posts newer than this many days are flagged `new` and get a relative date label. */
export const NEW_POST_DAYS = Number(process.env.NEW_POST_DAYS || 14);
/** Maximum number of topic chips rendered in the index filter bar. */
export const MAX_FILTER_TAGS = Number(process.env.MAX_FILTER_TAGS || 14);
/** Target length (characters) of the generated plain-text excerpt. */
export const EXCERPT_LENGTH = Number(process.env.EXCERPT_LENGTH || 180);
/** Maximum length of `<meta name="description">` / og:description values. */
export const META_DESCRIPTION_LENGTH = Number(process.env.META_DESCRIPTION_LENGTH || 160);
/** Length of the per-post summary shipped in the client search index (dist/search.json). */
export const SEARCH_SUMMARY_LENGTH = Number(process.env.SEARCH_SUMMARY_LENGTH || 120);

/**
 * Concatenation order of the CSS modules in src/styles/modules, mirrored by
 * src/styles/main-imports.css. Variables come first (everything references the tokens) and
 * responsive last (its overrides rely on source order rather than heavier selectors).
 */
export const STYLE_MODULES = [
  'variables.css',
  'base.css',
  'layout.css',
  'tags.css',
  'cards.css',
  'post.css',
  'typography.css',
  'syntax.css',
  'command-palette.css',
  'graph.css',
  'ux.css',
  'responsive.css',
] as const;

// Social cards (Open Graph images)
export const OG_IMAGES_ENABLED = String(process.env.OG_IMAGES || 'true').toLowerCase() !== 'false';
export const OG_DIR = 'og';

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
