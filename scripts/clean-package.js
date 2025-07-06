#!/usr/bin/env node

import { createWriteStream, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const ROOT_DIR = process.cwd();
const OUTPUT_FILE = 'quickbooks-mcp-clean.dxt';

// Files to skip (problematic paths that cause ENOENT errors)
const SKIP_PATTERNS = [
  '.github',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '.npmrc',
  '.yarnrc',
  '.eslint',
  '.prettier',
  'test',
  'tests',
  '__tests__',
  'spec',
  'docs',
  'examples',
  'demo',
  'benchmark',
  '.nyc_output',
  'coverage',
  '*.log',
  'CHANGELOG',
  'HISTORY',
  'CONTRIBUTORS',
  'AUTHORS'
];

function shouldSkip(name) {
  return SKIP_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      return regex.test(name);
    }
    return name.toLowerCase().includes(pattern.toLowerCase());
  });
}

function addDirectoryRecursive(archive, dirPath, archivePath = '', depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    console.log(`  Skipping deep directory: ${archivePath} (depth ${depth})`);
    return;
  }
  
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      // Skip problematic files/directories
      if (shouldSkip(item)) {
        continue;
      }
      
      const fullPath = join(dirPath, item);
      const itemArchivePath = archivePath ? join(archivePath, item) : item;
      
      try {
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          addDirectoryRecursive(archive, fullPath, itemArchivePath, depth + 1);
        } else if (stats.isFile()) {
          console.log(`  Adding: ${itemArchivePath}`);
          archive.file(fullPath, { name: itemArchivePath });
        }
      } catch (err) {
        console.log(`  Skipping inaccessible: ${itemArchivePath} (${err.code})`);
      }
    }
  } catch (err) {
    console.log(`  Skipping directory: ${archivePath} (${err.code})`);
  }
}

async function createDXT() {
  console.log('Creating clean DXT package...');
  
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });
  
  archive.pipe(output);
  
  // Add manifest as manifest.json (rename from manifest-simple.json)
  console.log('Adding: manifest.json');
  archive.file('manifest-simple.json', { name: 'manifest.json' });
  
  // Add essential files
  const essentialFiles = ['package.json', 'README.md'];
  for (const file of essentialFiles) {
    try {
      console.log(`Adding: ${file}`);
      archive.file(file, { name: file });
    } catch (err) {
      console.log(`Skipping missing: ${file}`);
    }
  }
  
  // Add dist/ directory carefully
  console.log('Adding dist/ directory...');
  addDirectoryRecursive(archive, 'dist', 'dist');
  
  // Add only essential node_modules
  console.log('Adding core dependencies...');
  const coreModules = ['fastmcp', 'dotenv', 'intuit-oauth', 'node-quickbooks', 'zod'];
  
  for (const moduleName of coreModules) {
    const modulePath = join('node_modules', moduleName);
    try {
      const stats = statSync(modulePath);
      if (stats.isDirectory()) {
        console.log(`Adding: node_modules/${moduleName}/`);
        addDirectoryRecursive(archive, modulePath, `node_modules/${moduleName}`);
      }
    } catch (err) {
      console.log(`Warning: Could not find module: ${moduleName}`);
    }
  }
  
  await archive.finalize();
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`\nClean DXT package created: ${OUTPUT_FILE}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve();
    });
    
    archive.on('error', reject);
  });
}

createDXT().catch(console.error);