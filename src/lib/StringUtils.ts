class StringUtils {
  static slugify(title: string): string {
    return String(title)
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Reduce markdown to a single line of readable prose. Used for card excerpts, meta
   * descriptions and social cards, where raw markdown syntax would leak into the output.
   */
  static toPlainText(markdown: string): string {
    return String(markdown ?? '')
      .replace(/```[\s\S]*?```/g, ' ')             // fenced code blocks
      .replace(/~~~[\s\S]*?~~~/g, ' ')             // alternate fences
      .replace(/<[^>]+>/g, ' ')                    // inline HTML
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')       // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links -> link text
      .replace(/`([^`]*)`/g, '$1')                 // inline code
      .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, ' ')   // thematic breaks
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')          // ATX headings
      .replace(/^\s{0,3}>\s?/gm, '')               // block quotes
      .replace(/^\s{0,3}(?:[*+-]|\d+\.)\s+/gm, '') // list markers
      .replace(/(\*\*|__|~~|\*)/g, '')             // emphasis markers
      // Underscore emphasis only when it wraps a whole word, so snake_case identifiers survive.
      .replace(/(^|\s)_([^_\s][^_]*)_(?=$|[\s.,;:!?)])/g, '$1$2')
      .replace(/\|/g, ' ')                         // table pipes
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Truncate on a word boundary, appending an ellipsis. Falls back to a hard cut when a
   * single word overruns the budget, so the result never exceeds `maxLength + 1` characters.
   */
  static truncateAtWord(text: string, maxLength: number, ellipsis: string = '\u2026'): string {
    const value = String(text ?? '').trim();
    if (maxLength <= 0) return '';
    if (value.length <= maxLength) return value;

    const window = value.slice(0, maxLength + 1);
    const lastSpace = window.lastIndexOf(' ');
    // Only respect the word boundary when it does not throw away most of the budget.
    const cut = lastSpace > Math.floor(maxLength * 0.6) ? window.slice(0, lastSpace) : window.slice(0, maxLength);
    return cut.replace(/[\s.,;:!?\-–—]+$/, '') + ellipsis;
  }

  /** Plain-text summary of markdown, truncated on a word boundary. */
  static summarize(markdown: string, maxLength: number): string {
    return StringUtils.truncateAtWord(StringUtils.toPlainText(markdown), maxLength);
  }
}

export default StringUtils;
