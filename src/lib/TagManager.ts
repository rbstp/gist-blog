export default class TagManager {
  private tagCache: Map<string, string[]>;

  constructor() {
    this.tagCache = new Map();
  }

  extract(description: string): string[] {
    if (this.tagCache.has(description)) return this.tagCache.get(description)!;
    const tagRegex = /#(\w+)/g;
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(description)) !== null) set.add(m[1]!.toLowerCase());
    const arr = Array.from(set).sort();
    this.tagCache.set(description, arr);
    return arr;
  }

  clean(description: string): string {
    return String(description)
      .replace(/#\w+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
