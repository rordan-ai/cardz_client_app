# מדריך גיבוי מלא לענף restore_checkpoints
📋 המדריך כולל:

## ✅ TODO גיבוי אולטימטיבי – חובה לעבור על כל סעיף

- חובה תפעולית: מיד לאחר קריאת המסמך, הסוכן חייב להעתיק/לפרוס את ה‑TODO הזה לסביבת העבודה שלו (כמסמך משימות/טבלה/Issue/Tasklist) ולעבוד ממנו בפועל. אין להסתמך על המסמך בלבד בזמן ביצוע. אי אפשר להמשיך בתהליך מבלי להסיר סעיף מה‑TODO לאחר שהושלם.

- [ ] הכנות: `git fetch origin`, קריאת הנהלים, עצירת/ווידוא שרת פיתוח לא רץ מענף שגוי (ראה “שלב 4.5: בקרת שרת/ענף”).  
- [ ] מניעה – אבטחה: סריקת סודות בקוד/כלים/מסמכים (JWT, `SUPABASE_*_KEY`, `.env*`, `runtime-config.json`). אם נמצא סוד → פועלים לפי “בעיות אבטחה בגיבויי והמנעות מהן”.  
- [ ] Snapshot עצמאי: יצירת `safety_snapshot_YYYYMMDD_HHMMSS`, `git add -A`, `git commit`, `git push origin`.  
- [ ] ענף ביטחון זמני: יצירת `safety_backup_YYYYMMDD_HHMMSS`, `git add -A`, `git commit`, `git push origin`. שמור את השם להמשך.  
- [ ] עדכון ענף הגיבוי: מעבר ל־`restore_checkpoints`, `git pull origin restore_checkpoints`, בדיקת `git status`.  
- [ ] מיזוג הגיבוי: `git merge safety_backup_...` ל־`restore_checkpoints`.  
  - אם יש קונפליקטים → עצירה מיידית: `git merge --abort`, יצירת `restorepoint_snapshot_...` ו־`git push origin` (תיעוד בדוח), לא דוחפים מיזוג שבור.  
  - אם אין קונפליקטים → ממשיכים.  
- [ ] Restorepoint snapshot: יצירת `restorepoint_snapshot_YYYYMMDD_HHMMSS` ו־`git push origin`.  
- [ ] דחיפת הגיבוי: `git push origin restore_checkpoints`.  
- [ ] בדיקות איכות (ראה “בדיקות איכות ו‑100% גיבוי”):  
  - `git rev-list --count main` == `git rev-list --count restore_checkpoints`  
  - `git diff main restore_checkpoints --name-only` → ריק  
  - `git status --porcelain` → ריק  
  - `git show-branch origin/restore_checkpoints restore_checkpoints` → זהות  
  - קבצים מרכזיים קיימים + בדיקות משלימות לפי הנהלים  
- [ ] דוח גיבוי: עדכון `docs/BACKUPS_REPORTS.md` עם תאריך, ענפים, SHA, הבדלים/קונפליקטים, אבטחה (ראה הדוגמאות).  
- [ ] בקרת שרת/ענף לאחר גיבוי: חזרה לענף העבודה הרלוונטי (למשל `safety_backup_...`), אתחול `npm run dev`, אימות מסכי UI קריטיים בדפדפן (למשל “פרסום → הודעות פוש”).  
- [ ] ניקוי: מחיקת ענפי ביטחון זמניים מקומיים לאחר הצלחה סופית (ראה “ניקוי ענפי בטחון זמניים”).  

🔧 סביבת עבודה מדויקת:
Windows 10 + PowerShell
נתיב: C:\cardz_curser\cards-admin-web
ענפים: main → restore_checkpoints
📝 תהליך מלא צעד אחר צעד:
בדיקות התחלתיות
הכנת ענף הגיבוי
מיזוג מ-main
דחיפה ל-origin
בעיות אבטחה בגיבויי והמנעות מהן (מפורט בהמשך)
בקרת שרת/ענף לאחר גיבוי: נעילת שרת הפיתוח לענף העבודה ואימות בדפדפן
🔍 בדיקות איכות מפורטות:
זהות קומיטים
השוואת קבצים
בדיקת working directory
וידוא סינכרון remote
⚠️ פתרון בעיות נפוצות:
התנגשויות במיזוג
בעיות PowerShell
בדיקות לאחר הגיבוי
קריטריונים להצלחה ברורים!!!

