import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';

import OgImageGenerator, {
  OG_WIDTH,
  OG_HEIGHT,
  escapeXml,
  wrapText,
  fitTitle,
} from '../src/lib/OgImageGenerator.ts';

describe('escapeXml', () => {
  it('escapes the five XML entities', () => {
    assert.strictEqual(
      escapeXml(`Tips & tricks: <b>"quoted"</b> & 'single'`),
      'Tips &amp; tricks: &lt;b&gt;&quot;quoted&quot;&lt;/b&gt; &amp; &apos;single&apos;'
    );
  });

  it('escapes ampersands before the other entities (no double-encoding)', () => {
    assert.strictEqual(escapeXml('a & b'), 'a &amp; b');
    assert.strictEqual(escapeXml('&amp;'), '&amp;amp;');
  });

  it('tolerates nullish input', () => {
    assert.strictEqual(escapeXml(undefined as unknown as string), '');
  });
});

describe('wrapText', () => {
  it('greedily fills lines up to the budget', () => {
    assert.deepStrictEqual(wrapText('the quick brown fox jumps', 10), ['the quick', 'brown fox', 'jumps']);
  });

  it('never emits a line longer than maxChars', () => {
    const text = 'observability, tracing and structured logging for distributed systems';
    for (const max of [6, 12, 25, 40]) {
      for (const line of wrapText(text, max)) {
        assert.ok(line.length <= max, `"${line}" exceeds ${max}`);
      }
    }
  });

  it('hard-splits words that cannot fit', () => {
    assert.deepStrictEqual(wrapText('kubernetesoperator', 6), ['kubern', 'etesop', 'erator']);
  });

  it('collapses whitespace and returns [] for blank input', () => {
    assert.deepStrictEqual(wrapText('  spaced \n  out  ', 20), ['spaced out']);
    assert.deepStrictEqual(wrapText('   ', 20), []);
    assert.deepStrictEqual(wrapText('', 20), []);
  });

  it('preserves every word', () => {
    const words = 'alpha beta gamma delta epsilon zeta eta theta'.split(' ');
    assert.deepStrictEqual(wrapText(words.join(' '), 11).join(' ').split(' '), words);
  });
});

describe('fitTitle', () => {
  it('uses the largest size for a short headline', () => {
    const short = fitTitle('Short title');
    const long = fitTitle('Short title'.repeat(12));
    assert.strictEqual(short.lines.length, 1);
    assert.ok(short.fontSize > long.fontSize, 'a long title should shrink relative to a short one');
  });

  it('never exceeds three lines and truncates the overflow', () => {
    const fitted = fitTitle('word '.repeat(200));
    assert.strictEqual(fitted.lines.length, 3);
    assert.ok(fitted.lines[2]!.endsWith('\u2026'), 'last line should be elided');
  });

  it('scales the character budget with the available width', () => {
    const narrow = fitTitle('Observability for distributed systems in practice', 400);
    const wide = fitTitle('Observability for distributed systems in practice', 1000);
    assert.ok(narrow.lines.length >= wide.lines.length);
  });

  it('is deterministic', () => {
    const title = 'Talk, Tag, Build: How Three Prompts Automate Product Development';
    assert.deepStrictEqual(fitTitle(title), fitTitle(title));
  });
});

describe('OgImageGenerator.buildSvg', () => {
  const og = new OgImageGenerator({ siteName: 'rbstp.dev' });

  it('emits a card-sized SVG document with the wordmark and title', () => {
    const svg = og.buildSvg({ title: 'Hello world', subtitle: 'Notes on things', meta: 'Nov 2, 2025' });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes(`width="${OG_WIDTH}" height="${OG_HEIGHT}"`));
    assert.ok(svg.includes('rbstp.dev'));
    assert.ok(svg.includes('Hello world'));
    assert.ok(svg.includes('Notes on things'));
    assert.ok(svg.includes('Nov 2, 2025'));
  });

  it('sets the topics as one quiet line of text', () => {
    const svg = og.buildSvg({ title: 'Tagged', tags: ['ai', 'devops', 'testing'] });
    assert.strictEqual((svg.match(/class="tag"/g) ?? []).length, 1);
    assert.match(svg, /class="tag">ai\s+·\s+devops\s+·\s+testing</);
  });

  it('caps the topic line at four names', () => {
    const svg = og.buildSvg({ title: 'Many tags', tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    const line = /class="tag">([^<]+)</.exec(svg)?.[1] ?? '';
    assert.strictEqual(line.split('·').length, 4);
  });

  it('stays flat: no gradients, glows or pills', () => {
    const svg = og.buildSvg({ title: 'Flat', subtitle: 'No decoration', tags: ['ai'], meta: 'Nov 2, 2025' });
    assert.ok(!/Gradient|filter=|<rect[^>]*rx=/.test(svg), 'the card must stay flat');
  });

  it('omits optional rows when unset', () => {
    const svg = og.buildSvg({ title: 'Bare' });
    assert.ok(!svg.includes('class="subtitle"'));
    assert.ok(!svg.includes('class="meta"'));
    assert.ok(!svg.includes('class="tag"'));
  });

  it('escapes titles so markup cannot break the document', () => {
    const svg = og.buildSvg({ title: 'Fix <script> & "quotes"' });
    assert.ok(!svg.includes('<script>'));
    assert.ok(svg.includes('&lt;script&gt; &amp; &quot;quotes&quot;'));
  });

  it('falls back to the site name for an empty title', () => {
    assert.ok(og.buildSvg({ title: '' }).includes('rbstp.dev'));
  });
});

describe('OgImageGenerator rasterisation', () => {
  it('renders a PNG at Open Graph dimensions', async () => {
    const og = new OgImageGenerator({ siteName: 'rbstp.dev' });
    const png = await og.toPng({ title: 'Social card', tags: ['ai'], meta: '2 min read' });
    const meta = await sharp(png).metadata();
    assert.strictEqual(meta.format, 'png');
    assert.strictEqual(meta.width, OG_WIDTH);
    assert.strictEqual(meta.height, OG_HEIGHT);
  });

  it('writeCard creates missing parent directories', async () => {
    const og = new OgImageGenerator();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-'));
    const dest = path.join(dir, 'nested', 'deeper', 'card.png');
    await og.writeCard({ title: 'Nested write' }, dest);
    const stat = await fs.stat(dest);
    assert.ok(stat.size > 0, 'card should not be empty');
    await fs.rm(dir, { recursive: true, force: true });
  });
});
