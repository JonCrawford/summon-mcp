// Simple script to create a placeholder icon for the DXT
const fs = require('fs');
const { createCanvas } = require('canvas');

// Check if canvas is installed
try {
  require.resolve('canvas');
} catch (e) {
  console.log('Canvas not installed. For a real icon, install canvas: npm install canvas');
  console.log('Or add your own 128x128 PNG as icon.png');
  process.exit(0);
}

// Create a 128x128 canvas
const canvas = createCanvas(128, 128);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#2CA01C'; // QuickBooks green
ctx.fillRect(0, 0, 128, 128);

// Add "QB" text
ctx.fillStyle = 'white';
ctx.font = 'bold 48px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('QB', 64, 64);

// Save as PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('icon.png', buffer);
console.log('Created icon.png (128x128)');