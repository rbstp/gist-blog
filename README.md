# Gist Blog Generator

Turn your GitHub gists into a calm, editorial static blog: a dark (and light) design system, generated social cards, an RSS feed, topic filtering, an interactive topic graph and a client-side search dialog.

## 🚀 Features

### Core Functionality

- **GitHub Gists Integration** - Automatically fetches and converts your public gists to blog posts
- **Markdown Processing** - Full markdown support with build-time syntax highlighting (no client-side highlighter)
- **Editorial Design System** - Every colour, type step, space, radius, shadow and easing is a token in `variables.css`; sans-serif UI and prose, monospace reserved for code
- **Dual Theme Support** - Light/dark toggle with system preference detection and localStorage persistence
- **Social Cards** - A 1200×630 Open Graph image rendered per post at build time, plus canonical/OG/Twitter metadata on every page
- **Static Generation** - Builds fast, lightweight HTML files ready for deployment

### Advanced Features

- **Per-Topic Colours** - Each tag is hashed to a stable hue, so a topic keeps the same colour on chips, cards and social cards
- **Featured Post** - The newest post anchors the listing grid as a wide hero card
- **Relative Dates** - Recent posts read as "today" / "3 days ago" and carry a **New** badge; older ones show an absolute date
- **Multi-Tag System** - Extract hashtags from gist descriptions for automatic categorization
- **Advanced Filtering** - Select multiple topics with AND logic for precise content discovery
- **Reading Time** - Estimated reading time shown inline on each post (e.g. "2 min read")
- **Internal Gist Links** - Automatically converts your gist URLs to internal blog post links for seamless navigation
- **Table of Contents** - Automatic outline with a sticky sidebar (pure CSS grid, no layout JS) and active-section highlighting
- **Permalink Navigation** - Click-to-copy section links with smooth scrolling
- **Global Topic Graph** - Explore connections between topics across all posts; hover to highlight, click a topic to filter the writing page
  - Pointer-centered zoom, pinch-zoom on touch, double-tap to zoom, and a reset view button
- **RSS Feed** - Auto-generated RSS 2.0 feed with proper metadata and categories
- **Responsive Design** - Mobile-first layouts; the grid, hero and sidebar collapse gracefully
- **Cache Busting** - Timestamp-driven cache busting for CSS and JS assets

### UI/UX Highlights

- **Search Dialog** - Press `Cmd/Ctrl+K` for fuzzy search across posts, topics and pages, backed by a generated `search.json`
- **Copy Button for Code Blocks** - Hover over code blocks to reveal a **Copy** button with one-click copying and "Copied" feedback
- **Jump to Top** - Floating button appears when scrolled down (>400px) on long posts
- **Reading Progress** - Thin accent progress bar at the top of the viewport
- **Keyboard Shortcuts Help** - Press `?` to open a help dialog documenting all shortcuts (not shown on the graph page, which has its own)
- **Graph Search** - Real-time topic search on `/graph.html` with visual highlighting
- **Keyboard Navigation** - Full arrow key navigation on the graph page with `?` help overlay and `/` search shortcut
- **Graph Minimap** - Small overview showing viewport position within the larger topic graph
- **Skip Link & Focus Ring** - Visible focus styles and a skip-to-content link on every page
- **Content-Sized Cards** - Date, reading time, title, excerpt, topic chips and a source link
- **Topic Filter Status** - Shows active topics and the result count, with one-click removal

## 🛠 Setup

### Prerequisites

- Node.js 26+ (runs the TypeScript sources directly via native type stripping — no build step)
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

Or change the default in `src/lib/config.ts`:

```typescript
export const DEFAULT_GIST_USERNAME = process.env.GIST_USERNAME || 'rbstp';
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
   # or directly: node src/build.ts
   ```

### Linting

