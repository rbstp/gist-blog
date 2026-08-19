import assert from 'node:assert';
import { describe, it } from 'node:test';

import DataShaper from '../src/lib/DataShaper.ts';
import DateUtils from '../src/lib/DateUtils.ts';
import {
  EXCERPT_LENGTH,
  MAX_FILTER_TAGS,
  META_DESCRIPTION_LENGTH,
  OG_DIR,
  SITE_AUTHOR,
  SITE_ROLE,
  SITE_TAGLINE,
  SITE_TITLE,
  SITE_URL,
} from '../src/lib/config.ts';
import type { Post } from '../src/lib/types.ts';

/** Frozen clock so generated dates are assertable. */
const NOW = Date.parse('2025-06-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** ISO timestamp for a post published `days` before the frozen clock. */
function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

function makeShaper(): DataShaper {
  const dates = new DateUtils();
  return new DataShaper({
    formatDate: (iso, fmt) => dates.formatISO(iso, fmt),
    now: (fmt) => dates.now(fmt),
    nowMs: () => NOW,
  });
}

function makePost(overrides: Partial<Post> = {}): Post {
  const createdAt = overrides.createdAt ?? daysAgo(100);
  return {
    id: 'abcdef1234567890',
    title: 'A post title',
    description: 'A hand written description',
    content: 'Body copy for the post.',
    htmlContent: '<p>Body copy for the post.</p>',
    createdAt,
    updatedAt: createdAt,
    url: 'https://gist.github.com/rbstp/abcdef1234567890',
    files: ['post.md'],
    tags: ['ai', 'devops'],
    filename: 'post.md',
    wordCount: 5,
    readingTime: '1 min',
    toc: [],
    hasToc: false,
    ...overrides,
  };
}

describe('DataShaper.buildTagChips', () => {
  const shaper = makeShaper();

  it('wraps each topic in the shape the template engine iterates', () => {
    assert.deepStrictEqual(shaper.buildTagChips(['ai', 'devops']), [{ name: 'ai' }, { name: 'devops' }]);
  });

  it('returns an empty list for missing tags', () => {
    assert.deepStrictEqual(shaper.buildTagChips(undefined), []);
  });
});

describe('DataShaper.buildExcerpt', () => {
  const shaper = makeShaper();

  it('prefers the gist description', () => {
    assert.strictEqual(
      shaper.buildExcerpt(makePost({ description: 'Short and sweet', content: 'Body copy.' })),
      'Short and sweet'
    );
  });

  it('falls back to the body when the description just echoes the title', () => {
    // GistParser defaults a missing description to the title, which would duplicate the heading.
    const post = makePost({ title: 'Introducing Skills', description: 'introducing skills', content: 'Why skills matter.' });
    assert.strictEqual(shaper.buildExcerpt(post), 'Why skills matter.');
  });

  it('falls back to the body for the parser placeholder', () => {
    const post = makePost({ description: 'No description', content: 'Actual prose.' });
    assert.strictEqual(shaper.buildExcerpt(post), 'Actual prose.');
  });

  it('strips markdown and truncates long bodies', () => {
    const post = makePost({ description: '', content: `# Heading\n\n${'word '.repeat(200)}` });
    const excerpt = shaper.buildExcerpt(post);
    assert.ok(!excerpt.includes('#'));
    assert.ok(excerpt.length <= EXCERPT_LENGTH + 1);
    assert.ok(excerpt.endsWith('\u2026'));
  });
});

describe('DataShaper.buildPostData', () => {
  const shaper = makeShaper();

  it('adds topics, a summary and a social card path', () => {
    const post = makePost({ tags: ['ai', 'claudecode'] });
    const shaped = shaper.buildPostData(post);

    assert.strictEqual(shaped.hasTags, true);
    assert.deepStrictEqual(shaped.tagList.map((t) => t.name), ['ai', 'claudecode']);
    assert.strictEqual(shaped.summary, 'A hand written description');
    assert.strictEqual(shaped.ogImage, `/${OG_DIR}/${post.id}.png`);
  });

  it('marks untagged posts and keeps the existing shape', () => {
    const shaped = shaper.buildPostData(makePost({ tags: [] }));
    assert.strictEqual(shaped.hasTags, false);
    assert.deepStrictEqual(shaped.tagList, []);
    assert.strictEqual(shaped.currentTopic, '');
    assert.strictEqual(shaped.tagsCsv, '');
    assert.strictEqual(shaped.shortId.length, 7);
  });

  it('caps the summary at the meta description length', () => {
    const shaped = shaper.buildPostData(makePost({ description: 'x'.repeat(400) }));
    assert.ok(shaped.summary.length <= META_DESCRIPTION_LENGTH + 1);
  });
});

describe('DataShaper.buildIndexData', () => {
  const shaper = makeShaper();

  function makePosts(count: number, tagsFor: (i: number) => string[] = () => ['ai']): Post[] {
    return Array.from({ length: count }, (_, i) => makePost({
      id: `id${String(i).padStart(6, '0')}${i}`,
      title: `Post ${i}`,
      description: `Description ${i}`,
      content: `Content ${i}`,
      createdAt: daysAgo(i * 30),
      updatedAt: daysAgo(i * 30),
      tags: tagsFor(i),
    }));
  }

  it('treats every entry the same: no promotion, one date format', () => {
    const dates = new DateUtils();
    const data = shaper.buildIndexData([
      makePost({ id: 'fresh01234567', createdAt: daysAgo(0), updatedAt: daysAgo(0) }),
      makePost({ id: 'stale01234567', createdAt: daysAgo(400), updatedAt: daysAgo(400) }),
    ]);

    // Compared against DateUtils rather than literals: formatting is timezone dependent.
    assert.deepStrictEqual(
      data.posts.map((p) => p.formattedDate),
      [dates.formatISO(daysAgo(0), 'MMM d, yyyy'), dates.formatISO(daysAgo(400), 'MMM d, yyyy')]
    );
    for (const post of data.posts) {
      assert.match(post.formattedDate, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    }
  });

  it('ranks filter topics by usage, then alphabetically, and caps the row', () => {
    const posts = [
      makePost({ id: 'p1abcdefghij', tags: ['rare'] }),
      makePost({ id: 'p2abcdefghij', tags: ['common', 'beta'] }),
      makePost({ id: 'p3abcdefghij', tags: ['common', 'alpha'] }),
    ];
    const data = shaper.buildIndexData(posts);

    assert.deepStrictEqual(data.topTags.map((t) => [t.name, t.count]), [
      ['common', 2], ['alpha', 1], ['beta', 1], ['rare', 1],
    ]);
    // allTags stays alphabetical: it drives the client-side filter lookup.
    assert.deepStrictEqual(data.allTags, ['alpha', 'beta', 'common', 'rare']);
  });

  it('caps the filter row at MAX_FILTER_TAGS', () => {
    const posts = makePosts(MAX_FILTER_TAGS + 6, (i) => [`tag-${i}`]);
    const data = shaper.buildIndexData(posts);
    assert.strictEqual(data.topTags.length, MAX_FILTER_TAGS);
    assert.strictEqual(data.allTags.length, MAX_FILTER_TAGS + 6);
  });

  it('exposes the masthead copy', () => {
    const data = shaper.buildIndexData(makePosts(4));
    assert.strictEqual(data.role, SITE_ROLE);
    assert.strictEqual(data.tagline, SITE_TAGLINE);
    assert.strictEqual(data.author, SITE_AUTHOR);
    assert.strictEqual(data.lastUpdate, new Date(NOW).toISOString());
  });

  it('handles an empty post list without throwing', () => {
    const data = shaper.buildIndexData([]);
    assert.strictEqual(data.postsLength, 0);
    assert.strictEqual(data.hasAnyTags, false);
    assert.deepStrictEqual(data.topTags, []);
    assert.strictEqual(data.pagination, null);
    assert.deepStrictEqual(data.posts, []);
  });
});

describe('DataShaper.buildPageMeta', () => {
  const shaper = makeShaper();

  it('builds absolute canonical and image URLs', () => {
    const meta = shaper.buildPageMeta({
      title: 'Post title',
      description: 'A description of the page.',
      path: '/posts/abc.html',
      image: '/og/abc.png',
      type: 'article',
    });

    assert.strictEqual(meta.canonicalUrl, `${SITE_URL}/posts/abc.html`);
    assert.strictEqual(meta.ogImageUrl, `${SITE_URL}/og/abc.png`);
    assert.strictEqual(meta.ogTitle, 'Post title');
    assert.strictEqual(meta.ogType, 'article');
    assert.strictEqual(meta.siteName, SITE_TITLE);
    assert.strictEqual(meta.author, SITE_AUTHOR);
    assert.strictEqual(meta.ogImageAlt, `Post title — ${SITE_TITLE}`);
  });

  it('normalises paths that omit the leading slash', () => {
    const meta = shaper.buildPageMeta({ title: 'T', description: 'D', path: 'graph.html', image: 'og/index.png' });
    assert.strictEqual(meta.canonicalUrl, `${SITE_URL}/graph.html`);
    assert.strictEqual(meta.ogImageUrl, `${SITE_URL}/og/index.png`);
  });

  it('defaults the type to website', () => {
    const meta = shaper.buildPageMeta({ title: 'T', description: 'D', path: '/', image: '/og/index.png' });
    assert.strictEqual(meta.ogType, 'website');
  });

  it('summarises long descriptions and falls back to the site copy', () => {
    const long = shaper.buildPageMeta({ title: 'T', description: 'word '.repeat(200), path: '/', image: '/og/index.png' });
    assert.ok(long.metaDescription.length <= META_DESCRIPTION_LENGTH + 1);

    const empty = shaper.buildPageMeta({ title: 'T', description: '', path: '/', image: '/og/index.png' });
    assert.strictEqual(empty.metaDescription, `${SITE_ROLE}. ${SITE_TAGLINE}`);
  });
});
