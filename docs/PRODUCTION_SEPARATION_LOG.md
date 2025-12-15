# 📋 תיעוד תהליך הפרדת ייצור מפיתוח

**תאריך התחלה:** 2025-12-15  
**סטטוס:** ✅ הושלם  
**מטרה:** הפרדת ריפו הייצור מקבצים רגישים ודוקומנטציה פנימית

---

## 🎯 מטרות התהליך

1. להסיר מריפו הייצור קבצים רגישים (מפתחות Firebase)
2. להסיר דוקומנטציה פנימית (שיחות סוכנים)
3. לשמור על תפקוד 100% של האפליקציה
4. לאפשר המשך פיתוח נוח עם גישה לקבצים הרגישים מקומית

---

## 📝 לוג ביצוע (צעד אחרי צעד)

### צעד 1: יצירת קובץ תיעוד + גיבוי
**זמן:** 2025-12-15  
**סטטוס:** ✅ הושלם

**פעולות:**
- [x] יצירת קובץ תיעוד זה
- [x] גיבוי מלא לענף ביטחון לפי backup_rules_1611.md

**תוצאות:**
- קובץ תיעוד נוצר: `docs/PRODUCTION_SEPARATION_LOG.md`
- ענף גיבוי נוצר ונדחף: `safety_snapshot_separation_20251215`
- SHA: `5995f0e`

---

### צעד 2: עדכון .gitignore
**זמן:** 2025-12-15  
**סטטוס:** ✅ הושלם

**פעולות:**
- [x] הוספת החרגות לקבצי Firebase
- [x] הוספת החרגות לתיקיות שיחות

**שורות שנוספו ל-.gitignore:**
```
# Firebase config files (contain API keys - keep locally, not in repo)
google-services.json
android/app/google-services.json
GoogleService-Info.plist

# Internal documentation / agent chats (development only)
docs/chats/
docs/cursor_1112NFC.md
agent_chats/
```

---

### צעד 3: הסרת קבצי Firebase מגיט (בלי למחוק מקומית)
**זמן:** 2025-12-15  
**סטטוס:** ✅ הושלם

**קבצים שהוסרו מגיט:**
- [x] `google-services.json` — `git rm --cached`
- [x] `android/app/google-services.json` — `git rm --cached`
- [x] `GoogleService-Info.plist` — `git rm --cached`

**תוצאה:** הקבצים נשארים במחשב המקומי, לא יעלו לגיט יותר.

---

### צעד 4: יצירת קבצי תבנית (example)
**זמן:** 2025-12-15  
**סטטוס:** ✅ הושלם

**קבצים שנוצרו:**
- [x] `google-services.example.json` — תבנית עם PLACEHOLDER
- [x] `GoogleService-Info.example.plist` — תבנית עם PLACEHOLDER

**מטרה:** מפתח חדש יעתיק את הקובץ, ימלא ערכים אמיתיים מ-Firebase Console.

---

### צעד 5: מחיקת קבצי שיחות סוכנים
**זמן:** 2025-12-15  
**סטטוס:** ✅ הושלם

**קבצים שנמחקו:**
- [x] `docs/chats/cursor_13122.md` — `git rm`
- [x] `docs/chats/cursor_1312.md` — `git rm`
- [x] `docs/cursor_1112NFC.md` — `git rm`
- [x] `agent_chats/cursor_chat0512.md` — `git rm`

**הערה:** הקבצים נמחקו גם מהגיט וגם מהמחשב (לא היה צורך לשמור אותם מקומית).

---

### צעד 6: קומיט ופוש
**זמן:** 2025-12-15  
**סטטוס:** ✅ הושלם

**פעולות:**
- [x] `git add -A`
- [x] `git commit` עם הודעה מפורטת
- [x] `git push origin restore_checkpoints`

**תוצאות:**
- SHA: `756dccc`
- נמחקו 267,498 שורות של קבצי שיחות
- הקבצים הרגישים הוסרו מהריפו אבל נשארים מקומית

---

## 📊 סיכום סופי

| פריט | לפני | אחרי |
|------|------|------|
| קבצי Firebase בגיט | 3 | 0 ✅ |
| קבצי Firebase במחשב | 3 | 3 ✅ |
| קבצי תבנית (example) | 0 | 2 ✅ |
| קבצי שיחות סוכנים | 4 | 0 ✅ |
| תפקוד האפליקציה | 100% | 100% ✅ |

**סה"כ שורות שנמחקו מהריפו:** 267,498

---

## 🔧 נהלי עבודה

### איך לבנות לחנויות אחרי ההפרדה:
1. הקבצים הרגישים (`google-services.json`, `GoogleService-Info.plist`) כבר קיימים במחשב שלך
2. בניה רגילה עם `expo prebuild` או `eas build` תעבוד כרגיל
3. הקבצים לא יעלו לגיט כי הם ב-.gitignore

### איך להוסיף קבצי Firebase אחרי clone חדש:
1. היכנס ל-Firebase Console: https://console.firebase.google.com
2. בחר את הפרויקט: `business-digital-punch-cards`
3. הורד את הקבצים:
   - **אנדרואיד:** Settings → General → Your apps → Download `google-services.json`
   - **iOS:** Settings → General → Your apps → Download `GoogleService-Info.plist`
4. שים את הקבצים במיקומים:
   - `google-services.json` → תיקיית root
   - `android/app/google-services.json` → העתק לתיקיית אנדרואיד
   - `GoogleService-Info.plist` → תיקיית root

### איך לשחזר אם משהו השתבש:
1. **שחזור מהיר:** `git checkout safety_snapshot_separation_20251215`
2. **שחזור מלא:** ענף הגיבוי נדחף ל-origin וזמין תמיד
3. **קבצי Firebase:** הם עדיין קיימים במחשב המקומי, לא נמחקו

### מה לא לעשות:
- ❌ לא להוסיף את הקבצים הרגישים חזרה לגיט
- ❌ לא למחוק את קבצי ה-example (הם נחוצים למפתחים חדשים)
- ❌ לא להסיר את ההחרגות מ-.gitignore

---

## 🗂️ ענפי גיבוי שנוצרו

| ענף | SHA | תאריך | מטרה |
|-----|-----|-------|------|
| `safety_snapshot_separation_20251215` | `5995f0e` | 2025-12-15 | גיבוי לפני תהליך ההפרדה |


