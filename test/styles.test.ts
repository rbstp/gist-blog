import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';

import { STYLE_MODULES } from '../src/lib/config.ts';

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

  it('declares exactly one accent, so colour stays meaningful', () => {
    const accents = [...new Set([...css.matchAll(/(--accent-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))].sort();
    assert.deepStrictEqual(accents, ['--accent-primary', '--accent-primary-rgb', '--accent-primary-soft']);
    assert.ok(!/--tag-hue-/.test(css), 'per-topic hues are gone: topics are set as text');
  });

  it('paints no decorative gradients', () => {
    const gradients = [...css.matchAll(/\w*-?(?:linear|radial|conic)-gradient\(/g)].map((m) => m[0]);
    assert.deepStrictEqual(gradients, [], 'flat surfaces only — gradients read as decoration');
  });

  it('reserves elevation for things that genuinely float', () => {
    // Every other surface is separated by a hairline instead of a shadow.
    const allowed = ['.skip-link', '.command-palette-panel', '.keyboard-help-content', '.jump-to-top'];
    const shadowed = [...css.matchAll(/([^{}]+)\{[^{}]*box-shadow:[^;}]+;/g)]
      .map((m) => m[1]!.trim().split('\n').pop()!.trim())
      .filter((selector) => !allowed.some((ok) => selector.includes(ok)));
    assert.deepStrictEqual(shadowed, [], `unexpected box-shadow on: ${shadowed.join(', ')}`);
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

describe('archive list', () => {
  let posts = '';
  let item = '';

  before(async () => {
    posts = stripComments(await fs.readFile(path.join(MODULES_DIR, 'posts.css'), 'utf8'));
    const match = /\.post-item\s*\{([^}]*)\}/.exec(posts);
    assert.ok(match, 'the .post-item rule disappeared');
    item = match[1] ?? '';
  });

  it('lays each entry out against the date rail', () => {
    // The rail is what makes titles align on one optical edge down the page.
    assert.match(item, /grid-template-columns:\s*var\(--rail-width\)/);
    assert.match(item, /border-bottom:\s*1px solid var\(--border-primary\)/);
  });

  it('separates entries with rules rather than boxing them', () => {
    assert.doesNotMatch(item, /background/, 'entries sit on the page, not on a panel');
    assert.doesNotMatch(item, /box-shadow/);
    assert.doesNotMatch(item, /border-radius/);
    assert.doesNotMatch(item, /transform/, 'rows must not lift or scale on hover');
  });

  it('keeps the whole row clickable while topics stay their own targets', () => {
    assert.match(posts, /\.post-title a::after\s*\{[^}]*inset:\s*0/);
    assert.match(posts, /\.post-topics[^{]*\{[^}]*z-index:\s*1/);
  });
});

describe('no card chrome', () => {
  // The archive replaced the card grid. These names must not come back.
  const BANNED = ['post-card', 'posts-grid', 'is-featured', 'card-body', 'card-title', 'badge-new', 'data-hue'];

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
    assert.deepStrictEqual(offenders, [], `card chrome resurfaced:\n${offenders.join('\n')}`);
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
