import { marked, type Tokens } from 'marked';
import hljs from 'highlight.js';
import StringUtils from './StringUtils.ts';
import type { TocItem } from './types.ts';

// Configure a renderer that adds permalink anchors, honoring custom {#id} anchor syntax.
// Uses the heading token's raw `text` (not parsed inline tokens) to match the original behavior.
const renderer = new marked.Renderer();
renderer.heading = function ({ text, depth }: Tokens.Heading): string {
  const m = text.match(/^(.*?)\s*\{#([^}]+)\}$/);
  const id = m ? (m[2] ?? '') : StringUtils.slugify(text);
  const clean = m ? (m[1] ?? '').trim() : text;
  return `<h${depth} id="${id}">${clean}<a href="#${id}" class="permalink" aria-label="Permalink">#</a></h${depth}>`;
};

// Highlight code blocks at build time so the shipped HTML already carries hljs classes
// (styled by src/styles/modules/syntax.css). marked v16 removed the `highlight` option, and
// no-language fences fall back to auto-detection to mirror the previous client-side highlightAll.
renderer.code = function ({ text, lang }: Tokens.Code): string {
  const result = lang && hljs.getLanguage(lang)
    ? hljs.highlight(text, { language: lang })
    : hljs.highlightAuto(text);
  const cls = lang || result.language || 'plaintext';
  return `<pre><code class="hljs language-${cls}">${result.value}</code></pre>`;
};

marked.setOptions({ renderer });

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
