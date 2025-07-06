#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const dxtDir = path.join(projectRoot, 'dxt-build-simple');
const outputFile = path.join(projectRoot, 'quickbooks-mcp-simple.dxt');

console.log('Building QuickBooks MCP Desktop Extension (Simple OAuth version)...');

// Clean up previous builds
if (fs.existsSync(dxtDir)) {
  fs.rmSync(dxtDir, { recursive: true, force: true });
}
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
}

// Create build directory
fs.mkdirSync(dxtDir, { recursive: true });

// Copy manifest-simple.json as manifest.json
console.log('Copying manifest...');
fs.copyFileSync(
  path.join(projectRoot, 'manifest-simple.json'),
  path.join(dxtDir, 'manifest.json')
);

// Copy built files
console.log('Copying built JavaScript files...');
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

// Copy dist directory
fs.cpSync(distDir, path.join(dxtDir, 'dist'), { recursive: true });

// Create package.json for the DXT (minimal version)
console.log('Creating minimal package.json...');
const originalPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const dxtPackage = {
  name: originalPackage.name,
  version: originalPackage.version,
  description: originalPackage.description,
  main: 'dist/server.js',
  type: 'module',
  dependencies: {
    // Only include runtime dependencies
    'dotenv': originalPackage.dependencies.dotenv,
    'fastmcp': originalPackage.dependencies.fastmcp,
    'intuit-oauth': originalPackage.dependencies['intuit-oauth'],
    'node-quickbooks': originalPackage.dependencies['node-quickbooks'],
    'zod': originalPackage.dependencies.zod
  }
};

fs.writeFileSync(
  path.join(dxtDir, 'package.json'),
  JSON.stringify(dxtPackage, null, 2)
);

// Install production dependencies in the DXT directory
console.log('Installing production dependencies...');
execSync('npm install --production', {
  cwd: dxtDir,
  stdio: 'inherit'
});

// Create the DXT archive
console.log('Creating DXT archive...');
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const size = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`
✅ Desktop Extension created successfully!
📦 Output: ${outputFile}
📏 Size: ${size} MB

🚀 To install in Claude Desktop:
   1. Open Claude Desktop
   2. Go to Extensions
   3. Click "Install from file"
   4. Select ${outputFile}
`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(dxtDir, false);
archive.finalize();