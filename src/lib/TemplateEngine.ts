import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateData } from '../types/index.js';

class TemplateEngine {
  private templatesDir: string;
  private blockRegex: RegExp;
  private variableRegex: RegExp;

  constructor(templatesDir: string = 'src/templates') {
    this.templatesDir = templatesDir;
    // Pre-compile regex patterns for better performance
    this.blockRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    this.variableRegex = /\{\{(\w+)\}\}/g;
  }

  async loadTemplate(templateName: string): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, templateName);
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  escapeHtml(unsafe: string): string {
    // Use a more performant approach with a single replace call
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return unsafe.replace(/[&<>"']/g, (match) => htmlEscapeMap[match]);
  }

  render(template: string, data: TemplateData): string {
    let result = template;

    // Handle simple loops {{#posts}}...{{/posts}} and conditional content first
    result = result.replace(this.blockRegex, (_, key: string, content: string) => {
      const items = data[key];

      // If it's an array, treat as a loop
      if (Array.isArray(items)) {
        return items.map((item: any, index: number) => {
          // Handle primitive arrays (strings, numbers) with {{.}} syntax
          if (typeof item === 'string' || typeof item === 'number') {
            return content.replace(/\{\{\.\}\}/g, String(item));
          }
          // Handle object arrays normally
          return this.render(content, item);
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

export default TemplateEngine;