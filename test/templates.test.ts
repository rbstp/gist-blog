import assert from 'node:assert';
import { describe, it, before } from 'node:test';

import TemplateEngine from '../src/lib/TemplateEngine.ts';
import DataShaper from '../src/lib/DataShaper.ts';
import DateUtils from '../src/lib/DateUtils.ts';
import { tagHue } from '../src/lib/TagPalette.ts';
import { SITE_TITLE, SITE_URL } from '../src/lib/config.ts';
import type { Post } from '../src/lib/types.ts';

const NOW = Date.parse('2025-06-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const engine = new TemplateEngine('src/templates');
const shaper = new DataShaper({
  formatDate: (iso, fmt) => new DateUtils().formatISO(iso, fmt),
  now: (fmt) => new DateUtils().now(fmt),
  nowMs: () => NOW,
});

function makePost(i: number, overrides: Partial<Post> = {}): Post {
  const createdAt = new Date(NOW - i * 3 * DAY).toISOString();
  return {
    id: `id${String(i).padStart(10, '0')}`,
    title: `Post number ${i}`,
    description: `Description for post ${i}`,
    content: `Body of post ${i}.`,
    htmlContent: `<p>Body of post ${i}.</p>`,
    createdAt,
    updatedAt: createdAt,
    url: `https://gist.github.com/rbstp/id${i}`,
    files: ['post.md'],
    tags: ['ai', 'devops'],
    filename: 'post.md',
    wordCount: 4,
    readingTime: '1 min',
    toc: [],
    hasToc: false,
    ...overrides,
  };
}

/** Render while capturing TemplateEngine's "variable is undefined" warnings. */
function renderStrict(template: string, data: Record<string, unknown>): { html: string; warnings: string[] } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  try {
    return { html: engine.render(template, data), warnings };
  } finally {
    console.warn = original;
  }
}

describe('index template', () => {
  let html = '';
  let warnings: string[] = [];

  before(async () => {
    const template = await engine.loadTemplate('index.html');
    const posts = Array.from({ length: 7 }, (_, i) => makePost(i));
    // Give one post an untagged, description-less shape to exercise the optional blocks.
    posts[3] = makePost(3, { tags: [], description: '', content: '' });
    ({ html, warnings } = renderStrict(template, shaper.buildIndexData(posts)));
  });

  it('renders every variable it references', () => {
    assert.deepStrictEqual(warnings, []);
    assert.ok(!html.includes('{{'), 'unresolved template tag left in output');
  });

  it('renders the hero with role, name, tagline and counts', () => {
    assert.ok(html.includes('class="hero"'));
    assert.ok(html.includes('class="hero-eyebrow"'));
    assert.ok(html.includes('class="hero-name"'));
    assert.ok(html.includes('class="hero-tagline"'));
    assert.match(html, /<strong>7<\/strong> posts/);
    assert.match(html, /<strong>2<\/strong> topics/);
  });

  it('promotes exactly one featured card', () => {
    assert.strictEqual((html.match(/class="post-card is-featured"/g) ?? []).length, 1);
    assert.strictEqual((html.match(/class="post-card"/g) ?? []).length, 6);
    // The featured card is the first one in document order.
    assert.ok(html.indexOf('is-featured') < html.indexOf('class="post-card"'));
  });

  it('renders a topic filter bar with hue-coded chips', () => {
    assert.ok(html.includes('class="topic-bar"'));
    assert.ok(html.includes(`data-tag="ai" data-hue="${tagHue('ai')}"`));
    assert.ok(html.includes(`data-tag="devops" data-hue="${tagHue('devops')}"`));
    assert.ok(html.includes('class="tag-count"'));
    // Filter chips are buttons, so keyboard users get them for free.
    assert.ok(html.includes('<button type="button" class="tag"'));
  });

  it('shows a New badge only for posts inside the recency window', () => {
    // Posts are 0, 3, 6, 9, 12, 15 and 18 days old; NEW_POST_DAYS defaults to 14.
    assert.strictEqual((html.match(/class="badge-new"/g) ?? []).length, 5);
  });

  it('uses relative dates for recent posts', () => {
    assert.ok(html.includes('>today</time>'));
    assert.ok(html.includes('>3 days ago</time>'));
  });

  it('omits the excerpt and tag row when a post has neither', () => {
    assert.strictEqual((html.match(/class="card-excerpt"/g) ?? []).length, 6);
    assert.strictEqual((html.match(/class="card-tags"/g) ?? []).length, 6);
  });

  it('links every card to its post and source gist', () => {
    assert.strictEqual((html.match(/href="\/posts\/id\d+\.html"/g) ?? []).length, 7);
    assert.strictEqual((html.match(/class="card-source"/g) ?? []).length, 7);
    assert.ok(html.includes('rel="noopener noreferrer"'));
  });

  it('renders the pager when there is more than one page', () => {
    assert.ok(html.includes('id="pagination-section"'));
    assert.ok(html.includes('aria-label="Pagination"'));
  });

  it('drops the pager for a single page of posts', () => {
    const template = engine.render('{{#pagination}}pager{{/pagination}}', shaper.buildIndexData([makePost(0)]));
    assert.strictEqual(template, '');
  });
});

