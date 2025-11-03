const fs = require('fs');
const path = require('path');
const glob = require('glob');

const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcWZ3a3h6bXZwa29yY2F5bWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTgzMTgsImV4cCI6MjA2MDk5NDMxOH0.LNozVpUNhbNR09WGCb79vKgUnrtflG2bEwPKQO7Q1oM';

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





