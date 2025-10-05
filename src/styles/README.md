# Styles Directory

This directory contains the CSS styles for the Gist Blog Generator, organized into modular files for easier maintenance.

## Structure

The CSS is split into focused modules in the `modules/` directory:

### Core Styles
- **`variables.css`** - CSS custom properties for theming (colors, fonts, spacing)
- **`base.css`** - Reset rules, font-face declarations, and utility classes
- **`layout.css`** - Base page layout, navigation, header, and container styles

### Component Styles
- **`terminal.css`** - Terminal window component styles (headers, controls, body)
- **`tags.css`** - Tag and filter UI components
- **`cards.css`** - Post card grid layouts and styling
- **`post.css`** - Post content layout, table of contents sidebar, and topic graph
- **`typography.css`** - Content typography, headings, paragraphs, lists, and links
- **`syntax.css`** - Code block and syntax highlighting styles

### Feature Styles
- **`dev-mode.css`** - Development mode easter egg styles
- **`command-palette.css`** - Command palette UI (Cmd/Ctrl+K)
- **`graph.css`** - Graph page enhancements, search, and help overlay
- **`ux.css`** - UX enhancements (copy buttons, jump to top, progress indicators)

### Responsive
- **`responsive.css`** - Media queries and mobile/tablet responsive styles

## Build Process

During the build process (`npm run build`):

1. The `BlogGenerator.copyStyles()` method concatenates all modules in the correct order
2. The combined CSS is written to `dist/styles.css`
3. The minification step (`npm run minify`) then compresses the output

## Development

### Editing Styles

To modify styles, edit the appropriate module file in `modules/`:
- Find the component or feature you want to change
- Edit the corresponding module file
- Run `npm run build` to see your changes

### Adding New Modules

If you need to add a new module:
1. Create a new `.css` file in the `modules/` directory
2. Update the `moduleOrder` array in `src/lib/BlogGenerator.js`
3. Document it in this README

### Import Order

The modules are concatenated in a specific order to ensure:
- Variables are available to all other modules
- Base styles and utilities come before components
- Responsive styles come last for proper specificity

## Migration Note

The original monolithic `main.css` file (3,367 lines) has been split into 14 focused modules averaging ~240 lines each. The backup is preserved as `main.css.backup`.

## Benefits

- **Maintainability** - Easier to find and modify specific features
- **Organization** - Clear separation of concerns
- **Readability** - Smaller, focused files are easier to understand
- **Performance** - Build process still produces a single optimized CSS file
- **Collaboration** - Reduces merge conflicts with separate modules
