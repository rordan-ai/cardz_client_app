# 🌍 מדריך סביבות - Cardz App

## סקירה מהירה

| סביבה | Channel | שימוש | מי רואה |
|-------|---------|-------|---------|
| **development** | development | פיתוח מקומי עם Metro | מפתחים בלבד |
| **preview** | preview | בדיקות פנימיות (APK/IPA) | מפתחים + בודקים |
| **production** | production | גרסה בחנויות | כל המשתמשים |

---

## 🔍 איך לזהות באיזו סביבה אני?

### בקוד:
```typescript
import { ENV, isDev, isPreview, isProd } from '@/config/environment';

if (isDev) {
  console.log('אני בפיתוח');
}
```

### בלוגים (adb logcat):
```
[ENV] 🌍 Environment: PREVIEW
[ENV] 📡 Channel: preview
```

### ב-UI:
- **DEV** - באנר כתום בפינה ימנית עליונה
- **PREVIEW** - באנר כחול בפינה ימנית עליונה
- **PRODUCTION** - ללא באנר

---

## 📤 פקודות דחיפה

### OTA Update (שינויי JavaScript בלבד)

```bash
# ל-PREVIEW (בדיקות)
eas update --branch preview --message "תיאור השינוי"

# ל-PRODUCTION (ייצור) - ⚠️ זהירות!
eas update --branch production --message "תיאור השינוי"
```

### Native Build (שינויי native/plugins)

```bash
# Preview - Android APK
eas build --profile preview --platform android

# Preview - iOS IPA
eas build --profile preview --platform ios

# Production - Android AAB (לחנות)
eas build --profile production --platform android

# Production - iOS IPA (לחנות)
eas build --profile production --platform ios
```

---

## ✅ צ'קליסט לפני דחיפה

### לפני כל OTA:
- [ ] וידאתי באיזה branch אני דוחף (preview/production)
- [ ] בדקתי שאין שגיאות lint: `npm run lint`
- [ ] עדכנתי מספר גרסה ב-UI (אם רלוונטי)

### לפני דחיפה ל-PRODUCTION:
- [ ] בדקתי בסביבת preview קודם
- [ ] וידאתי שכל הפיצ'רים עובדים: NFC, Push, Login
- [ ] גיבוי נעשה ל-restore_checkpoints
- [ ] קיבלתי אישור מפורש מבעל המוצר

---

## ⚠️ אזהרות חשובות

### 🚫 אסור:
1. לדחוף ל-production בלי בדיקה ב-preview קודם
2. לשנות runtimeVersion בלי native build
3. לערבב מפתחות Firebase/Supabase בין סביבות

### ✅ חובה:
1. לבדוק את הלוגים אחרי כל דחיפה
2. לעדכן מספר גרסה לאימות שהעדכון נקלט
3. לתעד כל שינוי ב-commit message ברור

---

## 🔧 משתני סביבה (EAS Secrets)

### הגדרה:
```bash
# הוספת secret
eas secret:create --name SUPABASE_URL --value "https://xxx.supabase.co" --scope project

# צפייה ב-secrets
eas secret:list
```

### משתנים נדרשים:
| שם | תיאור |
|----|-------|
| EXPO_PUBLIC_SUPABASE_URL | כתובת Supabase |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | מפתח Supabase |
| GOOGLE_SERVICES_JSON | Firebase config (Android) |

---

## 📊 מעקב אחר עדכונים

### בדיקת סטטוס עדכון:
```bash
# רשימת עדכונים אחרונים
eas update:list --branch preview

# פרטי עדכון ספציפי
eas update:view <update-id>
```

### ב-Expo Dashboard:
https://expo.dev/accounts/rordan/projects/my-new-test-app/updates

---

## 🆘 פתרון בעיות

### העדכון לא נקלט בטלפון:
1. סגור את האפליקציה לחלוטין
2. פתח מחדש (לא מ-recent apps)
3. בדוק לוגים: `adb logcat | findstr "expo-updates"`

### גרסה לא מתעדכנת:
1. וודא שה-channel נכון
2. וודא שה-runtimeVersion תואם
3. נסה: `eas update:republish`

---

*עודכן לאחרונה: ינואר 2026*