## סביבת עבודה
- **מערכת הפעלה:** Windows 10
- **מעטפת:** PowerShell
- **נתיב עבודה:** `C:\cardz_curser\cards-admin-web`
- **פרוייקט:** cards-admin-web
- **ענף מקור:** main
- **ענף יעד:** restore_checkpoints

## תהליך גיבוי מלא - צעד אחר צעד

### **בעיות אבטחה בגיבויי והמנעות מהן**
> מטרה: למנוע דליפת סודות (Supabase URL/ANON_KEY/SERVICE_ROLE_KEY וכו') לענפי גיבוי/restore ולדוחות, ולהבטיח שהמערכת ממשיכה לפעול לאחר הסרת מפתחות קשיחים.

#### מניעה לפני שמתחילים
- אין מפתחות אמיתיים בקוד/מסמכים/דוגמאות — משתמשים ב‑PLACEHOLDER בלבד.
- `.env*` ו‑`public/runtime-config.json` מוחרגים מגיט.
- סריקת סודות מהירה: חיפוש `eyJhbGciOiJI`, `SUPABASE_*_KEY`, ו‑`supabase.co` בקבצי דוגמא/כלים.
- Edge Functions קוראות מפתחות רק ממשתני סביבה; SERVICE_ROLE_KEY לעולם לא בצד לקוח.
- Frontend קורא Supabase URL/ANON רק מ‑ENV/Runtime/LocalStorage — ללא fallback קשיח בקוד.

#### אם נמצא סוד/חשד בזמן הגיבוי
1) לעצור מיזוג/דחיפה.  
2) להחליף ערכים אמיתיים ל‑`<PLACEHOLDER>` ולמחוק קבצי tmp רגישים.  
3) לבצע רוטציית מפתחות ב‑Supabase (ANON + SERVICE_ROLE).  
4) לוודא `.gitignore` כולל `.env*` ו‑`public/runtime-config.json`.  
5) לתעד ב‑`docs/BACKUPS_REPORTS.md` את האירוע וה‑SHA.  
6) להריץ בדיקות תפקוד (ראה סימפטומים להלן).

#### סימפטומים לאחר הסרת מפתחות קשיחים ומה עושים
- באדמין: “חסר מפתח API” → להשלים `VITE_SUPABASE_URL/ANON_KEY` (ENV/Runtime/LocalStorage) ולרענן.
- “Invalid supabaseUrl” → להגדיר `https://<ref>.supabase.co`.
- Edge Functions 500 “misconfigured” → להגדיר `SUPABASE_URL` ו‑`SUPABASE_SERVICE_ROLE_KEY` ב‑Settings.

#### פלייבוקים מהירים
- Dev:  
  `localStorage.setItem('SUPABASE_URL','https://<ref>.supabase.co')`  
  `localStorage.setItem('SUPABASE_ANON_KEY','<ANON_KEY>')`  
  `location.reload()`
- Runtime (מוחרג מגיט): `public/runtime-config.json` עם URL/ANON.
- CI/Prod: הזרקת ENV ל‑Frontend (`VITE_SUPABASE_*`) ול‑Functions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

#### צ’ק‑ליסט מהיר לפני דחיפה
- [ ] אין סודות בקוד/מסמכים/כלים.  
- [ ] `.env*` ו‑`public/runtime-config.json` מוחרגים.  
- [ ] Edge Functions ללא fallback למפתחות.  
- [ ] Frontend נטען מקונפיג תקין; שליחת פוש מחזירה 200.

> 🛟 **חדש:** בכל תהליך גיבוי חובה ליצור *ענף ביטחון עצמאי ומגובה* לפני שנוגעים ב-`restore_checkpoints` או ב-`main`. ענף זה מכיל צילום מלא של כל השינויים (כולל כאלה שלא בוצע להם קומיט בעבר) ומשמש כנקודת חזרה מיידית במקרה שמיזוגי הגיבוי ייכשלו או יוצרו פערים מול הענפים הראשיים.

