import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import StringUtils from './StringUtils.ts';
import { SITE_TITLE } from './config.ts';

// Social card (Open Graph) image generation.
//
// Cards are composed as SVG and rasterised to PNG by sharp (librsvg + pango), so the layout is
// plain markup rather than a headless browser. Without font metrics we approximate advance widths
// as a fraction of the font size, which is enough to wrap a headline deterministically and is
// stable across the machines that run the build.
//
// The design mirrors the site: flat background, one hairline rule, type doing the work.

/** Open Graph recommends 1200x630 (1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PADDING = 80;
const CONTENT_WIDTH = OG_WIDTH - PADDING * 2;
/** Mean advance width of one character as a fraction of the font size, for the sans stack. */
const SANS_ADVANCE = 0.52;
/** Font sizes tried, largest first, until the title fits within MAX_TITLE_LINES. */
const TITLE_SIZES = [64, 54, 46] as const;
const MAX_TITLE_LINES = 3;
/** Subtitle is a single line; 28px text fits roughly this many characters across the card. */
const SUBTITLE_MAX_CHARS = 68;
/** Generic families keep rendering predictable on CI, where Inter is not installed. */
const FONT_STACK = 'Inter, Helvetica Neue, DejaVu Sans, sans-serif';

// Dark-theme palette, mirroring :root in styles/modules/variables.css.
const COLORS = {
  bg: '#0d0e10',
  border: '#23252a',
  title: '#f2f3f5',
  body: '#c6c9cf',
  muted: '#868a92',
  accent: '#8ab4f8',
} as const;

/** Content of a single social card. */
export interface OgCard {
  /** Headline, wrapped and shrunk to fit. */
  title: string;
  /** Optional secondary line rendered under the title (e.g. the site tagline). */
  subtitle?: string;
  /** Topic names, set as a single quiet line of text. */
  tags?: string[];
  /** Right-aligned footer text, e.g. `Nov 3, 2025 · 2 min read`. */
  meta?: string;
}

export interface FittedTitle {
  fontSize: number;
  lines: string[];
}

/** Escape text for inclusion in XML/SVG character data and attribute values. */
export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Greedy word wrap at a fixed character budget, hard-splitting words that cannot fit. */
export function wrapText(text: string, maxChars: number): string[] {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (maxChars < 1) return [normalized];

  const lines: string[] = [];
  let current = '';

  for (const word of normalized.split(' ')) {
    let remaining = word;
    // A word longer than the budget is split across lines rather than overflowing the card.
    while (remaining.length > maxChars) {
      if (current) { lines.push(current); current = ''; }
      lines.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars);
    }
    if (!current) {
      current = remaining;
    } else if (current.length + 1 + remaining.length <= maxChars) {
      current += ' ' + remaining;
    } else {
      lines.push(current);
      current = remaining;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Pick the largest font size at which the title fits in MAX_TITLE_LINES, truncating if none do. */
export function fitTitle(title: string, availableWidth: number = CONTENT_WIDTH): FittedTitle {
  const sizes = TITLE_SIZES;
  for (const fontSize of sizes) {
    const maxChars = Math.max(1, Math.floor(availableWidth / (fontSize * SANS_ADVANCE)));
    const lines = wrapText(title, maxChars);
    if (lines.length <= MAX_TITLE_LINES) return { fontSize, lines };
  }

  const fontSize = sizes[sizes.length - 1] as number;
  const maxChars = Math.max(1, Math.floor(availableWidth / (fontSize * SANS_ADVANCE)));
  const lines = wrapText(title, maxChars).slice(0, MAX_TITLE_LINES);
  const last = lines[MAX_TITLE_LINES - 1];
  if (last !== undefined) {
    lines[MAX_TITLE_LINES - 1] = last.slice(0, Math.max(1, maxChars - 1)).replace(/[\s.,;:!?-]+$/, '') + '\u2026';
  }
  return { fontSize, lines };
}

export default class OgImageGenerator {
  siteName: string;

  constructor({ siteName = SITE_TITLE }: { siteName?: string } = {}) {
    this.siteName = siteName;
  }

  /** Build the card as an SVG document. Pure and synchronous, which keeps it unit-testable. */
  buildSvg(card: OgCard): string {
    const tags = (card.tags ?? []).slice(0, 4);
    const { fontSize, lines } = fitTitle(card.title || this.siteName);

    const left = PADDING;
    const lineHeight = Math.round(fontSize * 1.2);
    // Wordmark sits on a rule at the top; the headline hangs from a fixed baseline
    // below it so cards with one, two or three lines still feel like a set.
    const ruleY = PADDING + 46;
    const titleBaseline = 268 + fontSize;

    const titleLines = lines
      .map((line, i) => `<text x="${left}" y="${titleBaseline + i * lineHeight}" class="title">${escapeXml(line)}</text>`)
      .join('\n    ');

    const subtitleY = titleBaseline + lines.length * lineHeight + 6;
    const subtitle = card.subtitle
      ? `<text x="${left}" y="${subtitleY}" class="subtitle">${escapeXml(StringUtils.truncateAtWord(card.subtitle, SUBTITLE_MAX_CHARS))}</text>`
      : '';

    // Topics as one quiet line of text, the way they read on the site itself.
    const tagMarkup = tags.length
      ? `<text x="${left}" y="${OG_HEIGHT - PADDING - 44}" class="tag">${escapeXml(tags.join('   \u00b7   '))}</text>`
      : '';

    const meta = card.meta
      ? `<text x="${left}" y="${OG_HEIGHT - PADDING}" class="meta">${escapeXml(card.meta)}</text>`
      : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <style>
      text { font-family: ${FONT_STACK}; }
      .wordmark { font-size: 28px; font-weight: 600; fill: ${COLORS.title}; }
      .title { font-size: ${fontSize}px; font-weight: 600; fill: ${COLORS.title}; }
      .subtitle { font-size: 28px; font-weight: 400; fill: ${COLORS.body}; }
      .tag { font-size: 24px; font-weight: 400; fill: ${COLORS.muted}; }
      .meta { font-size: 24px; font-weight: 400; fill: ${COLORS.muted}; }
    </style>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLORS.bg}"/>
  <g>
    <text x="${left}" y="${PADDING + 20}" class="wordmark">${escapeXml(this.siteName)}</text>
    <line x1="${left}" y1="${ruleY}" x2="${OG_WIDTH - PADDING}" y2="${ruleY}" stroke="${COLORS.border}" stroke-width="1"/>
    <line x1="${left}" y1="${ruleY}" x2="${left + 120}" y2="${ruleY}" stroke="${COLORS.accent}" stroke-width="2"/>
    ${titleLines}
    ${subtitle}
    ${tagMarkup}
    ${meta}
  </g>
</svg>`;
  }

  /** Rasterise a card to PNG bytes. */
  async toPng(card: OgCard): Promise<Buffer> {
    return sharp(Buffer.from(this.buildSvg(card)))
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  }

  /** Rasterise a card and write it to disk, creating parent directories as needed. */
  async writeCard(card: OgCard, destPath: string): Promise<void> {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, await this.toPng(card));
  }
}
