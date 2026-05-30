import TagManager from './TagManager.ts';
import LinkTransformer from './LinkTransformer.ts';
import MarkdownProcessor from './MarkdownProcessor.ts';
import StringUtils from './StringUtils.ts';
import type { Gist, Post, TocItem } from './types.ts';

class GistParser {
  gistUsername: string | null;
  tags: TagManager;
  md: MarkdownProcessor;

  constructor(gistUsername: string | null = null) {
    this.gistUsername = gistUsername;
    this.tags = new TagManager();
    this.md = new MarkdownProcessor();
  }

  parseGistAsPost(gist: Gist): Post | null {
    try {
      // Validate gist structure
      if (!gist?.files || typeof gist.files !== 'object') {
        return null;
      }

      // Use the first markdown file as the main content
      const markdownFile = Object.values(gist.files).find(file =>
        file?.filename?.endsWith('.md') || file?.filename?.endsWith('.markdown')
      );

      if (!markdownFile?.content) {
        return null;
      }

      const content = markdownFile.content;
      const lines = content.split('\n');

      // Extract title from first line if it's a heading, otherwise use filename
      let title = markdownFile.filename.replace(/\.(md|markdown)$/i, '');
      let bodyContent = content;

      const firstLine = lines[0];
      if (lines.length > 0 && firstLine !== undefined && firstLine.startsWith('#')) {
        title = firstLine.replace(/^#+\s*/, '').trim();
        bodyContent = lines.slice(1).join('\n').trim();
      }

  // Parse tags from description (hashtags like #ai #cli #fix) with caching
  const rawDescription = gist.description || '';
  const tags = this.tags.extract(rawDescription);
  const cleanDescription = this.tags.clean(rawDescription);

      // Transform gist links to internal blog post links before processing markdown (only for own username)
      const transformedContent = LinkTransformer.transformGistLinks(bodyContent, this.gistUsername);

      // Extract table of contents before processing markdown
  const toc = this.md.extractToc(transformedContent);

      // Cache markdown processing to avoid re-rendering same content
      const contentKey = `${gist.id}_${gist.updated_at}`;
      const contentWithAnchors = this.md.addPermalinkAnchors(transformedContent);
      const htmlContent = this.md.render(contentWithAnchors, contentKey);

      // Calculate word count and reading time
      const wordCount = this.calculateWordCount(bodyContent);
      const readingTime = this.calculateReadingTime(wordCount);

      // Ensure we have valid data
      const post: Post = {
        id: gist.id,
        title: title || 'Untitled',
        description: cleanDescription || title || 'No description',
        content: bodyContent,
        htmlContent: htmlContent,
        createdAt: gist.created_at,
        updatedAt: gist.updated_at,
        url: gist.html_url,
        files: Object.keys(gist.files),
        tags: tags,
        filename: markdownFile.filename,
        wordCount: wordCount,
        readingTime: readingTime,
        toc: toc,
        hasToc: toc.length > 0
      };

      // Validate essential fields
      if (!post.id || !post.title) {
        return null;
      }

      return post;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error parsing gist ${gist?.id || 'unknown'}:`, message);
      return null;
    }
  }

  extractTags(description: string): string[] { return this.tags.extract(description); }

  cleanDescriptionFromTags(description: string): string { return this.tags.clean(description); }

  calculateWordCount(content: string): number {
    // Remove markdown syntax and count actual words
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Replace links with just text
      .replace(/[#*_~`]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanContent) return 0;

    return cleanContent.split(/\s+/).length;
  }

  calculateReadingTime(wordCount: number): string {
    // Average reading speed is 200-250 words per minute
    // Using 225 WPM as a reasonable average
    const wordsPerMinute = 225;
    const minutes = Math.ceil(wordCount / wordsPerMinute);

    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    return `${minutes} min`;
  }

  transformGistLinks(content: string, gistUsername: string | null): string { return LinkTransformer.transformGistLinks(content, gistUsername); }

  generateTableOfContents(content: string): TocItem[] { return this.md.extractToc(content); }

  addPermalinkAnchors(content: string): string { return this.md.addPermalinkAnchors(content); }

  createAnchor(title: string): string { return StringUtils.slugify(title); }
}

export default GistParser;
