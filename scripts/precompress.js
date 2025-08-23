#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const exts = new Set(['.html', '.css', '.js', '.json', '.xml', '.svg', '.txt']);

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

function newerThan(src, dest) {
  if (!fs.existsSync(dest)) return true;
  const s = fs.statSync(src);
  const d = fs.statSync(dest);
  return s.mtimeMs > d.mtimeMs;
}

function compressGzip(srcPath, outPath) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(srcPath);
    const output = fs.createWriteStream(outPath);
    const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
    input.pipe(gzip).pipe(output).on('finish', resolve).on('error', reject);
  });
}

function compressBrotli(srcPath, outPath) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(srcPath);
    const output = fs.createWriteStream(outPath);
    const brotli = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11
      }
    });
    input.pipe(brotli).pipe(output).on('finish', resolve).on('error', reject);
  });
}

async function run() {
  if (!fs.existsSync(DIST_DIR)) {
    console.log('dist directory not found. Please build the site first.');
    process.exit(0);
  }

  const files = walk(DIST_DIR).filter((f) => exts.has(path.extname(f)));
  if (!files.length) {
    console.log('No files to compress.');
    return;
  }
  console.log(`Precompressing ${files.length} files to .gz and .br`);

  let ok = 0, skipped = 0, failed = 0;
  for (const file of files) {
    try {
      const gz = file + '.gz';
      const br = file + '.br';
      // Only recompress when source is newer than compressed target
      if (newerThan(file, gz)) await compressGzip(file, gz); else skipped++;
      if (newerThan(file, br)) await compressBrotli(file, br); else skipped++;
      ok++;
    } catch (e) {
      failed++;
      console.error('Compression failed for', file, e.message);
    }
  }
  console.log(`Compression done. Success: ${ok}, Skipped: ${skipped}, Failed: ${failed}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
