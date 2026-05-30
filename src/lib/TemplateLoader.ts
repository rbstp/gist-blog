import { promises as fs } from 'node:fs';
import path from 'node:path';

// Simple template loader with in-memory caching
export default class TemplateLoader {
  templatesDir: string;
  cache: Map<string, string>;
  enableCache: boolean;

  constructor(templatesDir: string = 'src/templates') {
    this.templatesDir = templatesDir;
    this.cache = new Map();
    this.enableCache = String(process.env.TEMPLATE_CACHE || 'true').toLowerCase() !== 'false';
  }

  async load(name: string): Promise<string> {
    if (this.enableCache && this.cache.has(name)) return this.cache.get(name) as string;
    const full = path.join(this.templatesDir, name);
    try {
      const content = await fs.readFile(full, 'utf-8');
      if (this.enableCache) this.cache.set(name, content);
      return content;
    } catch {
      throw new Error(`Template not found: ${name}`);
    }
  }

  async loadMany(names: string[]): Promise<Record<string, string>> {
    const loaded = await Promise.all(names.map(async (n) => [n, await this.load(n)] as const));
    return Object.fromEntries(loaded);
  }
}
