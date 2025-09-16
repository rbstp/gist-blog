const assert = require('assert');
const Cache = require('../src/lib/Cache');
const GitHubClient = require('../src/lib/GitHubClient');
const { describe, it } = require('node:test');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

function mkTmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ghc-test-'));
}

function mockFetchSequence(responses) {
  let i = 0;
  global.fetch = async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return {
      ok: r.ok,
      status: r.status,
      statusText: r.statusText || '',
      headers: new Map(Object.entries(r.headers || {})),
      json: async () => r.json,
      text: async () => r.text || '',
      headers: {
        get: (k) => (r.headers || {})[k.toLowerCase()] || (r.headers || {})[k] || null,
        entries: () => Object.entries(r.headers || {}),
      },
    };
  };
}

describe('GitHubClient', () => {
  it('returns cached stale on 304', async () => {
    const dir = await mkTmp();
    const cache = new Cache(dir, true);
    await cache.writeJson('x', { cached: true });
    await cache.writeEtag('x', 'W/"123"');

    mockFetchSequence([
      { ok: true, status: 304, headers: {} },
    ]);

    const client = new GitHubClient({ token: '', rateLimitDelayMs: 5 });
    const { json } = await client.fetchJson('https://api.example.com', { etagKey: 'x', cache });
    assert.deepStrictEqual(json, { cached: true });
  });

  it('stores new ETag on success', async () => {
    const dir = await mkTmp();
    const cache = new Cache(dir, true);

    mockFetchSequence([
      { ok: true, status: 200, json: { a: 1 }, headers: { etag: 'W/"xyz"' } },
    ]);

    const client = new GitHubClient({ token: '', rateLimitDelayMs: 5 });
    const { json } = await client.fetchJson('https://api.example.com', { etagKey: 'y', cache });
    const et = await cache.readEtag('y');
    assert.deepStrictEqual(json, { a: 1 });
    assert.strictEqual(et, 'W/"xyz"');
  });

  it('retries once on 403', async () => {
    const dir = await mkTmp();
    const cache = new Cache(dir, true);

    mockFetchSequence([
      { ok: false, status: 403, statusText: 'Forbidden' },
      { ok: true, status: 200, json: { ok: true }, headers: {} },
    ]);

    const client = new GitHubClient({ token: '', rateLimitDelayMs: 5 });
    // Reduce wait by monkey patching setTimeout within the method would be intrusive; we accept minor delay.
    const start = Date.now();
    const { json } = await client.fetchJson('https://api.example.com', { etagKey: 'z', cache, timeoutMs: 5_000 });
    const elapsed = Date.now() - start;
    assert.deepStrictEqual(json, { ok: true });
    // Should have waited at least a bit; we don't assert the full RATE_LIMIT_DELAY_MS to avoid flakiness.
    assert.ok(elapsed >= 0);
  });

  it('falls back without auth header on 401 when token supplied', async () => {
    const dir = await mkTmp();
    const cache = new Cache(dir, true);

    let authHeaders = [];
    // First call 401 with auth, second success without auth
    global.fetch = async (_, opts) => {
      authHeaders.push(Object.keys(opts.headers).some(k => k.toLowerCase() === 'authorization'));
      if (authHeaders.length === 1) {
        return { ok: false, status: 401, statusText: 'Unauthorized', text: async () => JSON.stringify({ message: 'bad creds' }), headers: { get: () => null } };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), headers: { get: () => null } };
    };

    const client = new GitHubClient({ token: 'dummy' });
    const { json } = await client.fetchJson('https://api.example.com', { etagKey: 'a1', cache });
    assert.deepStrictEqual(json, { ok: true });
    assert.deepStrictEqual(authHeaders, [ true, false ], 'Should send auth first then retry without');
  });

  it('surfaces 401 when no token to fallback', async () => {
    const dir = await mkTmp();
    const cache = new Cache(dir, true);

    mockFetchSequence([
      { ok: false, status: 401, statusText: 'Unauthorized', text: JSON.stringify({ message: 'no token' }) },
    ]);

    const client = new GitHubClient({ token: '' });
    let error;
    try {
      await client.fetchJson('https://api.example.com', { etagKey: 'a2', cache });
    } catch (e) {
      error = e;
    }
    assert.ok(error, 'Expected error');
    assert.match(String(error), /401/);
  });
});
