const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let checkedCount = 0;

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      execFileSync(process.execPath, ['--check', fullPath], { stdio: 'inherit' });
      checkedCount++;
    }
  }
}

checkDir(path.join(__dirname, '../src'));
console.log(`[PASS] Syntax check passed across all ${checkedCount} source files.`);
