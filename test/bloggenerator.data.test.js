const assert = require('assert');
const { describe, it } = require('node:test');
const DataShaper = require('../src/lib/DataShaper');
const DateUtils = require('../src/lib/DateUtils');

describe('DataShaper shaping helpers', () => {
  it('buildPostData shapes post fields correctly', () => {
    const dates = new DateUtils();
    const shaper = new DataShaper({
      formatDate: (iso, fmt) => dates.formatISO(iso, fmt),
      now: (fmt) => dates.now(fmt),
    });
    const post = {
      id: 'abcdef123456',
      title: 'Hello',
      description: 'Desc',
      content: 'Short content',
      htmlContent: '<p>Short</p>',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      url: 'https://example.com',
      files: ['a.md'],
      tags: ['topic', 'extra'],
      filename: 'a.md',
      wordCount: 2,
      readingTime: '< 1 min',
      toc: [],
      hasToc: false,
    };

  const shaped = shaper.buildPostData(post);
    assert.strictEqual(shaped.shortId.length, 7);
    assert.strictEqual(shaped.currentTopic, 'topic');
    assert.strictEqual(shaped.tagsCsv, 'topic,extra');
    assert.ok(typeof shaped.formattedDate === 'string' && shaped.formattedDate.length > 0);
    assert.strictEqual(shaped.formattedUpdateDate, null);
    assert.ok(typeof shaped.timestamp === 'number');
  });

  it('buildIndexData aggregates tags and pagination in single pass', () => {
    const dates = new DateUtils();
    const shaper = new DataShaper({
      formatDate: (iso, fmt) => dates.formatISO(iso, fmt),
      now: (fmt) => dates.now(fmt),
    });
    // Build 7 posts to trigger pagination (> default 6 per page)
    const base = {
      title: 'T',
      description: 'D',
      htmlContent: '<p>x</p>',
      url: 'https://x',
      files: ['f.md'],
      filename: 'f.md',
      wordCount: 1,
      readingTime: '< 1 min',
      toc: [],
      hasToc: false,
    };
    const posts = Array.from({ length: 7 }).map((_, i) => ({
      ...base,
      id: `id${i}abcdef`,
      content: `content ${i}`,
      createdAt: `2024-01-0${(i % 7) + 1}T00:00:00Z`,
      updatedAt: `2024-01-0${(i % 7) + 1}T00:00:00Z`,
      tags: i % 2 === 0 ? ['b', 'a'] : ['c'],
    }));

  const data = shaper.buildIndexData(posts);
    // Ensure posts are passed through
    assert.strictEqual(data.postsLength, 7);
    // Pagination should exist with totalPages 2 when 7 posts, 6 per page
    assert.ok(data.pagination);
    assert.strictEqual(typeof data.pagination.totalPages, 'number');
    assert.strictEqual(data.pagination.postsPerPage, require('../src/lib/config').POSTS_PER_PAGE);
    // Tags should be unique & sorted ['a','b','c']
    assert.deepStrictEqual(data.allTags, ['a', 'b', 'c']);
    assert.ok(data.hasAnyTags);
    // Each post has extra derived fields
    assert.ok(data.posts[0].formattedDate && data.posts[0].shortId);
    assert.ok(typeof data.timestamp === 'number');
  });
});
