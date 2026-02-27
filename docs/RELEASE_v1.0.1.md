# 📦 Release v1.0.1 - Cardz App

**תאריך:** 24 ינואר 2026

---

## 📋 פרטי הגרסה

| פלטפורמה | גרסה | Build Number | סטטוס |
|----------|------|--------------|-------|
| **Android** | 1.0.1 | versionCode: 4 | ✅ מוכן |
| **iOS** | 1.0.1 | buildNumber: 4 | ✅ מוכן |

---

## 🔧 תיקונים בגרסה זו

### 1. תיקון קישור מדיניות פרטיות
- **קבצים:** `newclient_form.tsx`, `PunchCard.tsx`
- **תיאור:** קישור מדיניות הפרטיות מפנה עכשיו ל-URL הנכון: `https://app.punchcards.digital/privacy-policy`

### 2. ברירת מחדל לעסק ברישום עצמי
- **קובץ:** `newclient_form.tsx`
- **תיאור:** כאשר לקוח מגיע ממסך כניסה של עסק ספציפי, העסק נבחר אוטומטית בטופס הרישום

### 3. הודעת רישום כפול ברורה
- **קובץ:** `newclient_form.tsx`
- **תיאור:** במקרה של ניסיון רישום כפול (אותו טלפון + אותו מוצר), מוצגת הודעה ברורה: "זוהה רישום כפול של מספר טלפון ומוצר זהים. נסה/י להגדיר מוצר כרטיסייה שונה."

### 4. תיקון כניסה ללא ביומטרי
- **קובץ:** `customers-login.tsx`
- **תיאור:** תוקן באג שמנע כניסה לכרטיסייה כאשר לוחצים "לא עכשיו" במודאל הביומטרי (שגיאת regex)

---

## 🔗 קישורים להורדה

### Android (AAB) - להעלאה ל-Google Play
```
https://expo.dev/artifacts/eas/nbmvooDXaYwVJQkmsMhZcn.aab
```

### iOS (IPA) - להעלאה ל-App Store
```
https://expo.dev/artifacts/eas/38cC91gp8U66L2hftfufqm.ipa
```

---

## 📝 Release Notes לחנויות

### עברית (לשתי החנויות):
```
גרסה 1.0.1

✨ מה חדש:
- שיפור תהליך הרישום לכרטיסייה חדשה
- תיקון קישורי מדיניות פרטיות
- שיפור תהליך הכניסה לאפליקציה
- תיקון באגים והשיפורים כלליים

🔒 פרטיות:
- עדכון קישור למדיניות הפרטיות
```

### English:
```
Version 1.0.1

✨ What's New:
- Improved registration flow for new punch cards
- Fixed privacy policy links
- Enhanced login process
- Bug fixes and general improvements

🔒 Privacy:
- Updated privacy policy link
```

---

## ✅ צ'קליסט העלאה

### Google Play (Android):

- [x] בנייה הושלמה
- [ ] AAB הורד
- [ ] העלאה ל-Google Play Console
- [ ] Release Notes הוזנו
- [ ] שליחה לבדיקה

### App Store (iOS):

- [x] בנייה הושלמה
- [ ] IPA הורד
- [ ] העלאה דרך Transporter / EAS Submit
- [ ] Release Notes הוזנו
- [ ] שליחה לבדיקה

---

## 🚀 פקודות בנייה

### Android Production:
```bash
npx eas build --profile production --platform android
```

### iOS Production:
```bash
npx eas build --profile production --platform ios
```

### שתי הפלטפורמות במקביל:
```bash
npx eas build --profile production --platform all
```

---

## 📊 סטטוס בדיקות

| בדיקה | תוצאה |
|-------|-------|
| Linter | ✅ עבר |
| TypeScript | ✅ עבר |
| Build Android | ✅ הושלם |
| Build iOS | ✅ הושלם |

---

## 🔑 פרטי Build

### Android Build:
- **Build ID:** ab81fcbb-7796-4030-b48b-7f75824a4ca7
- **Logs:** https://expo.dev/accounts/rordan/projects/my-new-test-app/builds/ab81fcbb-7796-4030-b48b-7f75824a4ca7

### iOS Build:
- **Build ID:** 1133a58c-e01a-4b75-a243-e68f4ea66d1c
- **Logs:** https://expo.dev/accounts/rordan/projects/my-new-test-app/builds/1133a58c-e01a-4b75-a243-e68f4ea66d1c

---

*נוצר אוטומטית: 24 ינואר 2026*
