import { setTimeout as sleep } from 'node:timers/promises';
import { USER_AGENT, RATE_LIMIT_DELAY_MS, GITHUB_TOKEN } from './config.ts';
import type Cache from './Cache.ts';
import type { FetchJsonResult } from './types.ts';

interface GitHubClientOptions {
  token?: string;
  rateLimitDelayMs?: number;
}

interface FetchJsonOptions {
  etagKey?: string;
  cache?: Cache;
  timeoutMs?: number;
  useEtag?: boolean;
}

interface GetOnceOptions {
  omitAuth?: boolean;
}

class GitHubClient {
  token: string;
  rateLimitDelayMs: number;

  constructor({ token = GITHUB_TOKEN, rateLimitDelayMs = RATE_LIMIT_DELAY_MS }: GitHubClientOptions = {}) {
    this.token = token || '';
    this.rateLimitDelayMs = rateLimitDelayMs;
  }

  headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/vnd.github+json',
      ...extra,
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async fetchJson(url: string, { etagKey, cache, timeoutMs = 30_000, useEtag = true }: FetchJsonOptions = {}): Promise<FetchJsonResult> {
    // Each attempt gets its own timeout signal. Crucially, the inter-attempt rate-limit
    // sleep is left untimed: a single shared timer would abort the retry mid-sleep (the
    // default 30s timeout fires inside the 60s 403 backoff), so the recovery never worked.
    // AbortSignal.timeout uses an unref'd timer, so a pending signal never keeps the build alive.
    const getOnce = async (withEtag: boolean, { omitAuth }: GetOnceOptions = {}): Promise<Response> => {
      const etag = withEtag && etagKey && cache ? await cache.readEtag(etagKey) : '';
      const baseHeaders = this.headers(etag ? { 'If-None-Match': etag } : undefined);
      if (omitAuth) delete baseHeaders['Authorization'];
      return fetch(url, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    try {
      let response = await getOnce(useEtag);

      if (response.status === 304) {
        // Use stale cache regardless of TTL
        const stale = etagKey && cache ? await cache.readJson(etagKey, Number.MAX_SAFE_INTEGER) : null;
        if (stale) return { ok: true, status: 304, json: stale };
        // Fallback: re-fetch without ETag once
        response = await getOnce(false);
      }

      if (!response.ok) {
        if (response.status === 403) {
          // Rate limited: wait then retry once (untimed sleep — see note above)
          await sleep(this.rateLimitDelayMs);
          response = await getOnce(false);
        } else if (response.status === 401 && this.token) {
          // Token provided but unauthorized (token invalid or missing scope). Retry once without auth header.
          // This enables public-data fallback rather than failing entire build.
          response = await getOnce(false, { omitAuth: true });
        }
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const detail = text && text.length < 500 ? ` ${text}` : '';
        throw new Error(`GitHub API Error ${response.status} ${response.statusText}${detail}`);
      }

      const json = await response.json();
      const respEtag = response.headers.get('etag');
      if (etagKey && respEtag && cache) await cache.writeEtag(etagKey, respEtag);
      return { ok: true, status: response.status, json };
    } catch (error) {
      // AbortSignal.timeout aborts with a TimeoutError; a manual abort would be AbortError.
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new Error('Request timeout: GitHub API took too long to respond');
      }
      throw error;
    }
  }
}

export default GitHubClient;
