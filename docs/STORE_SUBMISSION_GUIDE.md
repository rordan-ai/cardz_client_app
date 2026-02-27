# 📱 מדריך העלאה לחנויות - Cardz App

## 📋 סטטוס Builds

| פלטפורמה | גרסה | סטטוס | קישור להורדה |
|----------|------|-------|--------------|
| **Android (AAB)** | v1.0.1 (code 11) | ✅ מוכן | https://expo.dev/artifacts/eas/2wNZPgp72cZvYGcu7GVneP.aab |
| **iOS (IPA)** | v1.0.1 (build 17) | ✅ הועלה ל-App Store Connect | https://expo.dev/artifacts/eas/gsBrMnAQtVGpDA5yeodeBC.ipa |

---

## 📝 הכנות משותפות (לשתי הפלטפורמות)

### חומרים נדרשים:

- [ ] **מדיניות פרטיות** - URL לדף מדיניות פרטיות (חובה!)
- [ ] **צילומי מסך** - לפחות 2-3 מסכים
- [ ] **אייקון** - 512×512 PNG (Android) / 1024×1024 PNG (iOS)
- [ ] **תיאור קצר** - עד 80 תווים
- [ ] **תיאור מלא** - עד 4000 תווים

### תיאור מוצע (עברית):

**תיאור קצר:**
```
אפליקציית כרטיסיות נאמנות דיגיטליות - אסוף ניקובים וקבל הטבות!
```

**תיאור מלא:**
```
Cardz - כרטיסיות נאמנות דיגיטליות

🎯 מה האפליקציה עושה?
- אסוף ניקובים בעסקים המשתתפים
- קבל הטבות ומתנות בהשלמת כרטיסייה
- עקוב אחרי ההתקדמות שלך בזמן אמת

✨ תכונות עיקריות:
- ניקוב מהיר באמצעות NFC
- קבלת התראות על הטבות חדשות
- תיבת דואר עם מבצעים והטבות
- ממשק פשוט ונוח בעברית

📱 איך זה עובד?
1. היכנס לאפליקציה עם מספר הטלפון שלך
2. בחר את העסק שבו אתה נמצא
3. קבל ניקוב בכל ביקור
4. השלם את הכרטיסייה וקבל הטבה!

🔒 פרטיות ואבטחה:
- המידע שלך מאובטח
- לא נשתף מידע עם צד שלישי
```

---

# 🤖 Google Play (Android)

## שלב 1: כניסה ל-Console

1. **היכנס:** https://play.google.com/console
2. התחבר עם חשבון Google Developer (עלות חד פעמית: $25)

## שלב 2: יצירת אפליקציה חדשה

1. לחץ **"Create app"**
2. מלא:
   - **App name:** Cardz
   - **Default language:** עברית (Hebrew)
   - **App or game:** App
   - **Free or paid:** Free
3. אשר את ההצהרות ולחץ **"Create app"**

## שלב 3: Store Listing (דף החנות)

נווט ל: **Grow** → **Store presence** → **Main store listing**

| שדה | מה למלא |
|-----|---------|
| **App name** | Cardz |
| **Short description** | תיאור קצר (80 תווים) |
| **Full description** | תיאור מלא (4000 תווים) |

### גרפיקה נדרשת:

| פריט | גודל | פורמט |
|------|------|-------|
| **App icon** | 512×512 | PNG |
| **Feature graphic** | 1024×500 | PNG/JPEG |
| **Screenshots (Phone)** | 320-3840px | PNG/JPEG |

## שלב 4: העלאת ה-AAB

1. נווט ל: **Release** → **Production**
2. לחץ **"Create new release"**
3. לחץ **"Upload"** והעלה את קובץ ה-AAB
4. **Release name:** `1.0.0`
5. **Release notes:** 
   ```
   גרסה ראשונה של Cardz!
   - כרטיסיות נאמנות דיגיטליות
   - ניקוב NFC
   - קבלת התראות
   ```

## שלב 5: Content Rating (דירוג תוכן)

1. נווט ל: **Policy** → **App content** → **Content rating**
2. לחץ **"Start questionnaire"**
3. ענה על השאלות (האפליקציה כנראה "Everyone")
4. שמור

## שלב 6: Privacy Policy

1. נווט ל: **Policy** → **App content** → **Privacy policy**
2. הכנס URL למדיניות פרטיות

## שלב 7: Target Audience

1. נווט ל: **Policy** → **App content** → **Target audience**
2. בחר קבוצת גיל (18+)

## שלב 8: Data Safety

1. נווט ל: **Policy** → **App content** → **Data safety**
2. מלא את השאלון לגבי איסוף נתונים

## שלב 9: Countries / Regions

