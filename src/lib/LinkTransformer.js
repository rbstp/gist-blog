class LinkTransformer {
  static transformGistLinks(content, gistUsername) {
    if (!gistUsername) return content;
    const re = new RegExp(`https\\:\\/\\/gist\\.github\\.com\\/${gistUsername}\\/([a-f0-9]+)(?:\\#[^)\\s]*)?`, 'g');
    return String(content).replace(re, (_, id) => `/posts/${id}.html`);
  }
}

module.exports = LinkTransformer;
