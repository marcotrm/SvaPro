const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'resources', 'js');

const replacements = {
  'ðŸ””': '🔔',
  'â‚¬': '€',
  'âš ': '⚠️', // sometimes followed by a space or non-breaking
  'âš ': '⚠️',
  'â °': '⏰',
  'Ã ': 'à',
  'Ã¨': 'è',
  'Ã©': 'é',
  'Ã¬': 'ì',
  'Ã²': 'ò',
  'Ã¹': 'ù',
  'â€”': '—', // em dash
  'â”€': '─', // box drawing light horizontal
  'âœ…': '✅',
  '': 'à' // Only a guess for the "Quantit" one, but better to fix manually.
};

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const [bad, good] of Object.entries(replacements)) {
        if (content.includes(bad)) {
          content = content.split(bad).join(good);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed mojibake in: ${fullPath}`);
      }
    }
  }
}

console.log('Starting cleanup...');
processDirectory(dir);
console.log('Done.');
