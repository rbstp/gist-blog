#!/usr/bin/env node

import * as fs from 'node:fs';
import path from 'node:path';
import { minify as minifyHtml } from 'html-minifier-terser';
import * as esbuild from 'esbuild';

// Function to minify CSS content
async function minifyCssWithEsbuild(content: string): Promise<string> {
  const result = await esbuild.transform(content, { loader: 'css', minify: true });
  return result.code;
}

async function minifyFiles(): Promise<void> {
  const distDir = path.join(import.meta.dirname, '..', 'dist');

  if (!fs.existsSync(distDir)) {
    console.log('dist directory not found. Please build the site first.');
    return;
  }

  // Walk the dist tree once (recursive readdir yields paths relative to distDir,
  // including nested dirs like posts/), then split by extension.
  const allFiles = (fs.readdirSync(distDir, { recursive: true }) as string[])
    .map(rel => path.join(distDir, rel));
  const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
  const cssFiles = allFiles.filter(f => f.endsWith('.css'));

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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error minifying ${file}:`, message);
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error minifying ${file}:`, message);
    }
  }

  console.log('Minification complete!');
}

minifyFiles().catch(console.error);
