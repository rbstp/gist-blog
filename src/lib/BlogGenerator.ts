import * as fs from 'fs/promises';
import * as path from 'path';
import { format, parseISO } from 'date-fns';

import TemplateEngine from './TemplateEngine.js';
import GistParser from './GistParser.js';
import RSSGenerator from './RSSGenerator.js';
import {
  Gist,
  BlogPost,
  BlogPostWithHtml,
  PostWithMeta,
  IndexTemplateData,
  PostTemplateData,
  LayoutTemplateData,
  GitHubAPIError,
  ValidationError
} from '../types/index.js';
import { ParsedGist } from './GistParser.js';
import { ValidationUtils } from './ValidationUtils.js';

const RATE_LIMIT_DELAY = 60000;
const USER_AGENT = 'gist-blog-generator';


class BlogGenerator {
  private gistUsername: string;
  private distDir: string;
  private templatesDir: string;
  private stylesDir: string;
  private templateEngine: TemplateEngine;
  private gistParser: GistParser;
  private rssGenerator: RSSGenerator;
  private templateCache: Map<string, string>;

  constructor() {
    this.gistUsername = process.env.GIST_USERNAME || 'rbstp';
    this.distDir = 'dist';
    this.templatesDir = 'src/templates';
    this.stylesDir = 'src/styles';

    this.templateEngine = new TemplateEngine(this.templatesDir);
    this.gistParser = new GistParser();
    this.rssGenerator = new RSSGenerator();

    // Template cache for performance
    this.templateCache = new Map();
  }

