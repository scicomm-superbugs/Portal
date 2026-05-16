const fs = require('fs');
const path = require('path');

const dir = 'src/scicomm';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));

const colorMap = {
  // Backgrounds
  "'#f8fafc'": "'var(--sci-bg-light-slate)'",
  '"#f8fafc"': "'var(--sci-bg-light-slate)'",
  "'#f9fafb'": "'var(--sci-bg-light-gray)'",
  '"#f9fafb"': "'var(--sci-bg-light-gray)'",
  "'#f3f4f6'": "'var(--sci-bg-gray-100)'",
  '"#f3f4f6"': "'var(--sci-bg-gray-100)'",
  "'#f3f2ef'": "'var(--sci-bg-linkedin)'",
  '"#f3f2ef"': "'var(--sci-bg-linkedin)'",
  "'#eef3f8'": "'var(--sci-bg-linkedin-blue)'",
  '"#eef3f8"': "'var(--sci-bg-linkedin-blue)'",
  "'white'": "'var(--sci-bg-white)'",
  '"white"': "'var(--sci-bg-white)'",
  "'#ffffff'": "'var(--sci-bg-white)'",
  '"#ffffff"': "'var(--sci-bg-white)'",
  "'#fff'": "'var(--sci-bg-white)'",
  '"#fff"': "'var(--sci-bg-white)'",
  
  // Borders
  "'#e2e8f0'": "'var(--sci-border-slate)'",
  '"#e2e8f0"': "'var(--sci-border-slate)'",
  "'#e0dfdc'": "'var(--sci-border-main)'",
  '"#e0dfdc"': "'var(--sci-border-main)'",
  "'#f1f5f9'": "'var(--sci-border-light)'",
  '"#f1f5f9"': "'var(--sci-border-light)'",

  // Text colors
  "'#0f172a'": "'var(--sci-text-dark)'",
  '"#0f172a"': "'var(--sci-text-dark)'",
  "'#1e293b'": "'var(--sci-text-darker)'",
  '"#1e293b"': "'var(--sci-text-darker)'",
  "'#334155'": "'var(--sci-text-slate-700)'",
  '"#334155"': "'var(--sci-text-slate-700)'",
  "'#475569'": "'var(--sci-text-slate-600)'",
  '"#475569"': "'var(--sci-text-slate-600)'",
  "'#64748b'": "'var(--sci-text-muted)'",
  '"#64748b"': "'var(--sci-text-muted)'",
  "'rgba(0,0,0,0.6)'": "'var(--sci-text-rgba-muted)'",
  '"rgba(0,0,0,0.6)"': "'var(--sci-text-rgba-muted)'",
  "'rgba(0, 0, 0, 0.6)'": "'var(--sci-text-rgba-muted)'",
  '"rgba(0, 0, 0, 0.6)"': "'var(--sci-text-rgba-muted)'"
};

let totalReplacements = 0;

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [oldVal, newVal] of Object.entries(colorMap)) {
    // Replace in style objects like `background: '#f8fafc'`
    // Be careful with simple string replacements, we want to target exact inline values
    const regex = new RegExp(`(?<=:\\s*)${oldVal.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'g');
    if (regex.test(content)) {
      const matchCount = (content.match(regex) || []).length;
      content = content.replace(regex, newVal);
      totalReplacements += matchCount;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${f}`);
  }
});

console.log(`Done. Total replacements: ${totalReplacements}`);
