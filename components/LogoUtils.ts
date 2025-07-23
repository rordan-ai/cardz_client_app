/**
 * פונקציות עזר לטיפול בלוגואים
 */

// הגודל הסטנדרטי שלוגואים צריכים להיות בהעלאה
export const STANDARD_LOGO_SIZE = 500;

// הגודל הנוכחי של הלוגו באפליקציה (אחרי כל ההקטנות)
export const CURRENT_LOGO_SCALE = 0.4419;

// הגודל הבסיסי של הלוגו בקוד (לפני ה-scale)
export const BASE_LOGO_SIZE = 170;

/**
 * מחשב את ה-scale הנדרש ללוגו חדש
 * @param originalWidth - רוחב הלוגו המקורי
 * @param originalHeight - גובה הלוגו המקורי
 * @returns scale factor שיתאים את הלוגו לגודל הנוכחי
 */
export const calculateLogoScale = (originalWidth: number, originalHeight: number): number => {
  // אם הלוגו כבר בגודל הסטנדרטי, השתמש בגודל הנוכחי
  if (originalWidth === STANDARD_LOGO_SIZE && originalHeight === STANDARD_LOGO_SIZE) {
    return CURRENT_LOGO_SCALE;
  }
  
  // חישוב יחס התאמה מהגודל המקורי לגודל הסטנדרטי
  const scaleToStandard = Math.min(
    STANDARD_LOGO_SIZE / originalWidth,
    STANDARD_LOGO_SIZE / originalHeight
  );
  
  // החלת הגודל הנוכחי על הלוגו המותאם
  return scaleToStandard * CURRENT_LOGO_SCALE;
};

/**
 * מחזיר את הגודל הנוכחי של הלוגו (לשימוש ישיר)
 * @returns הגודל הנוכחי של הלוגו
 */
export const getCurrentLogoScale = (): number => {
  return CURRENT_LOGO_SCALE;
};

/**
 * מחזיר הנחיות להעלאת לוגו
 * @returns מחרוזת עם הנחיות למשתמש
 */
export const getLogoUploadGuidelines = (): string => {
  return `להעלאת לוגו מושלמת:
• גודל מומלץ: ${STANDARD_LOGO_SIZE}x${STANDARD_LOGO_SIZE} פיקסלים
• פורמט: PNG או JPG
• רקע שקוף (PNG) מומלץ
• איכות גבוהה
• לוגו מרכזי ובהיר`;
}; 