import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import sharp from 'sharp';
// date-fns no longer needed directly; DateUtils handles formatting

import TemplateEngine from './TemplateEngine.ts';
import TemplateLoader from './TemplateLoader.ts';
import GistParser from './GistParser.ts';
import RSSGenerator from './RSSGenerator.ts';
import Cache from './Cache.ts';
import GitHubClient from './GitHubClient.ts';
import { mapWithConcurrency } from './AsyncPool.ts';
import DateUtils from './DateUtils.ts';
import GraphBuilder from './GraphBuilder.ts';
import DataShaper from './DataShaper.ts';
import {
  DEFAULT_GIST_USERNAME,
  TTL_LIST_MS,
  TTL_GIST_MS,
  GRAPH_MAX_NODES,
  FETCH_CONCURRENCY,
} from './config.ts';
import type { Post, Gist } from './types.ts';

// Data shaping logic moved to DataShaper

export default class BlogGenerator {
  gistUsername: string;
  distDir: string;
  templatesDir: string;
  stylesDir: string;
  fontsDir: string;
  clientDir: string;
  templateEngine: TemplateEngine;
  templateLoader: TemplateLoader;
  gistParser: GistParser;
  rssGenerator: RSSGenerator;
  dates: DateUtils;
  shaper: DataShaper;
  cache: Cache;
  github: GitHubClient;

  constructor() {
    this.gistUsername = DEFAULT_GIST_USERNAME;
    this.distDir = 'dist';
    this.templatesDir = 'src/templates';
    this.stylesDir = 'src/styles';
    this.fontsDir = 'src/fonts';
    this.clientDir = 'src/client';

    this.templateEngine = new TemplateEngine(this.templatesDir);
    this.templateLoader = new TemplateLoader(this.templatesDir);
    this.gistParser = new GistParser(this.gistUsername);
    this.rssGenerator = new RSSGenerator();

    // Date formatting utilities
    this.dates = new DateUtils();
    this.shaper = new DataShaper({
      formatDate: (iso: string, fmt: string) => this.dates.formatISO(iso, fmt),
      now: (fmt: string) => this.dates.now(fmt),
    });

    // On-disk cache and GitHub client
    this.cache = new Cache();
    this.github = new GitHubClient();
  }


  // Build a minimalist graph from tags: nodes are tags with frequency, edges are co-occurrences
  async generateGraphData(posts: Post[]): Promise<void> {
    const builder = new GraphBuilder();
    const graph = builder.buildFromPosts(posts, GRAPH_MAX_NODES);
    await fs.writeFile(path.join(this.distDir, 'graph.json'), JSON.stringify(graph));
  }

  async fetchGists(): Promise<Gist[]> {
    // Try cache first
    const cacheKey = `gists_${this.gistUsername}.json`;
    const cached = await this.cache.readJson(cacheKey, TTL_LIST_MS) as Gist[] | null;
    if (cached) return cached;

    const { json } = await this.github.fetchJson(
      `https://api.github.com/users/${this.gistUsername}/gists`,
      { etagKey: cacheKey, cache: this.cache, useEtag: true }
    );

    const list = json as Gist[];
    const filtered = list.filter(gist => gist.public);
    await this.cache.writeJson(cacheKey, filtered);
    return filtered;
  }

  async fetchGistContent(gist: Gist): Promise<Gist> {
    // Try per-gist cache
    const cacheKey = `gist_${gist.id}.json`;
    const cached = await this.cache.readJson(cacheKey, TTL_GIST_MS) as Gist | null;
    if (cached) return cached;

    const { json } = await this.github.fetchJson(
      gist.url,
      { etagKey: cacheKey, cache: this.cache, useEtag: true }
    );
    await this.cache.writeJson(cacheKey, json);
    return json as Gist;
  }

  async loadTemplatesCached(templateNames: string[]): Promise<Record<string, string>> {
    // Delegate caching to TemplateLoader internally
    return this.templateLoader.loadMany(templateNames);
  }

  async generateIndex(posts: Post[], buildTs: number): Promise<void> {
    const { 'layout.html': layoutTemplate, 'index.html': indexTemplate } =
      await this.loadTemplatesCached(['layout.html', 'index.html']);
    const templateData = this.shaper.buildIndexData(posts);

    const indexContent = this.templateEngine.render(indexTemplate ?? '', templateData);

    const fullPage = this.templateEngine.render(layoutTemplate ?? '', {
      title: 'main',
      content: indexContent,
      statusPath: '~/rbstp.dev',
      timestamp: buildTs
    });

    // Only generate index.html - no separate page files needed
    await fs.writeFile(path.join(this.distDir, 'index.html'), fullPage);
  }

