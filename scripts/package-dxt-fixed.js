#!/usr/bin/env node

import { execSync } from 'child_process';
import { createWriteStream, readFileSync } from 'fs';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';

const ROOT_DIR = process.cwd();
const OUTPUT_FILE = 'quickbooks-mcp-fixed.dxt';

// Files and directories to exclude
const EXCLUDE_PATTERNS = [
  'node_modules/.cache',
  'node_modules/.bin',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.dxt',
  'tests/',
  'docs/',
  'logs/',
  'tasks/',
  '*.test.ts',
  '*.test.js',
  'vitest.config.ts',
  'tsconfig.json',
  'repomix-output.xml',
  'tokens.json',
  'CLAUDE_DESKTOP_SETUP.md',
  'DXT-CONVERSION-SUMMARY.md',
  'README-DXT.md',
  'claude-desktop-config-example.json',
  'create-icon.js',
  'mcp-server.log',
  'src/',
  'scripts/',
  'manifest-simple.json'
];

function shouldExclude(filePath) {
  const relativePath = filePath.replace(ROOT_DIR + '/', '');
  return EXCLUDE_PATTERNS.some(pattern => {
    if (pattern.endsWith('/')) {
      return relativePath.startsWith(pattern) || relativePath.includes('/' + pattern);
    }
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(relativePath);
    }
    return relativePath === pattern || relativePath.endsWith('/' + pattern);
  });
}

async function addFilesToArchive(archive, dir, baseDir = '') {
  const items = await readdir(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const relativePath = join(baseDir, item);
    
    if (shouldExclude(fullPath)) {
      console.log(`Excluding: ${relativePath}`);
      continue;
    }
    
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await addFilesToArchive(archive, fullPath, relativePath);
    } else {
      console.log(`Adding: ${relativePath}`);
      const fileContent = await readFile(fullPath);
      archive.append(fileContent, { name: relativePath });
    }
  }
}

async function createDXT() {
  console.log('Creating DXT package...');
  
  // Create archive
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  archive.pipe(output);
  
  // Add files
  await addFilesToArchive(archive, ROOT_DIR);
  
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

// Run
createDXT().catch(console.error);