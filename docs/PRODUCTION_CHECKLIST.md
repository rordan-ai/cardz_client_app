# 🚀 רשימת הכנה לייצור - Cardz App

## 📊 סטטוס נוכחי

| קטגוריה | Android | iOS |
|---------|---------|-----|
| בנייה בסיסית | ✅ עובד | ❌ לא נבדק |
| Firebase | ✅ מוגדר | ⚠️ חסר קובץ |
| Supabase | ✅ מוגדר | ✅ מוגדר |
| NFC | ✅ עובד | ⚠️ צריך בדיקה |
| Push Notifications | ✅ עובד | ⚠️ צריך בדיקה |

---

## ✅ מה הושלם

### אבטחה וסביבות
- [x] הסרת credentials מ-Git
- [x] `.env` מקומי עם מפתחות
- [x] `.gitignore` מעודכן
- [x] EAS Secrets מוגדרים:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `GOOGLE_SERVICES_JSON_BASE64`

### קוד
- [x] Logger utility להפרדת dev/prod
- [x] supabaseClient קורא מ-env
- [x] תיקון Video onError

---

## ⚠️ נדרש לפני ייצור

### 1. iOS - קריטי 🔴

#### 1.1 GoogleService-Info.plist
```bash
# להוריד מ-Firebase Console:
# Project Settings > Your Apps > iOS > Download GoogleService-Info.plist
# לשמור בתיקיית השורש של הפרויקט
```

#### 1.2 EAS Secret ל-iOS Firebase
```bash
# להמיר את הקובץ ל-Base64 ולהעלות ל-EAS:
# macOS/Linux:
eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST_BASE64 --value "$(cat GoogleService-Info.plist | base64)" --type string
```

#### 1.3 חשבון Apple Developer
- [ ] חשבון Apple Developer פעיל ($99/שנה)
- [ ] Bundle Identifier רשום: `com.cardz.app`
- [ ] Push Notifications Capability מופעל
- [ ] App Groups (אם צריך)

#### 1.4 בדיקת iOS Simulator
```bash
# להריץ בסימולטור לפני בנייה:
npx expo run:ios
```

### 2. Android - השלמות 🟡

#### 2.1 Keystore לייצור
```bash
# ליצור keystore לחתימת האפליקציה:
keytool -genkey -v -keystore cardz-release.keystore -alias cardz -keyalg RSA -keysize 2048 -validity 10000
```

#### 2.2 EAS Credentials
```bash
# להגדיר credentials לייצור:
eas credentials
```

### 3. הגדרות app.json 🟡

#### 3.1 שינויים נדרשים
```json
{
  "expo": {
    "slug": "cardz-app",           // לשנות מ-"my-new-test-app"
    "version": "1.0.0",            // לעדכן לפי הצורך
    "ios": {
      "buildNumber": "1",          // להוסיף
    },
    "android": {
      "versionCode": 1,            // להוסיף
    }
  }
}
```

#### 3.2 אייקונים ו-Splash
- [ ] אייקון iOS: 1024x1024 (ללא שקיפות)
- [ ] אייקון Android Adaptive: foreground + background
- [ ] Splash Screen: תמונה מותאמת

### 4. App Store / Play Store 🟡

#### 4.1 Google Play Console
- [ ] חשבון מפתח ($25 חד פעמי)
- [ ] פרטי האפליקציה (שם, תיאור, צילומי מסך)
- [ ] מדיניות פרטיות URL
- [ ] סיווג תוכן

#### 4.2 App Store Connect
- [ ] חשבון Apple Developer
- [ ] פרטי האפליקציה
- [ ] צילומי מסך (iPhone, iPad)
- [ ] מדיניות פרטיות URL
- [ ] App Review Guidelines compliance

---

## 🔧 פקודות בנייה

### Development (בדיקות)
```bash
# Android
npx expo run:android

# iOS (דורש Mac)
npx expo run:ios
```

### Preview (בדיקות פנימיות)
```bash
# Android APK
eas build --platform android --profile preview

# iOS (Ad Hoc)
eas build --platform ios --profile preview
```

### Production (חנויות)
```bash
# Android AAB (Google Play)
eas build --platform android --profile production

# iOS IPA (App Store)
eas build --platform ios --profile production
```

### Submit (הגשה לחנויות)
```bash
# Google Play
eas submit --platform android

# App Store
eas submit --platform ios
```

---

## 📝 בדיקות לפני שחרור

### פונקציונליות
- [ ] התחברות/הרשמה
- [ ] זיהוי ביומטרי
- [ ] NFC ניקוב
- [ ] Push Notifications
- [ ] מיקום GPS
- [ ] כרטיסיות ושוברים

### UI/UX
- [ ] רספונסיביות (טלפון/טאבלט)
- [ ] RTL (עברית)
- [ ] מצב כהה/בהיר
- [ ] אנימציות

### ביצועים
- [ ] זמן טעינה
- [ ] צריכת זיכרון
- [ ] צריכת סוללה

---

## 🗓️ סדר פעולות מומלץ

1. **שלב 1 - iOS בסיסי:**
   - להוריד GoogleService-Info.plist
   - להריץ בסימולטור
   - לתקן בעיות שיעלו

2. **שלב 2 - EAS Credentials:**
   - להגדיר iOS credentials
   - ליצור Android keystore

3. **שלב 3 - Preview Build:**
   - לבנות APK ו-IPA
   - לבדוק על מכשירים אמיתיים

4. **שלב 4 - Production Build:**
   - לעדכן version/buildNumber
   - לבנות לחנויות
   - להגיש לבדיקה

---

*עודכן: 16/12/2025*

