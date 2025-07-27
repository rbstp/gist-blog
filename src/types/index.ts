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
  forks: any[];
  history: any[];
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

export interface TemplateData {
  [key: string]: any;
}

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