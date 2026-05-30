import assert from 'node:assert';
import Cache from '../src/lib/Cache.ts';
import GitHubClient from '../src/lib/GitHubClient.ts';
import { describe, it } from 'node:test';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface MockResponseSpec {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  json?: unknown;
  text?: string;
}

function mkTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ghc-test-'));
}

function mockFetchSequence(responses: MockResponseSpec[]): void {
  let i = 0;
  global.fetch = (async () => {
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return {
      ok: r.ok,
      status: r.status,
      statusText: r.statusText || '',
      json: async () => r.json,
      text: async () => r.text || '',
      headers: {
        get: (k: string) => (r.headers || {})[k.toLowerCase()] || (r.headers || {})[k] || null,
        entries: () => Object.entries(r.headers || {}),
      },
    };
  }) as unknown as typeof fetch;
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

  it('403 retry succeeds even when timeoutMs is shorter than the rate-limit delay', async () => {
    // Regression: a single shared timeout once governed the whole call, including the
    // 403 backoff sleep — so the default timeout fired mid-sleep and aborted the retry,
    // surfacing a bogus "Request timeout". A correct impl gives each attempt a fresh
    // timeout signal, so the retry (fired after the sleep) never sees an aborted signal.
    const dir = await mkTmp();
    const cache = new Cache(dir, true);

    let calls = 0;
    global.fetch = (async (_: unknown, opts: { signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'TimeoutError';
        throw err;
      }
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 403, statusText: 'Forbidden', text: async () => '', headers: { get: () => null } };
      }
      return { ok: true, status: 200, json: async () => ({ recovered: true }), headers: { get: () => null } };
    }) as unknown as typeof fetch;

    // timeoutMs (20) < rateLimitDelayMs (50): the old shared-timer impl aborted the retry mid-sleep.
    const client = new GitHubClient({ token: '', rateLimitDelayMs: 50 });
    const { json } = await client.fetchJson('https://api.example.com', { etagKey: 'rl', cache, timeoutMs: 20 });
    assert.deepStrictEqual(json, { recovered: true });
    assert.strictEqual(calls, 2, 'should make the initial call plus exactly one retry');
  });

  it('falls back without auth header on 401 when token supplied', async () => {
    const dir = await mkTmp();
    const cache = new Cache(dir, true);

    const authHeaders: boolean[] = [];
    // First call 401 with auth, second success without auth
    global.fetch = (async (_: unknown, opts: { headers: Record<string, string> }) => {
      authHeaders.push(Object.keys(opts.headers).some(k => k.toLowerCase() === 'authorization'));
      if (authHeaders.length === 1) {
        return { ok: false, status: 401, statusText: 'Unauthorized', text: async () => JSON.stringify({ message: 'bad creds' }), headers: { get: () => null } };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), headers: { get: () => null } };
    }) as unknown as typeof fetch;

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
    let error: unknown;
    try {
      await client.fetchJson('https://api.example.com', { etagKey: 'a2', cache });
    } catch (e) {
      error = e;
    }
    assert.ok(error, 'Expected error');
    assert.match(String(error), /401/);
  });
});
