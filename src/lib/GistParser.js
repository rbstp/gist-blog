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
  constructor() {
    // Cache for processed markdown content to avoid re-rendering
    this.markdownCache = new Map();
    // Cache for tag extraction to avoid re-processing descriptions
    this.tagCache = new Map();
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

      // Cache markdown processing to avoid re-rendering same content
      const contentKey = `${gist.id}_${gist.updated_at}`;
      let htmlContent = this.markdownCache.get(contentKey);
      if (!htmlContent) {
        htmlContent = marked(bodyContent);
        this.markdownCache.set(contentKey, htmlContent);
      }

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
        filename: markdownFile.filename
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
}

module.exports = GistParser;