### שלב 1: בדיקת מצב נוכחי
```bash
# בדיקת מצב git נוכחי
git status

# בדיקת כל הענפים הקיימים
git branch -a

# וידוא שאנו ב-main
git checkout main
```

### שלב 1.5: ענף ביטחון עצמאי (Snapshot מלא לפני כל גיבוי)
```bash
# יצירת Snapshot עצמאי לפני שנוגעים ב-restore_checkpoints או main
# הסנאפשוט חייב לכלול *כל* השינויים המזוהים, גם אם לא בוצע להם קומיט קודם לכן
git checkout -b safety_snapshot_$(Get-Date -Format 'yyyyMMdd_HHmmss')
git add -A
git commit -m "Snapshot עצמאי לפני גיבוי restore_checkpoints" --no-verify

# דחיפה כדי לאפשר שחזור בכל נקודה
git push origin safety_snapshot_YYYYMMDD_HHMMSS

# נשארים על הענף שנוצר עד לסיום ההעלאה, ואז ממשיכים לשלב הבא
git checkout main
```
💡 עכשיו יש לנו צילום בלתי תלוי שניתן לחזור אליו אם מיזוג restore\_checkpoints ⇆ main ייכשל. אין לדלג על צעד זה, במיוחד כשקיימים כבר קומיטים לא מסונכרנים ב-`restore_checkpoints`.

### שלב 2: הכנת ענף הגיבוי + ענף בטחון זמני
```bash
# יצירת ענף בטחון זמני (למניעת בעיות מיזוג)
# 📝 שמור את שם הענף למזוג מאוחר יותר!
git checkout -b safety_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')
git add -A
git commit -m "גיבוי בטחון זמני לפני קומיט מקצועי - לא למיזוג" --no-verify

# 💾 רשום את שם הענף שנוצר (לדוגמה: safety_backup_20251029_103728)
# תצטרך אותו בשלב 3!

# מעבר לענף restore_checkpoints
git checkout restore_checkpoints

# עדכון הענף מה-origin
git pull origin restore_checkpoints

# בדיקת מצב לאחר העדכון
git status
```
חובה להודיע למשתמש אם קיימות החרגות בגיבוי או בעיות אבטחה של קבצים רגישים יחד עם הצעה מקצועית לגיבוי

### שלב 3: ביצוע הגיבוי (מיזוג מענף הביטחון)
```bash
# 🚨 שלב קריטי - אל תדלג!
# יש למזג את ענף הביטחון הזמני (שמכיל את כל השינויים) ל-restore_checkpoints

# חזרה לענף הגיבוי
git checkout restore_checkpoints

# ⚠️ מיזוג חובה מענף הביטחון (לא מ-main!)
# ענף הביטחון מכיל את המצב המלא כולל שינויים לא-מוקדשים
git merge safety_backup_YYYYMMDD_HHMMSS -m "גיבוי מלא כולל שינויים לא-מוקדשים"

# 📝 הערה: אם יש גם קומיטים חדשים ב-main שטרם מוזגו, בצע גם:
# git merge main -m "מיזוג עדכונים נוספים מ-main"
```

### שלב 3.5: Snapshot לריסטורפוינט לפני מיזוג ל-main
```bash
# אחרי שהשלמת את המיזוג ל-restore_checkpoints וטרם מגע עם main
# צור ענף ביטחון נוסף שמייצג את מצב הריסטורפוינט המעודכן
git checkout restore_checkpoints
git branch restorepoint_snapshot_$(Get-Date -Format 'yyyyMMdd_HHmmss')
git push origin restorepoint_snapshot_YYYYMMDD_HHMMSS

# רק לאחר שיש Snapshot זהה גם ב-remote, המשך למיזוגים מול main לפי הנהלים
```
🔁 שני ענפי הביטחון (הראשון מהעבודה המקומית והשני אחרי עדכון הריסטורפוינט) מבטיחים שאפשר לשחזר גם אם קיימים קומיטים בלתי מעודכנים כבר ב-`restore_checkpoints` או אם נוצר כשל במיזוג עם `main`.

