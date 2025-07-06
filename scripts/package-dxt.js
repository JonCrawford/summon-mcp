import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

// Read manifest
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

// DXT package name
const dxtPackageName = `${manifest.name}.dxt`;

// Create a file to stream archive data to.
const output = fs.createWriteStream(dxtPackageName);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`\n✅ DXT package created successfully!`);
  console.log(`📦 Package: ${dxtPackageName}`);
  console.log(`📏 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🔖 Version: ${manifest.version}`);
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add files and directories
archive.file('manifest.json', { name: 'manifest.json' });
archive.directory('dist/', 'dist');
archive.directory('node_modules/', 'node_modules');


// Finalize the archive
archive.finalize();