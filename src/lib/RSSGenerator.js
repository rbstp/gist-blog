class RSSGenerator {
  constructor(siteUrl = process.env.SITE_URL || 'https://rbstp.dev') {
    this.siteUrl = siteUrl;
    this.title = process.env.SITE_TITLE || 'rbstp.dev';
    this.description = process.env.SITE_DESCRIPTION || 'There and Back Again: A DevOps Engineer\'s Journey Through AI and Infrastructure';
  }

  /**
   * Sanitizes HTML content for RSS feeds by removing permalink anchors
   * @param {string} html - The HTML content to sanitize
   * @returns {string} - Sanitized HTML without permalink anchors
   */
  sanitizeForRSS(html) {
    if (!html) return '';
    // Remove permalink anchors (e.g., <a href="#section" class="permalink" aria-label="Permalink">#</a>)
    return html.replace(/<a[^>]*class="permalink"[^>]*>.*?<\/a>/g, '');
  }

  generateFeed(posts) {
    // Assume posts are already sorted (they are sorted in BlogGenerator.generateIndex)
    // If not sorted, we could add a safety sort, but avoid redundant sorting
    const sortedPosts = posts.length > 1 && new Date(posts[0].createdAt) < new Date(posts[1].createdAt)
      ? posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      : posts;

    const buildDate = new Date().toUTCString();

    // Get the latest post date for the lastBuildDate
    const latestPostDate = sortedPosts.length > 0
      ? new Date(sortedPosts[0].createdAt).toUTCString()
      : buildDate;

    const rssItems = sortedPosts.map(post => {
      const postUrl = `${this.siteUrl}/posts/${post.id}.html`;
      const pubDate = new Date(post.createdAt).toUTCString();

      // Pre-build category tags if they exist to avoid inline conditional
      const categoryTags = post.tags && post.tags.length > 0
        ? '\n      ' + post.tags.map(tag => `<category>${tag}</category>`).join('\n      ')
        : '';

      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${this.sanitizeForRSS(post.htmlContent)}]]></description>${categoryTags}
    </item>`;
    }).join('\n');

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${this.title}</title>
    <link>${this.siteUrl}</link>
    <description>${this.description}</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${latestPostDate}</pubDate>
    <ttl>60</ttl>
    <atom:link href="${this.siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <generator>gist-blog-generator</generator>
    <image>
      <url>${this.siteUrl}/favicon.svg</url>
      <title>${this.title}</title>
      <link>${this.siteUrl}</link>
      <width>32</width>
      <height>32</height>
    </image>
${rssItems}
  </channel>
</rss>`;

    return rssXml;
  }
}

module.exports = RSSGenerator;