  async generatePost(post: Post, buildTs: number): Promise<void> {
    const { 'layout.html': layoutTemplate, 'post.html': postTemplate } =
      await this.loadTemplatesCached(['layout.html', 'post.html']);
    const postData = this.shaper.buildPostData(post);

    const postContent = this.templateEngine.render(postTemplate ?? '', postData);
    const fullPage = this.templateEngine.render(layoutTemplate ?? '', {
      title: post.title,
      content: postContent,
      statusPath: `~/posts/${post.filename}`,
      timestamp: buildTs
    });

    // The posts directory is created once in build() before posts are generated.
    await fs.writeFile(path.join(this.distDir, 'posts', `${post.id}.html`), fullPage);
  }

  async generateRSSFeed(posts: Post[]): Promise<void> {
    const rssXml = this.rssGenerator.generateFeed(posts);
    await fs.writeFile(path.join(this.distDir, 'feed.xml'), rssXml);
  }

  async generateGraphPage(buildTs: number): Promise<void> {
    const { 'layout.html': layoutTemplate, 'graph.html': graphTemplate } =
      await this.loadTemplatesCached(['layout.html', 'graph.html']);

    // graph.html has no template variables, so its content render takes no data.
    const content = this.templateEngine.render(graphTemplate ?? '', {});
    const fullPage = this.templateEngine.render(layoutTemplate ?? '', {
      title: 'tags graph',
      content,
      statusPath: '~/graph',
      timestamp: buildTs
    });
    await fs.writeFile(path.join(this.distDir, 'graph.html'), fullPage);
  }

