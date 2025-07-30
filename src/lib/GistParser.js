const { marked } = require('marked');
const hljs = require('highlight.js');

// Configure marked for syntax highlighting
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.warn(`Failed to highlight code with language '${lang}':`, err.message);
      }
    }
    return hljs.highlightAuto(code).value;
  }
});

class GistParser {
  constructor(gistUsername = null) {
    // Cache for processed markdown content to avoid re-rendering
    this.markdownCache = new Map();
    // Cache for tag extraction to avoid re-processing descriptions
    this.tagCache = new Map();
    // Store the gist username for link transformation
    this.gistUsername = gistUsername;
  }

  parseGistAsPost(gist) {
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

      if (lines.length > 0 && lines[0].startsWith('#')) {
        title = lines[0].replace(/^#+\s*/, '').trim();
        bodyContent = lines.slice(1).join('\n').trim();
      }

      // Parse tags from description (hashtags like #ai #cli #fix) with caching
      const rawDescription = gist.description || '';
      const tags = this.extractTags(rawDescription);
      const cleanDescription = this.cleanDescriptionFromTags(rawDescription);

      // Transform gist links to internal blog post links before processing markdown (only for own username)
      const transformedContent = this.gistUsername ? 
        this.transformGistLinks(bodyContent, this.gistUsername) : bodyContent;

      // Cache markdown processing to avoid re-rendering same content
      const contentKey = `${gist.id}_${gist.updated_at}`;
      let htmlContent = this.markdownCache.get(contentKey);
      if (!htmlContent) {
        htmlContent = marked(transformedContent);
        this.markdownCache.set(contentKey, htmlContent);
      }

      // Calculate word count and reading time
      const wordCount = this.calculateWordCount(bodyContent);
      const readingTime = this.calculateReadingTime(wordCount);

      // Ensure we have valid data
      const post = {
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
        readingTime: readingTime
      };

      // Validate essential fields
      if (!post.id || !post.title) {
        return null;
      }

      return post;
    } catch (error) {
      console.error(`Error parsing gist ${gist?.id || 'unknown'}:`, error.message);
      return null;
    }
  }

  extractTags(description) {
    // Use cache for tag extraction to avoid re-processing
    if (this.tagCache.has(description)) {
      return this.tagCache.get(description);
    }

    // Extract hashtags using exec for better performance with large descriptions
    const tagRegex = /#(\w+)/g;
    const tagsSet = new Set();
    let match;

    while ((match = tagRegex.exec(description)) !== null) {
      tagsSet.add(match[1].toLowerCase());
    }

    // Convert to sorted array - more efficient than spread operator for large sets
    const tags = Array.from(tagsSet).sort();
    this.tagCache.set(description, tags);
    return tags;
  }

  cleanDescriptionFromTags(description) {
    // Remove hashtags from description, keeping the rest clean
    // Use a single regex with word boundaries for more accurate matching
    return description
      .replace(/#\w+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  calculateWordCount(content) {
    // Remove markdown syntax and count actual words
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1') // Replace links with just text
      .replace(/[#*_~`]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanContent) return 0;

    return cleanContent.split(/\s+/).length;
  }

  calculateReadingTime(wordCount) {
    // Average reading speed is 200-250 words per minute
    // Using 225 WPM as a reasonable average
    const wordsPerMinute = 225;
    const minutes = Math.ceil(wordCount / wordsPerMinute);

    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    return `${minutes} min`;
  }

  transformGistLinks(content, gistUsername) {
    // Transform GitHub gist URLs to internal blog post links (only for the specified username)
    // Matches: https://gist.github.com/username/gistid
    const gistUrlRegex = new RegExp(`https:\\/\\/gist\\.github\\.com\\/${gistUsername}\\/([a-f0-9]+)(?:\\#[^)\\s]*)?`, 'g');
    
    return content.replace(gistUrlRegex, (match, gistId) => {
      // Replace with internal blog post link
      return `/posts/${gistId}.html`;
    });
  }
}

module.exports = GistParser;