### ⛔ טעות נפוצה שחייבים להימנע ממנה:
**אל תדלג על מיזוג ענף הביטחון!**  
אם תמזג רק מ-`main` ותדחוף, השינויים שנשמרו בענף הביטחון לא יגיעו ל-`restore_checkpoints` ו-remote, והגיבוי יהיה חסר!

### שלב 4: דחיפה ל-origin
```bash
# דחיפת הגיבוי ל-remote repository
git push origin restore_checkpoints
```

### שלב 4.5: בקרת שרת/ענף לאחר גיבוי (חובה כדי למנוע הצגת UI ישן)
```bash
# ודא שאתה חוזר לענף העבודה הפעיל (למשל ענף הביטחון הזמני עם התיקונים):
git checkout safety_backup_YYYYMMDD_HHMMSS

# הפעל/אתחל מחדש את שרת הפיתוח מהענף הנכון
npm run dev
```
- לפתוח בדפדפן את מסכי ה‑UI הקריטיים (למשל “פרסום → הודעות פוש”) ולוודא שהסידורים האחרונים נטענים.  
- אם מוצג UI ישן — לבדוק באיזה ענף רץ השרת ולתקן מיידית (לעצור את השרת, `git checkout <branch>`, להפעיל שוב).

## בדיקות איכות ו-100% גיבוי

### בדיקת זהות קומיטים
```bash
# ספירת קומיטים ב-main
git rev-list --count main

# ספירת קומיטים ב-restore_checkpoints
git rev-list --count restore_checkpoints

# התוצאה צריכה להיות זהה!
```

### בדיקת הבדלי קבצים
```bash
# בדיקה שאין הבדלים בין הענפים
git diff main restore_checkpoints --name-only

# אמור להחזיר תוצאה ריקה (אין הבדלים)
```

### בדיקת היסטוריית קומיטים
```bash
# בדיקת 5 הקומיטים האחרונים
git log --oneline -n 5

# וידוא שהקומיט האחרון זהה בשני הענפים
```

### בדיקת קבצים מרכזיים
```bash
# בדיקת קיום הקבצים החשובים
cmd /c "dir src\App.tsx src\components\MarketingCenter.tsx package.json"
```
### בדיקת השוואת גודל קבצים 
### בדיקת working directory נקי
```bash
# וידוא שאין שינויים לא מוקדשים
git status --porcelain

# אמור להחזיר תוצאה ריקה
```

### בדיקת סינכרון עם origin
```bash
# וידוא שהמקומי והרחוק זהים
git show-branch origin/restore_checkpoints restore_checkpoints
```

## פתרון בעיות נפוצות

### אם יש התנגשויות במיזוג:
```bash
# ביטול המיזוג
git merge --abort

# עדכון main מ-origin
git checkout main
git pull origin main

# ניסיון חוזר
git checkout restore_checkpoints
git merge main
```

### אם PowerShell לא מכיר פקודות:
```bash
# שימוש ב-cmd לפקודות בעייתיות
cmd /c "git status"
cmd /c "dir /s /a-d | find \"File(s)\""
```

### בדיקת מצב הענפים אחרי הגיבוי:
```bash
# בדיקה כמה קומיטים יש לכל ענף
git for-each-ref --format='%(refname:short) %(committerdate:short)' refs/heads/
```

### בעיה חוזרת: גיבוי לא מושלם (origin לא מסונכרן)
- **תסמין:** GitHub מציג פערים/חוסר קבצים למרות שהקומיטים הועלו מקומית.
- **גורמים נפוצים:**
  - שימוש בפקודות משולבות עם `&&` ב-PowerShell גורם להפסקה באמצע ולא כל השלבים רצים.
  - דילוג על `git fetch` לפני בדיקות מול `origin/*`.
  - דחיפה רק לענף אחד (למשל main) בלי לעדכן `restore_checkpoints` או להפך.
  - **🔴 דילוג על מיזוג ענף הביטחון** - הטעות הנפוצה ביותר! יצירת ענף ביטחון עם קומיט אבל לא מיזוג שלו ל-restore_checkpoints לפני הדחיפה.
