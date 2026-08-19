import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';
import {
  hashString,
  tagHue,
  tagColor,
  TAG_HUE_COUNT,
  TAG_HUE_TOKENS,
  TAG_HUE_COLORS,
} from '../src/lib/TagPalette.ts';

const VARIABLES_CSS = path.join('src', 'styles', 'modules', 'variables.css');

describe('TagPalette hashing', () => {
  it('hashString is deterministic and unsigned 32-bit', () => {
    for (const value of ['', 'a', 'kubernetes', 'a longer tag name with spaces']) {
      const hash = hashString(value);
      assert.strictEqual(hash, hashString(value), `unstable hash for "${value}"`);
      assert.ok(Number.isInteger(hash) && hash >= 0 && hash <= 0xffffffff, `out of range for "${value}"`);
    }
  });

  it('hashString matches known FNV-1a values (guards colour drift across builds)', () => {
    // Reference values for FNV-1a/32. If these change, every tag colour changes.
    assert.strictEqual(hashString(''), 0x811c9dc5);
    assert.strictEqual(hashString('a'), 0xe40c292c);
    assert.strictEqual(hashString('foobar'), 0xbf9cf968);
  });

  it('tagHue stays inside the palette', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const hue = tagHue(`tag-${i}`);
      assert.ok(Number.isInteger(hue) && hue >= 0 && hue < TAG_HUE_COUNT, `hue ${hue} out of range`);
      seen.add(hue);
    }
    // A usable palette spreads tags across every hue.
    assert.strictEqual(seen.size, TAG_HUE_COUNT);
  });

  it('tagHue ignores case so `AI` and `ai` share a colour', () => {
    assert.strictEqual(tagHue('AI'), tagHue('ai'));
    assert.strictEqual(tagColor('Kubernetes'), tagColor('kubernetes'));
  });

  it('tagColor resolves to a hex value from the token table', () => {
    const color = tagColor('devops');
    assert.match(color, /^#[0-9a-f]{6}$/);
    assert.ok(Object.values(TAG_HUE_COLORS).includes(color));
  });
});

describe('TagPalette / CSS token agreement', () => {
  let css = '';
  before(async () => { css = await fs.readFile(VARIABLES_CSS, 'utf8'); });

  it('exposes one --tag-hue-N pair per token, in the same order', () => {
    TAG_HUE_TOKENS.forEach((token, index) => {
      assert.ok(
        new RegExp(`--tag-hue-${index}:\\s*var\\(--${token}\\);`).test(css),
        `variables.css should map --tag-hue-${index} to var(--${token})`
      );
      assert.ok(
        new RegExp(`--tag-hue-${index}-rgb:\\s*var\\(--${token}-rgb\\);`).test(css),
        `variables.css should map --tag-hue-${index}-rgb to var(--${token}-rgb)`
      );
    });
  });

  it('declares no hue beyond the palette (CSS would silently fall back)', () => {
    const declared = [...css.matchAll(/--tag-hue-(\d+):/g)].map((m) => Number(m[1]));
    assert.deepStrictEqual(
      [...new Set(declared)].sort((a, b) => a - b),
      TAG_HUE_TOKENS.map((_, i) => i)
    );
  });

  it('TAG_HUE_COLORS matches the dark-theme accent values (used by OG images)', () => {
    // Only the :root block: [data-theme="light"] redefines the same tokens.
    const root = css.slice(css.indexOf(':root'), css.indexOf('[data-theme="light"]'));
    for (const [token, hex] of Object.entries(TAG_HUE_COLORS)) {
      const match = new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(root);
      assert.ok(match, `--${token} not found in :root`);
      assert.strictEqual(
        match[1]!.toLowerCase(),
        hex.toLowerCase(),
        `TAG_HUE_COLORS['${token}'] drifted from --${token} in variables.css`
      );
    }
  });

  it('every accent token used by the palette also declares an -rgb channel triplet', () => {
    for (const token of TAG_HUE_TOKENS) {
      assert.ok(
        new RegExp(`--${token}-rgb:\\s*\\d+,\\s*\\d+,\\s*\\d+;`).test(css),
        `--${token}-rgb missing or malformed`
      );
    }
  });
});
