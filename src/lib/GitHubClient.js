const { USER_AGENT, RATE_LIMIT_DELAY_MS, GITHUB_TOKEN } = require('./config');

class GitHubClient {
  constructor({ token = GITHUB_TOKEN, rateLimitDelayMs = RATE_LIMIT_DELAY_MS } = {}) {
    this.token = token || '';
    this.rateLimitDelayMs = rateLimitDelayMs;
  }

  headers(extra = {}) {
    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/vnd.github+json',
      ...extra,
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async fetchJson(url, { etagKey, cache, timeoutMs = 30_000, useEtag = true } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const getOnce = async (withEtag) => {
      const etag = withEtag && etagKey ? await cache.readEtag(etagKey) : '';
      const res = await fetch(url, {
        headers: this.headers(etag ? { 'If-None-Match': etag } : undefined),
        signal: controller.signal,
      });
      return res;
    };

    try {
      let response = await getOnce(useEtag);

      if (response.status === 304) {
        clearTimeout(timeoutId);
        // Use stale cache regardless of TTL
        const stale = await cache.readJson(etagKey, Number.MAX_SAFE_INTEGER);
        if (stale) return { ok: true, status: 304, json: stale };
        // Fallback: re-fetch without ETag once
        response = await getOnce(false);
      }

      if (!response.ok) {
        if (response.status === 403) {
          // Rate limited: wait then retry once
          await new Promise((r) => setTimeout(r, this.rateLimitDelayMs));
          response = await getOnce(false);
        }
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`GitHub API Error ${response.status} ${response.statusText} ${text}`);
      }

      const json = await response.json();
      const respEtag = response.headers.get('etag');
      if (etagKey && respEtag) await cache.writeEtag(etagKey, respEtag);
      return { ok: true, status: response.status, json };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: GitHub API took too long to respond');
      }
      throw error;
    }
  }
}

module.exports = GitHubClient;
