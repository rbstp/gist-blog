import assert from 'node:assert';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Cache from '../src/lib/Cache.ts';

function tmpDir(): Promise<string> {
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
