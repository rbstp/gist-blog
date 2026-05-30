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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const getOnce = async (withEtag: boolean, { omitAuth }: GetOnceOptions = {}): Promise<Response> => {
      const etag = withEtag && etagKey && cache ? await cache.readEtag(etagKey) : '';
      const baseHeaders = this.headers(etag ? { 'If-None-Match': etag } : undefined);
      if (omitAuth) delete baseHeaders['Authorization'];
      return fetch(url, {
        headers: baseHeaders,
        signal: controller.signal,
      });
    };

    try {
      let response = await getOnce(useEtag);

      if (response.status === 304) {
        clearTimeout(timeoutId);
        // Use stale cache regardless of TTL
        const stale = etagKey && cache ? await cache.readJson(etagKey, Number.MAX_SAFE_INTEGER) : null;
        if (stale) return { ok: true, status: 304, json: stale };
        // Fallback: re-fetch without ETag once
        response = await getOnce(false);
      }

      if (!response.ok) {
        if (response.status === 403) {
          // Rate limited: wait then retry once
          await new Promise<void>((r) => setTimeout(r, this.rateLimitDelayMs));
          response = await getOnce(false);
        } else if (response.status === 401 && this.token) {
          // Token provided but unauthorized (token invalid or missing scope). Retry once without auth header.
          // This enables public-data fallback rather than failing entire build.
          response = await getOnce(false, { omitAuth: true });
        }
      }

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: GitHub API took too long to respond');
      }
      throw error;
    }
  }
}

export default GitHubClient;
