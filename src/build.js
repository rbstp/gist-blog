const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { format, parseISO } = require('date-fns');

// Constants
const RATE_LIMIT_DELAY = 60000; // 60 seconds
const EXCERPT_LENGTH = 150;
const COMMIT_HASH_LENGTH = 7;
const USER_AGENT = 'gist-blog-generator';

// Configure marked with syntax highlighting
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

class GistBlogGenerator {
  constructor() {
    this.gistUsername = process.env.GIST_USERNAME || 'rbstp';
    this.distDir = 'dist';
    this.templatesDir = 'templates';
  }

  async fetchGists() {
    console.log(`Fetching public gists for user: ${this.gistUsername}`);

    const response = await fetch(`https://api.github.com/users/${this.gistUsername}/gists`, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      console.error(`GitHub API Error: ${response.status} ${response.statusText}`);
      console.error(`Response headers:`, Object.fromEntries(response.headers.entries()));

      if (response.status === 403) {
        console.error('Rate limit hit. Waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        return this.fetchGists(); // Retry once
      }

      throw new Error(`Failed to fetch gists: ${response.status} ${response.statusText}`);
    }

    const gists = await response.json();
    console.log(`Successfully fetched ${gists.length} gists`);
    return gists.filter(gist => gist.public);
  }

  async fetchGistContent(gist) {
    console.log(`Fetching content for gist: ${gist.id}`);

    const response = await fetch(gist.url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      console.error(`GitHub API Error for gist ${gist.id}: ${response.status} ${response.statusText}`);
      console.error(`Gist URL: ${gist.url}`);

      if (response.status === 403) {
        console.error('Rate limit hit. Waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        return this.fetchGistContent(gist); // Retry once
      }

      throw new Error(`Failed to fetch gist content: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  parseGistAsPost(gist) {
    try {
      // Validate gist structure
      if (!gist?.files || typeof gist.files !== 'object') {
        console.log(`Skipping gist ${gist?.id || 'unknown'}: Invalid gist structure`);
        return null;
      }

      // Use the first markdown file as the main content
      const markdownFile = Object.values(gist.files).find(file =>
        file?.filename?.endsWith('.md') || file?.filename?.endsWith('.markdown')
      );

      if (!markdownFile?.content) {
        console.log(`Skipping gist ${gist.id}: No markdown file with content found`);
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
        tags: tags
      };

      // Validate essential fields
      if (!post.id || !post.title) {
        console.log(`Skipping gist ${gist.id}: Missing essential fields`);
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

  async loadTemplate(templateName) {
    try {
      const templatePath = path.join(this.templatesDir, templateName);
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      console.log(`Template ${templateName} not found, using default`);
      return this.getDefaultTemplate(templateName);
    }
  }

  getDefaultTemplate(templateName) {
    const templates = {
      'layout.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}} - rbstp.dev</title>
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="terminal-bg"></div>
    <header>
        <nav class="container">
            <div class="logo-section">
                <span class="terminal-prompt">$</span>
                <a href="/" class="logo">rbstp.dev</a>
                <span class="cursor">_</span>
            </div>
            <div class="nav-links">
                <a href="/" class="nav-item">
                    <i class="fas fa-code-branch nav-icon"></i>
                    <span>main</span>
                </a>
                <a href="https://github.com/rbstp" class="nav-item" target="_blank">
                    <i class="fab fa-github nav-icon"></i>
                    <span>github</span>
                </a>
            </div>
        </nav>
    </header>
    <main class="container">
        {{content}}
    </main>
    <footer class="container">
        <div class="footer-content">
            <div class="status-bar">
                <span class="status-item">
                    <span class="status-dot online"></span>
                    <span>system: operational</span>
                </span>
                <span class="status-item">
                    <span class="status-dot"></span>
                    <span>source: <a href="https://gist.github.com/rbstp">gists</a></span>
                </span>
                <span class="status-item">
                    <span class="status-dot"></span>
                    <span>build: automated</span>
                </span>
            </div>
            <p class="copyright">© 2025 rbstp.dev • powered by github actions</p>
        </div>
    </footer>
    <script>
        // Convert timestamps to local time
        document.addEventListener('DOMContentLoaded', function() {
            const timeElements = document.querySelectorAll('.local-time');
            timeElements.forEach(function(element) {
                const timestamp = element.getAttribute('data-timestamp');
                if (timestamp) {
                    const date = new Date(timestamp);
                    const options = { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false
                    };
                    element.textContent = date.toLocaleString('en-US', options);
                }
            });

            // Tag filtering functionality
            let activeTag = null;
            const posts = document.querySelectorAll('.post-card');
            const tags = document.querySelectorAll('.tag');

            // Create filter status display
            const section = document.querySelector('.pipeline-section');
            const filterStatus = document.createElement('div');
            filterStatus.className = 'filter-status';
            filterStatus.style.display = 'none';
            section.insertBefore(filterStatus, section.querySelector('.posts-grid'));

            tags.forEach(function(tag) {
                tag.addEventListener('click', function() {
                    const tagName = this.getAttribute('data-tag');
                    
                    if (activeTag === tagName) {
                        // Clear filter
                        activeTag = null;
                        posts.forEach(function(post) {
                            post.style.display = 'block';
                        });
                        tags.forEach(function(t) {
                            t.classList.remove('active');
                        });
                        filterStatus.style.display = 'none';
                    } else {
                        // Apply filter
                        activeTag = tagName;
                        let visibleCount = 0;
                        
                        posts.forEach(function(post) {
                            const postTags = post.querySelectorAll('.tag');
                            let hasTag = false;
                            postTags.forEach(function(t) {
                                if (t.getAttribute('data-tag') === tagName) {
                                    hasTag = true;
                                }
                            });
                            
                            if (hasTag) {
                                post.style.display = 'block';
                                visibleCount++;
                            } else {
                                post.style.display = 'none';
                            }
                        });

                        // Update tag highlighting
                        tags.forEach(function(t) {
                            if (t.getAttribute('data-tag') === tagName) {
                                t.classList.add('active');
                            } else {
                                t.classList.remove('active');
                            }
                        });

                        // Show filter status
                        filterStatus.innerHTML = 
                            '<div class="filter-info">' +
                                '<span class="filter-prompt">$</span>' +
                                '<span>grep --tag</span>' +
                                '<span class="filter-tag">#' + tagName + '</span>' +
                                '<span class="filter-count">→ ' + visibleCount + ' result' + (visibleCount !== 1 ? 's' : '') + '</span>' +
                                '<button class="clear-filter" onclick="location.reload()">clear</button>' +
                            '</div>';
                        filterStatus.style.display = 'block';
                    }
                });
            });
        });
    </script>
</body>
</html>`,

      'index.html': `<div class="hero-terminal">
    <div class="terminal-window">
        <div class="terminal-header">
            <div class="terminal-controls">
                <span class="control close"></span>
                <span class="control minimize"></span>
                <span class="control maximize"></span>
            </div>
            <div class="terminal-title">rbstp@devops:~$</div>
        </div>
        <div class="terminal-body">
            <div class="terminal-line">
                <span class="prompt">rbstp@devops:~$</span>
                <span class="command">whoami</span>
            </div>
            <div class="terminal-output">
                <span class="output-text">DevOps and Context Engineer</span>
            </div>
            <div class="terminal-line">
                <span class="prompt">rbstp@devops:~$</span>
                <span class="command">ls -la blog/</span>
            </div>
            <div class="terminal-output">
                <span class="output-text">total {{postsLength}} posts</span>
            </div>
            <div class="terminal-line">
                <span class="prompt">rbstp@devops:~$</span>
                <span class="command">cat latest_thoughts.md</span>
            </div>
        </div>
    </div>
</div>

<section class="pipeline-section">
    <div class="section-header">
        <h2 class="section-title">
            <span class="section-icon">📦</span>
            Latest Deployments
        </h2>
        <div class="pipeline-status">
            <span class="build-status success">✓ Build Success</span>
            <span class="deploy-time">Last deploy: <span class="local-time" data-timestamp="{{lastUpdate}}">{{lastUpdate}}</span></span>
        </div>
    </div>
    
    <div class="posts-grid">
        {{#posts}}
        <article class="post-card">
            <div class="card-header">
                <div class="commit-info">
                    <span class="commit-hash">#{{shortId}}</span>
                    <span class="branch-name">main</span>
                </div>
                <div class="deploy-status">
                    <span class="status-indicator deployed"></span>
                    <span class="status-text">deployed</span>
                </div>
            </div>
            
            <div class="card-content">
                <h3 class="post-title">
                    <a href="/posts/{{id}}.html">{{title}}</a>
                </h3>
                <div class="post-metadata">
                    <span class="metadata-item">
                        <span class="icon">📅</span>
                        <time datetime="{{createdAt}}">{{formattedDate}}</time>
                    </span>
                    {{#description}}
                    <span class="metadata-item">
                        <span class="icon">📝</span>
                        <span class="description">{{description}}</span>
                    </span>
                    {{/description}}
                    {{#hasTags}}
                    <div class="tags-container">
                        <span class="icon">🏷️</span>
                        {{#tags}}
                        <span class="tag" data-tag="{{.}}">#{{.}}</span>
                        {{/tags}}
                    </div>
                    {{/hasTags}}
                </div>
                
                <div class="post-preview">
                    <code class="preview-code">{{excerpt}}</code>
                </div>
                
                <div class="card-actions">
                    <a href="/posts/{{id}}.html" class="action-link primary">
                        <span class="action-icon">→</span>
                        <span>deploy --read</span>
                    </a>
                    <a href="{{url}}" class="action-link secondary" target="_blank">
                        <span class="action-icon">⚡</span>
                        <span>source</span>
                    </a>
                </div>
            </div>
        </article>
        {{/posts}}
    </div>
</section>`,

      'post.html': `<article class="post-container">
    <div class="post-navigation">
        <a href="/" class="back-link">
            <span class="nav-arrow">←</span>
            <span>back to pipeline</span>
        </a>
        <div class="post-actions">
            <a href="{{url}}" class="source-link" target="_blank">
                <span class="action-icon">⚡</span>
                <span>view source</span>
            </a>
        </div>
    </div>

    <header class="post-header-advanced">
        <div class="deployment-info">
            <div class="deployment-badge">
                <span class="deploy-icon">🚀</span>
                <span class="deploy-text">DEPLOYED</span>
            </div>
            <div class="commit-details">
                <span class="commit-label">commit:</span>
                <span class="commit-hash">{{shortId}}</span>
            </div>
        </div>
        
        <h1 class="post-title-advanced">{{title}}</h1>
        
        <div class="post-metadata-advanced">
            <div class="metadata-row">
                <div class="metadata-group">
                    <span class="metadata-label">deployed:</span>
                    <time datetime="{{createdAt}}" class="metadata-value">{{formattedDate}}</time>
                </div>
                {{#updatedAt}}
                <div class="metadata-group">
                    <span class="metadata-label">updated:</span>
                    <time datetime="{{updatedAt}}" class="metadata-value">{{formattedUpdateDate}}</time>
                </div>
                {{/updatedAt}}
            </div>
            <div class="metadata-row">
                <div class="metadata-group">
                    <span class="metadata-label">pipeline:</span>
                    <span class="metadata-value">gist → actions → pages</span>
                </div>
                <div class="metadata-group">
                    <span class="metadata-label">status:</span>
                    <span class="metadata-value success">✓ operational</span>
                </div>
            </div>
        </div>
    </header>
    
    <div class="post-content-wrapper">
        <div class="content-terminal">
            <div class="terminal-header-small">
                <div class="terminal-controls-small">
                    <span class="control-small close"></span>
                    <span class="control-small minimize"></span>
                    <span class="control-small maximize"></span>
                </div>
                <div class="terminal-title-small">{{title}}.md</div>
            </div>
            <div class="post-content-advanced">
                {{htmlContent}}
            </div>
        </div>
    </div>
</article>`
    };

    return templates[templateName] || '';
  }

  escapeHtml(unsafe) {
    // Use a more performant approach with a single replace call
    const htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return unsafe.replace(/[&<>"']/g, (match) => htmlEscapeMap[match]);
  }

  simpleTemplateEngine(template, data) {
    let result = template;

    // Handle simple loops {{#posts}}...{{/posts}} and conditional content first
    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
      const items = data[key];

      // If it's an array, treat as a loop
      if (Array.isArray(items)) {
        return items.map((item, index) => {
          if (index === 0) console.log(`Processing ${items.length} ${key} items`);
          // Handle primitive arrays (strings, numbers) with {{.}} syntax
          if (typeof item === 'string' || typeof item === 'number') {
            return content.replace(/\{\{\.\}\}/g, item);
          }
          // Handle object arrays normally
          return this.simpleTemplateEngine(content, item);
        }).join('');
      }

      // If it's a truthy value, treat as conditional content
      if (items) {
        return this.simpleTemplateEngine(content, data);
      }

      // Otherwise, return empty string
      return '';
    });

    // Handle simple variable substitution {{variable}} after loops
    result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
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

  async generateIndex(posts) {
    const layoutTemplate = await this.loadTemplate('layout.html');
    const indexTemplate = await this.loadTemplate('index.html');

    // Sort posts by creation date (newest first)
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Add formatted dates and excerpts
    const postsWithMeta = sortedPosts.map(post => ({
      ...post,
      formattedDate: format(parseISO(post.createdAt), 'MMM d, yyyy'),
      excerpt: post.content.substring(0, EXCERPT_LENGTH) + (post.content.length > EXCERPT_LENGTH ? '...' : ''),
      shortId: post.id.substring(0, COMMIT_HASH_LENGTH),
      lastUpdate: format(new Date(), 'MMM d, HH:mm'),
      hasTags: post.tags && post.tags.length > 0
    }));

    const indexContent = this.simpleTemplateEngine(indexTemplate, {
      posts: postsWithMeta,
      postsLength: postsWithMeta.length,
      lastUpdate: new Date().toISOString()
    });
    const fullPage = this.simpleTemplateEngine(layoutTemplate, {
      title: 'Main',
      content: indexContent
    });

    await fs.writeFile(path.join(this.distDir, 'index.html'), fullPage);
  }

  async generatePost(post) {
    const layoutTemplate = await this.loadTemplate('layout.html');
    const postTemplate = await this.loadTemplate('post.html');

    const postData = {
      ...post,
      formattedDate: format(parseISO(post.createdAt), 'MMM d, yyyy'),
      formattedUpdateDate: post.updatedAt !== post.createdAt ?
        format(parseISO(post.updatedAt), 'MMM d, yyyy') : null,
      shortId: post.id.substring(0, COMMIT_HASH_LENGTH)
    };

    const postContent = this.simpleTemplateEngine(postTemplate, postData);
    const fullPage = this.simpleTemplateEngine(layoutTemplate, {
      title: post.title,
      content: postContent
    });

    const postsDir = path.join(this.distDir, 'posts');
    await fs.mkdir(postsDir, { recursive: true });
    await fs.writeFile(path.join(postsDir, `${post.id}.html`), fullPage);
  }

  async copyStyles() {
    const defaultCSS = `:root {
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-tertiary: #21262d;
    --bg-card: #0d1117;
    --border-primary: #30363d;
    --border-accent: #f78166;
    --text-primary: #f0f6fc;
    --text-secondary: #8b949e;
    --text-muted: #6e7681;
    --accent-primary: #58a6ff;
    --accent-secondary: #f78166;
    --accent-success: #3fb950;
    --accent-warning: #d29922;
    --accent-error: #f85149;
    --terminal-green: #39d353;
    --terminal-blue: #58a6ff;
    --terminal-orange: #ff7b72;
    --mono-font: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
    --sans-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--sans-font);
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    min-height: 100vh;
    position: relative;
}

.terminal-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 20% 80%, rgba(88, 166, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
    z-index: -1;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
}

header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--mono-font);
}

.terminal-prompt {
    color: var(--terminal-green);
    font-weight: 700;
}

.logo {
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 500;
    font-size: 1.1rem;
}

.cursor {
    color: var(--terminal-green);
    animation: blink 1s infinite;
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
}

.nav-links {
    display: flex;
    gap: 2rem;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-family: var(--mono-font);
    font-size: 0.9rem;
    transition: color 0.2s ease;
}

.nav-item:hover {
    color: var(--accent-primary);
}

.nav-icon {
    font-size: 0.8rem;
}

.hero-terminal {
    padding: 4rem 0 2rem;
    display: flex;
    justify-content: center;
}

.terminal-window {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 100%;
}

.terminal-header {
    background: var(--bg-secondary);
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-primary);
}

.terminal-controls {
    display: flex;
    gap: 0.5rem;
}

.control {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.control.close { background: var(--accent-error); }
.control.minimize { background: var(--accent-warning); }
.control.maximize { background: var(--accent-success); }

.terminal-title {
    color: var(--text-secondary);
    font-family: var(--mono-font);
    font-size: 0.85rem;
}

.terminal-body {
    padding: 1.5rem;
    font-family: var(--mono-font);
    font-size: 0.9rem;
}

.terminal-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.prompt {
    color: var(--terminal-green);
    font-weight: 500;
}

.command {
    color: var(--terminal-blue);
}

.terminal-output {
    margin-left: 2rem;
    margin-bottom: 1rem;
}

.output-text {
    color: var(--text-secondary);
}

.typing-animation {
    animation: typing 2s steps(20) infinite;
}

.cursor-blink {
    color: var(--terminal-green);
    animation: blink 1s infinite;
}

.pipeline-section {
    padding: 3rem 0;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-primary);
}

.section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
}

.section-icon {
    font-size: 1.2rem;
}

.pipeline-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-family: var(--mono-font);
    font-size: 0.85rem;
}

.build-status {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-weight: 500;
}

.build-status.success {
    background: rgba(63, 185, 80, 0.15);
    color: var(--accent-success);
    border: 1px solid var(--accent-success);
}

.deploy-time {
    color: var(--text-muted);
}

.posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
}

.post-card {
    background: var(--bg-card);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s ease;
    position: relative;
}

.post-card:hover {
    border-color: var(--accent-primary);
    box-shadow: 0 8px 32px rgba(88, 166, 255, 0.1);
    transform: translateY(-2px);
}

.card-header {
    background: var(--bg-secondary);
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-primary);
}

.commit-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--mono-font);
    font-size: 0.8rem;
}

.commit-hash {
    color: var(--terminal-orange);
    font-weight: 500;
}

.branch-name {
    background: rgba(88, 166, 255, 0.15);
    color: var(--accent-primary);
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    border: 1px solid var(--accent-primary);
}

.deploy-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--mono-font);
    font-size: 0.75rem;
}

.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.status-indicator.deployed {
    background: var(--accent-success);
    box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
}

.status-text {
    color: var(--accent-success);
    text-transform: uppercase;
    font-weight: 500;
}

.card-content {
    padding: 1.5rem;
}

.post-title {
    margin-bottom: 1rem;
}

.post-title a {
    color: var(--text-primary);
    text-decoration: none;
    font-size: 1.2rem;
    font-weight: 600;
    transition: color 0.2s ease;
}

.post-title a:hover {
    color: var(--accent-primary);
}

.post-metadata {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
}

.metadata-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
}

.icon {
    font-size: 0.75rem;
}

.description {
    color: var(--text-muted);
    font-style: italic;
}

.tags-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.tag {
    background: rgba(88, 166, 255, 0.15);
    color: var(--accent-primary);
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--accent-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--mono-font);
}

.tag:hover {
    background: var(--accent-primary);
    color: var(--bg-primary);
    transform: translateY(-1px);
}

.tag.active {
    background: var(--accent-primary);
    color: var(--bg-primary);
    box-shadow: 0 2px 8px rgba(88, 166, 255, 0.3);
}

.filter-status {
    background: #161b22 !important;
    border: 1px solid var(--accent-primary);
    border-radius: 6px;
    padding: 1rem 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 16px rgba(88, 166, 255, 0.1);
}

.filter-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-family: var(--mono-font);
    font-size: 0.85rem;
    color: var(--text-primary);
}

.filter-prompt {
    color: var(--terminal-green);
    font-weight: 600;
}

.filter-tag {
    background: rgba(88, 166, 255, 0.15);
    color: var(--accent-primary);
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--accent-primary);
    font-weight: 500;
}

.filter-count {
    color: var(--text-secondary);
    font-style: italic;
}

.clear-filter {
    background: var(--bg-primary);
    color: var(--terminal-orange);
    border: 1px solid var(--terminal-orange);
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: var(--mono-font);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
}

.clear-filter:hover {
    background: var(--terminal-orange);
    color: var(--bg-primary);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(255, 123, 114, 0.3);
}

.post-preview {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 1rem;
    margin: 1rem 0;
}

.preview-code {
    font-family: var(--mono-font);
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
    display: block;
}

.card-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-primary);
}

.action-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    text-decoration: none;
    font-family: var(--mono-font);
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.action-link.primary {
    background: var(--accent-primary);
    color: var(--bg-primary);
}

.action-link.primary:hover {
    background: var(--terminal-blue);
    transform: translateX(2px);
}

.action-link.secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
}

.action-link.secondary:hover {
    border-color: var(--accent-secondary);
    color: var(--accent-secondary);
}

.action-icon {
    font-size: 0.75rem;
}

.post-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 0;
}

.post-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-primary);
}

.back-link, .source-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-family: var(--mono-font);
    font-size: 0.9rem;
    transition: color 0.2s ease;
}

.back-link:hover, .source-link:hover {
    color: var(--accent-primary);
}

.post-header-advanced {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
}

.deployment-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.deployment-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(63, 185, 80, 0.15);
    color: var(--accent-success);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--accent-success);
    font-family: var(--mono-font);
    font-size: 0.8rem;
    font-weight: 600;
}

.commit-details {
    font-family: var(--mono-font);
    font-size: 0.85rem;
}

.commit-label {
    color: var(--text-muted);
}

.commit-hash {
    color: var(--terminal-orange);
    font-weight: 500;
}

.post-title-advanced {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: var(--text-primary);
}

.post-metadata-advanced {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: var(--mono-font);
    font-size: 0.85rem;
}

.metadata-row {
    display: flex;
    gap: 2rem;
}

.metadata-group {
    display: flex;
    gap: 0.5rem;
}

.metadata-label {
    color: var(--text-muted);
}

.metadata-value {
    color: var(--text-secondary);
}

.metadata-value.success {
    color: var(--accent-success);
}

.content-terminal {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    overflow: hidden;
}

.terminal-header-small {
    background: var(--bg-secondary);
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-primary);
}

.terminal-controls-small {
    display: flex;
    gap: 0.3rem;
}

.control-small {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.control-small.close { background: var(--accent-error); }
.control-small.minimize { background: var(--accent-warning); }
.control-small.maximize { background: var(--accent-success); }

.terminal-title-small {
    color: var(--text-secondary);
    font-family: var(--mono-font);
    font-size: 0.8rem;
}

.post-content-advanced {
    padding: 2rem;
    line-height: 1.8;
}

.post-content-advanced h1,
.post-content-advanced h2,
.post-content-advanced h3,
.post-content-advanced h4 {
    color: var(--text-primary);
    margin: 2rem 0 1rem 0;
    font-weight: 600;
}

.post-content-advanced h1 { font-size: 2rem; }
.post-content-advanced h2 { font-size: 1.5rem; }
.post-content-advanced h3 { font-size: 1.25rem; }

.post-content-advanced p {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
}

.post-content-advanced ul,
.post-content-advanced ol {
    margin: 1rem 0;
    padding-left: 2rem;
}

.post-content-advanced li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
}

.post-content-advanced pre {
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    padding: 1.5rem;
    margin: 1.5rem 0;
    overflow-x: auto;
    font-family: var(--mono-font);
    font-size: 0.85rem;
    line-height: 1.5;
}

.post-content-advanced code {
    font-family: var(--mono-font);
    font-size: 0.85rem;
    background: var(--bg-primary);
    color: var(--terminal-orange);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    border: 1px solid var(--border-primary);
}

.post-content-advanced pre code {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
}

.post-content-advanced blockquote {
    border-left: 3px solid var(--accent-primary);
    background: var(--bg-secondary);
    padding: 1rem 1.5rem;
    margin: 1.5rem 0;
    border-radius: 0 4px 4px 0;
}

.post-content-advanced blockquote p {
    margin: 0;
    color: var(--text-secondary);
    font-style: italic;
}

.post-content-advanced a {
    color: var(--accent-primary);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
}

.post-content-advanced a:hover {
    border-bottom-color: var(--accent-primary);
}

footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-primary);
    padding: 2rem 0;
    margin-top: 4rem;
}

.footer-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.status-bar {
    display: flex;
    gap: 2rem;
    font-family: var(--mono-font);
    font-size: 0.8rem;
}

.status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
}

.status-dot.online {
    background: var(--accent-success);
    box-shadow: 0 0 6px rgba(63, 185, 80, 0.5);
}

.status-item a {
    color: var(--accent-primary);
    text-decoration: none;
}

.status-item a:hover {
    text-decoration: underline;
}

.copyright {
    color: var(--text-muted);
    font-size: 0.8rem;
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-primary);
}

@keyframes typing {
    0% { width: 0; }
    50% { width: 100%; }
    100% { width: 0; }
}

@media (max-width: 768px) {
    .container {
        padding: 0 1rem;
    }
    
    nav {
        flex-direction: column;
        gap: 1rem;
    }
    
    .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }
    
    .posts-grid {
        grid-template-columns: 1fr;
    }
    
    .post-title-advanced {
        font-size: 2rem;
    }
    
    .metadata-row {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .deployment-info {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }
    
    .terminal-window {
        margin: 0 1rem;
    }
    
    .status-bar {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .post-navigation {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
    }
    
    .card-actions {
        flex-direction: column;
    }
}`;

    await fs.writeFile(path.join(this.distDir, 'styles.css'), defaultCSS);
  }

  async build() {
    console.log('Starting blog build...');

    // Create dist directory
    await fs.mkdir(this.distDir, { recursive: true });

    // Fetch gists
    console.log(`Fetching gists for user: ${this.gistUsername}`);
    const gists = await this.fetchGists();
    console.log(`Found ${gists.length} public gists`);

    // Process gists into posts in parallel
    console.log(`Processing ${gists.length} gists...`);
    const gistPromises = gists.map(async (gist) => {
      console.log(`Processing gist: ${gist.id}`);
      try {
        const fullGist = await this.fetchGistContent(gist);
        return this.parseGistAsPost(fullGist);
      } catch (error) {
        console.error(`Failed to process gist ${gist.id}:`, error.message);
        return null;
      }
    });

    const processedPosts = await Promise.all(gistPromises);
    const posts = processedPosts.filter(Boolean);

    // Generate post files in parallel
    const postGenerationPromises = posts.map(async (post) => {
      await this.generatePost(post);
      console.log(`Generated post: ${post.title}`);
    });
    
    await Promise.all(postGenerationPromises);

    // Generate index page
    await this.generateIndex(posts);
    console.log('Generated index page');

    // Copy styles
    await this.copyStyles();
    console.log('Copied styles');

    console.log(`Blog build complete! Generated ${posts.length} posts.`);
  }
}

// Run the build
const generator = new GistBlogGenerator();
generator.build().catch(console.error);
