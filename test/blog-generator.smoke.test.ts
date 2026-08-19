import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, before } from 'node:test';
import sharp from 'sharp';
import Cache from '../src/lib/Cache.ts';

import BlogGenerator from '../src/lib/BlogGenerator.ts';
import { OG_DIR, SEARCH_SUMMARY_LENGTH, SITE_URL } from '../src/lib/config.ts';
import { OG_WIDTH, OG_HEIGHT } from '../src/lib/OgImageGenerator.ts';

import type { FetchJsonResult } from '../src/lib/types.ts';

interface FakeGist {
  id: string;
  description: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  files: Record<string, { filename: string; content: string }>;
}

/** Build a whole site from canned gists into a throwaway dist directory. */
async function buildSite(gists: FakeGist[]): Promise<string> {
  const generator = new BlogGenerator();
  generator.distDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dist-'));
  generator.cache = new Cache(await fs.mkdtemp(path.join(os.tmpdir(), 'cache-')), true);

  const byUrl = new Map(gists.map((g) => [`https://api.github.com/gists/${g.id}`, g]));
  generator.github.fetchJson = async (url: string): Promise<FetchJsonResult> => {
    if (url.includes('/users/')) {
      return {
        ok: true,
        status: 200,
        json: gists.map((g) => ({ id: g.id, public: true, url: `https://api.github.com/gists/${g.id}` })),
      };
    }
    const gist = byUrl.get(url.split('?')[0] as string);
    if (gist) return { ok: true, status: 200, json: gist };
    return { ok: true, status: 200, json: [] };
  };

  await generator.build();
  return generator.distDir;
}

function makeGist(i: number, overrides: Partial<FakeGist> = {}): FakeGist {
  const id = `gist${String(i).padStart(6, '0')}`;
  const date = `2024-0${i + 1}-01T00:00:00Z`;
  return {
    id,
    description: `Notes about number ${i} #ai #devops`,
    created_at: date,
    updated_at: date,
    html_url: `https://gist.github.com/rbstp/${id}`,
    files: {
      'post.md': {
        filename: 'post.md',
        content: `# Post ${i}\n\nIntro paragraph ${i}.\n\n## A section\n\nMore prose here.\n`,
      },
    },
    ...overrides,
  };
}

describe('BlogGenerator smoke', () => {
  it('builds minimal site artifacts', async () => {
    const generator = new BlogGenerator();
    const dist = await fs.mkdtemp(path.join(os.tmpdir(), 'dist-'));
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-'));
    generator.distDir = dist;
    generator.cache = new Cache(cacheDir, true);

    const gistId = 'abc123def';
    const user = process.env.GIST_USERNAME || 'rbstp';
    const gistList = [
      { id: gistId, public: true, url: `https://api.github.com/gists/${gistId}` }
    ];
    const gistContent = {
      id: gistId,
      description: 'Demo post #test',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      html_url: `https://gist.github.com/${user}/${gistId}`,
      files: { 'post.md': { filename: 'post.md', content: '# Title\n\nHello world' } }
    };

    let step = 0;
    generator.github.fetchJson = async (url: string): Promise<FetchJsonResult> => {
      if (url.includes('/users/') && step === 0) { step++; return { ok: true, status: 200, json: gistList }; }
      if (url.includes('/gists/') && step === 1) { step++; return { ok: true, status: 200, json: gistContent }; }
      return { ok: true, status: 200, json: [] };
    };

    await generator.build();

    const indexPath = path.join(dist, 'index.html');
    const postPath = path.join(dist, 'posts', `${gistId}.html`);
    const rssPath = path.join(dist, 'feed.xml');
    const cssPath = path.join(dist, 'styles.css');
    const robotsPath = path.join(dist, 'robots.txt');

    const [indexOk, postOk, rssOk, cssOk, robotsOk] = await Promise.all([
      fileExists(indexPath), fileExists(postPath), fileExists(rssPath), fileExists(cssPath), fileExists(robotsPath)
    ]);

    assert.ok(indexOk, 'index.html missing');
    assert.ok(postOk, 'post page missing');
    assert.ok(rssOk, 'feed.xml missing');
    assert.ok(cssOk, 'styles.css missing');
    assert.ok(robotsOk, 'robots.txt missing');
  });
});

