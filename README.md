# Gist Blog Generator

> "There and Back Again: A DevOps Engineer's Journey Through AI and Infrastructure"

Transform your GitHub Gists into a beautiful, terminal-themed static blog with automatic RSS feeds, tag filtering, and modern responsive design.

## 🚀 Features

### Core Functionality

- **GitHub Gists Integration** - Automatically fetches and converts your public gists to blog posts
- **Markdown Processing** - Full markdown support with GitHub-style syntax highlighting
- **Dual Theme Support** - Light/dark mode toggle with system preference detection
- **Terminal Theme** - Cyberpunk/DevOps aesthetic with green terminal prompts
- **Static Generation** - Builds fast, lightweight HTML files ready for deployment

### Advanced Features

- **Theme Toggle** - Smart light/dark mode with system preference detection and localStorage persistence
- **Syntax Highlighting** - GitHub-style code highlighting with language-specific colors for XML, JSON, JavaScript, Python, CSS, and more
- **Multi-Tag System** - Extract hashtags from gist descriptions for automatic categorization
- **Advanced Filtering** - Select multiple tags with AND logic for precise content discovery
- **Reading Analytics** - Terminal-themed word count and estimated reading time for each post
- **Internal Gist Links** - Automatically converts your gist URLs to internal blog post links for seamless navigation
- **Table of Contents** - Automatic ToC generation with sticky sidebar navigation and active section highlighting
- **Permalink Navigation** - Click-to-copy section links with smooth scrolling
- **Global Tag Graph** - Explore connections between tags across all posts; hover to highlight, click a tag to filter the homepage
  - Pointer-centered zoom, pinch-zoom on touch, double-tap to zoom, and a reset view button
- **RSS Feed** - Auto-generated RSS 2.0 feed with proper metadata and categories
- **Responsive Design** - Mobile-optimized layouts with compact headers
- **Cache Busting** - Timestamp-driven cache busting for CSS and JS assets

### UI/UX Highlights

- **Modern Graph Styling** - Terminal-themed graph visualizations with grid backgrounds, subtle glows, and improved accessibility
- **Interactive Tag Graphs** - Explore tag connections with hover highlighting, pointer-centered zoom, pinch gestures, and keyboard navigation
- **Theme Switching** - Seamless light/dark mode toggle in navigation bar
- **Interactive Terminal Windows** - Functional close, minimize, and maximize buttons with hover icons
- **Multi-Tag Filtering** - Select multiple tags with AND logic for precise content discovery
- **Reading Metrics** - Terminal commands show word count and reading time: `$ wc -w file.md` → `1151 words`
- **Sticky Table of Contents** - Desktop-only floating sidebar with active section highlighting
- **Permalink Anchors** - Hover-activated # links for easy section sharing
- **Blinking Terminal Cursor** - Authentic terminal feel in the header
- **Pipeline Theme** - Posts displayed as "deployments" with commit hashes
- **Compact Post Headers** - Mobile-friendly design that prioritizes content
- **Advanced Tag Filtering UI** - Multi-tag display: `$ grep --tag #ai #devops → 3 results`

## 🛠 Setup

### Prerequisites

- Node.js 24+
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd gist-blog
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure your username**

Prefer setting an environment variable:

```bash
export GIST_USERNAME=your-github-username
```

Or change the default in `src/lib/config.js`:

```javascript
DEFAULT_GIST_USERNAME: process.env.GIST_USERNAME || 'rbstp';
```

4. **Optional: Configure RSS metadata**

   ```bash
   export SITE_URL=https://yourdomain.com
   export SITE_TITLE="Your Blog Title"
   export SITE_DESCRIPTION="Your blog description"
   ```

5. **Build your blog**
   ```bash
   npm run build
   # or directly: node src/build.js
   ```

### Linting

This repo uses ESLint (flat config) for JS and CSS.

- Run lints:
  ```bash
  npm run lint
  ```
- Auto-fix what can be fixed:
  ```bash
  npm run lint:fix
  ```

