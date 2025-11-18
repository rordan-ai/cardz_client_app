# דו״ח גיבוי - restore_checkpoints

תאריך/שעה: 2025-01-18 14:27:00

סיכום
- זהות מלאה בין מקומי לרחוק לענף `restore_checkpoints`:
  - SHA local: ad043b002ad9e5a511bc9f33b6fac1b9cc4d7774
  - SHA remote: ad043b002ad9e5a511bc9f33b6fac1b9cc4d7774
- Working directory: נקי (git status --porcelain → ריק).
- ספירת קומיטים:
  - main: 36
  - restore_checkpoints: 76
- הבדלי קבצים main ↔ restore_checkpoints: קיימים (מצופה, עקב עדכוני גיבוי ושינויים שנוספו). ראו diff name-only בפיקוח, כולל קבצי קוד ו‑docs.

ענפי ביטחון שנוצרו:
- safety_snapshot_20250118_142522: Snapshot עצמאי לפני גיבוי
- safety_backup_20250118_142603: ענף ביטחון זמני
- restorepoint_snapshot_20250118_142700: Snapshot נקודת שחזור

שינויים מרכזיים שנכללו בגיבוי:
- תיקון מחיקה עצמית של לקוח: תיקון שמות פרמטרים ב-RPC (p_business_code, p_customer_phone)
- תיקון הוספת לקוח חדש: הוספת RLS Policies ל-INSERT ו-UPDATE
- הוספת לוגים לאבחון במחיקה עצמית
- קבצי SQL: fix_customer_self_delete.sql, add_customers_rls_soft_delete.sql, fix_customers_rls_insert_update.sql
- מסמך הוראות: FIX_CUSTOMER_SELF_DELETE_INSTRUCTIONS.md

בדיקות איכות (מספריות)
- ספירת שורות בקבצים קריטיים לאחר הגיבוי:
  - app/(tabs)/_layout.tsx: 420 שורות
  - app/(tabs)/PunchCard.tsx: 2663 שורות (עודכן עם לוגים ותיקונים)
  - components/FCMService.ts: 395 שורות
- תוצאות תואמות לצפי לאחר היישומים והגיבוי (אין חוסר/קטיעה של קבצים).

הצהרה
- אימות זהות מקומית‑רחוקה לענף `restore_checkpoints` הושלם בהצלחה.
- בוצעו בדיקות איכות מספריות (ספירת קומיטים, diff name-only, ספירת שורות בקבצים קריטיים) והכל תקין.
- כל השינויים הלא מוקדשים נשמרו בגיבוי.
- הערה: לאחר תיקון הוספת לקוח חדש ומחיקה עצמית של לקוח


