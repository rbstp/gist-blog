const assert = require('assert');
const { describe, it, afterEach } = require('node:test');

// Clear cached module to pick up env changes between subtests
function freshConfig() {
  delete require.cache[require.resolve('../src/lib/config')];
  return require('../src/lib/config');
}

describe('config', () => {
  const envBackup = { ...process.env };
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('uses defaults when env is not set', () => {
    delete process.env.POSTS_PER_PAGE;
    delete process.env.GRAPH_MAX_NODES;
    delete process.env.GIST_USERNAME;

    const cfg = freshConfig();
    assert.strictEqual(cfg.POSTS_PER_PAGE, 6);
    assert.strictEqual(cfg.GRAPH_MAX_NODES, 20);
    assert.strictEqual(typeof cfg.DEFAULT_GIST_USERNAME, 'string');
    assert.ok(cfg.DEFAULT_GIST_USERNAME.length > 0);
  });

  it('respects env overrides', () => {
    process.env.POSTS_PER_PAGE = '9';
    process.env.GRAPH_MAX_NODES = '42';
    process.env.GIST_USERNAME = 'someone';

    const cfg = freshConfig();
    assert.strictEqual(cfg.POSTS_PER_PAGE, 9);
    assert.strictEqual(cfg.GRAPH_MAX_NODES, 42);
    assert.strictEqual(cfg.DEFAULT_GIST_USERNAME, 'someone');
  });
});