Notes:

- Generated output in `dist/` and the local cache `.cache/` are ignored by ESLint.
- CSS linting is scoped to `src/**/*.css`. Rules that flagged modern properties and important flags have been relaxed for this project.

#### Optional: GitHub token and conditional requests

To improve reliability and speed (especially in CI), you can provide a personal access token and benefit from conditional requests:

- Set `GITHUB_TOKEN` to raise rate limits for the GitHub API.
- The build uses ETags (`If-None-Match`) for both the gist list and per‑gist requests; when content is unchanged, cached data from `.cache/` is reused after a `304 Not Modified` response.

Example (macOS zsh):

```bash
export GITHUB_TOKEN=ghp_your_token_here
export GIST_USERNAME=your-github-username
npm run build
```

### Performance controls (optional)

- Fetch concurrency: set `FETCH_CONCURRENCY` (default 5) to control parallel GitHub requests during build.
- Local API caching: set `GIST_CACHE=true|false` (default true in local dev) to enable/disable on-disk caching under `.cache/`.
  - Cache TTLs can be tuned via `GIST_CACHE_TTL_LIST_MS` (default 600000 = 10m) and `GIST_CACHE_TTL_GIST_MS` (default 3600000 = 60m).
- Post-build minification runs automatically. The `postbuild` script minifies HTML, inline JS/CSS, and `styles.css`.

In CI, you can disable caching to always fetch fresh data:

```bash
GIST_CACHE=false npm run build
```

If rate limits are hit in CI, set a `GITHUB_TOKEN` secret and pass it to the build environment.

## 📝 Usage

### Creating Blog Posts

1. **Create a Gist** on GitHub with a `.md` file
2. **Add tags** to your gist description using hashtags:
   ```
   Fix for CLI tools running in monochrome mode #ai #cli #fix
   ```
3. **Run the build** - your gist becomes a blog post automatically

### Gist Structure

Your gist should contain:

- At least one `.md` or `.markdown` file
- Optional: Title as first H1 heading, otherwise filename is used
- Optional: Multiple files (first markdown file becomes the post)

### Tag System

Add hashtags anywhere in your gist description:

- `#ai #devops #tutorial` → Creates clickable filter tags
- Tags are extracted and removed from the display description
- Click tags to filter posts with a terminal-style interface

### Internal Gist Links

When you reference your own gists in markdown content, they automatically become internal links:

**Before (in your markdown):**

```markdown
Check out my other post: https://gist.github.com/rbstp/abc123def456
```

**After (in generated HTML):**

```markdown
Check out my other post: /posts/abc123def456.html
```

**Features:**

