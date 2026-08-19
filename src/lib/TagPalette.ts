// Deterministic per-tag colouring.
//
// Every tag name is hashed to a hue index (0..TAG_HUE_COUNT-1). The index is emitted into the
// markup as `data-hue` and resolved to a colour by CSS (`--tag-hue-N` in styles/modules/variables.css)
// and by the Open Graph image generator (TAG_HUE_COLORS below). The mapping must be stable across
// builds so a tag keeps the same colour on every page, hence a plain hash rather than ordering.

/** CSS accent tokens backing each hue index, in order. Mirrored by `--tag-hue-N` in variables.css. */
export const TAG_HUE_TOKENS = [
  'accent-primary',
  'accent-secondary',
  'accent-cyan',
  'accent-teal',
  'accent-success',
  'accent-warning',
  'accent-orange',
  'accent-error',
] as const;

export type TagHueToken = (typeof TAG_HUE_TOKENS)[number];

/** Number of distinct tag hues. */
export const TAG_HUE_COUNT = TAG_HUE_TOKENS.length;

/**
 * Dark-theme hex value of each accent token, used for raster output (OG images) where CSS
 * custom properties are unavailable. Kept in sync with `:root` in variables.css by a unit test.
 */
export const TAG_HUE_COLORS: Record<TagHueToken, string> = {
  'accent-primary': '#7aa2f7',
  'accent-secondary': '#bb9af7',
  'accent-cyan': '#7dcfff',
  'accent-teal': '#73daca',
  'accent-success': '#9ece6a',
  'accent-warning': '#e0af68',
  'accent-orange': '#ff9e64',
  'accent-error': '#f7768e',
};

/**
 * FNV-1a (32-bit). Chosen because it is tiny, dependency-free and deterministic across
 * platforms and Node versions — the colours must not shift between builds.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    // 32-bit FNV prime multiplication via shifts, kept unsigned with >>> 0.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stable hue index for a tag name (case-insensitive). */
export function tagHue(tag: string): number {
  return hashString(String(tag).toLowerCase()) % TAG_HUE_COUNT;
}

/** Dark-theme hex colour for a tag name, for use in generated images. */
export function tagColor(tag: string): string {
  const token = TAG_HUE_TOKENS[tagHue(tag)] as TagHueToken;
  return TAG_HUE_COLORS[token];
}