- **פרוטוקול תיקון מהיר:**
  ```bash
  cmd /c git fetch origin
  cmd /c git --no-pager rev-parse origin/main
  cmd /c git --no-pager rev-parse main
  cmd /c git --no-pager rev-parse origin/restore_checkpoints
  cmd /c git --no-pager rev-parse restore_checkpoints
  # אם יש פערים – דחיפה מסודרת
  cmd /c git push origin restore_checkpoints
  cmd /c git push origin main
  ```
- **מניעה קדימה:**
  - ב‑Windows להימנע מ‑`&&`; להריץ כל פקודה בנפרד עם `cmd /c`.
  - תמיד לבצע `git fetch origin` לפני בדיקות השוואה מול `origin/*`.
  - לאשר זהות SHA בין מקומי ל‑origin לשני הענפים לפני סיום גיבוי.
  - **חובה:** אחרי יצירת ענף ביטחון ב-שלב 2, למזג אותו ל-restore_checkpoints ב-שלב 3 (לא רק main!).

## סיכום הצלחה

הגיבוי הושלם בהצלחה כאשר:

✅ **מספר הקומיטים זהה** - main ו-restore_checkpoints עם אותו מספר קומיטים
✅ **אין הבדלי קבצים** - `git diff` מחזיר ריק  
✅ **Working directory נקי** - `git status --porcelain` ריק
✅ **דחיפה הושלמה** - origin/restore_checkpoints עודכן
✅ **קבצים מרכזיים קיימים** - App.tsx, SystemSettings.tsx, BackupManager.tsx, package.json
✅ **ספירת קבצי TSX** - 25 קבצים בsrc (כולל כל הקומפוננטים)
✅ **📊 דוח גיבוי נשמר** - יצירת דוח מפורט בקובץ BACKUPS_REPORTS.md עם תאריך ושעה

## דוגמה למוצר סופי מוצלח (עדכון אחרון):

```
קומיטים: main=181, restore_checkpoints=181 ✅
הבדלי קבצים: 0 ✅  
קבצים לא מוקדשים: 0 ✅
סינכרון remote: מושלם ✅
קבצי TSX: 25 ✅
קבצים קריטיים: App.tsx(10,911), SystemSettings.tsx(10,087), BackupManager.tsx(43,507), package.json(1,409) ✅

הגיבוי הושלם במאה אחוז הצלחה!
```

## שינויים אחרונים שנוספו:
- **תיקון מסך לבן** - הוספת try-catch ל-setHistoryState ב-BackupManager
- **תיקון Google OAuth** - שמירה על לוגיקת forcePrompt לבחירת חשבונות
- **3 טאבים חדשים** - במסך תנאים ומדיניות עם כותרות דינמיות

---
**הערות חשובות:**
- לבצע הגיבוי תמיד מ-main העדכני ביותר
- לוודא שאין שינויים לא מוקדשים לפני התחלה
- לבדוק כל שלב לפני המעבר לבא אחריו
- במקרה של כישלון - לא להמשיך, לבדוק את השגיאה
- **חדש:** תמיד ליצור ענף בטחון זמני לפני מיזוגים גדולים
- **חדש:** לנקות ענפי בטחון זמניים אחרי הצלחת הגיבוי

## ניקוי ענפי בטחון זמניים (אחרי הצלחה):
```bash
# מחיקת ענפי בטחון זמניים (רק אחרי הצלחת הגיבוי)
git branch -D safety_backup_*
```

## 📊 שמירת דוח גיבוי (שלב אחרון חובה):
**חובה:** לאחר השלמת כל הבדיקות ואישור ההצלחה, יש ליצור/לעדכן את קובץ `BACKUPS_REPORTS.md` עם:
- תאריך ושעה מדויקים
- כל תוצאות הבדיקות
- פירוט השינויים המרכזיים שנכללו בגיבוי
- מספרי SHA של הקומיטים
- סטטוס סופי של הגיבוי

תקציר: 
