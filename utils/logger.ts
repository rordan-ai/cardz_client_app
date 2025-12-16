/**
 * Logger Utility - Development vs Production
 * 
 * בפיתוח (__DEV__ = true): מציג את כל הלוגים
 * בייצור (__DEV__ = false): מציג רק errors
 */

const isDev = __DEV__;

export const logger = {
  // תמיד מופיע - שגיאות קריטיות
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  
  // תמיד מופיע - אזהרות חשובות
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  
  // רק בפיתוח - לוגים רגילים
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  
  // רק בפיתוח - מידע
  info: (...args: any[]) => {
    if (isDev) console.info('[INFO]', ...args);
  },
  
  // רק בפיתוח - דיבוג מפורט
  debug: (...args: any[]) => {
    if (isDev) console.log('[DEBUG]', ...args);
  },
  
  // לוגים קריטיים שיופיעו גם בייצור (למעקב אחר בעיות)
  critical: (...args: any[]) => console.log('[CRITICAL]', ...args),
};

// Export default לנוחות
export default logger;

