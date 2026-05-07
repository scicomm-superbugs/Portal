const fs = require('fs');
const path = require('path');

const colorMap = {
  // Main green to AIU Blue (#0B3C5D) - wait, standard tailwind blue is better for UI? Let's use AIU Blue for primary if possible, but maybe a slightly brighter blue for buttons: #1d4ed8 (blue-700)
  // Let's use #1d4ed8 as primary, and Gold #d97706 as secondary.
  '#10b981': '#1d4ed8', // Main green -> Blue 700
  '#059669': '#1e3a8a', // Hover green -> Blue 900
  '#047857': '#0f172a', // Dark green -> Slate 900 (Black-ish)
  '#064e3b': '#020617', // Very dark green -> Slate 950 (Black-ish)
  
  '#ecfdf5': '#eff6ff', // Light bg -> Blue 50
  '#d1fae5': '#dbeafe', // Light border -> Blue 100
  '#a7f3d0': '#bfdbfe', // Light border 2 -> Blue 200
  
  // Success/Special accents mapped to Gold
  '#dcfce7': '#fef3c7', // Success bg -> Amber 100
  '#166534': '#92400e', // Success text -> Amber 800
  '#34d399': '#fbbf24', // Accent green -> Amber 400
  '#065f46': '#1e3a8a'  // Dark text -> Blue 900
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [green, newColor] of Object.entries(colorMap)) {
    const regex = new RegExp(green, 'gi');
    content = content.replace(regex, newColor);
  }

  // Also replace color keywords if they exist? No, we mostly used hex codes.

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      processFile(fullPath);
    }
  }
}

walk(path.join(__dirname, 'src'));