describe('post template', () => {
  let html = '';
  let warnings: string[] = [];

  before(async () => {
    const template = await engine.loadTemplate('post.html');
    const post = makePost(1, {
      title: 'Reading the docs',
      tags: ['ai', 'howto'],
      hasToc: true,
      toc: [
        { level: 2, title: 'First section', anchor: 'first-section', lineNumber: 3 },
        { level: 3, title: 'Nested bit', anchor: 'nested-bit', lineNumber: 7 },
      ],
    });
    ({ html, warnings } = renderStrict(template, shaper.buildPostData(post)));
  });

  it('renders every variable it references', () => {
    assert.deepStrictEqual(warnings, []);
    assert.ok(!html.includes('{{'), 'unresolved template tag left in output');
  });

  it('renders article chrome: back link, source link, kicker and title', () => {
    assert.ok(html.includes('class="article-nav"'));
    assert.ok(html.includes('href="/" class="back-link"'));
    assert.ok(html.includes('class="source-link"'));
    assert.ok(html.includes('class="article-kicker"'));
    assert.ok(html.includes('<h1 class="article-title">Reading the docs</h1>'));
    assert.ok(html.includes('1 min read'));
  });

  it('renders hue-coded topic chips as buttons', () => {
    assert.ok(html.includes(`class="tag post-tag" data-tag="ai" data-hue="${tagHue('ai')}"`));
    assert.ok(html.includes(`class="tag post-tag" data-tag="howto" data-hue="${tagHue('howto')}"`));
  });

  it('renders the outline sidebar and marks the layout as two-column', () => {
    assert.ok(html.includes('post-content-wrapper has-sidebar'));
    assert.ok(html.includes('class="toc-sidebar"'));
    assert.ok(html.includes('aria-label="Article outline"'));
    assert.ok(html.includes('class="toc-item toc-level-2"'));
    assert.ok(html.includes('href="#first-section"'));
    assert.ok(html.includes('class="graph-panel"'));
    assert.ok(html.includes('data-all-topics="ai,howto"'));
  });

  it('injects the rendered markdown unescaped into the article body', () => {
    assert.ok(html.includes('<div class="article-body">'));
    assert.ok(html.includes('<p>Body of post 1.</p>'));
  });

  it('drops the sidebar entirely when a post has no headings', async () => {
    const template = await engine.loadTemplate('post.html');
    const { html: bare } = renderStrict(template, shaper.buildPostData(makePost(2)));
    assert.ok(!bare.includes('toc-sidebar'));
    assert.ok(!bare.includes('has-sidebar'));
    assert.ok(!bare.includes('graph-panel'));
  });

  it('escapes titles that contain markup', async () => {
    const template = await engine.loadTemplate('post.html');
    const { html: escaped } = renderStrict(template, shaper.buildPostData(makePost(3, { title: '<script>x</script>' })));
    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
  });
});

describe('graph template', () => {
  it('renders a search field, legend and stats caption', async () => {
    const template = await engine.loadTemplate('graph.html');
    const { html, warnings } = renderStrict(template, {});
    assert.deepStrictEqual(warnings, []);
    assert.ok(html.includes('id="graph-search-input"'));
    assert.ok(html.includes('type="search"'));
    assert.ok(html.includes('aria-label="Search topics"'));
    assert.ok(html.includes('id="graph-stats"'));
    assert.ok(html.includes('id="global-tag-graph"'));
  });
});

describe('layout template', () => {
  let html = '';
  let warnings: string[] = [];

  before(async () => {
    const template = await engine.loadTemplate('layout.html');
    const meta = shaper.buildPageMeta({
      title: 'Reading the docs',
      description: 'How to read the docs without losing your mind.',
      path: '/posts/abc.html',
      image: '/og/abc.png',
      type: 'article',
    });
    ({ html, warnings } = renderStrict(template, { ...meta, content: '<p>page</p>', timestamp: 1234 }));
  });

  it('renders every variable it references', () => {
    assert.deepStrictEqual(warnings, []);
    assert.ok(!html.includes('{{'), 'unresolved template tag left in output');
  });

  it('sets the document title from the page metadata', () => {
    assert.ok(html.includes(`<title>Reading the docs · ${SITE_TITLE}</title>`));
  });

  it('emits canonical, Open Graph and Twitter metadata', () => {
    assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/posts/abc.html">`));
    assert.ok(html.includes('<meta property="og:type" content="article">'));
    assert.ok(html.includes(`<meta property="og:image" content="${SITE_URL}/og/abc.png">`));
    assert.ok(html.includes('<meta property="og:image:width" content="1200">'));
    assert.ok(html.includes('<meta property="og:image:height" content="630">'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
    assert.match(html, /<meta name="description" content="How to read the docs[^"]*">/);
  });

  it('keeps the accessibility scaffolding', () => {
    assert.ok(html.includes('class="skip-link" href="#main"'));
    assert.ok(html.includes('id="main"'));
    assert.ok(html.includes('aria-label="Main"'));
    assert.ok(html.includes('aria-label="Toggle colour theme"'));
  });

  it('injects the page content unescaped', () => {
    assert.ok(html.includes('<p>page</p>'));
  });

  it('references only icons defined in the sprite', () => {
    const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(symbols.size > 0, 'sprite should define symbols');
    for (const [, id] of html.matchAll(/<use href="#([^"]+)"/g)) {
      assert.ok(symbols.has(id), `layout uses #${id} which the sprite does not define`);
    }
  });

  it('busts caches for styles and scripts with the build timestamp', () => {
    assert.ok(html.includes('/styles.css?v=1234'));
    assert.ok(html.includes('/assets/main.js?v=1234'));
    assert.ok(html.includes('data-build-ts="1234"'));
  });
});
