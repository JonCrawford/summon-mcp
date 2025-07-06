#!/usr/bin/env node

import { createWriteStream, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const ROOT_DIR = process.cwd();
const OUTPUT_FILE = 'quickbooks-mcp-simple.dxt';

// Essential files only
const INCLUDE_FILES = [
  'manifest-simple.json',
  'dist/',
  'node_modules/',
  'package.json',
  'README.md'
];

function addDirectoryToArchive(archive, dirPath, archivePath = '') {
  const items = readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = join(dirPath, item);
    const itemArchivePath = archivePath ? join(archivePath, item) : item;
    
    // Skip certain files even in included directories
    if (item === '.DS_Store' || item === 'Thumbs.db' || item.endsWith('.log')) {
      continue;
    }
    
    const stats = statSync(fullPath);
    
    if (stats.isDirectory()) {
      // For node_modules, exclude .cache and .bin
      if (archivePath === 'node_modules' && (item === '.cache' || item === '.bin')) {
        continue;
      }
      addDirectoryToArchive(archive, fullPath, itemArchivePath);
    } else {
      console.log(`Adding: ${itemArchivePath}`);
      archive.file(fullPath, { name: itemArchivePath });
    }
  }
}

async function createDXT() {
  console.log('Creating simple DXT package...');
  
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });
  
  archive.pipe(output);
  
  // Add manifest as manifest.json (rename from manifest-simple.json)
  console.log('Adding: manifest.json');
  archive.file('manifest-simple.json', { name: 'manifest.json' });
  
  // Add essential files
  for (const item of INCLUDE_FILES) {
    if (item === 'manifest-simple.json') continue; // Already added as manifest.json
    
    const fullPath = join(ROOT_DIR, item);
    
    try {
      const stats = statSync(fullPath);
      
      if (stats.isDirectory()) {
        addDirectoryToArchive(archive, fullPath, item);
      } else {
        console.log(`Adding: ${item}`);
        archive.file(fullPath, { name: item });
      }
    } catch (err) {
      console.log(`Skipping missing: ${item}`);
    }
  }
  
  await archive.finalize();
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`\nDXT package created: ${OUTPUT_FILE}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve();
    });
    
    archive.on('error', reject);
  });
}

createDXT().catch(console.error);