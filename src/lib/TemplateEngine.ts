import { promises as fs } from 'node:fs';
import path from 'node:path';

export default class TemplateEngine {
  templatesDir: string;
  blockRegex: RegExp;
  variableRegex: RegExp;
  dotRegex: RegExp;
  htmlEscapeMap: Record<string, string>;
  htmlEscapeRegex: RegExp;

  constructor(templatesDir: string = 'src/templates') {
    this.templatesDir = templatesDir;
    // Pre-compile regex patterns for better performance
    this.blockRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    this.variableRegex = /\{\{(\w+)\}\}/g;
    this.dotRegex = /\{\{\.\}\}/g;

    // Cache for HTML escape lookups
    this.htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    this.htmlEscapeRegex = /[&<>"']/g;
  }

  async loadTemplate(templateName: string): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, templateName);
      return await fs.readFile(templatePath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  escapeHtml(unsafe: string): string {
    // Use pre-compiled regex and cached map for better performance
    return unsafe.replace(this.htmlEscapeRegex, (match) => this.htmlEscapeMap[match] ?? match);
  }

  render(template: string, data: Record<string, unknown>): string {
    let result = template;

    // Handle simple loops {{#posts}}...{{/posts}} and conditional content first
    result = result.replace(this.blockRegex, (_, key: string, content: string) => {
      const items = data[key];

      // If it's an array, treat as a loop
      if (Array.isArray(items)) {
        return items.map((item) => {
          // Handle primitive arrays (strings, numbers) with {{.}} syntax - use pre-compiled regex
          if (typeof item === 'string' || typeof item === 'number') {
            return content.replace(this.dotRegex, String(item));
          }
          // Handle object arrays normally
          return this.render(content, item as Record<string, unknown>);
        }).join('');
      }

      // If it's a truthy value, treat as conditional content
      if (items) {
        return this.render(content, data);
      }

      // Otherwise, return empty string
      return '';
    });

    // Handle simple variable substitution {{variable}} after loops
    result = result.replace(this.variableRegex, (_, key: string) => {
      const value = data[key];
      if (value === undefined || value === null) {
        console.warn(`Template variable '${key}' is undefined`);
        return '';
      }
      // Escape HTML for security, except for htmlContent which is already processed by marked
      // and content which is the template content itself
      if (key === 'htmlContent' || key === 'content') {
        return String(value);
      }
      return typeof value === 'string' ? this.escapeHtml(value) : String(value);
    });

    return result;
  }
}
