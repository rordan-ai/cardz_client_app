const fs = require('fs');
const path = require('path');
const glob = require('glob');

// NOTE: Do not store real keys in repo. This is a placeholder for detection only.
const OLD_KEY = '<OLD_SUPABASE_ANON_KEY_PLACEHOLDER>';

console.log('🔍 בודק קבצים עם מפתחות חשופים...\n');

const files = glob.sync('**/*', {
  ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/android/**', '**/ios/**'],
  nodir: true
});

let found = 0;
files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(OLD_KEY)) {
      console.log(`⚠️  נמצא מפתח חשוף ב: ${file}`);
      found++;
    }
  } catch (e) {}
});

console.log(`\n📊 סיכום: ${found} קבצים עדיין מכילים מפתחות חשופים`);





