# Gist Blog Generator

> "There and Back Again: A DevOps Engineer's Journey Through AI and Infrastructure"

Transform your GitHub Gists into a beautiful, terminal-themed static blog with automatic RSS feeds, tag filtering, and modern responsive design.

## 🚀 Features

### Core Functionality
- **GitHub Gists Integration** - Automatically fetches and converts your public gists to blog posts
- **Markdown Processing** - Full markdown support with syntax highlighting via highlight.js
- **Terminal Theme** - Cyberpunk/DevOps aesthetic with green terminal prompts and dark theme
- **Static Generation** - Builds fast, lightweight HTML files ready for deployment

### Advanced Features
- **Tag System** - Extract hashtags from gist descriptions for automatic categorization
- **Interactive Filtering** - Click tags to filter posts with terminal-style status display
- **RSS Feed** - Auto-generated RSS 2.0 feed with proper metadata and categories
- **Responsive Design** - Mobile-optimized layouts with compact headers
- **Cache Busting** - Automatic CSS versioning for instant updates

### UI/UX Highlights
- **Blinking Terminal Cursor** - Authentic terminal feel in the header
- **Pipeline Theme** - Posts displayed as "deployments" with commit hashes
- **Compact Post Headers** - Mobile-friendly design that prioritizes content
- **Tag Filtering UI** - Terminal-style filter display: `$ grep --tag #ai → 1 result`

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
   
   Edit `src/build.js` and update the username:
   ```javascript
   this.gistUsername = process.env.GIST_USERNAME || 'your-github-username';
   ```

   Or set an environment variable:
   ```bash
   export GIST_USERNAME=your-github-username
   ```

4. **Build your blog**
   ```bash
   node src/build.js
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

## 🎨 Customization

### Styling
- Colors and theme variables are in the CSS section of `src/build.js`
- Terminal theme uses GitHub dark color palette
- Fonts: JetBrains Mono (code) + Inter (text)

### Templates
The system includes built-in templates for:
- `layout.html` - Main page wrapper with navigation
- `index.html` - Homepage with post grid
- `post.html` - Individual post pages

Override by creating files in `templates/` directory.

### Site Configuration
Edit the constants in `src/build.js`:
```javascript
const RATE_LIMIT_DELAY = 60000;  // GitHub rate limit delay
const EXCERPT_LENGTH = 150;      // Post preview length
const COMMIT_HASH_LENGTH = 7;    // Hash display length
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
    - run: node src/build.js
      env:
        GIST_USERNAME: ${{ github.repository_owner }}
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
- **Build-time processing** with Node.js
- **GitHub API integration** for gist fetching
- **Rate limit handling** with automatic retries

### Features Deep Dive

**Tag System**
- Extracts `#tagname` from gist descriptions
- Creates interactive filter buttons
- Terminal-style filter status display
- Maintains clean descriptions without hashtags

**RSS Feed**
- Full RSS 2.0 compliance
- Post categories from tags
- Proper CDATA encoding
- Self-referencing atom:link

**Performance**
- Parallel gist processing
- Minimal CSS/JS payload
- Static HTML generation
- Browser caching with timestamps

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
