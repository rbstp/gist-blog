import { marked } from 'marked';
import hljs from 'highlight.js';
import StringUtils from './StringUtils.ts';
import type { TocItem } from './types.ts';

// Shape of the heading token marked v16 passes to renderer.heading.
interface HeadingToken {
  depth?: number;
  text?: string;
}

// Configure a renderer that adds permalink anchors when IDs are present
const renderer = new marked.Renderer();
renderer.heading = function (text: unknown, level?: number, raw?: string): string {
  let headingLevel = 1;
  let textStr = '';
  if (typeof text === 'object' && text !== null && (text as HeadingToken).depth && (text as HeadingToken).text) {
    headingLevel = (text as HeadingToken).depth as number; textStr = (text as HeadingToken).text as string;
  } else {
    headingLevel = level || 1;
    if (typeof text === 'string') textStr = text;
    else if (Array.isArray(text)) textStr = text.map((t: { text?: string }) => t.text || t).join('');
    else if (text && typeof text === 'object' && (text as HeadingToken).text) textStr = (text as HeadingToken).text as string;
    else textStr = raw || '';
  }

  // Check for custom anchor syntax {#id}
  const m = String(textStr).match(/^(.*?)\s*\{#([^}]+)\}$/);
  if (m) {
    const clean = (m[1] ?? '').trim();
    const id = m[2] ?? '';
    return `<h${headingLevel} id="${id}">${clean}<a href="#${id}" class="permalink" aria-label="Permalink">#</a></h${headingLevel}>`;
  }
  const id = StringUtils.slugify(textStr);
  return `<h${headingLevel} id="${id}">${textStr}<a href="#${id}" class="permalink" aria-label="Permalink">#</a></h${headingLevel}>`;
} as unknown as typeof renderer.heading;

marked.setOptions({
  renderer,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch { /* ignore */ }
    }
    return hljs.highlightAuto(code).value;
  },
} as unknown as Parameters<typeof marked.setOptions>[0]);

export default class MarkdownProcessor {
  cache: Map<string, string>;

  constructor() {
    this.cache = new Map();
  }

  render(content: string, cacheKey?: string): string {
    if (cacheKey && this.cache.has(cacheKey)) return this.cache.get(cacheKey) as string;
    const html = marked(String(content)) as string;
    if (cacheKey) this.cache.set(cacheKey, html);
    return html;
  }

  addPermalinkAnchors(md: string): string {
    return String(md).replace(/^(#{2,6})\s+(.+)$/gm, (_: string, hashes: string, title: string) => {
      const id = StringUtils.slugify(title);
      return `${hashes} ${title} {#${id}}`;
    });
  }

  extractToc(md: string): TocItem[] {
    const re = /^(#{2,6})\s+(.+)$/gm;
    const out: TocItem[] = [];
    let m: RegExpExecArray | null; let line = 1;
    while ((m = re.exec(md)) !== null) {
      const level = (m[1] ?? '').length;
      const title = (m[2] ?? '').trim();
      const anchor = StringUtils.slugify(title);
      out.push({ level, title, anchor, lineNumber: line++ });
    }
    return out;
  }
}
