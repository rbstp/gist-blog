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
- **RSS Feed** - Auto-generated RSS 2.0 feed with proper metadata and categories
- **Responsive Design** - Mobile-optimized layouts with compact headers
- **Cache Busting** - Automatic CSS versioning for instant updates

### UI/UX Highlights
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
   
   Edit `src/lib/BlogGenerator.js` and update the username:
   ```javascript
   this.gistUsername = process.env.GIST_USERNAME || 'your-github-username';
   ```

   Or set an environment variable:
   ```bash
   export GIST_USERNAME=your-github-username
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
- **Non-Intrusive** - ToC overlays as true sidebar without affecting post content width
- **Responsive Behavior** - Completely hidden on tablets and mobile devices
- **Proper Positioning** - Fixed positioning ensures ToC doesn't interfere with content layout

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
- `layout.html` - Main page wrapper with navigation
- `index.html` - Homepage with post grid
- `post.html` - Individual post pages

Override by creating files in `templates/` directory.

### Site Configuration
Edit the constants in `src/lib/BlogGenerator.js`:
```javascript
const RATE_LIMIT_DELAY = 60000;  // GitHub rate limit delay
const EXCERPT_LENGTH = 150;      // Post preview length
const COMMIT_HASH_LENGTH = 7;    // Hash display length
const POSTS_PER_PAGE = 6;        // Posts per page
```

Configure RSS feed via environment variables:
```bash
export SITE_URL=https://yourdomain.com
export SITE_TITLE="Your Blog Title" 
export SITE_DESCRIPTION="Your blog description"
```

## 🚀 Deployment

### GitHub Actions

Create `.github/workflows/build-blog.yml`:
```yaml
name: Build and Deploy Blog

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 */6 * * *'  # Build every 6 hours for new gists

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
    - run: npm install
    - run: npm run build
      env:
        GIST_USERNAME: ${{ github.repository_owner }}
        SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}
        SITE_TITLE: "${{ github.repository_owner }}'s Blog"
    - uses: actions/deploy-pages@v4
      with:
        artifact_name: dist
```

## 📊 Generated Files

```
dist/
├── index.html          # Homepage with post grid
├── feed.xml           # RSS 2.0 feed
├── styles.css         # All styling (embedded)
└── posts/
    └── {gist-id}.html # Individual post pages
```

## 🔧 Technical Details

### Architecture
- **Zero dependencies** at runtime (pure HTML/CSS/JS)
- **Modular build system** with separated concerns:
  - `BlogGenerator.js` - Core orchestration and GitHub API with timeout handling
  - `GistParser.js` - Markdown processing, tag extraction, and gist link transformation
  - `RSSGenerator.js` - RSS feed generation with configurable metadata
  - `TemplateEngine.js` - Custom template rendering with pre-compiled regex
- **External templates** in `src/templates/` for easy customization
- **Rate limit handling** with automatic retries and 30s request timeouts
- **Template caching** for improved build performance
- **Promise.allSettled** for resilient gist processing

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
- Browser caching with timestamps

**Pagination & Filtering**
- All posts loaded once for instant filtering
- Terminal-themed pagination UI
- Smart tag filtering across all posts
- No server requests for navigation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the build process
5. Submit a pull request

## 📄 License

MIT License - feel free to use for your own blog!

---

*Built with ❤️ for developers who love terminals, gists, and clean code.*
