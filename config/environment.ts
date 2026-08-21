/**
 * Environment Configuration
 * =========================
 * זיהוי אוטומטי של הסביבה לפי EAS channel או משתני סביבה.
 * 
 * סביבות:
 * - development: פיתוח מקומי עם Metro
 * - preview: בדיקות פנימיות (APK/IPA)
 * - production: גרסה בחנויות
 * 
 * שימוש:
 * import { ENV, isDev, isPreview, isProd } from '@/config/environment';
 */

import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

// סוגי סביבות
export type Environment = 'development' | 'preview' | 'production';

/**
 * זיהוי הסביבה הנוכחית
 * - אם רצים עם Metro (dev) → development
 * - אם יש channel מ-EAS → לפי שם ה-channel
 * - אחרת → production (ברירת מחדל בטוחה)
 */
function detectEnvironment(): Environment {
  // בדיקה אם זה development build עם Metro
  if (__DEV__) {
    return 'development';
  }

  // בדיקת EAS Update channel
  const channel = Updates.channel;
  
  if (channel === 'preview') {
    return 'preview';
  }
  
  if (channel === 'development') {
    return 'development';
  }
  
  if (channel === 'production') {
    return 'production';
  }

  // אם אין channel מוגדר, בדוק את releaseChannel (לגרסאות ישנות)
  const releaseChannel = Updates.releaseChannel;
  
  if (releaseChannel?.includes('preview')) {
    return 'preview';
  }
  
  if (releaseChannel?.includes('dev')) {
    return 'development';
  }

  // ברירת מחדל בטוחה - production
  return 'production';
}

// הסביבה הנוכחית
export const ENV: Environment = detectEnvironment();

// בדיקות נוחות
export const isDev = ENV === 'development';
export const isPreview = ENV === 'preview';
export const isProd = ENV === 'production';

// מידע על הסביבה לצורכי debug
export const environmentInfo = {
  env: ENV,
  channel: Updates.channel || 'none',
  runtimeVersion: Updates.runtimeVersion || 'unknown',
  appVersion: Constants.expoConfig?.version || 'unknown',
  updateId: Updates.updateId || 'none',
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
};

/**
 * לוג סביבה בהפעלה
 * קורא לזה מ-_layout.tsx הראשי
 */
export function logEnvironmentInfo(): void {
  console.log('='.repeat(50));
  console.log(`[ENV] 🌍 Environment: ${ENV.toUpperCase()}`);
  console.log(`[ENV] 📡 Channel: ${environmentInfo.channel}`);
  console.log(`[ENV] 🔢 Runtime Version: ${environmentInfo.runtimeVersion}`);
  console.log(`[ENV] 📱 App Version: ${environmentInfo.appVersion}`);
  if (environmentInfo.updateId !== 'none') {
    console.log(`[ENV] 🔄 Update ID: ${environmentInfo.updateId}`);
  }
  console.log('='.repeat(50));
}

/**
 * קבלת כתובת Supabase לפי סביבה
 * (כרגע אותו URL לכל הסביבות - יש להפריד בעתיד)
 */
export function getSupabaseUrl(): string {
  // TODO: בעתיד להפריד לפרויקטים שונים
  // if (isProd) return process.env.EXPO_PUBLIC_SUPABASE_URL_PROD;
  // if (isPreview) return process.env.EXPO_PUBLIC_SUPABASE_URL_PREVIEW;
  return process.env.EXPO_PUBLIC_SUPABASE_URL || '';
}

/**
 * קבלת Anon Key של Supabase לפי סביבה
 */
export function getSupabaseAnonKey(): string {
  // TODO: בעתיד להפריד לפרויקטים שונים
  // if (isProd) return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD;
  // if (isPreview) return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_PREVIEW;
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
}
