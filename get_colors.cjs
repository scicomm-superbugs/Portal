const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('src/scicomm').filter(f => f.endsWith('.jsx'));
const colors = new Set();
files.forEach(f => {
  const txt = fs.readFileSync(path.join('src/scicomm', f), 'utf8');
  const matches = txt.match(/background(?:Color)?:\s*['"](#[0-9a-fA-F]{3,6}|white|black|transparent)['"]/g);
  if (matches) {
    matches.forEach(m => colors.add(m.split(/['"]/)[1]));
  }
});
console.log(Array.from(colors));
