#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const esbuild = require('esbuild');

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
async function minifyCssWithEsbuild(content) {
  const result = await esbuild.transform(content, { loader: 'css', minify: true });
  return result.code;
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
        conservativeCollapse: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        collapseBooleanAttributes: true,
        removeOptionalTags: false, // keep for safety
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
        sortAttributes: true,
        sortClassName: false
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
      const minified = await minifyCssWithEsbuild(content);

      fs.writeFileSync(file, minified);
      console.log(`Minified: ${file}`);
    } catch (error) {
      console.error(`Error minifying ${file}:`, error.message);
    }
  }

  console.log('Minification complete!');
}

minifyFiles().catch(console.error);