- **Username-specific**: Only your gist URLs are converted (preserves external links to other users' gists)
- **All markdown formats**: Works with inline links, reference links, and plain URLs
- **Build-time transformation**: No performance impact on site visitors
- **Cross-post navigation**: Create seamless content series and references

### Table of Contents & Navigation

**Automatic ToC Generation:**

- **Smart Detection** - Automatically generates ToC for posts with heading levels 2-6 (`##`, `###`, etc.)
- **Terminal Styling** - ToC styled as terminal window with `$ grep -n "^##" filename.md` command
- **Desktop Only** - ToC appears as floating sidebar on desktop, hidden on mobile for clean mobile experience

**Interactive Features:**

- **Sticky Positioning** - ToC follows along as you scroll, always accessible
- **Active Section Highlighting** - Current section highlighted in blue with bold text
- **Smooth Scrolling** - Clicking ToC links smoothly scrolls to target section
- **Permalink Anchors** - Hover over headings to reveal clickable # symbols for easy link sharing

**Layout:**

- **Container-Aligned** - On wide viewports, the ToC/graph sidebar aligns with the main content container
- **Smart Sizing** - Width uses a clamp (min ~240px, ideal ~22vw, max ~360px) for a stable ratio across screen sizes
- **Fallback Docking** - If there isn’t enough room next to content, it docks to the right edge and reserves space so content isn’t overlapped
- **Responsive Behavior** - Hidden only on narrower screens (≤1080px) or when there truly isn’t space
- **Footer-Aware** - Sidebar height shrinks as the footer enters view so they never overlap

### Terminal Controls

**Interactive Terminal Windows** (Available on index page):

- **Close Button** (red) - Hides the entire terminal section
- **Minimize Button** (yellow) - Collapses terminal to header-only view
- **Maximize Button** (green) - Expands terminal to full width
- **Hover Effects** - Shows macOS-style icons (×, −, ⇱) when hovering over buttons

**Post Page Terminals**:

- **Terminal Header** - Shows `$ cat filename.md` with green prompt and blue command
- **Static Display** - No interactive controls for cleaner reading experience

**Multi-Tag Filtering System**:

- **Multiple Selection**: Click multiple tags to combine filters using AND logic
- **Toggle Behavior**: Click active tags to remove them, inactive tags to add them
- **Maximize Access**: Maximize the pagination terminal to reveal all available tags
- **Synchronized State**: Tags in pagination terminal sync with main post area
- **Smart Display**: Filter status shows all active tags: `$ grep --tag #ai #devops → 3 results`
- **Persistent Terminal**: Pagination terminal stays visible when tags are active
- **Precise Filtering**: Posts must contain ALL selected tags to appear in results

**Dev Mode Easter Egg** 🎯:

- **Activation**: Click the "main" branch button in the top navigation
- **Chaos Mode**: Instantly transforms the site into a DevOps disaster scenario
- **Visual Changes**: Build failures, error indicators, emergency rollback messages
- **Branch Switch**: Navigation and post cards change from "main" to "dev" branch
- **Authentic Errors**: Realistic terminal output with deployment failures and database issues
- **Toggle Back**: Click "dev" button to restore normal operation
- **No Persistence**: Easter egg resets on page reload for clean demo experience

## 🕸 Global Tag Graph

Navigate to `/graph.html` (also available in the header) to explore connections between tags across all posts.

- Uses the generated `dist/graph.json` (built from post tags during `npm run build`)
- Interactions:
  - Pan: click/touch-drag to move the graph
  - Zoom toward pointer: mouse wheel zoom is centered on the cursor
  - Pinch-zoom (mobile/tablet): two-finger pinch to zoom with the midpoint anchored
  - Double-tap to zoom toward the tap point
  - Reset: a small “reset” button in the top-right restores the default view
  - Hover: highlight neighbors when hovering a tag (desktop)
- Click a tag to jump back to the homepage with that tag preselected (filter applied automatically)
- Node sizes scale with tag frequency; edge widths scale with co-occurrence weight

Post pages also include a compact topic graph (in the ToC sidebar on desktop) with the same pan/zoom/double‑tap/reset behavior.

Notes:

- By default, the graph includes up to 20 most frequent tags. You can change this via `GRAPH_MAX_NODES` in `src/lib/config.js` (or env var `GRAPH_MAX_NODES`).

## 🎨 Customization

### Styling

- **Dual Theme Support** with CSS custom properties in `src/styles/main.css`
- **Dark Theme**: GitHub dark color palette (`--bg-primary: #0d1117`)
- **Light Theme**: Clean light palette (`--bg-primary: #ffffff`)
- **System Integration**: Automatically detects and follows OS preference
- **Manual Override**: Theme toggle persists user choice in localStorage
- Fonts: JetBrains Mono (code) + Inter (text)

### Templates

The system includes built-in templates for:

- `layout.html` - Main page wrapper with navigation; loads `/assets/main.js` with a build timestamp
- `index.html` - Homepage with post grid
- `post.html` - Individual post pages with compact topic graph and ToC sidebar; no inline scripts or styles
- `graph.html` - Global tag graph page; scripts are loaded dynamically by `main.js`

Override by creating files in `templates/` directory.

### Site Configuration

Most knobs live in `src/lib/config.js` and can also be set via environment variables:

- `POSTS_PER_PAGE` (default 6)
- `GRAPH_MAX_NODES` (default 20)
- `GIST_USERNAME` (default from `DEFAULT_GIST_USERNAME`)
- `GIST_CACHE` (true/false), `GIST_CACHE_TTL_LIST_MS`, `GIST_CACHE_TTL_GIST_MS`
- `FETCH_CONCURRENCY` (default 5)

Configure RSS feed via environment variables:

```bash
export SITE_URL=https://yourdomain.com
export SITE_TITLE="Your Blog Title"
export SITE_DESCRIPTION="Your blog description"
```

## 🚀 Deployment

### GitHub Actions

Create `.github/workflows/build-blog.yml`:

````yaml
name: Build and Deploy Gist Blog

on:
  schedule:
    - cron: '47 * * * *'   # hourly
  workflow_dispatch:        # manual trigger
  push:
    branches: [ master ]
    paths:
      - 'src/**'
      - '.github/workflows/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '24'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Lint
      run: npm run lint

  - name: Build site
      env:
        GIST_USERNAME: ${{ github.repository_owner }}
        GIST_CACHE: false
      run: npm run build

    - name: Setup Pages
      uses: actions/configure-pages@v4

    - name: Upload artifact
      uses: actions/upload-pages-artifact@v3
      with:
        path: './dist'
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
### Architecture
- **Zero dependencies** at runtime (pure HTML/CSS/JS)
- **Modular build system** with separated concerns:
  - `BlogGenerator.js` - Build orchestrator: fetch → parse → shape → render → emit
  - `GistParser.js` - High-level parser delegating to focused modules
  - `TagManager.js` - Extracts/cleans hashtags with caching
  - `MarkdownProcessor.js` - marked + highlight.js wrapper with anchors/ToC and caching
  - `LinkTransformer.js` - Converts own gist URLs into internal post links
  - `GraphBuilder.js` - Builds tag co-occurrence graph data
  - `DataShaper.js` - Shapes view-models for templates (single-pass reduce, DI for date utils)
  - `TemplateEngine.js` - Custom mustache-like template rendering
  - `TemplateLoader.js` - Cached template file loader
  - `RSSGenerator.js` - RSS feed generation with configurable metadata
  - `config.js` - Central configuration (env + defaults)
  - `Cache.js` - JSON/ETag on-disk caching
  - `GitHubClient.js` - Fetch with timeout, ETag handling, 304 reuse, 403 backoff
  - `AsyncPool.js` - Controlled concurrency helper
  - `DateUtils.js` - ISO date formatting utilities
- **External templates** in `src/templates/` for easy customization
- **Rate limit handling** with automatic retries and 30s request timeouts
- **Template caching** for improved build performance
- **Controlled concurrency** for GitHub API requests

### Features Deep Dive

**Internal Gist Link Transformation**
- Regex-based URL transformation during markdown processing
- Username-specific filtering preserves external links to other users' gists
- Supports all markdown link formats (inline, reference, plain URLs)
- Build-time transformation for zero runtime performance impact
- Pattern matching: `https://gist.github.com/{username}/{gistId}` → `/posts/{gistId}.html`

**Multi-Tag System**
- Extracts `#tagname` from gist descriptions
- Supports multiple tag selection with AND logic
- Interactive filter buttons with toggle behavior
- Terminal-style filter status display showing all active tags
- Synchronized state across post area and pagination terminal
- Maintains clean descriptions without hashtags

**Reading Analytics**
- Calculates word count by removing markdown syntax and code blocks
- Estimates reading time based on 225 words per minute average
- Displays as terminal commands with color-coded output
- Green `$` prompt and blue command text for authenticity
- Two-line format: word count and reading time separately

**Table of Contents System**
- Extracts headings (levels 2-6) from markdown content during build
- Generates URL-friendly anchor IDs with proper slug formatting
- Custom marked.js renderer adds permalink anchors with hover effects
- JavaScript scroll tracking with throttled active section detection
- Fixed positioning with proper z-index management for overlay behavior
- CSS media queries ensure desktop-only display (hidden below 768px)
- Performance optimized with requestAnimationFrame for smooth scroll updates

**RSS Feed**
- Full RSS 2.0 compliance
- Post categories from tags
- Proper CDATA encoding
- Self-referencing atom:link

**Performance**
- Parallel gist processing with error resilience
- Template caching to reduce file I/O
- Pre-compiled regex patterns in template engine
- Request timeouts prevent hanging API calls
- Client-side pagination and filtering
- Minimal CSS/JS payload
- Static HTML generation
- Timestamp cache-busting for assets
- Lazy-loaded highlight.js only on pages containing code blocks
- rAF-throttled ToC layout adjustments on scroll/resize
- CSS `content-visibility` + `contain-intrinsic-size` to speed initial render of heavy/offscreen sections
- Respects `prefers-reduced-motion` to disable animations and smooth scrolling

### Build toolchain and assets

- Client scripts live in `src/client/` and are emitted to `dist/assets/` via esbuild
  - `main.js` is referenced once in `layout.html`; it lazy-loads page-specific modules (`graph-page.js`, `topic-graph-enhance.js`) when needed
  - Default build produces separate minified IIFEs without bundling for predictable filenames
  - Optional: enable bundling with environment variable `BUNDLE_CLIENT=true` (keeps filenames stable)
- Post-build minification uses `html-minifier-terser` on HTML and `styles.css`
- Timestamp is injected as `data-build-ts` on `<body>` and appended as `?v=...` to asset URLs for cache-busting

## 📁 Project structure

```
gist-blog/
├── CLAUDE.md
├── CNAME
├── LICENSE
├── README.md
├── eslint.config.mjs
├── package.json
├── scripts/
│   └── minify.js
├── src/
│   ├── build.js
│   ├── client/
│   │   ├── main.js
│   │   ├── graph-page.js
│   │   └── topic-graph-enhance.js
│   ├── lib/
│   │   ├── AsyncPool.js
│   │   ├── BlogGenerator.js
│   │   ├── Cache.js
│   │   ├── DataShaper.js
│   │   ├── DateUtils.js
│   │   ├── GistParser.js
│   │   ├── GitHubClient.js
│   │   ├── GraphBuilder.js
│   │   ├── LinkTransformer.js
│   │   ├── MarkdownProcessor.js
│   │   ├── RSSGenerator.js
│   │   ├── StringUtils.js
│   │   ├── TagManager.js
│   │   └── config.js
│   ├── styles/
│   │   └── main.css
│   └── templates/
│       ├── graph.html
│       ├── index.html
│       ├── layout.html
│       └── post.html
├── test/
│   ├── blog-generator.smoke.test.js
│   ├── bloggenerator.data.test.js
│   ├── cache.test.js
│   ├── config.test.js
│   ├── gist-parser.test.js
│   ├── github-client.test.js
│   └── template-engine.test.js
└── dist/
  ├── assets/
  │   ├── main.js
  │   ├── graph-page.js
  │   └── topic-graph-enhance.js
  ├── posts/
  │   └── {gist-id}.html
  ├── feed.xml
  ├── graph.html
  ├── index.html
  └── styles.css
```

**Pagination & Filtering**
- All posts loaded once for instant filtering
- Terminal-themed pagination UI
- Smart tag filtering across all posts
- No server requests for navigation

## 🧪 Testing

This repo uses Node’s built-in test runner (no external frameworks).

- Run tests:
  ```bash
  npm test
````

The tests isolate temp `dist/` and cache directories, and stub network calls where needed. The smoke test ensures the generator can build a minimal site with fake gist data.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the build process
5. Submit a pull request

## 📄 License

MIT License - feel free to use for your own blog!

---

_Built with ❤️ for developers who love terminals, gists, and clean code._
