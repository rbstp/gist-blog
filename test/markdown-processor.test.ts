import assert from 'node:assert';
import { describe, it } from 'node:test';

import MarkdownProcessor from '../src/lib/MarkdownProcessor.ts';

const md = new MarkdownProcessor();

/** The build pipeline: anchors are injected into the markdown before rendering. */
function renderWithAnchors(source: string): string {
  return md.render(md.addPermalinkAnchors(source));
}

describe('MarkdownProcessor headings', () => {
  it('renders inline markdown inside headings', () => {
    const html = renderWithAnchors('## Core Setup: The `CLAUDE.md` File\n\nBody.\n');
    assert.ok(html.includes('<code>CLAUDE.md</code>'), 'code span in a heading should render');
    assert.ok(!html.includes('`CLAUDE.md`'), 'literal backticks leaked into the heading');
  });

  it('renders emphasis and links inside headings', () => {
    const html = renderWithAnchors('## Why *this* matters and [why not](https://example.com)\n');
    assert.ok(html.includes('<em>this</em>'));
    assert.ok(html.includes('<a href="https://example.com">why not</a>'));
  });

  it('adds a permalink anchor whose id matches the outline', () => {
    const source = '## Core Setup: The `CLAUDE.md` File\n\nBody.\n';
    const html = renderWithAnchors(source);
    const toc = md.extractToc(source);

    assert.strictEqual(toc.length, 1);
    const anchor = toc[0]!.anchor;
    assert.ok(html.includes(`<h2 id="${anchor}">`), `heading id should be ${anchor}`);
    assert.ok(html.includes(`href="#${anchor}" class="permalink"`));
  });

  it('keeps H1 out of the outline (the post title is rendered by the template)', () => {
    const source = '# Title\n\n## Section\n';
    assert.deepStrictEqual(md.extractToc(source).map((t) => t.title), ['Section']);
    // The H1 still renders, it simply never reaches the sidebar.
    assert.ok(renderWithAnchors(source).includes('<h1 '));
  });
});

describe('MarkdownProcessor.extractToc', () => {
  it('flattens markdown syntax out of outline entries', () => {
    const toc = md.extractToc('## The `--flag` option\n\n### Using *emphasis*\n');
    assert.deepStrictEqual(toc.map((t) => t.title), ['The --flag option', 'Using emphasis']);
    assert.deepStrictEqual(toc.map((t) => t.level), [2, 3]);
  });

  it('ignores H1 and code blocks that look like headings', () => {
    const toc = md.extractToc('# Title\n\n```\n## not a heading\n```\n\n## Real heading\n');
    assert.deepStrictEqual(toc.map((t) => t.title), ['not a heading', 'Real heading']);
  });
});

describe('MarkdownProcessor code blocks', () => {
  it('highlights fenced code at build time', () => {
    const html = md.render('```js\nconst x = 1;\n```\n');
    assert.ok(html.includes('class="hljs language-js"'));
    assert.ok(html.includes('hljs-keyword'), 'tokens should be classified at build time');
  });

  it('falls back to auto-detection for unlabelled fences', () => {
    const html = md.render('```\n{ "a": 1 }\n```\n');
    assert.match(html, /class="hljs language-[a-z0-9-]+"/);
  });
});

describe('MarkdownProcessor caching', () => {
  it('returns the cached render for a repeated key', () => {
    const first = md.render('# One\n', 'key-1');
    const second = md.render('# Two\n', 'key-1');
    assert.strictEqual(second, first, 'cache key should short-circuit the render');
  });
});
