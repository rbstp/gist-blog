
interface PostWithContent {
  id: string;
  title: string;
  htmlContent: string;
  createdAt: string;
  tags?: string[];
}

class RSSGenerator {
  private siteUrl: string;
  private title: string;
  private description: string;

  constructor(siteUrl: string = process.env.SITE_URL || 'https://rbstp.dev') {
    this.siteUrl = siteUrl;
    this.title = process.env.SITE_TITLE || 'rbstp.dev';
    this.description = process.env.SITE_DESCRIPTION || 'There and Back Again: A DevOps Engineer\'s Journey Through AI and Infrastructure';
  }

  generateFeed(posts: PostWithContent[]): string {
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const buildDate = new Date().toUTCString();

    // Get the latest post date for the lastBuildDate
    const latestPostDate = sortedPosts.length > 0
      ? new Date(sortedPosts[0].createdAt).toUTCString()
      : buildDate;

    const rssItems = sortedPosts.map(post => {
      const postUrl = `${this.siteUrl}/posts/${post.id}.html`;
      const pubDate = new Date(post.createdAt).toUTCString();

      // Use full HTML content for RSS feed
      const fullContent = post.htmlContent;

      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${fullContent}]]></description>
      ${post.tags && post.tags.length > 0 ? post.tags.map(tag => `<category>${tag}</category>`).join('\n      ') : ''}
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
${rssItems}
  </channel>
</rss>`;

    return rssXml;
  }
}

export default RSSGenerator;