/**
 * Fix Windows-1252 mojibake in Layout.jsx
 * 
 * The emojis were saved as Windows-1252 bytes interpreted as Unicode codepoints.
 * Example: 📋 (F0 9F 93 8B in UTF-8) got stored as ðŸ"‹ (each byte → Win-1252 char → UTF-8)
 *   F0 → ð (U+00F0)
 *   9F → Ÿ (U+0178 in Windows-1252)
 *   93 → " (U+201C in Windows-1252)
 *   8B → ‹ (U+2039 in Windows-1252)
 * 
 * Fix: replace the mojibake sequences with safe plain text equivalents.
 */

const fs = require('fs');
const file = 'resources/js/components/Layout.jsx';

let content = fs.readFileSync(file, 'utf8');
const original = content;

// Map of mojibake → plain text replacement
// (tested by checking what Windows-1252 bytes F0 9F ... produce as Unicode chars)
const fixes = [
  // 📋 (F0 9F 93 8B) → "ðŸ"‹"   -- VapeCalc button
  ['\u00F0\u0178\u201C\u2039', 'Scheda'],
  // 🔔 (F0 9F 94 94) → "ðŸ"""  -- bell emoji in notification header
  ['\u00F0\u0178\u201D\u201D', ''],
  // 📄 (F0 9F 93 84) → "ðŸ"„"  -- document emoji
  ['\u00F0\u0178\u201C\u201E', ''],
  // ✅ (E2 9C 85) → "âœ…"     -- checkmark
  ['\u00E2\u009C\u2026',       ''],
  // ⚠ (E2 9A A0) → "âš "      -- warning sign
  ['\u00E2\u009A\u00A0',       '!'],
  // ️ EF B8 8F → variation selector (often after ⚠️)
  ['\u00EF\u00B8\u008F',       ''],
  // 🕐 (F0 9F 95 90) → clock
  ['\u00F0\u0178\u2022\u2020', ''],
  // Generic: strip remaining lone control-area chars often part of emoji
  ['\u0178', ''],
];

let changed = false;
for (const [bad, good] of fixes) {
  if (content.includes(bad)) {
    console.log(`Found mojibake: ${JSON.stringify(bad)} → replacing with "${good}"`);
    content = content.split(bad).join(good);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(file, content, 'utf8');
  console.log('Layout.jsx fixed!');
} else {
  // Fallback: try to detect any remaining non-ASCII in JSX (not in comments/strings OK)
  const lines = content.split('\n');
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      const code = lines[i].charCodeAt(j);
      if (code > 127) {
        console.log(`L${i+1} col${j+1}: U+${code.toString(16).toUpperCase().padStart(4,'0')} "${lines[i][j]}" → ctx: ${lines[i].trim().slice(0,50)}`);
        found++;
        if (found > 20) { console.log('...truncated'); process.exit(0); }
      }
    }
  }
  if (!found) console.log('No non-ASCII found - file may already be clean.');
}
