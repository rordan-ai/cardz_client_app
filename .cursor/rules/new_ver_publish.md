# 🚀 נוהל פרסום גרסאות חדשות - cards_project

### 🛑 חובה: איסור דחיפה ללא אישור
**אין לבצע שום דחיפת גרסה (EAS Update / EAS Build) ללא קבלת אישור מפורש מהמשתמש בכתב!**
**לפני כל דחיפה:**
1. לדווח על השינויים.
2. לדווח על סטטוס הבאגים.
3. לשאול: "האם לדחוף גרסה?"
4. להמתין לאישור.

**פרויקט**: אפליקציית React Native/Expo - Cardz  
**מיקום**: `C:\cardz_curser\cards_project`  
**פלטפורמות**: Android + iOS

---

## 📋 תוכן עניינים

1. [הבנת סוגי עדכונים](#1-הבנת-סוגי-עדכונים)
2. [זיהוי סוג השינוי](#2-זיהוי-סוג-השינוי)
3. [תהליך עדכון OTA](#3-תהליך-עדכון-ota-javascript)
4. [תהליך בנייה מלאה](#4-תהליך-בנייה-מלאה-native)
5. [עדכון מספר גרסה](#5-עדכון-מספר-גרסה)
6. [בדיקת העדכון](#6-בדיקת-העדכון)
7. [אבחון בעיות](#7-אבחון-בעיות)

---

## 1. הבנת סוגי עדכונים

| סוג | קבצים | זמן | עלות | פקודה |
|-----|-------|-----|------|-------|
| **OTA Update** | JavaScript/TypeScript | ~1-2 דק | חינם | `npx eas update` |
| **Native Build** | Kotlin/Swift/Manifest | ~20-30 דק | $$ | `npx eas build` |

### מתי להשתמש ב-OTA:
- ✅ שינויי לוגיקה (קוד TypeScript/JavaScript)
- ✅ שינויי UI/סגנונות
- ✅ תיקוני באגים בקוד
- ✅ עדכון טקסטים

### מתי נדרש Native Build:
- ❌ שינויים ב-`android/` או `ios/`
- ❌ שינויים ב-`app.json` (permissions, plugins, associatedDomains)
- ❌ הוספת תלויות native חדשות
- ❌ שינויים ב-AndroidManifest.xml / MainActivity.kt

---

## 2. זיהוי סוג השינוי

### בדיקת הקבצים שהשתנו:

```bash
git status
git diff
```

**קבצים שדורשים Native Build:**
```
android/app/src/main/AndroidManifest.xml
android/app/src/main/java/com/mycardz/app/MainActivity.kt
app.json (אם שינוי ב-associatedDomains, permissions, plugins)
```

**קבצים שמספיק OTA:**
```
app/(tabs)/*.tsx
app/*.tsx
components/*.tsx
hooks/*.ts
```

---

## 3. תהליך עדכון OTA (JavaScript)

### שלב 1: עריכת הקוד

דוגמה - תיקון באג:
```typescript
// app/(tabs)/PunchCard.tsx
// לפני:
const benefitName = punchCard.benefit;

// אחרי:
const benefitName = punchCard?.product_name || punchCard?.benefit || 'מוצר';
```

### שלב 2: בדיקת linter

```bash
# בדיקת שגיאות
npx eslint app/(tabs)/PunchCard.tsx
```

או דרך הכלי:
```typescript
read_lints({ paths: ["app/(tabs)/PunchCard.tsx"] })
```

### שלב 3: עדכון מספר גרסה

**קובץ**: `app/(tabs)/business_selector.tsx` (שורה ~313)

```typescript
// לפני:
{Platform.OS === 'android' ? 'V30.6' : 'V33.6'}

// אחרי:
{Platform.OS === 'android' ? 'V30.7' : 'V33.7'}
```

**חשוב**: תמיד להעלות את הגרסה (minor patch: +0.1)

### שלב 4: דחיפת OTA Update

**⚠️ חשוב לפני דחיפה**: לבדוק באיזה channel נבנו האפליקציות במכשירים:
```bash
eas build:list --limit 3
```
ה-branch בפקודת הדחיפה **חייב להתאים** ל-channel של ה-build!

**פקודה** (אם האפליקציות נבנו עם channel: preview):
```bash
npx eas update --branch preview --message "תיאור השינוי - V30.7" --non-interactive
```

**מה קורה**:
1. Metro Bundler בונה bundles עבור iOS, Android, Web
2. קבצים נדחסים ונשלחים ל-EAS servers
3. העדכון מתפרסם ל-branch `preview`

**פלט מוצלח**:
```
✔ Published!
Branch             preview
Platform           android, ios
Update group ID    ...
Android update ID  ...
iOS update ID      ...
```

**קישור למעקב**: מופיע ב-`EAS Dashboard`

### שלב 5: בדיקה

1. **במכשיר**: סגור אפליקציה לגמרי
2. פתח מחדש
3. בדוק מספר גרסה בפינה שמאלית עליונה
4. צריך להיות **V30.7** (אנדרואיד) או **V33.7** (iOS)

---

## 4. תהליך בנייה מלאה (Native)

### מתי נדרש:

כאשר יש שינויים ב:
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/.../*.kt`
- `app.json` (שדות: associatedDomains, permissions, plugins)

### שלב 1: עריכת קוד Native

דוגמה - הוספת Intent Filter:
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<intent-filter>
  <action android:name="android.nfc.action.NDEF_DISCOVERED"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <data android:scheme="mycardz"/>
</intent-filter>
```

### שלב 2: עדכון מספר גרסה

אותו תהליך כמו ב-OTA (שלב 3 למעלה)

### שלב 3: בנייה

**Android**:
```bash
npx eas build --platform android --profile preview
```

**iOS**:
```bash
npx eas build --platform ios --profile preview
```

**או שניהם ביחד**:
```bash
npx eas build --platform all --profile preview
```

**מה קורה**:
1. דחיסת כל קבצי הפרויקט (~97 MB)
2. העלאה ל-EAS Build servers
3. בנייה בענן:
   - Android: Gradle build → APK
   - iOS: Xcode build → IPA
4. הפקת קישור + QR code

**זמן**: 20-30 דקות

**פלט מוצלח**:
```
✔ Build finished

🤖 Open this link on your Android devices:
https://expo.dev/accounts/rordan/projects/.../builds/...

[QR CODE]
```

### שלב 4: התקנה

**Android**:
1. סרוק QR code מהטרמינל או פתח את הקישור
2. הורד APK
3. התקן (יחליף את הגרסה הקודמת)

**iOS**:
1. סרוק QR code או פתח קישור **באייפון**
2. התקן דרך TestFlight או Ad-Hoc
3. סמוך על הפרופיל

---

## 5. עדכון מספר גרסה

### מדריך מספור גרסאות:

**פורמט**: `V[Major].[Minor]`

| גרסה | מתי להשתמש |
|------|-----------|
| V30 → V31 | Native build חדש |
| V30.1 → V30.2 | OTA update |

**דוגמאות**:
- `V30` - Build native ראשון
- `V30.1` - OTA תיקון באג
- `V30.2` - OTA תיקון נוסף
- `V31` - Build native חדש עם שינויי manifest

### קובץ לעדכון:

**נתיב**: `app/(tabs)/business_selector.tsx`

**שורה**:
```typescript
<Text style={{ position: 'absolute', top: 50, left: 10, color: '#fff', fontSize: 12, fontFamily: 'Rubik' }}>
  {Platform.OS === 'android' ? 'V30.7' : 'V33.7'}
</Text>
```

**חשוב**:
- Android ו-iOS יכולים להיות בגרסאות שונות
- תמיד לעדכן את שתי הפלטפורמות גם ב-OTA (למרות שה-build נפרד)

---

## 6. בדיקת העדכון

### OTA Update:

**במכשיר**:
1. Force Stop אפליקציה
2. פתח מחדש **3 פעמים** (כדי לוודא שהעדכון התקבל)
3. בדוק מספר גרסה

**אם הגרסה לא משתנה**:
- בדוק חיבור לאינטרנט
- בדוק ב-EAS Dashboard אם העדכון פורסם
- נסה לנקות cache: הסר ותתקין מחדש

### Native Build:

**במכשיר**:
1. התקן APK/IPA החדש (דרוס את הישן)
2. פתח אפליקציה
3. בדוק מספר גרסה מיד בפתיחה

---

## 7. אבחון בעיות

### א. OTA לא מתקבל

**בדיקה**:
```bash
npx eas update:list --branch preview
```

**פתרון**:
- ודא ש-`app.json` מכיל:
  ```json
  "updates": {
    "enabled": true,
    "checkAutomatically": "ON_LOAD"
  }
  ```

### ב. Native Build נכשל

**לוגים**:
- פתח את הקישור מהטרמינל
- לחץ על "View logs"
- חפש שגיאות Gradle (Android) או Xcode (iOS)

### ג. קריסת אפליקציה

**Android logs**:
```bash
adb logcat -s ReactNativeJS:E
```

**שגיאות נפוצות**:
- `Property 'X' doesn't exist` → חסר import
- `undefined is not an object` → null/undefined בלי ?. optional chaining

### ד. NFC לא עובד

**Android**:
```bash
adb logcat -s MainActivity:D NfcDispatch:D ReactNativeJS:I
```

**חפש**:
- `[MainActivity] NFC deep link created`
- `[NfcHandler] Deep link received`

**iOS**:
- בדוק שהתג כתוב כ-URI Record (לא Text)
- ודא שקובץ AASA קיים: `https://app.punchcards.digital/.well-known/apple-app-site-association`

### ה. OTA נדחף אבל המכשיר לא מקבל עדכון (גרסה לא משתנה)

**הבעיה הנפוצה ביותר**: אי-התאמה בין ה-**branch** שאליו נדחף העדכון לבין ה-**channel** שבו האפליקציה נבנתה.

**הסבר**:
- כשבונים אפליקציה עם `--profile preview` → האפליקציה מחפשת עדכונים ב-branch `preview`
- כשבונים עם `--profile production` → מחפשת ב-branch `production`
- אם דוחפים עדכון ל-branch אחר - המכשיר **לא יראה** את העדכון!

**בדיקה - באיזה channel נבנו האפליקציות**:
```bash
eas build:list --limit 5
```

**חפש בפלט**:
```
Channel    preview    ← זה ה-channel של ה-build
```

**פתרון**:
- אם האפליקציות נבנו עם `channel: preview`:
  ```bash
  npx eas update --branch preview --message "תיאור השינוי"
  ```
- אם נבנו עם `channel: production`:
  ```bash
  npx eas update --branch production --message "תיאור השינוי"
  ```

**⚠️ חשוב**: ה-branch בפקודת `eas update` חייב להתאים ל-channel שבו האפליקציה נבנתה!

---

## 📦 מבנה EAS

### profiles (eas.json):

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "android": { "buildType": "apk" }
    },
    "production": {
      "channel": "production"
    }
  }
}
```

### channels:
- **preview** - לבדיקות (development/staging)
- **production** - ללקוחות אמיתיים

---

## 🔐 Credentials

**Android**:
- Keystore: מנוהל ב-EAS (remote)
- Package: `com.mycardz.app`

**iOS**:
- Bundle ID: `com.mycompany.mycard`
- Team ID: `C4N93LK5V7`
- Distribution Certificate + Provisioning Profile

---

## 📝 דוגמה מלאה - תיקון באג

### תרחיש: תיקון "NULL בהטבה"

**1. זיהוי**:
```
שגיאה: מוצג "מזל טוב! הגעת להטבה: null"
קובץ: app/(tabs)/PunchCard.tsx
```

**2. תיקון**:
```typescript
// שורה 231
const benefitName = punchCard?.product_name || punchCard?.benefit || 'ההטבה';
```

**3. בדיקת linter**:
```
אין שגיאות ✓
```

**4. עדכון גרסה**:
```typescript
// business_selector.tsx
V30.6 → V30.7
```

**5. דחיפה**:
```bash
npx eas update --branch preview --message "Fix NULL benefit - V30.7" --non-interactive
```

**6. בדיקה**:
- סגור אפליקציה
- פתח מחדש
- ודא גרסה V30.7
- בדוק תיקון

---

## 🎯 זכור!

1. **תמיד לעדכן מספר גרסה** - כך המשתמש יודע שהעדכון התקבל
2. **OTA מהיר וזול** - להשתמש בו כשאפשר
3. **Native Build יקר** - רק כשחייב
4. **לבדוק בשתי הפלטפורמות** - אנדרואיד ו-iOS מתנהגים אחרת
5. **לשמור logs** - לאבחון בעיות

---

**📅 מסמך נוצר**: דצמבר 2024  
**🔄 עדכון אחרון**: דצמבר 2025 - הוספת סעיף אי-התאמת branch/channel


