# 🔄 התנהלות בפרודקשן - Cardz App

## 📋 תוכן עניינים

- [טיפול בריג'קטים](#-טיפול-בריגקטים)
- [EAS Update - עדכונים מהירים](#-eas-update---עדכונים-מהירים)
- [עדכון גרסה לחנויות](#-עדכון-גרסה-לחנויות)
- [Channels - ערוצי עדכון](#-channels---ערוצי-עדכון)

---

## 🚫 טיפול בריג'קטים

### תהליך כללי לריג'קט

1. **קרא את הריג'קט בעיון** - הבן מה בדיוק הבעיה
2. **אתר את מקור הבעיה בקוד**
3. **בצע תיקון מינימלי** - אל תשנה דברים אחרים
4. **בנה גרסה חדשה**
5. **העלה ושלח לבדיקה מחדש**

### ריג'קטים נפוצים ופתרונות

#### Apple - Guideline 4.0 (Design) - פתיחת דפדפן חיצוני

**הבעיה:** האפליקציה פותחת דפדפן חיצוני (Safari) להתחברות/הרשמה

**הפתרון:**
```tsx
// במקום:
Linking.openURL('https://...')

// להשתמש ב:
import * as WebBrowser from 'expo-web-browser';
WebBrowser.openBrowserAsync('https://...')
```

| שיטה | תוצאה | סטטוס אפל |
|------|-------|-----------|
| `Linking.openURL()` | פותח Safari נפרד | ❌ נדחה |
| `WebBrowser.openBrowserAsync()` | Safari View Controller בתוך האפליקציה | ✅ מאושר |
| מודאל מובנה | תוכן נייטיב | ✅ מאושר |

#### Apple - Guideline 5.1.1(v) - מחיקת חשבון

**הבעיה:** אפליקציה שתומכת ביצירת חשבון חייבת לתמוך גם במחיקה

**הפתרון:** וודא שיש אפשרות מחיקת חשבון נגישה למשתמש

---

## ⚡ EAS Update - עדכונים מהירים

### מתי להשתמש

| סוג שינוי | EAS Update | EAS Build |
|-----------|------------|-----------|
| תיקון באג JS/TS | ✅ | ✅ |
| שינוי UI | ✅ | ✅ |
| שינוי native code | ❌ | ✅ |
| הוספת dependency חדש | ❌ | ✅ |
| שינוי הרשאות | ❌ | ✅ |
| ריג'קט מחנות | ❌ | ✅ |

### יתרונות EAS Update

- **מהירות:** שניות במקום 20+ דקות
- **ללא review:** לא צריך אישור מאפל/גוגל
- **מיידי:** המשתמשים מקבלים את העדכון בפתיחה הבאה

### פקודות

```bash
# עדכון ל-staging (בדיקות)
npx eas update --channel preview --message "תיאור השינוי"

# עדכון ל-production (אחרי בדיקה!)
npx eas update --channel production --message "תיאור השינוי"
```

### חשוב לזכור

- EAS Update **לא יעזור** לריג'קט מחנות - צריך build חדש
- EAS Update **כן יעזור** לתיקון באג אחרי שהגרסה אושרה
- תמיד לבדוק קודם ב-`preview` לפני `production`

---

## 📦 עדכון גרסה לחנויות

### שלב 1: עדכון מספרי גרסה

ב-`app.json`:
```json
{
  "expo": {
    "version": "1.0.2",      // גרסה מוצגת למשתמש
    "ios": {
      "buildNumber": "19"    // מספר build - חייב לעלות
    },
    "android": {
      "versionCode": 12      // מספר build - חייב לעלות
    }
  }
}
```

### שלב 2: בנייה

```bash
# שתי הפלטפורמות
npx eas build --platform all --profile production

# או נפרד
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

### שלב 3: העלאה לחנויות

```bash
# iOS - App Store Connect
npx eas submit --platform ios --id [BUILD_ID]

# Android - Google Play Console
npx eas submit --platform android --id [BUILD_ID]
```

### שלב 4: עדכון תיעוד

עדכן את `STORE_SUBMISSION_GUIDE.md`:
- קישורי הורדה חדשים
- מספרי build חדשים
- תאריך עדכון

---

## 🔀 Channels - ערוצי עדכון

### המבנה הנוכחי

| Channel | שימוש | מי רואה |
|---------|-------|---------|
| `development` | פיתוח מקומי | מפתחים בלבד |
| `preview` | QA / staging | צוות בדיקות |
| `production` | משתמשים אמיתיים | כולם |

### תהליך עבודה מומלץ

```
development → preview → production
     ↓            ↓           ↓
  פיתוח       בדיקות     שחרור
```

1. **פתח ב-development** - עבודה מקומית
2. **דחוף ל-preview** - בדיקת QA
3. **וודא שהכל עובד**
4. **דחוף ל-production** - רק אחרי אישור

### פקודות לפי channel

```bash
# בנייה ל-preview (בדיקות)
npx eas build --profile preview

# בנייה ל-production (חנויות)
npx eas build --profile production

# עדכון OTA ל-preview
npx eas update --channel preview

# עדכון OTA ל-production
npx eas update --channel production
```

---

## 📝 צ'קליסט לפני שחרור

### לפני כל build לפרודקשן:

- [ ] מספרי גרסה עודכנו (version, buildNumber, versionCode)
- [ ] נבדק ב-preview/staging
- [ ] אין שגיאות linter
- [ ] אין console.log מיותרים
- [ ] תיעוד עודכן

### לפני submit לחנות:

- [ ] Build הסתיים בהצלחה
- [ ] נבדק על מכשיר אמיתי
- [ ] צילומי מסך מעודכנים (אם יש שינוי UI)
- [ ] Release notes מוכנים

---

## 📜 היסטוריית ריג'קטים ופתרונות

| תאריך | חנות | סיבה | פתרון |
|-------|------|------|--------|
| 01.02.2026 | Apple | Guideline 4.0 - דפדפן חיצוני למדיניות פרטיות | WebBrowser.openBrowserAsync + מודאל מובנה |

---

*עודכן לאחרונה: 01 פברואר 2026*
