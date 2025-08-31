const fs = require('fs').promises;
const path = require('path');

// Simple template loader with in-memory caching
class TemplateLoader {
  constructor(templatesDir = 'src/templates') {
    this.templatesDir = templatesDir;
    this.cache = new Map();
  }

  async load(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const full = path.join(this.templatesDir, name);
    try {
      const content = await fs.readFile(full, 'utf-8');
      this.cache.set(name, content);
      return content;
    } catch {
      throw new Error(`Template not found: ${name}`);
    }
  }

  async loadMany(names) {
    const out = {};
    for (const n of names) out[n] = await this.load(n);
    return out;
  }
}

module.exports = TemplateLoader;
