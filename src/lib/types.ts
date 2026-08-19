// Shared domain types for the gist-blog generator.
//
// This is a PURE TYPE MODULE: it must contain only `export type` / `export interface`
// declarations and no runtime code. Because the project runs `.ts` directly via Node's
// native type-stripping (erasure without type information), every import of a symbol from
// this file MUST use `import type { ... }` (enforced by `verbatimModuleSyntax`). Otherwise
// Node would keep the import at runtime and fail, since these symbols have no runtime binding.

/** A single file entry within a GitHub gist (as returned by the GitHub API). */
export interface GistFile {
  filename: string;
  type?: string;
  language?: string | null;
  raw_url?: string;
  size?: number;
  /** Present on full (per-gist) responses; absent in the gist list response. */
  content?: string;
}

/** A GitHub gist as returned by the GitHub API (list or full response). */
export interface Gist {
  id: string;
  description: string | null;
  public: boolean;
  created_at: string;
  updated_at: string;
  html_url: string;
  url: string;
  files: Record<string, GistFile>;
}

/** A single entry in a post's table of contents. */
export interface TocItem {
  level: number;
  title: string;
  anchor: string;
  lineNumber: number;
}

/** A fully-parsed blog post derived from a gist. */
export interface Post {
  id: string;
  title: string;
  description: string;
  content: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  files: string[];
  tags: string[];
  filename: string;
  wordCount: number;
  readingTime: string;
  toc: TocItem[];
  hasToc: boolean;
}

/** A node in the global tag co-occurrence graph. */
export interface GraphNode {
  id: string;
  count: number;
}

/** An edge (tag co-occurrence) in the global tag graph. */
export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

/** The full tag co-occurrence graph written to graph.json. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Loosely-typed bag of values handed to the template engine. The engine resolves
 * keys dynamically (`data[key]`) and narrows at runtime, so values are `unknown`.
 * Concrete shaped interfaces below are assignable to this type.
 */
export type TemplateData = Record<string, unknown>;

/** Pagination metadata for the index page (null when a single page). */
export interface Pagination {
  totalPages: number;
  postsPerPage: number;
}

/** A topic name in the shape the template engine iterates over. */
export interface TagChip {
  [key: string]: unknown;
  name: string;
}

/** A topic in the index filter row, carrying how many posts use it. */
export interface TagFilterChip extends TagChip {
  count: number;
}

/** Per-post data shaped for the post template. */
export interface PostTemplateData extends Post {
  // Template data is consumed via dynamic key lookup by TemplateEngine, so it is an
  // open bag of values (assignable to TemplateData / Record<string, unknown>).
  [key: string]: unknown;
  formattedDate: string;
  formattedUpdateDate: string | null;
  shortId: string;
  currentTopic: string;
  tagsCsv: string;
  tagList: TagChip[];
  hasTags: boolean;
  /** Plain-text summary used for meta descriptions and social cards. */
  summary: string;
  /** Site-root-relative path of the post's Open Graph image. */
  ogImage: string;
}

/** A post shaped for rendering within the index listing. */
export interface IndexPostData extends Post {
  [key: string]: unknown;
  /** Publication date, formatted identically for every entry in the archive. */
  formattedDate: string;
  excerpt: string;
  shortId: string;
  lastUpdate: string;
  hasTags: boolean;
  tagList: TagChip[];
}

/** Data shaped for the index template. */
export interface IndexTemplateData {
  [key: string]: unknown;
  posts: IndexPostData[];
  postsLength: number;
  lastUpdate: string;
  allTags: string[];
  hasAnyTags: boolean;
  /** Most-used topics, capped for the filter row. */
  topTags: TagFilterChip[];
  tagline: string;
  role: string;
  author: string;
  pagination: Pagination | null;
}

/** Inputs for building a page's metadata block. */
export interface PageMetaInput {
  /** Human title used for og:title / twitter:title. */
  title: string;
  /** Source text for the meta description (summarised and truncated). */
  description: string;
  /** Site-root-relative path of the page, e.g. `/posts/abc.html`. */
  path: string;
  /** Site-root-relative path of the social card image. */
  image: string;
  /** Open Graph object type. */
  type?: 'website' | 'article';
}

/** Resolved page metadata handed to the layout template. */
export interface PageMeta {
  [key: string]: unknown;
  siteName: string;
  author: string;
  /** Contents of `<title>`: the page title qualified with the site name. */
  documentTitle: string;
  canonicalUrl: string;
  metaDescription: string;
  ogTitle: string;
  ogType: string;
  ogImageUrl: string;
  ogImageAlt: string;
}

/** Date-formatting callbacks injected into DataShaper to keep it pure/testable. */
export type FormatDateFn = (iso: string, fmt: string) => string;
export type NowFn = (fmt: string) => string;
export type NowMsFn = () => number;

/** Result of a JSON fetch via GitHubClient. */
export interface FetchJsonResult<T = unknown> {
  ok: boolean;
  status: number;
  json: T;
}