1. נווט ל: **Release** → **Production** → **Countries / regions**
2. בחר **Israel** (התחל עם ישראל בלבד)
3. אפשר להוסיף מדינות נוספות אחר כך

## שלב 10: שליחה לבדיקה

1. חזור ל: **Release** → **Production**
2. לחץ **"Review release"**
3. תקן שגיאות אם יש
4. לחץ **"Start rollout to Production"**

### ⏱️ זמן אישור: 3-7 ימים (פעם ראשונה)

---

# 🍎 App Store (iOS)

## שלב 1: כניסה ל-App Store Connect

1. **היכנס:** https://appstoreconnect.apple.com
2. התחבר עם Apple Developer Account (עלות שנתית: $99)

## שלב 2: יצירת אפליקציה חדשה

1. לחץ על **"+"** → **"New App"**
2. מלא:
   - **Platforms:** iOS
   - **Name:** Cardz
   - **Primary Language:** Hebrew
   - **Bundle ID:** com.mycardz.app
   - **SKU:** cardz-app-001

## שלב 3: App Information

נווט ל: **App Information**

| שדה | מה למלא |
|-----|---------|
| **Name** | Cardz |
| **Subtitle** | כרטיסיות נאמנות דיגיטליות |
| **Category** | Lifestyle או Shopping |
| **Content Rights** | Does not contain third-party content |

## שלב 4: Pricing and Availability

1. נווט ל: **Pricing and Availability**
2. **Price:** Free
3. **Availability:** Israel (התחל עם ישראל)

## שלב 5: App Privacy

1. נווט ל: **App Privacy**
2. הכנס **Privacy Policy URL**
3. מלא את שאלון איסוף הנתונים

## שלב 6: Version Information

נווט ל: **iOS App** → **1.0**

### Screenshots (חובה):

| מכשיר | גודל | כמות |
|-------|------|------|
| **iPhone 6.7"** | 1290×2796 | 3-10 |

### App Preview and Screenshots:
1. לחץ על גודל המכשיר
2. גרור את צילומי המסך

### Description:
הכנס את התיאור המלא (עברית)

### Keywords:
```
כרטיסיות,נאמנות,הטבות,ניקובים,מתנות,עסקים,NFC
```

### Support URL:
הכנס URL לדף תמיכה

### Marketing URL (אופציונלי):
הכנס URL לאתר

## שלב 7: Build

1. נווט ל: **Build** section
2. העלה את ה-IPA דרך **Transporter** או **TestFlight**

### העלאת IPA:

**אפשרות 1: Transporter (Mac בלבד)**
1. הורד Transporter מ-App Store
2. גרור את ה-IPA
3. העלה

**אפשרות 2: EAS Submit**
```bash
npx eas submit --platform ios
```

## שלב 8: App Review Information

1. נווט ל: **App Review Information**
2. מלא פרטי קשר לבודקים
3. אם צריך login - תן פרטי משתמש לבדיקה

## שלב 9: שליחה לבדיקה

1. לחץ **"Add for Review"**
2. לחץ **"Submit to App Review"**

### ⏱️ זמן אישור: 1-3 ימים

---

# 📸 LambdaTest - צילומי מסך

## למה LambdaTest?
- לצלם מסכים ברזולוציות נכונות
- לבדוק על מכשירים שאין לך

## שלב 1: כניסה

1. **היכנס:** https://www.lambdatest.com
2. התחבר עם החשבון שלך

## שלב 2: העלאת האפליקציה

### iOS (IPA):
1. נווט ל: **Real Device** → **App Testing**
2. לחץ **"Upload App"**
3. הורד את ה-IPA מהקישור:
   ```
   https://expo.dev/artifacts/eas/aAUYLUSH6fXCmJdaXZMTz3.ipa
   ```
4. העלה את הקובץ

### Android (APK/AAB):
1. נווט ל: **Real Device** → **App Testing**
2. לחץ **"Upload App"**
3. הורד את ה-AAB מהקישור:
   ```
   https://expo.dev/artifacts/eas/dpy6S4Q2uC16VgtzbunqUV.aab
   ```
4. העלה את הקובץ

## שלב 3: בחירת מכשיר

