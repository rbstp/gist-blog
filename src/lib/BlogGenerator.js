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
  }

  async fetchGists() {
    const response = await fetch(`https://api.github.com/users/${this.gistUsername}/gists`, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

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
  }

  async fetchGistContent(gist) {
    const response = await fetch(gist.url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

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
  }

  async generateIndex(posts) {
    const layoutTemplate = await this.templateEngine.loadTemplate('layout.html');
    const indexTemplate = await this.templateEngine.loadTemplate('index.html');

    // Sort posts by creation date (newest first)
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Add formatted dates and excerpts
    const postsWithMeta = sortedPosts.map(post => ({
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

  async generatePost(post) {
    const layoutTemplate = await this.templateEngine.loadTemplate('layout.html');
    const postTemplate = await this.templateEngine.loadTemplate('post.html');

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

    const processedPosts = await Promise.all(gistPromises);
    const posts = processedPosts.filter(Boolean);

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

module.exports = BlogGenerator;