describe('generated site', () => {
  let dist = '';
  let indexHtml = '';
  let postHtml = '';
  let css = '';
  const gists = [makeGist(0), makeGist(1), makeGist(2)];

  before(async () => {
    dist = await buildSite(gists);
    indexHtml = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
    // Posts are sorted newest first, so gist 2 is the featured one.
    postHtml = await fs.readFile(path.join(dist, 'posts', `${gists[2]!.id}.html`), 'utf8');
    css = await fs.readFile(path.join(dist, 'styles.css'), 'utf8');
  });

  it('renders a social card per post plus a site default', async () => {
    const files = (await fs.readdir(path.join(dist, OG_DIR))).sort();
    assert.deepStrictEqual(files, ['gist000000.png', 'gist000001.png', 'gist000002.png', 'index.png']);

    const meta = await sharp(path.join(dist, OG_DIR, 'index.png')).metadata();
    assert.strictEqual(meta.width, OG_WIDTH);
    assert.strictEqual(meta.height, OG_HEIGHT);
  });

  it('emits complete page metadata on the index', () => {
    assert.ok(indexHtml.includes(`<link rel="canonical" href="${SITE_URL}/">`));
    assert.ok(indexHtml.includes(`<meta property="og:image" content="${SITE_URL}/${OG_DIR}/index.png">`));
    assert.match(indexHtml, /<meta name="description" content="[^"]+">/);
    assert.match(indexHtml, /<title>[^<]+<\/title>/);
  });

  it('points each post at its own canonical URL and social card', () => {
    const id = gists[2]!.id;
    assert.ok(postHtml.includes(`<link rel="canonical" href="${SITE_URL}/posts/${id}.html">`));
    assert.ok(postHtml.includes(`<meta property="og:image" content="${SITE_URL}/${OG_DIR}/${id}.png">`));
    assert.ok(postHtml.includes('<meta property="og:type" content="article">'));
  });

  it('leaves no unresolved template tags', () => {
    assert.ok(!indexHtml.includes('{{'), 'index.html has an unresolved tag');
    assert.ok(!postHtml.includes('{{'), 'post page has an unresolved tag');
  });

  it('renders the index and article shells', () => {
    assert.ok(indexHtml.includes('class="masthead"'));
    assert.ok(indexHtml.includes('class="topic-filter"'));
    assert.strictEqual((indexHtml.match(/class="post-item"/g) ?? []).length, 3);
    assert.ok(postHtml.includes('class="article-body"'));
    assert.ok(postHtml.includes('class="toc-sidebar"'));
  });

  it('bundles the stylesheet with the design tokens and none of the retired chrome', () => {
    assert.ok(css.includes('--bg-primary'), 'design tokens missing from the bundle');
    assert.ok(css.includes('.post-item'), 'archive styles missing from the bundle');
    assert.ok(!/terminal-window|status-bar|prompt-symbol|post-card|--tag-hue/.test(css));
  });

  it('writes a newest-first search index for the client search dialog', async () => {
    const index = JSON.parse(await fs.readFile(path.join(dist, 'search.json'), 'utf8')) as Array<{
      id: string; title: string; summary: string; tags: string[]; date: string;
    }>;

    assert.strictEqual(index.length, 3);
    assert.deepStrictEqual(index.map((entry) => entry.id), [gists[2]!.id, gists[1]!.id, gists[0]!.id]);
    for (const entry of index) {
      assert.match(entry.title, /^Post \d$/);
      assert.ok(entry.summary.length > 0 && entry.summary.length <= SEARCH_SUMMARY_LENGTH + 1);
      assert.deepStrictEqual(entry.tags, ['ai', 'devops']);
      assert.match(entry.date, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    }
  });

  it('bundles the client scripts and self-hosted fonts', async () => {
    const assets = await fs.readdir(path.join(dist, 'assets'));
    for (const name of ['main.js', 'command-palette.js', 'ux-enhancements.js', 'graph-page.js']) {
      assert.ok(assets.includes(name), `${name} missing from dist/assets`);
    }
    const fonts = await fs.readdir(path.join(dist, 'fonts'));
    assert.ok(fonts.some((f) => f.startsWith('Inter-Variable')), 'Inter woff2 not copied');
    assert.ok(fonts.some((f) => f.startsWith('JetBrainsMono')), 'JetBrains Mono woff2 not copied');
  });
});

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}
