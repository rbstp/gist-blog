import { marked } from 'marked';
import hljs from 'highlight.js';
import { Gist, BlogPost } from '../types/index.js';

// Configure marked for syntax highlighting
marked.setOptions({
  highlight: function (code: string, lang?: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, code).value;
      } catch (err: any) {
        console.warn(`Failed to highlight code with language '${lang}':`, err.message);
      }
    }
    return hljs.highlightAuto(code).value;
  }
} as any);

interface ParsedGist {
  id: string;
  title: string;
  description: string;
  content: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  files: string[];
  tags: string[];
  filename: string;
}

class GistParser {
  parseGistAsPost(gist: Gist): ParsedGist | null {
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
      const post: ParsedGist = {
        id: gist.id,
        title: title || 'Untitled',
        description: cleanDescription || title || 'No description',
        content: bodyContent,
        htmlContent: marked(bodyContent) as string,
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
    } catch (error: any) {
      console.error(`Error parsing gist ${gist?.id || 'unknown'}:`, error.message);
      return null;
    }
  }

  extractTags(description: string): string[] {
    // Extract hashtags from description using matchAll for cleaner code
    const tagRegex = /#(\w+)/g;
    const matches = description.matchAll(tagRegex);
    const tags = Array.from(matches, match => match[1].toLowerCase());

    // Remove duplicates and sort
    return [...new Set(tags)].sort();
  }

  cleanDescriptionFromTags(description: string): string {
    // Remove hashtags from description, keeping the rest clean
    return description
      .replace(/#\w+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export default GistParser;