  async fetchGists(): Promise<Gist[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`https://api.github.com/users/${this.gistUsername}/gists`, {
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`GitHub API Error: ${response.status} ${response.statusText}`);
        console.error(`Response headers:`, response.headers);

        if (response.status === 403) {
          console.error('Rate limit hit. Waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          return this.fetchGists(); // Retry once
        }

        throw new GitHubAPIError(`Failed to fetch gists: ${response.status} ${response.statusText}`, response.status, response);
      }

      const rawData = await response.json();
      ValidationUtils.validateGistsArray(rawData);
      return rawData.filter(gist => gist.public);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: GitHub API took too long to respond');
      }
      throw error;
    }
  }

  async fetchGistContent(gist: Gist): Promise<Gist> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(gist.url, {
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`GitHub API Error for gist ${gist.id}: ${response.status} ${response.statusText}`);
        console.error(`Gist URL: ${gist.url}`);

        if (response.status === 403) {
          console.error('Rate limit hit. Waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          return this.fetchGistContent(gist); // Retry once
        }

        throw new GitHubAPIError(`Failed to fetch gist content: ${response.status} ${response.statusText}`, response.status, response);
      }

      const rawData = await response.json();
      ValidationUtils.validateGist(rawData);
      return rawData;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: Gist ${gist.id} took too long to fetch`);
      }
      throw error;
    }
  }

  async loadTemplatesCached(templateNames: string[]): Promise<Record<string, string>> {
    const templates: Record<string, string> = {};
    for (const name of templateNames) {
      if (!this.templateCache.has(name)) {
        this.templateCache.set(name, await this.templateEngine.loadTemplate(name));
      }
      templates[name] = this.templateCache.get(name)!;
    }
    return templates;
  }

  async generateIndex(posts: ParsedGist[]): Promise<void> {
    const { 'layout.html': layoutTemplate, 'index.html': indexTemplate } =
      await this.loadTemplatesCached(['layout.html', 'index.html']);

    // Sort posts by creation date (newest first)
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Add formatted dates and excerpts
    const postsWithMeta = sortedPosts.map(post => ({
      ...post,
      date: post.createdAt, // Map createdAt to date for compatibility
      formattedDate: post.createdAt ? format(parseISO(post.createdAt), 'MMM d, yyyy') : 'Unknown date',
      excerpt: post.content ? post.content.substring(0, 150) + (post.content.length > 150 ? '...' : '') : '',
      shortId: post.id ? post.id.substring(0, 7) : 'unknown',
      lastUpdate: format(new Date(), 'MMM d, HH:mm'),
      hasTags: post.tags && post.tags.length > 0,
      commitHash: post.id ? post.id.substring(0, 7) : 'unknown',
      deployStatus: 'DEPLOYED'
    }));

    // Calculate pagination data for client-side use
    const totalPosts = postsWithMeta.length;
    const totalPages = Math.ceil(totalPosts / 6);

    const templateData = {
      posts: postsWithMeta, // Load ALL posts for client-side pagination
      postsLength: totalPosts,
      lastUpdate: new Date().toISOString(),
      pagination: totalPages > 1 ? {
        totalPages,
        postsPerPage: 6
      } : null
    };

    const indexContent = this.templateEngine.render(indexTemplate, templateData);

    const fullPage = this.templateEngine.render(layoutTemplate, {
      title: 'main',
      content: indexContent,
      timestamp: Date.now()
    });

    // Only generate index.html - no separate page files needed
    await fs.writeFile(path.join(this.distDir, 'index.html'), fullPage);
  }

  async generatePost(post: ParsedGist): Promise<void> {
    const { 'layout.html': layoutTemplate, 'post.html': postTemplate } =
      await this.loadTemplatesCached(['layout.html', 'post.html']);

    const postData = {
      ...post,
      formattedDate: post.createdAt ? format(parseISO(post.createdAt), 'MMM d, yyyy') : 'Unknown date',
      formattedUpdateDate: null, // Disable update date for now
      shortId: post.id ? post.id.substring(0, 7) : 'unknown'
    };

    const postContent = this.templateEngine.render(postTemplate, postData);
    const fullPage = this.templateEngine.render(layoutTemplate, {
      title: post.title,
      content: postContent,
      timestamp: Date.now()
    });

    const postsDir = path.join(this.distDir, 'posts');
    await fs.mkdir(postsDir, { recursive: true });
    await fs.writeFile(path.join(postsDir, `${post.id}.html`), fullPage);
  }

  async generateRSSFeed(posts: ParsedGist[]): Promise<void> {
    const rssXml = this.rssGenerator.generateFeed(posts);
    await fs.writeFile(path.join(this.distDir, 'feed.xml'), rssXml);
  }

  async copyStyles(): Promise<void> {
    const sourceStylesPath = path.join(this.stylesDir, 'main.css');
    const destStylesPath = path.join(this.distDir, 'styles.css');

    try {
      const cssContent = await fs.readFile(sourceStylesPath, 'utf-8');
      await fs.writeFile(destStylesPath, cssContent);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error copying styles:', message);
      throw error;
    }
  }

  async build(): Promise<void> {
    console.log('Starting blog build...');

    // Create dist directory
    await fs.mkdir(this.distDir, { recursive: true });

    // Clean up old pagination files (we now use client-side pagination)
    try {
      await fs.rm(path.join(this.distDir, 'page'), { recursive: true, force: true });
    } catch (error) {
      // Ignore error if directory doesn't exist
    }

    // Fetch gists
    const gists = await this.fetchGists();
    const gistPromises = gists.map(async (gist) => {
      try {
        const fullGist = await this.fetchGistContent(gist);
        return this.gistParser.parseGistAsPost(fullGist);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process gist ${gist.id}:`, message);
        return null;
      }
    });

    // Use allSettled for better error resilience
    const gistResults = await Promise.allSettled(gistPromises);
    const posts = gistResults
      .filter((result): result is PromiseFulfilledResult<ParsedGist> => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    // Generate post files in parallel
    const postGenerationPromises = posts.map(async (post) => {
      await this.generatePost(post);
    });

    await Promise.all(postGenerationPromises);

    await this.generateIndex(posts);
    await this.generateRSSFeed(posts);
    await this.copyStyles();

    console.log(`✅ Build complete! Generated ${posts.length} posts.`);
  }
}

export default BlogGenerator;
