# דו״ח גיבוי - restore_checkpoints

## גיבוי אחרון: 2025-12-05 17:30
**הערה:** זיהוי ביומטרי, מיון לפי מיקום GPS, הגדרות EAS Build

### סיכום
- ✅ SHA local = remote: `1f0ebc3`
- ✅ Working directory נקי
- ✅ קומיטים: main=36, restore_checkpoints=98

### קבצים שנוספו/עודכנו:
- `app/(tabs)/customers-login.tsx` - זיהוי ביומטרי (Face ID/טביעת אצבע)
- `app/(tabs)/business_selector.tsx` - מיון עסקים לפי מיקום GPS
- `app.json` - הגדרות הרשאות מיקום ו-SecureStore
- `eas.json` - הגדרות EAS Build
- `.easignore` - קובץ התעלמות ל-EAS Build
- `assets/icons/biometric.png` - אייקון זיהוי ביומטרי
- `assets/icons/cardz-logo.png` - לוגו האפליקציה

### פיצ'רים חדשים:
- זיהוי ביומטרי לכניסה מהירה לכרטיסייה
- מיון עסקים לפי קרבה גיאוגרפית
- הכנה ל-EAS Build להפצה

---

## גיבוי קודם: 2025-12-04 22:00
**הערה:** תפריטים, פופאפים, מדיניות פרטיות, חבר מזמין חבר, תמונת כניסה חדשה

### סיכום
- ✅ SHA local = remote: `c3a3fb9038af7960cdc6a81bacd0671178ab81ae`
- ✅ Working directory נקי
- ✅ קומיטים: main=36, restore_checkpoints=94

### בדיקות איכות (ספירת שורות):
- `app/(tabs)/PunchCard.tsx`: 3,565 שורות
- `app/(tabs)/business_selector.tsx`: 733 שורות
- `app/(tabs)/customers-login.tsx`: 835 שורות

### קבצים שנוספו/עודכנו:
- `app/(tabs)/PunchCard.tsx` - מודאל פרטיות, מודאל אודותינו, חבר מזמין חבר דינמי
- `app/(tabs)/business_selector.tsx` - מודאל פרטיות, תמונת כניסה חדשה, כיול שטחי מגע
- `app/(tabs)/customers-login.tsx` - תפריט המבורגר עם שם עסק דינמי
- `assets/images/new_entry.png` - תמונת כניסה חדשה
- `docs/מדיניות פרטיות – Cardz.md` - מסמך מדיניות פרטיות

### ענפי ביטחון:
- `safety_snapshot_20251204_220000`
- `safety_backup_20251204_220100`

---

## גיבוי קודם: 2025-12-04 19:00
**הערה:** תפריט המבורגר ומצגת הדגמה

### סיכום
- ✅ SHA local = remote: `68587272c4cae47aceca23d95a953b60728ddc65`
- ✅ Working directory נקי
- ✅ קומיטים: main=36, restore_checkpoints=90

### קבצים שנוספו/עודכנו:
- `components/TutorialSlideshow.tsx` - רכיב מצגת הדגמה חדש (201 שורות)
- `app/(tabs)/business_selector.tsx` - עדכון תפריט המבורגר
- `app/(tabs)/customers-login.tsx` - עדכון תפריט המבורגר
- `app/(tabs)/PunchCard.tsx` - עדכון תפריט המבורגר
- `assets/images/tutorial/` - 12 תמונות מצגת (13MB)

### ענפי ביטחון:
- `safety_snapshot_20251204_190000`
- `safety_backup_20251204_190000`

---

## גיבוי קודם: 2025-01-18 14:27:00

סיכום
- זהות מלאה בין מקומי לרחוק לענף `restore_checkpoints`:
  - SHA local: ad043b002ad9e5a511bc9f33b6fac1b9cc4d7774
  - SHA remote: ad043b002ad9e5a511bc9f33b6fac1b9cc4d7774
- Working directory: נקי (git status --porcelain → ריק).
- ספירת קומיטים:
  - main: 36
  - restore_checkpoints: 76

ענפי ביטחון שנוצרו:
- safety_snapshot_20250118_142522: Snapshot עצמאי לפני גיבוי
- safety_backup_20250118_142603: ענף ביטחון זמני
- restorepoint_snapshot_20250118_142700: Snapshot נקודת שחזור

שינויים מרכזיים שנכללו בגיבוי:
- תיקון מחיקה עצמית של לקוח: תיקון שמות פרמטרים ב-RPC
- תיקון הוספת לקוח חדש: הוספת RLS Policies
- הוספת לוגים לאבחון במחיקה עצמית

