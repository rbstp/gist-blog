#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');

// Function to recursively find all files with specific extensions
function findFiles(dir, extensions) {
  let results = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extensions));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  }

  return results;
}

// Function to minify CSS content
function minifyCss(css) {
  // Simple CSS minification - remove comments, unnecessary whitespace
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/;\s*}/g, '}') // Remove semicolon before closing brace
    .replace(/,\s+/g, ',') // Remove space after comma
    .replace(/:\s+/g, ':') // Remove space after colon
    .replace(/{\s+/g, '{') // Remove space after opening brace
    .replace(/}\s+/g, '}') // Remove space after closing brace
    .trim();
}

async function minifyFiles() {
  const distDir = path.join(__dirname, '..', 'dist');

  if (!fs.existsSync(distDir)) {
    console.log('dist directory not found. Please build the site first.');
    return;
  }

  // Find all HTML and CSS files
  const htmlFiles = findFiles(distDir, ['.html']);
  const cssFiles = findFiles(distDir, ['.css']);

  console.log(`Found ${htmlFiles.length} HTML files and ${cssFiles.length} CSS files to minify`);

  // Minify HTML files
  for (const file of htmlFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const minified = await minifyHtml(content, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true
      });

      fs.writeFileSync(file, minified);
      console.log(`Minified: ${file}`);
    } catch (error) {
      console.error(`Error minifying ${file}:`, error.message);
    }
  }

  // Minify CSS files
  for (const file of cssFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const minified = minifyCss(content);

      fs.writeFileSync(file, minified);
      console.log(`Minified: ${file}`);
    } catch (error) {
      console.error(`Error minifying ${file}:`, error.message);
    }
  }

  console.log('Minification complete!');
}

minifyFiles().catch(console.error);
