const { marked } = require('marked');
const hljs = require('highlight.js');
const StringUtils = require('./StringUtils');

// Configure a renderer that adds permalink anchors when IDs are present
const renderer = new marked.Renderer();
renderer.heading = function (text, level, raw) {
  let headingLevel = 1;
  let textStr = '';
  if (typeof text === 'object' && text.depth && text.text) {
    headingLevel = text.depth; textStr = text.text;
  } else {
    headingLevel = level || 1;
    if (typeof text === 'string') textStr = text;
    else if (Array.isArray(text)) textStr = text.map(t => t.text || t).join('');
    else if (text && typeof text === 'object' && text.text) textStr = text.text;
    else textStr = raw || '';
  }

  // Check for custom anchor syntax {#id}
  const m = String(textStr).match(/^(.*?)\s*\{#([^}]+)\}$/);
  if (m) {
    const clean = m[1].trim();
    const id = m[2];
    return `<h${headingLevel} id="${id}">${clean}<a href="#${id}" class="permalink" aria-label="Permalink">#</a></h${headingLevel}>`;
  }
  const id = StringUtils.slugify(textStr);
  return `<h${headingLevel} id="${id}">${textStr}<a href="#${id}" class="permalink" aria-label="Permalink">#</a></h${headingLevel}>`;
};

marked.setOptions({
  renderer,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch { /* ignore */ }
    }
    return hljs.highlightAuto(code).value;
  }
});

class MarkdownProcessor {
  constructor() {
    this.cache = new Map();
  }

  render(content, cacheKey) {
    if (cacheKey && this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const html = marked(String(content));
    if (cacheKey) this.cache.set(cacheKey, html);
    return html;
  }

  addPermalinkAnchors(md) {
    return String(md).replace(/^(#{2,6})\s+(.+)$/gm, (_, hashes, title) => {
      const id = StringUtils.slugify(title);
      return `${hashes} ${title} {#${id}}`;
    });
  }

  extractToc(md) {
    const re = /^(#{2,6})\s+(.+)$/gm;
    const out = [];
    let m; let line = 1;
    while ((m = re.exec(md)) !== null) {
      const level = m[1].length;
      const title = m[2].trim();
      const anchor = StringUtils.slugify(title);
      out.push({ level, title, anchor, lineNumber: line++ });
    }
    return out;
  }
}

module.exports = MarkdownProcessor;
