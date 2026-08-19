import assert from 'node:assert';
import { describe, it } from 'node:test';
import StringUtils from '../src/lib/StringUtils.ts';

describe('StringUtils.toPlainText', () => {
  it('strips markdown syntax down to prose', () => {
    const markdown = [
      '# Heading',
      '',
      'A **bold** and _italic_ line with `code` and a [link](https://example.com).',
      '',
      '- first item',
      '- second item',
      '',
      '> quoted line',
    ].join('\n');

    assert.strictEqual(
      StringUtils.toPlainText(markdown),
      'Heading A bold and italic line with code and a link. first item second item quoted line'
    );
  });

  it('drops fenced code blocks, images and inline HTML', () => {
    const markdown = [
      'Intro line.',
      '',
      '```bash',
      'rm -rf /important',
      '```',
      '',
      '![alt text](/img/pic.png)',
      '<div class="x">markup</div>',
      '',
      '---',
      '',
      'Outro line.',
    ].join('\n');

    const plain = StringUtils.toPlainText(markdown);
    assert.strictEqual(plain, 'Intro line. markup Outro line.');
    assert.ok(!plain.includes('rm -rf'));
    assert.ok(!plain.includes('alt text'));
    assert.ok(!plain.includes('<div'));
  });

  it('keeps snake_case identifiers intact while stripping underscore emphasis', () => {
    assert.strictEqual(
      StringUtils.toPlainText('call _really_ carefully: use max_retry_count.'),
      'call really carefully: use max_retry_count.'
    );
  });

  it('handles empty and nullish input', () => {
    assert.strictEqual(StringUtils.toPlainText(''), '');
    assert.strictEqual(StringUtils.toPlainText(undefined as unknown as string), '');
  });
});

describe('StringUtils.truncateAtWord', () => {
  it('leaves short text untouched', () => {
    assert.strictEqual(StringUtils.truncateAtWord('short enough', 40), 'short enough');
  });

  it('cuts on a word boundary and appends an ellipsis', () => {
    const out = StringUtils.truncateAtWord('the quick brown fox jumps over the lazy dog', 20);
    assert.strictEqual(out, 'the quick brown fox\u2026');
    assert.ok(out.length <= 21);
  });

  it('hard-cuts when a single word overruns the budget', () => {
    const out = StringUtils.truncateAtWord('supercalifragilisticexpialidocious', 10);
    assert.strictEqual(out, 'supercalif\u2026');
  });

  it('never exceeds maxLength + ellipsis', () => {
    const text = 'a '.repeat(200);
    for (const max of [1, 5, 17, 64, 160]) {
      assert.ok(StringUtils.truncateAtWord(text, max).length <= max + 1, `overran at ${max}`);
    }
  });

  it('trims trailing punctuation before the ellipsis', () => {
    assert.strictEqual(StringUtils.truncateAtWord('alpha beta, gamma delta', 12), 'alpha beta\u2026');
  });

  it('returns an empty string for a non-positive budget', () => {
    assert.strictEqual(StringUtils.truncateAtWord('anything', 0), '');
  });
});

describe('StringUtils.summarize', () => {
  it('flattens markdown then truncates', () => {
    const markdown = '## Title\n\nSome **long** body copy that should be cut somewhere sensible.';
    const out = StringUtils.summarize(markdown, 24);
    assert.ok(!out.includes('#'));
    assert.ok(!out.includes('**'));
    assert.ok(out.length <= 25);
    assert.ok(out.endsWith('\u2026'));
  });

  it('is a no-op for prose already within budget', () => {
    assert.strictEqual(StringUtils.summarize('Just a line.', 80), 'Just a line.');
  });
});

describe('StringUtils.slugify', () => {
  it('produces url-safe anchors', () => {
    assert.strictEqual(StringUtils.slugify('Hello, World!'), 'hello-world');
    assert.strictEqual(StringUtils.slugify('  spaced   out  '), 'spaced-out');
  });
});
