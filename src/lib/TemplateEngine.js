const fs = require('fs').promises;
const path = require('path');

class TemplateEngine {
  constructor(templatesDir = 'src/templates') {
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

  async loadTemplate(templateName) {
    try {
      const templatePath = path.join(this.templatesDir, templateName);
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new Error(`Template not found: ${templateName}`);
    }
  }

  escapeHtml(unsafe) {
    // Use pre-compiled regex and cached map for better performance
    return unsafe.replace(this.htmlEscapeRegex, (match) => this.htmlEscapeMap[match]);
  }

  render(template, data) {
    let result = template;

    // Handle simple loops {{#posts}}...{{/posts}} and conditional content first
    result = result.replace(this.blockRegex, (_, key, content) => {
      const items = data[key];

      // If it's an array, treat as a loop
      if (Array.isArray(items)) {
        return items.map((item) => {
          // Handle primitive arrays (strings, numbers) with {{.}} syntax - use pre-compiled regex
          if (typeof item === 'string' || typeof item === 'number') {
            return content.replace(this.dotRegex, item);
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
    result = result.replace(this.variableRegex, (_, key) => {
      const value = data[key];
      if (value === undefined || value === null) {
        console.warn(`Template variable '${key}' is undefined`);
        return '';
      }
      // Escape HTML for security, except for htmlContent which is already processed by marked
      // and content which is the template content itself
      if (key === 'htmlContent' || key === 'content') {
        return value;
      }
      return typeof value === 'string' ? this.escapeHtml(value) : value;
    });

    return result;
  }
}

module.exports = TemplateEngine;
