import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, ENABLE_CACHE } from './config.ts';

export default class Cache {
  baseDir: string;
  enabled: boolean;

  constructor(baseDir: string = CACHE_DIR, enabled: boolean = ENABLE_CACHE) {
    this.baseDir = baseDir;
    this.enabled = enabled;
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async readJson<T = unknown>(relPath: string, ttlMs: number): Promise<T | null> {
    if (!this.enabled) return null;
    try {
      const full = path.join(this.baseDir, relPath);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) return null;
      const age = Date.now() - stat.mtimeMs;
      if (typeof ttlMs === 'number' && age > ttlMs) return null;
      const buf = await fs.readFile(full, 'utf-8');
      return JSON.parse(buf) as T;
    } catch {
      return null;
    }
  }

  async writeJson(relPath: string, data: unknown): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.ensureDir();
      const full = path.join(this.baseDir, relPath);
      await fs.writeFile(full, JSON.stringify(data));
    } catch {
      // ignore cache errors
    }
  }

  async readEtag(key: string): Promise<string> {
    try {
      const full = path.join(this.baseDir, `${key}.etag`);
      const etag = await fs.readFile(full, 'utf-8').catch(() => '');
      return etag || '';
    } catch {
      return '';
    }
  }

  async writeEtag(key: string, etag: string): Promise<void> {
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
