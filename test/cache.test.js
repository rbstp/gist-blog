const assert = require('assert');
const { describe, it } = require('node:test');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const Cache = require('../src/lib/Cache');

function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'cache-test-'));
}

describe('Cache', () => {
  it('writes and reads JSON', async () => {
    const base = await tmpDir();
    const cache = new Cache(base, true);
    const data = { foo: 'bar', n: 1 };
    await cache.writeJson('a.json', data);
    const got = await cache.readJson('a.json', 60_000);
    assert.deepStrictEqual(got, data);
  });

  it('honors TTL for stale files', async () => {
    const base = await tmpDir();
    const cache = new Cache(base, true);
    const data = { x: 1 };
    const rel = 'b.json';
    await cache.writeJson(rel, data);
    // Force mtime in the past
    const full = path.join(base, rel);
    const old = new Date(Date.now() - 10_000);
    await fs.utimes(full, old, old);
    const got = await cache.readJson(rel, 1); // ttl 1ms
    assert.strictEqual(got, null);
  });

  it('reads/writes ETags', async () => {
    const base = await tmpDir();
    const cache = new Cache(base, true);
    await cache.writeEtag('k', 'W/"123"');
    const et = await cache.readEtag('k');
    assert.strictEqual(et, 'W/"123"');
  });
});
