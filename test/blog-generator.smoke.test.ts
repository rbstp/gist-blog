import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it } from 'node:test';
import Cache from '../src/lib/Cache.ts';

import BlogGenerator from '../src/lib/BlogGenerator.ts';

import type { FetchJsonResult } from '../src/lib/types.ts';

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

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}
