import assert from 'node:assert';
import { describe, it, afterEach } from 'node:test';

// Clear cached module to pick up env changes between subtests.
// ESM has no require.cache, so re-import config with a cache-busting query string.
let counter = 0;
async function freshConfig() {
  return await import('../src/lib/config.ts?bust=' + (counter++));
}

describe('config', () => {
  const envBackup = { ...process.env };
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses defaults when env is not set', async () => {
    delete process.env.POSTS_PER_PAGE;
    delete process.env.GRAPH_MAX_NODES;
    delete process.env.GIST_USERNAME;

    const cfg = await freshConfig();
    assert.strictEqual(cfg.POSTS_PER_PAGE, 6);
    assert.strictEqual(cfg.GRAPH_MAX_NODES, 20);
    assert.strictEqual(typeof cfg.DEFAULT_GIST_USERNAME, 'string');
    assert.ok(cfg.DEFAULT_GIST_USERNAME.length > 0);
  });

  it('respects env overrides', async () => {
    process.env.POSTS_PER_PAGE = '9';
    process.env.GRAPH_MAX_NODES = '42';
    process.env.GIST_USERNAME = 'someone';

    const cfg = await freshConfig();
    assert.strictEqual(cfg.POSTS_PER_PAGE, 9);
    assert.strictEqual(cfg.GRAPH_MAX_NODES, 42);
    assert.strictEqual(cfg.DEFAULT_GIST_USERNAME, 'someone');
  });
});
