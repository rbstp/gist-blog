import assert from 'node:assert';
import { describe, it } from 'node:test';
import GistParser from '../src/lib/GistParser.ts';
import type { Gist } from '../src/lib/types.ts';

describe('GistParser', () => {
  const parser = new GistParser('me');

  it('extracts and cleans tags from description', () => {
    const desc = 'A post about stuff #AI #devOps and more #AI';
    const tags = parser.extractTags(desc);
    const clean = parser.cleanDescriptionFromTags(desc);
    assert.deepStrictEqual(tags, ['ai', 'devops']);
    assert.strictEqual(clean.includes('#'), false);
  });

  it('transforms internal gist links to post links', () => {
    const content = 'See https://gist.github.com/me/abc123 for details';
    const out = parser.transformGistLinks(content, 'me');
    assert.ok(out.includes('/posts/abc123.html'));
  });

  it('generates ToC and anchors for headings', () => {
    const md = '# Title\n\n## Section One\ncontent\n\n### Sub\n';
    const toc = parser.generateTableOfContents(md);
    const withAnchors = parser.addPermalinkAnchors(md);
    assert.ok(toc.length >= 2);
    assert.ok(withAnchors.includes('{#section-one}'));
  });

  it('parses gist into post object', () => {
    const gist = {
      id: 'abc123',
      description: 'My post #tag1 #tag2',
      public: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      html_url: 'https://gist.github.com/me/abc123',
      url: 'https://api.github.com/gists/abc123',
      files: {
        'post.md': { filename: 'post.md', content: '# Title\n\n## Section\nHello world' },
      },
    } as Gist;
    const post = parser.parseGistAsPost(gist);
    assert.ok(post);
    assert.strictEqual(post.id, 'abc123');
    assert.strictEqual(post.title, 'Title');
    assert.deepStrictEqual(post.tags, ['tag1', 'tag2']);
    // Should include permalink anchors for headings; look for an id attribute
    assert.ok(/<h[2-6]\s+id=/.test(post.htmlContent));
  });
});
