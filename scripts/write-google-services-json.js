const fs = require('fs');
const path = require('path');

function main() {
  const b64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
  if (!b64) {
    console.log('GOOGLE_SERVICES_JSON_BASE64 is not set, skipping write.');
    return;
  }
  const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
  const outPath = path.join(__dirname, '..', 'android', 'app', 'google-services.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, jsonStr, 'utf8');
  console.log('Wrote android/app/google-services.json');
}

main();


