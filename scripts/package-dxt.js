#!/usr/bin/env node

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read version from manifest.json
const manifestPath = join(projectRoot, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

// Generate filename
const outputFile = `quickbooks-mcp-${version}.dxt`;

console.log(`Packaging DXT extension version ${version}...`);

// Run dxt pack command
try {
    execSync(`dxt pack . ${outputFile}`, {
        stdio: 'inherit',
        cwd: projectRoot
    });
    console.log(`\n✅ Successfully created ${outputFile}`);
} catch (error) {
    console.error('❌ Failed to package DXT extension:', error.message);
    process.exit(1);
}