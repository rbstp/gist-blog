import assert from 'node:assert';
import { describe, it } from 'node:test';

import DataShaper from '../src/lib/DataShaper.ts';
import DateUtils from '../src/lib/DateUtils.ts';
import { tagHue, TAG_HUE_COUNT } from '../src/lib/TagPalette.ts';
import {
  EXCERPT_LENGTH,
  MAX_FILTER_TAGS,
  META_DESCRIPTION_LENGTH,
  NEW_POST_DAYS,
  OG_DIR,
  SITE_AUTHOR,
  SITE_ROLE,
  SITE_TAGLINE,
  SITE_TITLE,
  SITE_URL,
} from '../src/lib/config.ts';
import type { Post } from '../src/lib/types.ts';

/** Frozen clock so relative dates and `new` badges are assertable. */
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

describe('DataShaper.daysSince / displayDate', () => {
  const shaper = makeShaper();

  it('counts whole days against the injected clock', () => {
    assert.strictEqual(shaper.daysSince(daysAgo(0)), 0);
    assert.strictEqual(shaper.daysSince(daysAgo(1)), 1);
    assert.strictEqual(shaper.daysSince(daysAgo(42)), 42);
  });

  it('clamps future dates to zero and rejects invalid input', () => {
    assert.strictEqual(shaper.daysSince(new Date(NOW + 5 * DAY).toISOString()), 0);
    assert.strictEqual(shaper.daysSince('not a date'), Number.POSITIVE_INFINITY);
  });

  it('labels recent posts relatively', () => {
    assert.strictEqual(shaper.displayDate(daysAgo(0)), 'today');
    assert.strictEqual(shaper.displayDate(daysAgo(1)), 'yesterday');
    assert.strictEqual(shaper.displayDate(daysAgo(3)), '3 days ago');
    assert.strictEqual(shaper.displayDate(daysAgo(8)), 'last week');
    assert.strictEqual(shaper.displayDate(daysAgo(NEW_POST_DAYS)), '2 weeks ago');
  });

  it('switches to an absolute date past the recency window', () => {
    const old = daysAgo(NEW_POST_DAYS + 1);
    // Compared against DateUtils rather than a literal: formatting is timezone dependent.
    assert.strictEqual(shaper.displayDate(old), new DateUtils().formatISO(old, 'MMM d, yyyy'));
    assert.match(shaper.displayDate(old), /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });
});

describe('DataShaper.buildTagChips', () => {
  const shaper = makeShaper();

  it('pairs each tag with its palette hue', () => {
    assert.deepStrictEqual(shaper.buildTagChips(['ai', 'devops']), [
      { name: 'ai', hue: tagHue('ai') },
      { name: 'devops', hue: tagHue('devops') },
    ]);
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

  it('adds coloured tag chips, a summary and a social card path', () => {
    const post = makePost({ tags: ['ai', 'claudecode'] });
    const shaped = shaper.buildPostData(post);

    assert.strictEqual(shaped.hasTags, true);
    assert.deepStrictEqual(shaped.tagList.map((t) => t.name), ['ai', 'claudecode']);
    shaped.tagList.forEach((chip) => {
      assert.ok(chip.hue >= 0 && chip.hue < TAG_HUE_COUNT);
    });
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

  it('features only the newest post, and only once there is a grid to anchor', () => {
    const featured = shaper.buildIndexData(makePosts(3));
    assert.deepStrictEqual(featured.posts.map((p) => p.isFeatured), [true, false, false]);

    const tooFew = shaper.buildIndexData(makePosts(2));
    assert.deepStrictEqual(tooFew.posts.map((p) => p.isFeatured), [false, false]);
  });

  it('flags posts inside the recency window as new', () => {
    const data = shaper.buildIndexData([
      makePost({ id: 'fresh01234567', createdAt: daysAgo(2), updatedAt: daysAgo(2) }),
      makePost({ id: 'edge012345678', createdAt: daysAgo(NEW_POST_DAYS), updatedAt: daysAgo(NEW_POST_DAYS) }),
      makePost({ id: 'stale01234567', createdAt: daysAgo(NEW_POST_DAYS + 1), updatedAt: daysAgo(NEW_POST_DAYS + 1) }),
    ]);
    assert.deepStrictEqual(data.posts.map((p) => p.isNew), [true, true, false]);
    assert.strictEqual(data.posts[0]!.displayDate, '2 days ago');
  });

  it('ranks filter chips by usage, then alphabetically, and caps the row', () => {
    const posts = [
      makePost({ id: 'p1abcdefghij', tags: ['rare'] }),
      makePost({ id: 'p2abcdefghij', tags: ['common', 'beta'] }),
      makePost({ id: 'p3abcdefghij', tags: ['common', 'alpha'] }),
    ];
    const data = shaper.buildIndexData(posts);

    assert.deepStrictEqual(data.topTags.map((t) => [t.name, t.count]), [
      ['common', 2], ['alpha', 1], ['beta', 1], ['rare', 1],
    ]);
    data.topTags.forEach((chip) => assert.strictEqual(chip.hue, tagHue(chip.name)));
    // allTags stays alphabetical: it drives the client-side filter lookup.
    assert.deepStrictEqual(data.allTags, ['alpha', 'beta', 'common', 'rare']);
    assert.strictEqual(data.tagCount, 4);
  });

  it('caps the filter row at MAX_FILTER_TAGS', () => {
    const posts = makePosts(MAX_FILTER_TAGS + 6, (i) => [`tag-${i}`]);
    const data = shaper.buildIndexData(posts);
    assert.strictEqual(data.topTags.length, MAX_FILTER_TAGS);
    assert.strictEqual(data.tagCount, MAX_FILTER_TAGS + 6);
  });

  it('exposes hero copy and the newest post date', () => {
    const data = shaper.buildIndexData(makePosts(4));
    assert.strictEqual(data.role, SITE_ROLE);
    assert.strictEqual(data.tagline, SITE_TAGLINE);
    assert.strictEqual(data.author, SITE_AUTHOR);
    assert.strictEqual(data.latestPostDate, data.posts[0]!.formattedDate);
    assert.strictEqual(data.lastUpdate, new Date(NOW).toISOString());
  });

  it('handles an empty post list without throwing', () => {
    const data = shaper.buildIndexData([]);
    assert.strictEqual(data.postsLength, 0);
    assert.strictEqual(data.hasAnyTags, false);
    assert.deepStrictEqual(data.topTags, []);
    assert.strictEqual(data.pagination, null);
    assert.ok(typeof data.latestPostDate === 'string' && data.latestPostDate.length > 0);
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
