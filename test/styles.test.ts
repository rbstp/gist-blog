import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';

import { STYLE_MODULES } from '../src/lib/config.ts';
import { TAG_HUE_COUNT } from '../src/lib/TagPalette.ts';

const MODULES_DIR = path.join('src', 'styles', 'modules');
const IMPORTS_FILE = path.join('src', 'styles', 'main-imports.css');

/** Strip comments so documentation examples are not mistaken for real declarations. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

describe('stylesheet modules', () => {
  const order = [...STYLE_MODULES];
  let files: string[] = [];
  let imports = '';

  before(async () => {
    files = (await fs.readdir(MODULES_DIR)).filter((f) => f.endsWith('.css')).sort();
    imports = await fs.readFile(IMPORTS_FILE, 'utf8');
  });

  it('bundles exactly the modules that exist on disk', () => {
    assert.deepStrictEqual([...order].sort(), files, 'STYLE_MODULES and src/styles/modules disagree');
  });

  it('main-imports.css documents the same modules in the same order', () => {
    const imported = [...imports.matchAll(/@import\s+"modules\/([^"]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(imported, order, 'main-imports.css drifted from the build order');
  });

  it('loads variables first and responsive last (specificity depends on it)', () => {
    assert.strictEqual(order[0], 'variables.css');
    assert.strictEqual(order[order.length - 1], 'responsive.css');
  });

  it('no longer ships the terminal stylesheet', () => {
    assert.ok(!files.includes('terminal.css'));
    assert.ok(!imports.includes('terminal.css'));
  });
});

describe('design tokens', () => {
  let css = '';

  before(async () => {
    const files = (await fs.readdir(MODULES_DIR)).filter((f) => f.endsWith('.css'));
    const parts = await Promise.all(files.map((f) => fs.readFile(path.join(MODULES_DIR, f), 'utf8')));
    css = stripComments(parts.join('\n'));
  });

  it('every var() reference resolves to a declared token', () => {
    const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const dangling = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))]
      .filter((token) => !declared.has(token));
    assert.deepStrictEqual(dangling, [], `undeclared custom properties: ${dangling.join(', ')}`);
  });

  it('declares no unused tokens', () => {
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const orphans = [...new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))]
      .filter((token) => !used.has(token));
    assert.deepStrictEqual(orphans, [], `unused custom properties: ${orphans.join(', ')}`);
  });

  it('styles every palette hue for chips and cards', () => {
    // Hue 0 is the default declared on the base rule, so only 1..n-1 need overrides.
    for (let hue = 1; hue < TAG_HUE_COUNT; hue++) {
      assert.ok(css.includes(`.tag[data-hue="${hue}"]`), `.tag missing hue ${hue}`);
      assert.ok(css.includes(`.post-card[data-hue="${hue}"]`), `.post-card missing hue ${hue}`);
    }
    assert.ok(!css.includes(`.tag[data-hue="${TAG_HUE_COUNT}"]`), 'hue rule beyond the palette');
  });

  it('defines a light theme counterpart for every surface and text token', () => {
    const root = css.slice(css.indexOf(':root'), css.indexOf('[data-theme="light"]'));
    const light = css.slice(css.indexOf('[data-theme="light"]'));
    const themed = [...root.matchAll(/(--(?:bg|text|accent|border|on)[a-z0-9-]*)\s*:/g)].map((m) => m[1]);
    const missing = [...new Set(themed)].filter((token) => !new RegExp(`${token}\\s*:`).test(light));
    assert.deepStrictEqual(missing, [], `light theme is missing: ${missing.join(', ')}`);
  });

  it('keeps the monospace stack for code only (the redesign is sans-serif)', () => {
    const codeSelector = /^(?:code|kbd|pre|samp|\.hljs[\w-]*|[.#][\w-]*(?:code|mono)[\w-]*)$/;
    const monoRules = [...css.matchAll(/([^{}]+)\{[^{}]*var\(--font-mono\)[^{}]*\}/g)]
      .map((m) => m[1]!.trim());

    assert.ok(monoRules.length > 0, 'the mono stack should still be applied to code');
    for (const rule of monoRules) {
      for (const selector of rule.split(',').map((s) => s.trim())) {
        assert.match(selector, codeSelector, `--font-mono should be reserved for code, found on: ${selector}`);
      }
    }
  });
});

describe('card topic accent', () => {
  let cards = '';
  let rule = '';

  before(async () => {
    cards = stripComments(await fs.readFile(path.join(MODULES_DIR, 'cards.css'), 'utf8'));
    const match = /\.post-card::before\s*\{([^}]*)\}/.exec(cards);
    assert.ok(match, 'the .post-card::before accent rule disappeared');
    rule = match[1] ?? '';
  });

  it('rides the card outline so it follows the rounded corners', () => {
    // The accent is the top border of a full-size overlay: the adjacent borders
    // are transparent, so the colour tapers along each corner arc.
    assert.match(rule, /border-top-color:\s*var\(--card-accent\)/);
    assert.match(rule, /border-radius:[^;]*--radius-lg/, 'the overlay must share the card radius');
  });

  it('is never a straight bar clipped across the corners', () => {
    // A painted background plus a fixed height draws a chord over the corner
    // arcs, which is the artefact this rule exists to avoid.
    assert.doesNotMatch(rule, /(?:^|;)\s*height\s*:/, 'a fixed height turns the accent back into a chord');
    assert.doesNotMatch(rule, /background/, 'the accent must be painted by the border, not a background');
  });

  it('dissolves toward the trailing edge instead of stopping abruptly', () => {
    assert.match(rule, /mask-image:/);
    assert.match(rule, /mask-composite:\s*intersect/, 'the fade and corner masks must intersect');
  });

  it('only shows on hover or keyboard focus', () => {
    assert.match(rule, /opacity:\s*0/);
    assert.ok(cards.includes('.post-card:hover::before'), 'hover never reveals the accent');
    assert.ok(cards.includes('.post-card:focus-within::before'), 'keyboard focus never reveals the accent');
  });
});

describe('no terminal chrome', () => {
  // The redesign dropped the terminal/TUI shell. These names must not come back.
  const BANNED = [
    'terminal-window',
    'terminal-header',
    'terminal-body',
    'terminal-title',
    'terminal-prompt',
    'prompt-symbol',
    'window-controls',
    'status-bar',
    'yazi',
    'blinking-cursor',
    '--terminal-',
  ];

  it('is absent from templates, stylesheets and client scripts', async () => {
    const roots = [
      { dir: path.join('src', 'templates'), ext: '.html' },
      { dir: MODULES_DIR, ext: '.css' },
      { dir: path.join('src', 'client'), ext: '.ts' },
    ];

    const offenders: string[] = [];
    for (const { dir, ext } of roots) {
      for (const name of await fs.readdir(dir)) {
        if (!name.endsWith(ext)) continue;
        const content = await fs.readFile(path.join(dir, name), 'utf8');
        for (const needle of BANNED) {
          if (content.includes(needle)) offenders.push(`${path.join(dir, name)}: ${needle}`);
        }
      }
    }
    assert.deepStrictEqual(offenders, [], `terminal chrome resurfaced:\n${offenders.join('\n')}`);
  });
});
