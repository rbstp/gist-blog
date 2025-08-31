class TagManager {
  constructor() {
    this.tagCache = new Map();
  }

  extract(description) {
    if (this.tagCache.has(description)) return this.tagCache.get(description);
    const tagRegex = /#(\w+)/g;
    const set = new Set();
    let m;
    while ((m = tagRegex.exec(description)) !== null) set.add(m[1].toLowerCase());
    const arr = Array.from(set).sort();
    this.tagCache.set(description, arr);
    return arr;
  }

  clean(description) {
    return String(description)
      .replace(/#\w+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = TagManager;