This repo uses ESLint (flat config) with [typescript-eslint](https://typescript-eslint.io/) for TypeScript and CSS.

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

### Type checking

The project is written in **TypeScript** and runs directly via Node's native type
stripping — there is no build/emit step. Type-check with:

```bash
npm run typecheck
```

This runs `tsc --noEmit` against `tsconfig.json` (Node generator code + tests) and
`tsconfig.client.json` (browser client scripts, checked against the DOM lib). CI runs
it on every push, after linting.

#### Optional: GitHub token and conditional requests

To improve reliability and speed (especially in CI), you can provide a personal access token and benefit from conditional requests:

- Set `GITHUB_TOKEN` to raise rate limits for the GitHub API.
- The build uses ETags (`If-None-Match`) for both the gist list and per‑gist requests; when content is unchanged, cached data from `.cache/` is reused after a `304 Not Modified` response.
- If an invalid or insufficient‑scope token causes a `401 Unauthorized`, the build now automatically retries the request **without** the token so public gist data can still be fetched. A warning is emitted and the build continues (helpful if a secret was rotated or missing).
- In CI, if **zero posts** are ultimately generated the build exits with code `2` to surface a likely auth or data issue early.

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

### GitHub Actions cache for API responses

The build stores normalized gist list + per‑gist JSON (plus ETags) in the local `.cache/` directory. In CI you can persist this between runs using `actions/cache` to drastically cut API calls and stay well below rate limits:

Benefits:

- Faster builds when nothing changed (many 304s avoided entirely – you never hit the network if still fresh in cache and TTL not expired).
- Reduced likelihood of secondary rate limiting on busy schedules.
- Allows safe increases to `FETCH_CONCURRENCY` for large gist sets.

Example snippet added before the build step:

```yaml
- name: Restore gist API cache
  uses: actions/cache@v4
  with:
    path: .cache
    key: gist-cache-${{ env.GIST_USERNAME }}-${{ hashFiles('package-lock.json') }}-${{ github.run_id }}
    restore-keys: |
      gist-cache-${{ env.GIST_USERNAME }}-
```

Key strategy rationale:

- Includes username so forks don’t collide.
- Includes a hash of `package-lock.json` so changes to dependencies (potentially affecting parsing logic) can naturally bust the cache.
- Appends `github.run_id` in the primary key so each run writes a fresh segment (avoids concurrent write races). The restore key prefix reuses the most recent cache from the same username if present.

TTL vs. cache persistence:

- Your internal TTLs (`GIST_CACHE_TTL_LIST_MS`, `GIST_CACHE_TTL_GIST_MS`) still gate staleness; even if a file is restored from cache, the code re-validates TTL before reusing.
- If you want to force a clean fetch while keeping the Action step, you can set `GIST_CACHE=false` for that run or tweak the key (e.g., add a manual suffix `-bust1`).

When NOT to cache:

- Extremely small gist sets (benefit negligible).
- Highly dynamic private gists (not applicable here since only public gists are used).

Local dev: caching is always on by default; Action-level caching only affects CI persistence.

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

- `#ai #devops #tutorial` → Creates clickable topic chips
- Tags are extracted and removed from the display description
- Each topic gets a stable colour (hashed in `src/lib/TagPalette.ts`) that follows it everywhere
- Click a chip anywhere on the site to filter the writing page by that topic

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

**Automatic outline generation:**

- **Smart Detection** - Automatically generates an outline for posts with heading levels 2-6 (`##`, `###`, etc.)
- **Desktop Only** - The outline is a sidebar column on wide screens and is dropped on narrow ones

**Interactive Features:**

- **Sticky Positioning** - The outline follows along as you scroll, always accessible
- **Active Section Highlighting** - The section being read is highlighted
- **Smooth Scrolling** - Clicking an outline link smoothly scrolls to the target section
- **Permalink Anchors** - Hover over headings to reveal clickable # symbols for easy link sharing

**Layout:**

- **CSS-only** - The article and sidebar are a two-column CSS grid with `position: sticky`; there is no measuring/positioning JavaScript
- **Reading Measure** - Body copy is capped at `--measure` (74ch) so long-form text stays comfortable
- **Graceful Collapse** - Below 64rem the sidebar (and its topic graph) is hidden and the article takes the full width

### Post Pages

- **Article nav** - "All posts" back link and a "View source" link to the originating gist
- **Header** - Date, reading time, title and topic chips
- **Sidebar** (desktop) - "On this page" outline plus a "Related topics" mini graph
- **Social card** - Each post gets `/og/<gist-id>.png` referenced from its Open Graph tags

### Topic Filtering

- **Filter Bar** - The most-used topics are shown with post counts (capped by `MAX_FILTER_TAGS`)
- **Multiple Selection** - Click multiple topics to combine filters using AND logic
- **Toggle Behavior** - Click active chips to remove them, inactive chips to add them
- **Filter Status** - Shows the active topics and result count, each chip removable
- **Precise Filtering** - Posts must contain ALL selected topics to appear in results
- **Clean Pager** - "Page X of Y" with Previous/Next and numbered pages (client-side, no reloads)

## 🕸 Global Tag Graph

Navigate to `/graph.html` (also available in the header) to explore connections between tags across all posts.

- Uses the generated `dist/graph.json` (built from post tags during `npm run build`)
- Interactions:
  - Pan: click/touch-drag to move the graph
  - Zoom toward pointer: mouse wheel zoom is centered on the cursor (viewport-centered zoom with proper transform math)
  - Pinch-zoom (mobile/tablet): two-finger pinch to zoom with the midpoint anchored
  - Double-tap to zoom toward the tap point
  - Reset: a small "reset" button in the top-right restores the default view
  - Hover: highlight neighbors when hovering a tag (desktop)
- Keyboard shortcuts:
  - `/` - Focus search box
  - `?` - Show help overlay with all shortcuts
  - `Esc` - Close help overlay or clear search
  - `t` - Toggle light/dark theme
  - Arrow keys - Navigate between tags
  - `Enter` - Select focused tag
- Click a tag to jump back to the homepage with that tag preselected (filter applied automatically)
- Node sizes scale with tag frequency (2-5px radius); edge widths scale with co-occurrence weight

Post pages also include a compact topic graph (in the ToC sidebar on desktop) with the same pan/zoom/double‑tap/reset behavior.

Notes:

- By default, the graph includes up to 20 most frequent tags. You can change this via `GRAPH_MAX_NODES` in `src/lib/config.ts` (or env var `GRAPH_MAX_NODES`).

### Search Dialog

Press `Cmd/Ctrl+K` anywhere on the site to open the search dialog.

**Features:**
- **Recent Posts First**: Opens as a jump list of the five newest posts before you type anything
- **Universal Search**: Posts, topics and pages in one list
- **Fuzzy Matching**: Type partial words (e.g., "demi" finds "deming"); title matches outrank summary and topic matches
- **Keyboard Shortcuts**:
  - `Cmd/Ctrl+K` to open
  - `↑↓` to navigate results
  - `Enter` to select
  - `Esc` to close
- **Categorised Results**: Each row is labelled "post", "topic" or "page"
- **Instant Results**: Data preloads on idle for zero-latency search

**Data:**
- Posts come from `dist/search.json`, generated at build time (id, title, summary, topics, date)
- Topics come from `dist/graph.json`
- Both requests are cache-busted with the build timestamp, so a deploy never serves a stale index

## 🎨 Customization

### Styling

Styles are organized into **modular CSS files** in `src/styles/modules/` for easier maintenance:
- 12 focused modules (variables, base, layout, tags, cards, post, typography, syntax, command-palette, graph, ux, responsive)
- The order lives in one place, `STYLE_MODULES` in `src/lib/config.ts`; `main-imports.css` documents it and `test/styles.test.ts` keeps them in agreement
- Colours, type, space, radii, shadows and easings are defined once as tokens in `variables.css`; translucent tints reference RGB-channel tokens (`--accent-*-rgb`, `--shadow-rgb`, `--halo-rgb`) so the whole UI recolours from one place
- Build process concatenates modules into a single `dist/styles.css` file
- See `src/styles/README.md` for detailed module documentation

Key features:
- **Dual Theme Support** with CSS custom properties
- **Dark Theme** (default): deep neutral surfaces (`--bg-primary: #0f1017`) with cards lifted off the page
- **Light Theme**: a single `[data-theme="light"]` override block (`--bg-primary: #f6f7fb`)
- **System Integration**: Automatically detects and follows OS preference
- **Manual Override**: Theme toggle persists user choice in localStorage
- **Topic Hues**: `--tag-hue-0` … `--tag-hue-7` map the palette in `src/lib/TagPalette.ts` onto the chips and card accents
- Fonts: Inter (UI + prose) and JetBrains Mono (code only) — both self-hosted variable fonts
- Icons: Inline SVG symbol sprite

#### Self-hosted Fonts

This project now self-hosts its fonts for improved privacy, performance, and resilience.

Why:

- Removes external `fonts.googleapis.com` / `fonts.gstatic.com` network dependency
- Avoids layout shift and speeds up first render (`font-display: swap`)
- Keeps consistent caching behavior with other static assets

Implementation:

- Variable font files placed in `src/fonts/` and copied to `dist/fonts` during build
- `@font-face` declarations added in `src/styles/modules/base.css`
- Preload hints added in `layout.html` for faster font availability

Expected filenames in `src/fonts/`:

```
Inter-Variable-latin.woff2          # UI + prose (subset: latin)
Inter-Variable-latin-ext.woff2      # extended latin, loaded on demand via unicode-range
JetBrainsMono-Variable.woff2        # code
```

Obtain them from the official releases:

- Inter: https://github.com/rsms/inter/releases
- JetBrains Mono: https://github.com/JetBrains/JetBrainsMono/releases

Both licenses (SIL OFL 1.1) are included as `OFL-INTER.txt` and `OFL-JETBRAINS-MONO.txt` in the same directory.

If a font file is missing the site gracefully falls back to the system sans/monospace stacks defined in the CSS custom properties.

#### Icons (SVG, no external font)

Previously icons were provided by Font Awesome via a CDN stylesheet which triggered font downloads (`fa-solid-900.woff2`, `fa-brands-400.woff2`). These external requests have been removed. A tiny inline SVG sprite (sun, moon, github, rss, search, doc, hash, arrow-left, compass) now serves icons:

- No layout shift waiting for icon font
- No cross‑origin font requests
- Easy to add more: drop another `<symbol>` into the sprite inside `layout.html` and reference with `<use href="#icon-name"/>`.

Theme toggle now swaps the `<use>` target between `#icon-sun` and `#icon-moon` instead of toggling Font Awesome classes.

### Templates

The system includes built-in templates for:

- `layout.html` - Document shell: metadata (canonical/OG/Twitter), sticky header, icon sprite, footer; loads `/assets/main.js` with a build timestamp
- `index.html` - Hero, topic filter bar and the post grid (with a featured card)
- `post.html` - Individual post pages with the outline sidebar and related-topics graph; no inline scripts or styles
- `graph.html` - Global topic graph page; scripts are loaded dynamically by `main.js`

Override by creating files in `templates/` directory.

### Site Configuration

Most knobs live in `src/lib/config.ts` and can also be set via environment variables:

- `POSTS_PER_PAGE` (default 6)
- `GRAPH_MAX_NODES` (default 20)
- `GIST_USERNAME` (default from `DEFAULT_GIST_USERNAME`)
- `GIST_CACHE` (true/false), `GIST_CACHE_TTL_LIST_MS`, `GIST_CACHE_TTL_GIST_MS`
- `FETCH_CONCURRENCY` (default 5)

Presentation:

- `SITE_AUTHOR`, `SITE_ROLE`, `SITE_TAGLINE` - hero copy and metadata author
- `NEW_POST_DAYS` (default 14) - recency window for relative dates and the **New** badge
- `MAX_FILTER_TAGS` (default 14) - topic chips in the index filter bar
- `EXCERPT_LENGTH` (default 180) - card excerpt length
- `META_DESCRIPTION_LENGTH` (default 160) - `<meta name="description">` / og:description length
- `SEARCH_SUMMARY_LENGTH` (default 120) - summary length in `search.json`
- `OG_IMAGES` (true/false) - set `false` to skip social card rendering

Configure RSS feed and canonical URLs via environment variables:

```bash
export SITE_URL=https://yourdomain.com
export SITE_TITLE="Your Blog Title"
export SITE_DESCRIPTION="Your blog description"
```

## 🚀 Deployment

### GitHub Actions

Create `.github/workflows/build-blog.yml` (simplified example with caching enabled):

```yaml
name: Build and Deploy Gist Blog

on:
  schedule:
    - cron: '47 * */6 * *' # every 6 hours
  workflow_dispatch:
  push:
    branches: [master]
    paths:
      - 'src/**'
      - '.github/workflows/**'

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      GIST_USERNAME: ${{ github.repository_owner }}
      SITE_URL: https://example.com
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '26'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Restore gist API cache
        uses: actions/cache@v4
        with:
          path: .cache
          key: gist-cache-${{ env.GIST_USERNAME }}-${{ hashFiles('package-lock.json') }}-${{ github.run_id }}
          restore-keys: |
            gist-cache-${{ env.GIST_USERNAME }}-

      - name: Build site
        env:
          GIST_CACHE: true
          GITHUB_TOKEN: ${{ secrets.GIST_BLOG_TOKEN }} # optional PAT (gist scope)
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
```

### Providing a Personal Access Token

The default `GITHUB_TOKEN` that GitHub Actions provides does **not** allow calling the Gist API at elevated rate limits; for most public‑gist use cases anonymous access works, but heavy schedules (hourly + many gists) may hit secondary limits. To harden builds:

1. Create a classic PAT with the minimal `gist` scope (no repo scope required).
2. Add it to your repository secrets as `GIST_BLOG_TOKEN`.
3. Pass it as `GITHUB_TOKEN: ${{ secrets.GIST_BLOG_TOKEN }}` in the build step env.

If the token becomes invalid the build will log a warning and fall back to unauthenticated requests; monitor for the zero‑posts exit code in CI.

### Troubleshooting

| Symptom                                                        | Cause                                              | Fix                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Build log shows `GitHub API Error 401` then succeeds           | Invalid / missing PAT                              | Recreate PAT with `gist` scope and update secret                               |
| `✅ Build complete! Generated 0 posts.` with exit code 2 in CI | No public gists fetched (auth failure or no gists) | Verify `GIST_USERNAME`, token validity, at least one public gist with markdown |
| Frequent `403` then retry                                      | Rate limiting                                      | Add PAT or reduce `FETCH_CONCURRENCY`                                          |
| Slow builds                                                    | Large gist set                                     | Increase cache TTLs or reduce schedule frequency                               |

### Architecture

- **Zero runtime dependencies** in the generated site (pure HTML/CSS/JS output)
- **Written in TypeScript**, run directly via Node's native type stripping (no compile step); shared domain types live in `src/lib/types.ts`
- **Modular build system** with separated concerns:
  - `BlogGenerator.ts` - Build orchestrator: fetch → parse → shape → render → emit
  - `GistParser.ts` - High-level parser delegating to focused modules
  - `TagManager.ts` - Extracts/cleans hashtags with caching
  - `MarkdownProcessor.ts` - marked + highlight.js wrapper with anchors/ToC and caching
  - `LinkTransformer.ts` - Converts own gist URLs into internal post links
  - `GraphBuilder.ts` - Builds tag co-occurrence graph data
  - `DataShaper.ts` - Shapes view-models for templates (single-pass reduce, DI for date/clock utils)
  - `TagPalette.ts` - Hashes tag names to stable hues shared by CSS and social cards
  - `OgImageGenerator.ts` - Composes 1200×630 social cards as SVG and rasterises them with sharp
  - `TemplateEngine.ts` - Custom mustache-like template rendering
  - `TemplateLoader.ts` - Cached template file loader
  - `RSSGenerator.ts` - RSS feed generation with configurable metadata
  - `StringUtils.ts` - Slugs for anchors plus markdown→plain-text summarising
  - `config.ts` - Central configuration (env + defaults)
  - `Cache.ts` - JSON/ETag on-disk caching
  - `GitHubClient.ts` - Fetch with timeout, ETag handling, 304 reuse, 403 backoff
  - `AsyncPool.ts` - Controlled concurrency helper
  - `DateUtils.ts` - ISO date formatting utilities
  - `types.ts` - Shared domain types (Gist, Post, GraphData, template view-models)
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
- Filter status display showing all active tags
- Maintains clean descriptions without hashtags
- Hashes each tag to one of eight hues (FNV-1a), so colours never shift between builds

**Social Cards**

- One 1200×630 PNG per post in `dist/og/`, plus a site-wide `index.png`
- Composed as SVG (wordmark, headline, topic pills, date/reading time) and rasterised by sharp
- The headline is wrapped and shrunk to fit at most three lines
- The card's accent colour comes from the post's first topic
- Rendering failures are logged and skipped: cards are cosmetic and never break a deploy

**Reading Time**

- Calculates word count by removing markdown syntax and code blocks
- Estimates reading time based on 225 words per minute average
- Displayed inline in the post/card meta line (e.g. "2 min read")

**Table of Contents System**

- Extracts headings (levels 2-6) from markdown content during build
- Generates URL-friendly anchor IDs with proper slug formatting
- Custom marked.js renderer adds permalink anchors with hover effects
- Laid out by CSS (sticky grid column); JavaScript only highlights the active section
- Throttled with requestAnimationFrame for smooth scroll updates
- Hidden below 64rem, where the article takes the full width

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
- Syntax highlighting runs at build time — no highlighter is shipped to the browser
- No layout JavaScript for the outline sidebar (CSS sticky grid)
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
├── CNAME
├── LICENSE
├── README.md
├── eslint.config.mjs
├── package.json
├── tsconfig.base.json        # Shared strict compiler options (noEmit, nodenext, erasableSyntaxOnly)
├── tsconfig.json             # Node project: src/lib, src/build.ts, scripts, test
├── tsconfig.client.json      # Browser project: src/client (DOM lib)
├── scripts/
│   └── minify.ts
├── src/
│   ├── build.ts
│   ├── client/               # Browser scripts (esbuild → dist/assets/*.js)
│   │   ├── main.ts
│   │   ├── command-palette.ts
│   │   ├── graph-page.ts
│   │   ├── topic-graph-enhance.ts
│   │   └── ux-enhancements.ts
│   ├── fonts/                # Self-hosted variable fonts (Inter, JetBrains Mono) + licenses
│   ├── lib/
│   │   ├── AsyncPool.ts
│   │   ├── BlogGenerator.ts
│   │   ├── Cache.ts
│   │   ├── DataShaper.ts
│   │   ├── DateUtils.ts
│   │   ├── GistParser.ts
│   │   ├── GitHubClient.ts
│   │   ├── GraphBuilder.ts
│   │   ├── LinkTransformer.ts
│   │   ├── MarkdownProcessor.ts
│   │   ├── OgImageGenerator.ts
│   │   ├── RSSGenerator.ts
│   │   ├── StringUtils.ts
│   │   ├── TagManager.ts
│   │   ├── TagPalette.ts
│   │   ├── TemplateEngine.ts
│   │   ├── TemplateLoader.ts
│   │   ├── config.ts
│   │   └── types.ts          # Shared domain types (pure type module)
│   ├── styles/
│   │   ├── main-imports.css  # Documents the module order
│   │   └── modules/          # 12 focused CSS modules → concatenated to dist/styles.css
│   └── templates/
│       ├── graph.html
│       ├── index.html
│       ├── layout.html
│       └── post.html
├── test/
│   ├── async-pool.test.ts
│   ├── blog-generator.smoke.test.ts
│   ├── bloggenerator.data.test.ts
│   ├── cache.test.ts
│   ├── config.test.ts
│   ├── data-shaper.test.ts
│   ├── gist-parser.test.ts
│   ├── github-client.test.ts
│   ├── og-image.test.ts
│   ├── string-utils.test.ts
│   ├── styles.test.ts
│   ├── tag-palette.test.ts
│   ├── template-engine.test.ts
│   └── templates.test.ts
└── dist/                     # Generated site (after build); esbuild emits .js from .ts entries
  ├── assets/
  │   ├── main.js
  │   ├── command-palette.js
  │   ├── graph-page.js
  │   ├── topic-graph-enhance.js
  │   └── ux-enhancements.js
  ├── fonts/
  ├── og/                    # Generated social cards ({gist-id}.png + index.png)
  ├── posts/
  │   └── {gist-id}.html
  ├── feed.xml
  ├── graph.html
  ├── graph.json
  ├── index.html
  ├── search.json
  └── styles.css
```

**Pagination & Filtering**

- All posts loaded once for instant filtering
- Clean "Page X of Y" pager
- Smart tag filtering across all posts
- No server requests for navigation

## 🧪 Testing

This repo uses Node’s built-in test runner (no external frameworks).

- Run tests:
  ```bash
  npm test
  ```

The tests isolate temp `dist/` and cache directories, and stub network calls where needed. Coverage worth knowing about:

- `blog-generator.smoke.test.ts` builds a whole site from canned gists and asserts the emitted metadata, social cards, search index and assets
- `templates.test.ts` renders the real templates and fails if a template variable is left undefined
- `styles.test.ts` keeps `STYLE_MODULES`, `main-imports.css` and the files on disk in agreement, rejects dangling/unused CSS tokens, and guards against terminal-era markup returning
- `tag-palette.test.ts` pins the tag hash and keeps `TAG_HUE_COLORS` in sync with `variables.css`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the build process
5. Submit a pull request

## 📄 License

MIT License - feel free to use for your own blog!

---

_Built with ❤️ for developers who love writing, gists, and clean code._
```
