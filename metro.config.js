// metro.config.js — ברירת המחדל של Expo + תיקון dev-בלבד (Windows):
// ה-dev-client מבקש אייקונים דרך /assets?unstable_path=... בקידוד כפול (%252F).
// Metro מפענח segments של נתיב רגיל, אבל את unstable_path הוא לוקח גולמי אחרי
// פענוח יחיד — נשאר %2F בשם התיקייה → ENOENT והאייקונים לא נטענים בפיתוח.
// rewriteRequestUrl רץ על כל בקשה (Server._processRequest) — שם מנרמלים.
// לא משפיע על production builds (השרת לא קיים שם; ה-assets מוטמעים).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const prevRewrite = config.server?.rewriteRequestUrl;
config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    let u = typeof prevRewrite === 'function' ? prevRewrite(url) : url;
    if (typeof u === 'string' && u.includes('unstable_path=') && /%25(2F|2E|5C)/i.test(u)) {
      u = u.replace(/%252F/gi, '%2F').replace(/%252E/gi, '%2E').replace(/%255C/gi, '%5C');
    }
    return u;
  },
};

module.exports = config;
