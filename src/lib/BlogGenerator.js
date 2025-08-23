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
    this.gistParser = new GistParser(this.gistUsername);
    this.rssGenerator = new RSSGenerator();

    // Template cache for performance
    this.templateCache = new Map();
    // Date formatting cache to avoid repeated parsing and formatting
    this.dateCache = new Map();

    // Simple on-disk cache for API responses (dev convenience)
    this.cacheDir = path.join('.cache');
    this.enableCache = String(process.env.GIST_CACHE || 'true').toLowerCase() !== 'false';
    // Default TTL: 10 minutes for list, 60 minutes for per-gist
    this.ttlListMs = Number(process.env.GIST_CACHE_TTL_LIST_MS || 10 * 60 * 1000);
    this.ttlGistMs = Number(process.env.GIST_CACHE_TTL_GIST_MS || 60 * 60 * 1000);
  }

  async readCache(filePath, ttlMs) {
    if (!this.enableCache) return null;
    try {
      const full = path.join(this.cacheDir, filePath);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) return null;
      const age = Date.now() - stat.mtimeMs;
      if (age > ttlMs) return null;
      const buf = await fs.readFile(full, 'utf-8');
      return JSON.parse(buf);
    } catch { return null; }
  }

  async writeCache(filePath, data) {
    if (!this.enableCache) return;
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const full = path.join(this.cacheDir, filePath);
      await fs.writeFile(full, JSON.stringify(data));
    } catch { /* ignore cache errors */ }
  }

  // Build a minimalist graph from tags: nodes are tags with frequency, edges are co-occurrences
  async generateGraphData(posts) {
    const nodeCount = new Map();
    const edgeCount = new Map(); // key: a|b

    for (const post of posts) {
      const tags = Array.isArray(post.tags) ? [...new Set(post.tags.map(t => String(t).toLowerCase()))] : [];
      if (tags.length === 0) continue;
      for (const t of tags) nodeCount.set(t, (nodeCount.get(t) || 0) + 1);
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const a = tags[i];
          const b = tags[j];
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        }
      }
    }

    // Reduce to a compact graph (top N nodes by frequency)
    const MAX_NODES = 20;
    const sortedNodes = Array.from(nodeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, MAX_NODES);
    const allowed = new Set(sortedNodes.map(([id]) => id));
    const nodes = sortedNodes.map(([id, count]) => ({ id, count }));
    const edges = Array.from(edgeCount.entries())
      .map(([key, weight]) => { const [source, target] = key.split('|'); return { source, target, weight }; })
      .filter(e => allowed.has(e.source) && allowed.has(e.target));

    const graph = { nodes, edges };
    await fs.writeFile(path.join(this.distDir, 'graph.json'), JSON.stringify(graph));
  }

  async fetchGists() {
    // Try cache first
    const cacheKey = `gists_${this.gistUsername}.json`;
    const cached = await this.readCache(cacheKey, this.ttlListMs);
    if (cached) return cached;

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
      const filtered = gists.filter(gist => gist.public);
      await this.writeCache(cacheKey, filtered);
      return filtered;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: GitHub API took too long to respond');
      }
      throw error;
    }
  }

  async fetchGistContent(gist) {
    // Try per-gist cache
    const cacheKey = `gist_${gist.id}.json`;
    const cached = await this.readCache(cacheKey, this.ttlGistMs);
    if (cached) return cached;

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

      const json = await response.json();
      await this.writeCache(cacheKey, json);
      return json;
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

    // Determine the primary topic for this post (used by the sidebar graph)
    function choosePrimaryTopic(p) {
      if (Array.isArray(p.tags) && p.tags.length) return String(p.tags[0]);
      return '';
    }
    const currentTopic = choosePrimaryTopic(post);

    const postData = {
      ...post,
      formattedDate: this.formatDateCached(post.createdAt),
      formattedUpdateDate: post.updatedAt !== post.createdAt ?
        this.formatDateCached(post.updatedAt) : null,
      shortId: post.id.substring(0, COMMIT_HASH_LENGTH),
      currentTopic,
      tagsCsv: Array.isArray(post.tags) ? post.tags.join(',') : ''
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

  async generateGraphPage() {
    const { 'layout.html': layoutTemplate, 'graph.html': graphTemplate } =
      await this.loadTemplatesCached(['layout.html', 'graph.html']);

    const content = this.templateEngine.render(graphTemplate, { timestamp: Date.now() });
    const fullPage = this.templateEngine.render(layoutTemplate, {
      title: 'tags graph',
      content,
      timestamp: Date.now()
    });
    await fs.writeFile(path.join(this.distDir, 'graph.html'), fullPage);
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

    // Concurrency limiting to avoid bursts and rate-limit spikes
    const limit = Number(process.env.FETCH_CONCURRENCY || 5);
    async function mapWithConcurrency(items, worker, concurrency) {
      const results = new Array(items.length);
      let index = 0;
      let active = 0;
      return new Promise((resolve) => {
        function next() {
          if (index >= items.length && active === 0) return resolve(results);
          while (active < concurrency && index < items.length) {
            const cur = index++;
            active++;
            Promise.resolve(worker(items[cur], cur))
              .then((res) => { results[cur] = res; })
              .catch((err) => { console.error('Worker error:', err?.message || err); results[cur] = null; })
              .finally(() => { active--; next(); });
          }
        }
        next();
      });
    }

    const gistPromises = await mapWithConcurrency(
      gists,
      async (gist) => {
        try {
          const fullGist = await this.fetchGistContent(gist);
          return this.gistParser.parseGistAsPost(fullGist);
        } catch (error) {
          console.error(`Failed to process gist ${gist.id}:`, error.message);
          return null;
        }
      },
      Math.max(1, limit)
    );

    // Use allSettled for better error resilience
    const gistResults = await Promise.allSettled(gistPromises);
    const posts = gistResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    // Sort posts by createdAt once for reuse
    const sortedPostsByDate = posts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Generate all files in parallel for better performance
    await Promise.all([
      // Generate individual post files
      ...posts.map(post => this.generatePost(post)),
      // Generate index page (uses sorted posts)
      this.generateIndex(sortedPostsByDate),
      // Generate RSS feed (uses sorted posts)
      this.generateRSSFeed(sortedPostsByDate),
      // Generate global tag graph page
      this.generateGraphPage(),
      // Generate tag graph data
      this.generateGraphData(posts),
      // Copy styles
      this.copyStyles()
    ]);

    console.log(`✅ Build complete! Generated ${posts.length} posts.`);
  }
}

module.exports = BlogGenerator;
