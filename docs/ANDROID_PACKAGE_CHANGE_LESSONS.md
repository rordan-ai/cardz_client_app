# 🚨 לקחים משינוי Package Name באנדרואיד

**תאריך:** 3 פברואר 2026

## ❌ מה השתבש

### בעיה 1: מפתח חתימה חדש נוצר אוטומטית
כששינינו package מ-`com.mycardz.app` ל-`com.yuladigital.cardz`:
- EAS שאל "Generate a new Android Keystore?" 
- ענינו **Yes** - וזו הייתה טעות אם רוצים להעלות לאפליקציה קיימת
- Google Play דחה כי המפתח לא תאם

### בעיה 2: קבצי Kotlin בנתיב הישן
- הקבצים `MainActivity.kt`, `MainApplication.kt`, `NfcDispatchActivity.kt` נשארו בנתיב `com/mycardz/app`
- הבנייה נכשלה עם "Unresolved reference 'MainActivity'"

### בעיה 3: Plugin של NFC עם נתיב קשיח
- הקובץ `plugins/with-nfc-android.js` היה עם נתיב קשיח `com/mycardz/app`
- צריך לעדכן גם אותו

### בעיה 4: איפוס מפתח לוקח יומיים
- בחרנו "בקשת איפוס של מפתח ההעלאה" ב-Google Play
- זה לוקח **יומיים** להיכנס לתוקף
- מחיקת האפליקציה ויצירה חדשה הייתה מהירה יותר

---

## ✅ התהליך הנכון לשינוי Package Name

### שלב 1: עדכון app.json
```json
"android": {
  "package": "com.NEW_PACKAGE.NAME"
}
```

### שלב 2: עדכון Plugin של NFC
בקובץ `plugins/with-nfc-android.js`:
- שנה את הנתיב מ-`com/OLD/PACKAGE` ל-`com/NEW/PACKAGE`
- שנה את ה-package בתוך `NFC_DISPATCH_ACTIVITY_KT`

### שלב 3: עדכון Firebase
1. Firebase Console → Project Settings → Add app
2. הוסף אפליקציית Android עם ה-package החדש
3. הורד `google-services.json` חדש
4. החלף את הקובץ בתיקיית הפרויקט

### שלב 4: בנייה חדשה
```bash
npx eas build --platform android --profile production
```

**כש-EAS שואל "Generate a new Android Keystore?":**
- **אם זו אפליקציה חדשה לגמרי ב-Google Play** → Yes
- **אם רוצים לעדכן אפליקציה קיימת** → No (צריך להשתמש באותו מפתח)

### שלב 5: Google Play
**אם יש ריג'קט על מפתח חתימה:**
- **הפתרון המהיר:** מחק את האפליקציה וצור חדשה (שעה טפסים)
- **לא לבחור:** "בקשת איפוס מפתח" - זה לוקח יומיים!

---

## 📋 צ'קליסט לפני שינוי Package

- [ ] האם צריך ליצור אפליקציה חדשה ב-Google Play?
- [ ] האם יש קבצי Kotlin קסטומיים שצריך להעביר?
- [ ] האם יש plugins עם נתיבים קשיחים?
- [ ] האם Firebase מעודכן עם ה-package החדש?
- [ ] האם יש deep links / assetlinks.json שצריך לעדכן?

---

## 🔑 מפתחות EAS הנוכחיים (com.yuladigital.cardz)

```
Key Alias:          6f600470c0b8d77ceae9a3df4b1b2d0e
Keystore Password:  fb22529562b08158acd87393da0f86e9
Key Password:       1d12163b5fe914c52d956c8b79b8224b
SHA1:               9E:2C:0D:34:0C:3A:45:DE:29:0A:B0:E8:67:06:7D:11:33:B3:01:67
SHA256:             F9:32:45:80:13:AF:04:C8:26:49:BB:83:A7:B1:DA:86:78:34:43:BA:98:E7:96:80:B8:22:FE:CD:34:72:18:DD
```

---

## 📁 קבצים שצריך לעדכן בשינוי Package

1. `app.json` - android.package
2. `plugins/with-nfc-android.js` - נתיב ו-package name
3. `google-services.json` - מ-Firebase
4. `android/app/src/main/java/com/[PACKAGE]/` - קבצי Kotlin (אם קיימים)
