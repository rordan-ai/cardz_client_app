/**
 * מנגנון האזנה אוטומטי לעדכוני קוד
 * מפעיל התראה לאדמין כשיש בנייה/שינוי קוד או כשהמשתמש כותב !
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// נתיבים למעקב
const WATCH_PATHS = [
  'app/',
  'components/',
  'android/app/build.gradle',
  'android/gradle.properties',
  'package.json',
  'eas.json'
];

// פונקציה לשליחת הודעה לאדמין
async function notifyAdmin(message, context = {}) {
  try {
    const axios = require('axios');
    
    // שליחה דרך MCP AgentsCommunication
    await axios.post('http://localhost:3000/send-message', {
      from: 'CLIENT',
      to: 'ADMIN',
      message: message,
      context: context
    });
    
    console.log('✅ Admin notified:', message.substring(0, 50));
  } catch (error) {
    console.error('❌ Failed to notify admin:', error.message);
  }
}

// מעקב אחרי בניות
function watchBuilds() {
  const buildLog = path.join(process.cwd(), 'android/build/outputs/logs/build.log');
  
  if (fs.existsSync(buildLog)) {
    fs.watchFile(buildLog, async () => {
      await notifyAdmin('🔨 Build completed', {
        type: 'build',
        timestamp: new Date().toISOString()
      });
    });
  }
}

// מעקב אחרי שינויי קוד
function watchCodeChanges() {
  exec('git diff --name-only HEAD', async (error, stdout) => {
    if (error) return;
    
    const changedFiles = stdout.trim().split('\n').filter(Boolean);
    if (changedFiles.length > 0) {
      await notifyAdmin(`📝 Code changes detected: ${changedFiles.length} files`, {
        type: 'code_change',
        files: changedFiles
      });
    }
  });
}

// האזנה להודעות עם !
async function watchUserMessages() {
  // זה ידרוש אינטגרציה עם Cursor API
  console.log('👂 Listening for user messages with ! ...');
}

// הפעלה
if (require.main === module) {
  console.log('🚀 Auto-notify mechanism started');
  watchBuilds();
  
  // בדיקה כל 30 שניות
  setInterval(watchCodeChanges, 30000);
  
  watchUserMessages();
}

module.exports = { notifyAdmin };

