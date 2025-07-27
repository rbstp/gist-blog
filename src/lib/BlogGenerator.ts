import * as fs from 'fs/promises';
import * as path from 'path';
import { format, parseISO } from 'date-fns';

import TemplateEngine from './TemplateEngine.js';
import GistParser from './GistParser.js';
import RSSGenerator from './RSSGenerator.js';
import { Gist, BlogPost } from '../types/index.js';

const RATE_LIMIT_DELAY = 60000;
const EXCERPT_LENGTH = 150;
const COMMIT_HASH_LENGTH = 7;
const POSTS_PER_PAGE = 6;
const USER_AGENT = 'gist-blog-generator';

interface PostWithMeta extends BlogPost {
  formattedDate: string;
  excerpt: string;
  shortId: string;
  lastUpdate: string;
  hasTags: boolean;
  formattedUpdateDate?: string;
}

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

      throw new Error(`Failed to fetch gists: ${response.status} ${response.statusText}`);
    }

      const gists = await response.json() as Gist[];
      return gists.filter(gist => gist.public);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
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

      throw new Error(`Failed to fetch gist content: ${response.status} ${response.statusText}`);
    }

      return await response.json() as Gist;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
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

  async generateIndex(posts: any[]): Promise<void> {
    const { 'layout.html': layoutTemplate, 'index.html': indexTemplate } = 
      await this.loadTemplatesCached(['layout.html', 'index.html']);

    // Sort posts by creation date (newest first)
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Add formatted dates and excerpts
    const postsWithMeta: PostWithMeta[] = sortedPosts.map(post => ({
      ...post,
      formattedDate: format(parseISO(post.createdAt), 'MMM d, yyyy'),
      excerpt: post.content.substring(0, EXCERPT_LENGTH) + (post.content.length > EXCERPT_LENGTH ? '...' : ''),
      shortId: post.id.substring(0, COMMIT_HASH_LENGTH),
      lastUpdate: format(new Date(), 'MMM d, HH:mm'),
      hasTags: post.tags && post.tags.length > 0
    }));

    // Calculate pagination data for client-side use
    const totalPosts = postsWithMeta.length;
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    const templateData = {
      posts: postsWithMeta, // Load ALL posts for client-side pagination
      postsLength: totalPosts,
      lastUpdate: new Date().toISOString(),
      pagination: totalPages > 1 ? {
        totalPages,
        postsPerPage: POSTS_PER_PAGE
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

  async generatePost(post: any): Promise<void> {
    const { 'layout.html': layoutTemplate, 'post.html': postTemplate } = 
      await this.loadTemplatesCached(['layout.html', 'post.html']);

    const postData = {
      ...post,
      formattedDate: format(parseISO(post.createdAt), 'MMM d, yyyy'),
      formattedUpdateDate: post.updatedAt !== post.createdAt ?
        format(parseISO(post.updatedAt), 'MMM d, yyyy') : null,
      shortId: post.id.substring(0, COMMIT_HASH_LENGTH)
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

  async generateRSSFeed(posts: any[]): Promise<void> {
    const rssXml = this.rssGenerator.generateFeed(posts);
    await fs.writeFile(path.join(this.distDir, 'feed.xml'), rssXml);
  }

  async copyStyles(): Promise<void> {
    const sourceStylesPath = path.join(this.stylesDir, 'main.css');
    const destStylesPath = path.join(this.distDir, 'styles.css');
    
    try {
      const cssContent = await fs.readFile(sourceStylesPath, 'utf-8');
      await fs.writeFile(destStylesPath, cssContent);
    } catch (error: any) {
      console.error('Error copying styles:', error.message);
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
      } catch (error: any) {
        console.error(`Failed to process gist ${gist.id}:`, error.message);
        return null;
      }
    });

    // Use allSettled for better error resilience
    const gistResults = await Promise.allSettled(gistPromises);
    const posts = gistResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled' && result.value !== null)
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