  async copyStyles(): Promise<void> {
    const destStylesPath = path.join(this.distDir, 'styles.css');
    const modulesDir = path.join(this.stylesDir, 'modules');

    try {
      // Check if modules directory exists (modular approach)
      const stat = await fs.stat(modulesDir).catch(() => null);

      if (stat && stat.isDirectory()) {
        // Concatenate CSS modules in the correct order
        const moduleOrder = [
          'variables.css',
          'base.css',
          'layout.css',
          'terminal.css',
          'tags.css',
          'cards.css',
          'post.css',
          'typography.css',
          'syntax.css',
          'command-palette.css',
          'graph.css',
          'ux.css',
          'responsive.css'
        ];

        const parts = await Promise.all(
          moduleOrder.map((moduleName) => fs.readFile(path.join(modulesDir, moduleName), 'utf8'))
        );
        await fs.writeFile(destStylesPath, parts.join('\n') + '\n');
      }
    } catch (error) {
      console.error('Error copying styles:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async copyFonts(): Promise<void> {
    // Copy entire fonts directory if it exists
    try {
      const source = this.fontsDir;
      // Verify directory exists; if not, skip silently
      const stat = await fs.stat(source).catch(() => null);
      if (!stat || !stat.isDirectory()) return;
      const destDir = path.join(this.distDir, 'fonts');
      await fs.mkdir(destDir, { recursive: true });
      const entries = await fs.readdir(source);
      await Promise.all(entries.map(async (name) => {
        const srcPath = path.join(source, name);
        const destPath = path.join(destDir, name);
        const s = await fs.stat(srcPath);
        if (s.isFile()) {
          await fs.copyFile(srcPath, destPath);
        }
      }));
    } catch (error) {
      console.error('Error copying fonts:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async copyFavicon(): Promise<void> {
    // Copy favicon.svg and convert to PNG for RSS feed
    try {
      const source = path.join('src', 'favicon.svg');
      const svgDest = path.join(this.distDir, 'favicon.svg');
      const pngDest = path.join(this.distDir, 'favicon.png');

      const stat = await fs.stat(source).catch(() => null);
      if (stat && stat.isFile()) {
        // Copy SVG for website use
        await fs.copyFile(source, svgDest);

        // Convert to PNG for RSS feed (RSS requires GIF/JPEG/PNG)
        await sharp(source)
          .resize(128, 128) // Larger size for better quality in feed readers
          .png()
          .toFile(pngDest);
      }
    } catch (error) {
      console.error('Error copying/converting favicon:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async copyRobotsTxt(): Promise<void> {
    // Copy robots.txt to dist directory
    try {
      const source = path.join('src', 'robots.txt');
      const dest = path.join(this.distDir, 'robots.txt');

      const stat = await fs.stat(source).catch(() => null);
      if (stat && stat.isFile()) {
        await fs.copyFile(source, dest);
      }
    } catch (error) {
      console.error('Error copying robots.txt:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async bundleClientScripts(): Promise<void> {
    const outdir = path.join(this.distDir, 'assets');
    await fs.mkdir(outdir, { recursive: true });
    // We treat each client script as its own entry point; main.js will lazy-load others.
    const entryPoints = [
      path.join(this.clientDir, 'main.ts'),
      path.join(this.clientDir, 'graph-page.ts'),
      path.join(this.clientDir, 'topic-graph-enhance.ts'),
      path.join(this.clientDir, 'command-palette.ts'),
      path.join(this.clientDir, 'ux-enhancements.ts'),
    ];
    // Optional bundling: if we ever add imports across client files, enable bundling by setting
    //   BUNDLE_CLIENT=true
    // Default keeps separate minified IIFEs without bundling for simplicity and predictable filenames.
    const enableBundling = String(process.env.BUNDLE_CLIENT || '').toLowerCase() === 'true';
    try {
      await esbuild.build({
        entryPoints,
        outdir,
        bundle: enableBundling,
        minify: true,
        sourcemap: false,
        format: 'iife',
        platform: 'browser',
        target: ['es2019'],
        entryNames: '[name]', // keep stable names main.js, graph-page.js, topic-graph-enhance.js, ux-enhancements.js
        write: true,
        logLevel: 'silent'
      });
    } catch (error) {
      console.error('Error bundling client scripts:', error instanceof Error ? error.message : String(error));
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
    } catch {
      // Ignore error if directory doesn't exist
    }

    // Fetch gists
    const gists = await this.fetchGists();

    // Concurrency limiting to avoid bursts and rate-limit spikes
    const limit = Math.max(1, FETCH_CONCURRENCY);

    const gistResults = await mapWithConcurrency(
      gists,
      async (gist: Gist): Promise<Post | null> => {
        try {
          const fullGist = await this.fetchGistContent(gist);
          return this.gistParser.parseGistAsPost(fullGist);
        } catch (error) {
          console.error(`Failed to process gist ${gist.id}:`, error instanceof Error ? error.message : String(error));
          return null;
        }
      },
      limit
    );

    // Filter out failures/nulls; items are already resolved
    const posts = gistResults.filter((p): p is Post => p !== null);

    if (posts.length === 0) {
      console.warn('⚠️  No posts were generated. This may indicate an authentication issue (invalid GITHUB_TOKEN) or no public gists found.');
    }

    // Sort posts by createdAt once for reuse
    const sortedPostsByDate = posts.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Ensure the posts directory exists once, rather than per-post inside generatePost().
    await fs.mkdir(path.join(this.distDir, 'posts'), { recursive: true });

    // One build timestamp shared across all pages for consistent asset cache-busting.
    const buildTs = Date.now();

    // Generate all files in parallel for better performance
    await Promise.all([
      // Generate individual post files
      ...posts.map(post => this.generatePost(post, buildTs)),
      // Generate index page (uses sorted posts)
      this.generateIndex(sortedPostsByDate, buildTs),
      // Generate RSS feed (uses sorted posts)
      this.generateRSSFeed(sortedPostsByDate),
      // Generate global tag graph page
      this.generateGraphPage(buildTs),
      // Generate tag graph data
      this.generateGraphData(posts),
      // Copy styles
      this.copyStyles(),
      // Copy fonts (if any present)
      this.copyFonts(),
      // Copy favicon
      this.copyFavicon(),
      // Copy robots.txt
      this.copyRobotsTxt(),
      // Bundle/copy client scripts
      this.bundleClientScripts()
    ]);

    console.log(`✅ Build complete! Generated ${posts.length} posts.`);
    if (posts.length === 0) {
      // Provide failing exit code in CI to surface problem early
      if (process.env.CI) {
        console.error('Exiting with code 2 because zero posts generated in CI environment.');
        process.exitCode = 2;
      }
    }
  }
}
