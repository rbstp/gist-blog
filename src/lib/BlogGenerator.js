const fs = require('fs').promises;
const path = require('path');
const { format, parseISO } = require('date-fns');

const TemplateEngine = require('./TemplateEngine');
const GistParser = require('./GistParser');
const RSSGenerator = require('./RSSGenerator');

const RATE_LIMIT_DELAY = 60000;
const EXCERPT_LENGTH = 150;
const COMMIT_HASH_LENGTH = 7;
const POSTS_PER_PAGE = 6;
const USER_AGENT = 'gist-blog-generator';

class BlogGenerator {
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
    // Date formatting cache to avoid repeated parsing and formatting
    this.dateCache = new Map();
  }

  async fetchGists() {
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
      console.error(`Response headers:`, Object.fromEntries(response.headers.entries()));

      if (response.status === 403) {
        console.error('Rate limit hit. Waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        return this.fetchGists(); // Retry once
      }

      throw new Error(`Failed to fetch gists: ${response.status} ${response.statusText}`);
    }

      const gists = await response.json();
      return gists.filter(gist => gist.public);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: GitHub API took too long to respond');
      }
      throw error;
    }
  }

  async fetchGistContent(gist) {
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

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: Gist ${gist.id} took too long to fetch`);
      }
      throw error;
    }
  }

  async loadTemplatesCached(templateNames) {
    const templates = {};
    for (const name of templateNames) {
      if (!this.templateCache.has(name)) {
        this.templateCache.set(name, await this.templateEngine.loadTemplate(name));
      }
      templates[name] = this.templateCache.get(name);
    }
    return templates;
  }

  formatDateCached(dateString, formatStr = 'MMM d, yyyy') {
    const cacheKey = `${dateString}_${formatStr}`;
    if (!this.dateCache.has(cacheKey)) {
      this.dateCache.set(cacheKey, format(parseISO(dateString), formatStr));
    }
    return this.dateCache.get(cacheKey);
  }

  async generateIndex(posts) {
    const { 'layout.html': layoutTemplate, 'index.html': indexTemplate } = 
      await this.loadTemplatesCached(['layout.html', 'index.html']);

    // Cache the current date formatting to avoid repeated calls
    const lastUpdateFormatted = format(new Date(), 'MMM d, HH:mm');

    // Sort posts and add metadata in single operation for better performance
    const postsWithMeta = posts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(post => ({
        ...post,
        formattedDate: this.formatDateCached(post.createdAt),
        excerpt: post.content.length > EXCERPT_LENGTH 
          ? post.content.substring(0, EXCERPT_LENGTH) + '...' 
          : post.content,
        shortId: post.id.substring(0, COMMIT_HASH_LENGTH),
        lastUpdate: lastUpdateFormatted,
        hasTags: post.tags && post.tags.length > 0
      }));

    // Calculate pagination data for client-side use
    const totalPosts = postsWithMeta.length;
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    // Collect all unique tags from posts
    const allTags = [...new Set(
      postsWithMeta
        .filter(post => post.tags && post.tags.length > 0)
        .flatMap(post => post.tags)
    )].sort();

    const templateData = {
      posts: postsWithMeta, // Load ALL posts for client-side pagination
      postsLength: totalPosts,
      lastUpdate: new Date().toISOString(),
      allTags: allTags,
      hasAnyTags: allTags.length > 0,
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

  async generatePost(post) {
    const { 'layout.html': layoutTemplate, 'post.html': postTemplate } = 
      await this.loadTemplatesCached(['layout.html', 'post.html']);

    const postData = {
      ...post,
      formattedDate: this.formatDateCached(post.createdAt),
      formattedUpdateDate: post.updatedAt !== post.createdAt ?
        this.formatDateCached(post.updatedAt) : null,
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

  async generateRSSFeed(posts) {
    const rssXml = this.rssGenerator.generateFeed(posts);
    await fs.writeFile(path.join(this.distDir, 'feed.xml'), rssXml);
  }

  async copyStyles() {
    const sourceStylesPath = path.join(this.stylesDir, 'main.css');
    const destStylesPath = path.join(this.distDir, 'styles.css');
    
    try {
      const cssContent = await fs.readFile(sourceStylesPath, 'utf-8');
      await fs.writeFile(destStylesPath, cssContent);
    } catch (error) {
      console.error('Error copying styles:', error.message);
      throw error;
    }
  }

  async build() {
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
      } catch (error) {
        console.error(`Failed to process gist ${gist.id}:`, error.message);
        return null;
      }
    });

    // Use allSettled for better error resilience
    const gistResults = await Promise.allSettled(gistPromises);
    const posts = gistResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    // Generate all files in parallel for better performance
    await Promise.all([
      // Generate individual post files
      ...posts.map(post => this.generatePost(post)),
      // Generate index page
      this.generateIndex(posts),
      // Generate RSS feed
      this.generateRSSFeed(posts),
      // Copy styles
      this.copyStyles()
    ]);

    console.log(`✅ Build complete! Generated ${posts.length} posts.`);
  }
}

module.exports = BlogGenerator;