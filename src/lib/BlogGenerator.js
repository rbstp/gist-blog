const fs = require('fs').promises;
const path = require('path');
const esbuild = require('esbuild');
// date-fns no longer needed directly; DateUtils handles formatting

const TemplateEngine = require('./TemplateEngine');
const TemplateLoader = require('./TemplateLoader');
const GistParser = require('./GistParser');
const RSSGenerator = require('./RSSGenerator');
const Cache = require('./Cache');
const GitHubClient = require('./GitHubClient');
const { mapWithConcurrency } = require('./AsyncPool');
const DateUtils = require('./DateUtils');
const GraphBuilder = require('./GraphBuilder');
const DataShaper = require('./DataShaper');
const {
  DEFAULT_GIST_USERNAME,
  TTL_LIST_MS,
  TTL_GIST_MS,
  GRAPH_MAX_NODES,
  FETCH_CONCURRENCY,
} = require('./config');

// Data shaping logic moved to DataShaper

class BlogGenerator {
  constructor() {
    this.gistUsername = DEFAULT_GIST_USERNAME;
    this.distDir = 'dist';
    this.templatesDir = 'src/templates';
    this.stylesDir = 'src/styles';
  this.clientDir = 'src/client';

  this.templateEngine = new TemplateEngine(this.templatesDir);
  this.templateLoader = new TemplateLoader(this.templatesDir);
    this.gistParser = new GistParser(this.gistUsername);
    this.rssGenerator = new RSSGenerator();

    // Date formatting utilities
  this.dates = new DateUtils();
  this.shaper = new DataShaper({
    formatDate: (iso, fmt) => this.dates.formatISO(iso, fmt),
    now: (fmt) => this.dates.now(fmt),
  });

    // On-disk cache and GitHub client
    this.cache = new Cache();
    this.github = new GitHubClient();
  }


  // Build a minimalist graph from tags: nodes are tags with frequency, edges are co-occurrences
  async generateGraphData(posts) {
    const builder = new GraphBuilder();
    const graph = builder.buildFromPosts(posts, GRAPH_MAX_NODES);
    await fs.writeFile(path.join(this.distDir, 'graph.json'), JSON.stringify(graph));
  }

  async fetchGists() {
    // Try cache first
    const cacheKey = `gists_${this.gistUsername}.json`;
    const cached = await this.cache.readJson(cacheKey, TTL_LIST_MS);
    if (cached) return cached;

    const { json } = await this.github.fetchJson(
      `https://api.github.com/users/${this.gistUsername}/gists`,
      { etagKey: cacheKey, cache: this.cache, useEtag: true }
    );

    const filtered = json.filter(gist => gist.public);
    await this.cache.writeJson(cacheKey, filtered);
    return filtered;
  }

  async fetchGistContent(gist) {
    // Try per-gist cache
    const cacheKey = `gist_${gist.id}.json`;
    const cached = await this.cache.readJson(cacheKey, TTL_GIST_MS);
    if (cached) return cached;

    const { json } = await this.github.fetchJson(
      gist.url,
      { etagKey: cacheKey, cache: this.cache, useEtag: true }
    );
    await this.cache.writeJson(cacheKey, json);
    return json;
  }

  async loadTemplatesCached(templateNames) {
    // Delegate caching to TemplateLoader internally
    return this.templateLoader.loadMany(templateNames);
  }

  async generateIndex(posts) {
    const { 'layout.html': layoutTemplate, 'index.html': indexTemplate } =
      await this.loadTemplatesCached(['layout.html', 'index.html']);
  const templateData = this.shaper.buildIndexData(posts);

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
  const postData = this.shaper.buildPostData(post);

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
      await fs.copyFile(sourceStylesPath, destStylesPath);
    } catch (error) {
      console.error('Error copying styles:', error.message);
      throw error;
    }
  }

  async bundleClientScripts() {
    const outdir = path.join(this.distDir, 'assets');
    await fs.mkdir(outdir, { recursive: true });
    // We treat each client script as its own entry point; main.js will lazy-load others.
    const entryPoints = [
      path.join(this.clientDir, 'main.js'),
      path.join(this.clientDir, 'graph-page.js'),
      path.join(this.clientDir, 'topic-graph-enhance.js'),
    ];
    try {
      await esbuild.build({
        entryPoints,
        outdir,
        bundle: false,
        minify: true,
        sourcemap: false,
        format: 'iife',
        platform: 'browser',
        target: ['es2019'],
        write: true,
        logLevel: 'silent'
      });
    } catch (error) {
      console.error('Error bundling client scripts:', error.message);
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
    } catch {
      // Ignore error if directory doesn't exist
    }

    // Fetch gists
    const gists = await this.fetchGists();

    // Concurrency limiting to avoid bursts and rate-limit spikes
  const limit = Math.max(1, FETCH_CONCURRENCY);

    const gistResults = await mapWithConcurrency(
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
      limit
    );

    // Filter out failures/nulls; items are already resolved
    const posts = gistResults.filter((p) => p !== null);

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
      this.copyStyles(),
      // Bundle/copy client scripts
      this.bundleClientScripts()
    ]);

    console.log(`✅ Build complete! Generated ${posts.length} posts.`);
  }
}

module.exports = BlogGenerator;