### iOS - לצילומי מסך לחנות:
- **iPhone 14 Pro Max** (6.7", 1290×2796) - מומלץ!
- iPhone 15 Pro Max
- iPhone 16 Pro Max

### Android - לצילומי מסך לחנות:
- Samsung Galaxy S23 Ultra
- Google Pixel 8 Pro

## שלב 4: צילום מסכים

1. הפעל את האפליקציה על המכשיר
2. נווט למסך הרצוי
3. לחץ על **"Screenshot"** בסרגל הכלים
4. שמור את התמונה

### מסכים מומלצים לצלם:

| # | מסך | תיאור |
|---|-----|-------|
| 1 | **מסך התחברות** | עם לוגו ושדה טלפון |
| 2 | **בחירת עסקים** | רשימת עסקים |
| 3 | **כרטיסיית ניקובים** | עם כמה ניקובים |
| 4 | **תיבת דואר** | עם הודעות |
| 5 | **מודאל NFC** | תהליך ניקוב |

---

# 📸 צילומי מסך מוכנים להעלאה

## 🤖 Android - Google Play (5 תמונות)

| סדר | שם קובץ | תיאור | סטטוס |
|-----|---------|-------|-------|
| 1 | `entry_android.png` | מסך כניסה CARDZ עם מודאל מיקום | ✅ |
| 2 | `punchcard_android.png` | כרטיסיית גוטלה 4/11 ניקובים | ✅ |
| 3 | `inbox_android.png` | תיבת דואר עם הודעה + קישור לשובר | ✅ |
| 4 | `card_login_android.png` | מסך התחברות גוטלה עם פולי קפה | ✅ |
| 5 | `business_select_android.png` | בחירת עסק - רשימת עסקים | ✅ |

### סדר מומלץ להצגה בחנות:
1. **entry** - רושם ראשוני + ברנדינג CARDZ
2. **punchcard** - הפיצ'ר העיקרי - כרטיסיית ניקובים
3. **inbox** - תיבת דואר עם הטבות
4. **card_login** - עיצוב מותאם לעסק
5. **business_select** - מגוון עסקים (אופציונלי)

---

## 🍎 iOS - App Store (5 תמונות)

| סדר | שם קובץ | תיאור | סטטוס |
|-----|---------|-------|-------|
| 1 | `entry_iphone_14_pro_max.png` | מסך כניסה CARDZ עם מודאל מיקום | ✅ |
| 2 | `punchcard_iphone_14_pro_max.png` | כרטיסיית גוטלה 4/11 ניקובים | ✅ |
| 3 | `inbox_iphone_14_pro_max.png` | תיבת דואר עם הודעה + קישור לשובר | ✅ |
| 4 | `card_login_iphone_14_pro_max.png` | מסך התחברות גוטלה עם פולי קפה | ✅ |
| 5 | `business_select_iphone_14_pro_max.png` | בחירת עסק - רשימת עסקים | ✅ |

### סדר מומלץ להצגה בחנות:
1. **entry** - רושם ראשוני + ברנדינג CARDZ
2. **punchcard** - הפיצ'ר העיקרי - כרטיסיית ניקובים
3. **inbox** - תיבת דואר עם הטבות
4. **card_login** - עיצוב מותאם לעסק
5. **business_select** - מגוון עסקים (אופציונלי)

---

## 📋 סיכום תמונות

| פלטפורמה | כמות | רזולוציה | סטטוס |
|----------|------|----------|-------|
| **Android** | 5 | משתנה (מהמכשיר) | ✅ מוכן |
| **iOS** | 5 | 1290×2796 (iPhone 6.7") | ✅ מוכן |

---

# ✅ צ'קליסט סופי

## לפני שליחה:

### Android:
- [ ] AAB הועלה
- [ ] צילומי מסך (2-8)
- [ ] אייקון 512×512
- [ ] Feature Graphic 1024×500
- [ ] תיאור קצר
- [ ] תיאור מלא
- [ ] מדיניות פרטיות
- [ ] Content Rating
- [ ] Data Safety
- [ ] מדינות נבחרו

### iOS:
- [ ] IPA הועלה
- [ ] צילומי מסך iPhone 6.7"
- [ ] אייקון 1024×1024
- [ ] תיאור
- [ ] Keywords
- [ ] מדיניות פרטיות
- [ ] App Privacy מולא
- [ ] פרטי קשר לבדיקה

---

# 🔄 עדכונים עתידיים

### להוספת שפות:
- **Google Play:** Store listing → Manage translations → Add language
- **App Store:** App Information → Localizations → Add

### להוספת מדינות:
- **Google Play:** Release → Countries/regions
- **App Store:** Pricing and Availability → Availability

### לעדכון גרסה:
1. בנה גרסה חדשה עם `versionCode` / `buildNumber` מוגדל
2. העלה את הקובץ החדש
3. כתוב Release Notes
4. שלח לבדיקה

---

*עודכן לאחרונה: 29 ינואר 2026*

## 📜 היסטוריית Builds

| תאריך | פלטפורמה | גרסה | פעולה |
|-------|----------|------|-------|
| 29.1.2026 | iOS | build 17 | הועלה ל-App Store Connect |
| 29.1.2026 | Android | code 11 | בנייה הושלמה |
| 28.1.2026 | iOS | build 15 | בנייה הושלמה |
| 28.1.2026 | Android | code 9 | בנייה הושלמה |