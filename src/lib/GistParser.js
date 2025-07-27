const { marked } = require('marked');
const hljs = require('highlight.js');

// Configure marked for syntax highlighting
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) { }
    }
    return hljs.highlightAuto(code).value;
  }
});

class GistParser {
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

      // Parse tags from description (hashtags like #ai #cli #fix)
      const rawDescription = gist.description || '';
      const tags = this.extractTags(rawDescription);
      const cleanDescription = this.cleanDescriptionFromTags(rawDescription);

      // Ensure we have valid data
      const post = {
        id: gist.id,
        title: title || 'Untitled',
        description: cleanDescription || title || 'No description',
        content: bodyContent,
        htmlContent: marked(bodyContent),
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
    // Extract hashtags from description
    const tagRegex = /#(\w+)/g;
    const tags = [];
    let match;

    while ((match = tagRegex.exec(description)) !== null) {
      tags.push(match[1].toLowerCase());
    }

    // Remove duplicates and sort
    return [...new Set(tags)].sort();
  }

  cleanDescriptionFromTags(description) {
    // Remove hashtags from description, keeping the rest clean
    return description
      .replace(/#\w+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = GistParser;