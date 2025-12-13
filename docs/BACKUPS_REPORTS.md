# דו״ח גיבוי - restore_checkpoints

## גיבוי אחרון: 2025-12-13 23:51
**הערה:** גיבוי מלא + מיזוג ל-main + ניקוי אבטחה (הסרת `.env` ומפתחות קשיחים מה-repo)

### סיכום
- ✅ SHA local (main) = `a5283fe055b46ca0451a872f78e9ead91d4cdc42`
- ✅ SHA local (restore_checkpoints) = `a5283fe055b46ca0451a872f78e9ead91d4cdc42`
- ✅ Diff: ריק (`git diff main restore_checkpoints --name-only` → ריק)
- ✅ Working directory: נקי (`git status --porcelain` → ריק)
- ✅ קומיטים: main=179, restore_checkpoints=179

### ענפי ביטחון / Snapshots
- `safety_snapshot_20251213_235027`
- `safety_backup_20251213_235039`
- `restorepoint_snapshot_20251213_235113`

### אבטחה (קריטי)
- הוסר `.env` ממעקב git והוסף `.env*` ל-`.gitignore` (עם `!.env.example`)
- הוסר מפתח Supabase ANON קשיח מקבצים: `components/supabaseClient.ts`, `shared-mcp-server/agents-comm.js`, `tools/check_remaining_keys.js`
- הוסרו קבצי טמפ' של Cursor שיכלו להכיל סודות: `.cursor/temp_files_for_deleet/`
- הוסר `temp-export/` מה-repo והוסף ל-`.gitignore` (ארטיפקטים/מפות שעלולים להכיל מידע רגיש)

**המלצה מחייבת:** לבצע רוטציה למפתחות Supabase (ANON וגם SERVICE_ROLE אם היה חשוף אי פעם) ולבדוק גם מפתחות Firebase/`google-services*.json` אם הופיעו בהיסטוריה.

---

## גיבוי אחרון: 2025-12-05 17:30
**הערה:** זיהוי ביומטרי, מיון לפי מיקום GPS, הגדרות EAS Build

### סיכום
- ✅ SHA local = remote: `bae9d2e6490111bcf6419492e3059a49fb7da3f9`
- ✅ Diff: ריק (אין הבדלים בין local ל-remote)
- ✅ Working directory: נקי (git status --porcelain → ריק)
- ✅ קומיטים: main=36, restore_checkpoints=99

### בדיקות איכות (ספירת שורות):
| קובץ | שורות | השוואה לגיבוי קודם |
|------|--------|-------------------|
| `app/(tabs)/PunchCard.tsx` | 3,565 | ללא שינוי |
| `app/(tabs)/business_selector.tsx` | 1,034 | +301 (GPS) |
| `app/(tabs)/customers-login.tsx` | 1,060 | +225 (ביומטרי) |
| **סה"כ** | **5,659** | +526 שורות |

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

