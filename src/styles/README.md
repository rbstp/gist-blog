# Styles

CSS for the blog, split into focused modules under `modules/`. The build
concatenates them (in the order below) into a single `dist/styles.css`.

## Design system

All colour, type, spacing, radius, elevation and motion values live in
`modules/variables.css` as custom properties. Modules never hardcode a colour or
a spacing value — they reference tokens, so the whole site can be retuned from
one file, and the light theme is a single block of overrides.

Topic chips are coloured from the shared palette in `src/lib/TagPalette.ts`:
the generator hashes each tag name to a hue index and emits it as `data-hue`,
which `modules/tags.css` maps onto `--tag-hue-*`. A unit test keeps the CSS
tokens and the TypeScript palette in sync.

## Modules

### Core
- **`variables.css`** - design tokens (colour, type scale, space, radii, shadows, motion)
- **`base.css`** - reset, self-hosted variable fonts, element defaults, focus ring, selection, scrollbars
- **`layout.css`** - page frame, sticky header, hero, section headings, footer

### Components
- **`tags.css`** - topic chips and the index filter bar
- **`cards.css`** - post cards, the listing grid, featured card, buttons, pager
- **`post.css`** - article page layout, outline sidebar, topic graph panels
- **`typography.css`** - article body typography (headings, prose, quotes, code, tables)
- **`syntax.css`** - highlight.js token colours

### Features
- **`command-palette.css`** - search dialog (Cmd/Ctrl+K)
- **`graph.css`** - topic graph page, search, legend, dialogs
- **`ux.css`** - copy buttons, reading progress, back to top, shortcut hint button

### Responsive
- **`responsive.css`** - breakpoints and `prefers-reduced-motion` (last for specificity)

## Working on styles

1. Edit the relevant module in `modules/`.
2. Run `npm run build` (or `npm run dev` to serve `dist` on port 3000).
3. `npm run lint` covers the CSS with `@eslint/css`.

Adding a module means creating the file, adding it to `STYLE_MODULES` in
`src/lib/config.ts`, listing it in `main-imports.css`, and documenting it here.
`test/styles.test.ts` asserts those lists stay in agreement, that every `var()`
resolves to a declared token, and that no token is left unused.
