class LinkTransformer {
  static transformGistLinks(content: string, gistUsername: string | null): string {
    if (!gistUsername) return content;
    const re = new RegExp(`https\\:\\/\\/gist\\.github\\.com\\/${gistUsername}\\/([a-f0-9]+)(?:\\#[^)\\s]*)?`, 'g');
    return String(content).replace(re, (_, id: string) => `/posts/${id}.html`);
  }
}

export default LinkTransformer;
