#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

// Ensure we have archiver installed
try {
  require.resolve('archiver');
} catch (e) {
  console.log('Installing archiver for DXT packaging...');
  execSync('npm install --save-dev archiver', { stdio: 'inherit' });
}

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const dxtDir = path.join(projectRoot, 'dxt-build');
const outputFile = path.join(projectRoot, 'quickbooks-mcp.dxt');

console.log('Building QuickBooks MCP Desktop Extension...');

// Clean up previous builds
if (fs.existsSync(dxtDir)) {
  fs.rmSync(dxtDir, { recursive: true, force: true });
}
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
}

// Create build directory
fs.mkdirSync(dxtDir, { recursive: true });

// Copy manifest.json
console.log('Copying manifest.json...');
fs.copyFileSync(
  path.join(projectRoot, 'manifest.json'),
  path.join(dxtDir, 'manifest.json')
);

// Copy icon if it exists
const iconPath = path.join(projectRoot, 'icon.png');
if (fs.existsSync(iconPath)) {
  console.log('Copying icon.png...');
  fs.copyFileSync(iconPath, path.join(dxtDir, 'icon.png'));
} else {
  console.log('Warning: icon.png not found. Consider adding a 128x128 PNG icon.');
}

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
  main: 'dist/server-broker.js',
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

// Update manifest to point to the correct server file
console.log('Updating manifest for broker server...');
const manifest = JSON.parse(fs.readFileSync(path.join(dxtDir, 'manifest.json'), 'utf8'));
manifest.server.args = ['dist/server-broker.js'];
fs.writeFileSync(
  path.join(dxtDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

// Create the DXT archive
console.log('Creating DXT archive...');
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Desktop Extension created successfully!`);
  console.log(`📦 Output: ${outputFile}`);
  console.log(`📏 Size: ${sizeMB} MB`);
  console.log(`\n🚀 To install in Claude Desktop:`);
  console.log(`   1. Open Claude Desktop`);
  console.log(`   2. Go to Extensions`);
  console.log(`   3. Click "Install from file"`);
  console.log(`   4. Select ${outputFile}`);
  
  // Clean up build directory
  fs.rmSync(dxtDir, { recursive: true, force: true });
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files from the build directory
archive.directory(dxtDir, false);

// Finalize the archive
archive.finalize();