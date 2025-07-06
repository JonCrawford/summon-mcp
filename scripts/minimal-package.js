#!/usr/bin/env node

import { createWriteStream, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const ROOT_DIR = process.cwd();
const OUTPUT_FILE = 'quickbooks-mcp-minimal.dxt';

// Essential production files only - exclude all development dependencies
const INCLUDE_PATTERNS = [
  'manifest-simple.json',
  'dist/',
  'package.json',
  'README.md'
];

// Production dependencies only (exclude dev/build tools)
const PRODUCTION_DEPS = [
  'fastmcp',
  'dotenv',
  'intuit-oauth',
  'node-quickbooks',
  'zod',
  'qs',
  'debug',
  'xmlhttprequest',
  'crypto',
  'uuid',
  'atob',
  'btoa',
  'async',
  'underscore',
  'request',
  'request-promise'
];

function shouldIncludeNodeModule(moduleName) {
  // Include core production dependencies and their dependencies
  const coreModules = ['fastmcp', 'dotenv', 'intuit-oauth', 'node-quickbooks', 'zod'];
  return coreModules.some(core => moduleName.startsWith(core));
}

async function createDXT() {
  console.log('Creating minimal DXT package...');
  
  const output = createWriteStream(OUTPUT_FILE);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });
  
  archive.pipe(output);
  
  // Add manifest as manifest.json (rename from manifest-simple.json)
  console.log('Adding: manifest.json');
  archive.file('manifest-simple.json', { name: 'manifest.json' });
  
  // Add dist/ directory
  console.log('Adding: dist/');
  archive.directory('dist/', 'dist/');
  
  // Add package.json
  console.log('Adding: package.json');
  archive.file('package.json', { name: 'package.json' });
  
  // Add README.md
  console.log('Adding: README.md');
  archive.file('README.md', { name: 'README.md' });
  
  // Add minimal node_modules (only core dependencies)
  console.log('Adding core node_modules...');
  const nodeModulesDir = 'node_modules';
  try {
    const modules = readdirSync(nodeModulesDir);
    for (const module of modules) {
      if (shouldIncludeNodeModule(module)) {
        console.log(`  Adding: node_modules/${module}/`);
        archive.directory(join(nodeModulesDir, module), `node_modules/${module}`);
      }
    }
  } catch (err) {
    console.log('Warning: Could not access node_modules directory');
  }
  
  await archive.finalize();
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`\nMinimal DXT package created: ${OUTPUT_FILE}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve();
    });
    
    archive.on('error', reject);
  });
}

createDXT().catch(console.error);