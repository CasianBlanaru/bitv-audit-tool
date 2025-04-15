const { createCanvas } = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

// Create canvas (32x32 is standard for favicons)
const canvas = createCanvas(32, 32);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#2C3E50';
ctx.fillRect(0, 0, 32, 32);

// Draw "A"
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 24px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('A', 16, 14);

// Draw checkmark
ctx.beginPath();
ctx.moveTo(12, 22);
ctx.lineTo(16, 26);
ctx.lineTo(22, 20);
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 2;
ctx.stroke();

// Save as PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'public', 'favicon.png'), buffer);

console.log('Favicon has been created!'); 