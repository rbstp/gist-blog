export interface GistFile {
  filename: string;
  type: string;
  language: string | null;
  raw_url: string;
  size: number;
  truncated: boolean;
  content: string;
}

export interface GistOwner {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  user_view_type: string;
  site_admin: boolean;
}

export interface Gist {
  id: string;
  node_id: string;
  url: string;
  forks_url: string;
  commits_url: string;
  git_pull_url: string;
  git_push_url: string;
  html_url: string;
  files: Record<string, GistFile>;
  public: boolean;
  created_at: string;
  updated_at: string;
  description: string | null;
  comments: number;
  user: null;
  comments_url: string;
  owner: GistOwner;
  forks: unknown[];
  history: unknown[];
  truncated: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  description: string;
  content: string;
  date: string;
  formattedDate: string;
  url: string;
  tags: string[];
  excerpt: string;
  commitHash: string;
  deployStatus: string;
}

// Interface for posts with HTML content (used by RSS and generated posts)
export interface BlogPostWithHtml extends BlogPost {
  htmlContent: string;
}

export interface TemplateData {
  [key: string]: unknown;
}

// Specific template data interfaces for better type safety
export interface IndexTemplateData extends TemplateData {
  posts: PostWithMeta[];
  postsLength: number;
  lastUpdate: string;
  pagination?: PaginationConfig | null;
}

export interface PostTemplateData extends TemplateData {
  id: string;
  title: string;
  description: string;
  htmlContent: string;
  formattedDate: string;
  formattedUpdateDate?: string;
  shortId: string;
  tags: string[];
  url: string;
}

export interface LayoutTemplateData extends TemplateData {
  title: string;
  content: string;
  timestamp: number;
}

export interface PostWithMeta extends BlogPost {
  formattedDate: string;
  excerpt: string;
  shortId: string;
  lastUpdate: string;
  hasTags: boolean;
  formattedUpdateDate?: string;
}

export interface PaginationConfig {
  totalPages: number;
  postsPerPage: number;
}

// Configuration interfaces for better dependency injection
export interface BlogGeneratorConfig {
  readonly gistUsername: string;
  readonly distDir: string;
  readonly templatesDir: string;
  readonly stylesDir: string;
  readonly rateLimitDelay: number;
  readonly excerptLength: number;
  readonly commitHashLength: number;
  readonly postsPerPage: number;
  readonly userAgent: string;
}

export type PartialBlogGeneratorConfig = Partial<BlogGeneratorConfig> & Pick<BlogGeneratorConfig, 'gistUsername'>;

// Utility types for better type safety
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// Extract certain fields from BlogPost for different use cases
export type BlogPostSummary = Pick<BlogPost, 'id' | 'title' | 'description' | 'date' | 'tags' | 'url'>;
export type BlogPostMeta = Pick<BlogPost, 'id' | 'title' | 'date' | 'tags'>;

// Template-specific data types using utility types
export type PostContentData = Pick<BlogPost, 'title' | 'description' | 'tags'>;
export type PostMetaData = Pick<BlogPost, 'id' | 'date' | 'url'>;

export interface PaginationData {
  posts: BlogPost[];
  currentPage: number;
  totalPages: number;
  totalPosts: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPageUrl?: string;
  prevPageUrl?: string;
}

export interface RSSFeedConfig {
  title: string;
  description: string;
  url: string;
  language?: string;
  managingEditor?: string;
  webMaster?: string;
}

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  content: string;
}

// Custom error types for better error handling
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: Response
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

export class TemplateError extends Error {
  constructor(message: string, public readonly templateName: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly data?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Type predicate utility functions
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}
