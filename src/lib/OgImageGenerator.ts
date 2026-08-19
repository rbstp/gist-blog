import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import StringUtils from './StringUtils.ts';
import { tagColor } from './TagPalette.ts';
import { SITE_TITLE } from './config.ts';

// Social card (Open Graph) image generation.
//
// Cards are composed as SVG and rasterised to PNG by sharp (librsvg + pango), so the layout is
// plain markup rather than a headless browser. Without font metrics we approximate advance widths
// as a fraction of the font size, which is enough to wrap a headline deterministically and is
// stable across the machines that run the build.

/** Open Graph recommends 1200x630 (1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PADDING = 80;
const ACCENT_BAR_WIDTH = 8;
const CONTENT_WIDTH = OG_WIDTH - PADDING * 2 - ACCENT_BAR_WIDTH;
/** Mean advance width of one character as a fraction of the font size, for the sans stack. */
const SANS_ADVANCE = 0.52;
/** Font sizes tried, largest first, until the title fits within MAX_TITLE_LINES. */
const TITLE_SIZES = [68, 58, 48] as const;
const MAX_TITLE_LINES = 3;
/** Subtitle is a single line; 30px text fits roughly this many characters across the card. */
const SUBTITLE_MAX_CHARS = 64;
/** Generic families keep rendering predictable on CI, where Inter is not installed. */
const FONT_STACK = 'Inter, Helvetica Neue, DejaVu Sans, sans-serif';

// Dark-theme palette, mirroring :root in styles/modules/variables.css.
const COLORS = {
  bg: '#0f1017',
  panel: '#171a24',
  border: '#333a4f',
  title: '#e8eaf4',
  body: '#b7bdd2',
  muted: '#79809a',
  accent: '#7aa2f7',
} as const;

/** Content of a single social card. */
export interface OgCard {
  /** Headline, wrapped and shrunk to fit. */
  title: string;
  /** Optional secondary line rendered under the title (e.g. the site tagline). */
  subtitle?: string;
  /** Tag names, coloured by their hue and rendered as `#tag` chips. */
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
    const accent = tags.length > 0 ? tagColor(tags[0] as string) : COLORS.accent;
    const { fontSize, lines } = fitTitle(card.title || this.siteName);

    const left = PADDING + ACCENT_BAR_WIDTH;
    const lineHeight = Math.round(fontSize * 1.18);
    const titleBaseline = 250 + fontSize;

    const titleLines = lines
      .map((line, i) => `<text x="${left}" y="${titleBaseline + i * lineHeight}" class="title">${escapeXml(line)}</text>`)
      .join('\n    ');

    const subtitleY = titleBaseline + lines.length * lineHeight + 8;
    const subtitle = card.subtitle
      ? `<text x="${left}" y="${subtitleY}" class="subtitle">${escapeXml(StringUtils.truncateAtWord(card.subtitle, SUBTITLE_MAX_CHARS))}</text>`
      : '';

    // Topic pills, laid out left to right from estimated text widths.
    const tagFontSize = 26;
    const pillHeight = 46;
    const pillPadX = 22;
    const pillGap = 14;
    const pillTop = OG_HEIGHT - 176;
    let pillX = left;
    const tagMarkup = tags.map((tag) => {
      const width = Math.round(tag.length * tagFontSize * SANS_ADVANCE) + pillPadX * 2;
      const color = tagColor(tag);
      const markup = `<g>
      <rect x="${pillX}" y="${pillTop}" width="${width}" height="${pillHeight}" rx="${pillHeight / 2}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-opacity="0.4"/>
      <text x="${pillX + width / 2}" y="${pillTop + 31}" class="tag" text-anchor="middle" fill="${color}">${escapeXml(tag)}</text>
    </g>`;
      pillX += width + pillGap;
      return markup;
    }).join('\n    ');

    const meta = card.meta
      ? `<text x="${left}" y="${OG_HEIGHT - 80}" class="meta">${escapeXml(card.meta)}</text>`
      : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="surface" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="${COLORS.panel}"/>
      <stop offset="100%" stop-color="${COLORS.bg}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.05" r="0.75">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${COLORS.accent}"/>
    </linearGradient>
    <style>
      text { font-family: ${FONT_STACK}; }
      .wordmark { font-size: 30px; font-weight: 600; fill: ${COLORS.title}; }
      .initial { font-size: 30px; font-weight: 700; fill: ${COLORS.bg}; }
      .title { font-size: ${fontSize}px; font-weight: 700; fill: ${COLORS.title}; }
      .subtitle { font-size: 30px; font-weight: 400; fill: ${COLORS.body}; }
      .tag { font-size: ${tagFontSize}px; font-weight: 500; }
      .meta { font-size: 26px; font-weight: 400; fill: ${COLORS.muted}; }
    </style>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#surface)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${ACCENT_BAR_WIDTH}" height="${OG_HEIGHT}" fill="${accent}"/>
  <rect x="0.5" y="0.5" width="${OG_WIDTH - 1}" height="${OG_HEIGHT - 1}" fill="none" stroke="${COLORS.border}"/>
  <g>
    <rect x="${left}" y="${PADDING + 4}" width="46" height="46" rx="12" fill="url(#mark)"/>
    <text x="${left + 23}" y="${PADDING + 37}" class="initial" text-anchor="middle">R</text>
    <text x="${left + 64}" y="${PADDING + 37}" class="wordmark">${escapeXml(this.siteName)}</text>
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
