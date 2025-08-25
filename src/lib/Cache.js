const fs = require('fs').promises;
const path = require('path');
const { CACHE_DIR, ENABLE_CACHE } = require('./config');

class Cache {
  constructor(baseDir = CACHE_DIR, enabled = ENABLE_CACHE) {
    this.baseDir = baseDir;
    this.enabled = enabled;
  }

  async ensureDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async readJson(relPath, ttlMs) {
    if (!this.enabled) return null;
    try {
      const full = path.join(this.baseDir, relPath);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) return null;
      const age = Date.now() - stat.mtimeMs;
      if (typeof ttlMs === 'number' && age > ttlMs) return null;
      const buf = await fs.readFile(full, 'utf-8');
      return JSON.parse(buf);
    } catch {
      return null;
    }
  }

  async writeJson(relPath, data) {
    if (!this.enabled) return;
    try {
      await this.ensureDir();
      const full = path.join(this.baseDir, relPath);
      await fs.writeFile(full, JSON.stringify(data));
    } catch {
      // ignore cache errors
    }
  }

  async readEtag(key) {
    try {
      const full = path.join(this.baseDir, `${key}.etag`);
      const etag = await fs.readFile(full, 'utf-8').catch(() => '');
      return etag || '';
    } catch {
      return '';
    }
  }

  async writeEtag(key, etag) {
    try {
      if (!etag) return;
      await this.ensureDir();
      const full = path.join(this.baseDir, `${key}.etag`);
      await fs.writeFile(full, etag);
    } catch {
      // ignore
    }
  }
}

module.exports = Cache;
