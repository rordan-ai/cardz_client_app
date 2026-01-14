# 🚀 תכנית מוכנות לפרודקשן - Cardz App

**תאריך:** 14/01/2026  
**גרסה נוכחית:** Preview V30.65 (Android) / V33.70 (iOS)  
**גרסת יעד לפרודקשן:** V1.0.0  
**סטטוס:** בהכנה

---

## 📋 סיכום מצב נוכחי

### ✅ הושלם
- אפליקציה פעילה ב-preview mode
- Firebase מוגדר (Android בלבד)
- Supabase מוגדר
- NFC פועל (Android)
- Push Notifications פועל (Android)
- OTA Updates פועל
- רקעים מותאמים אישית לעסקים
- הפרדת קבצים רגישים מ-Git

### ⚠️ נדרש השלמה
- iOS Firebase configuration
- iOS בדיקות מלאות
- Production builds
- חשבונות חנויות
- הפרדה סופית dev/prod

---

## 🎯 הפרדת סביבות (Development / Production)

### עקרונות הפרדה:

| היבט | Preview (Dev) | Production |
|------|---------------|------------|
| **Channel** | `preview` | `production` |
| **Runtime Version** | `1.0.0` (משותף) | `1.0.0` → `1.0.1` → `1.0.2` |
| **Updates** | OTA updates תכופים | OTA זהירים ונבדקים |
| **Credentials** | Development | Production (חתימה חזקה) |
| **Firebase** | Staging project | Production project |
| **Supabase** | Staging או shared | Production או shared |
| **מספור גרסה** | V30.X / V33.X | V1.0.0 → V1.0.1 |
| **Distribution** | Internal (APK/Ad-Hoc) | Store (AAB/IPA) |

---

## 📊 מספור גרסאות לפרודקשן

### מבנה גרסה:
```
V[Major].[Minor].[Patch]

דוגמאות:
V1.0.0 - שחרור ראשון
V1.0.1 - תיקון באג קטן (OTA)
V1.1.0 - פיצ'ר חדש (OTA)
V2.0.0 - שינוי מבני (Native Build)
```

### כללי עדכון גרסה:

#### OTA Update (שינויי JavaScript בלבד):
```
V1.0.0 → V1.0.1
V1.0.1 → V1.0.2
```

#### Native Build (שינויי manifest/permissions/native):
```
V1.0.X → V1.1.0
V1.1.X → V2.0.0
```

### קבצים לעדכון:
1. **app.json:**
   ```json
   {
     "version": "1.0.0",
     "ios": { "buildNumber": "1" },
     "android": { "versionCode": 1 }
   }
   ```

2. **business_selector.tsx:**
   ```typescript
   {Platform.OS === 'android' ? 'V1.0.0' : 'V1.0.0'}
   ```

3. **PunchCard.tsx:**
   ```typescript
   {Platform.OS === 'android' ? 'V1.0.0' : 'V1.0.0'}
   ```

---

## 🔐 הגדרות Production

### 1. Firebase - הפרדת Projects

**נוכחי (Preview):**
- Project: `business-digital-punch-cards` (Staging?)

**מומלץ לפרודקשן:**
- ליצור Firebase Project נפרד: `cardz-production`
- או להשתמש באותו project עם הפרדת environments

**פעולות:**
```bash
# 1. הורדת קבצי config חדשים מ-Firebase Production
# 2. שמירה מקומית:
#    - google-services-prod.json
#    - GoogleService-Info-prod.plist

# 3. העלאה ל-EAS Secrets:
eas secret:create --scope project --name GOOGLE_SERVICES_JSON_PROD --value "$(cat google-services-prod.json | base64)" --type string

eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST_PROD --value "$(cat GoogleService-Info-prod.plist | base64)" --type string
```

### 2. Supabase - הפרדת Environments

**אפשרות A: Project נפרד**
- Project חדש ל-Production
- URL + Keys שונים
- RLS policies זהים

**אפשרות B: אותו Project עם Branches**
- Preview Branch: `preview`
- Production Branch: `production`

**המלצה:** אותו project, הפרדה ב-branch level ב-EAS Updates.

### 3. EAS Profiles - הגדרות Production

**עדכון eas.json:**
```json
{
  "build": {
    "production": {
      "channel": "production",
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "buildConfiguration": "Release"
      },
      "env": {
        "GOOGLE_SERVICES_JSON": "@GOOGLE_SERVICES_JSON_PROD"
      }
    }
  }
}
```

---

## 📱 iOS - דרישות קריטיות

### 1. GoogleService-Info.plist
- [ ] הורדה מ-Firebase Console
- [ ] שמירה בשורש הפרויקט (מקומית)
- [ ] העלאה ל-EAS Secret

### 2. Apple Developer Account
- [ ] חשבון פעיל ($99/שנה)
- [ ] Bundle ID: `com.cardz.app` (או `com.mycompany.mycard`)
- [ ] Push Notifications Capability
- [ ] Associated Domains: `punchcards.digital`, `app.punchcards.digital`

### 3. Provisioning Profiles
- [ ] Development Profile (לבדיקות)
- [ ] Ad Hoc Profile (preview builds)
- [ ] App Store Profile (production)

### 4. הוספת מכשירים
- [ ] כל מכשירי הבדיקה ב-Devices
- [ ] עדכון Provisioning Profile אחרי הוספה

---

## 🤖 Android - דרישות

### 1. Keystore לפרודקשן
```bash
# יצירת keystore חדש (שמור בבטחון!)
keytool -genkey -v -keystore cardz-production.keystore \
  -alias cardz-prod -keyalg RSA -keysize 2048 -validity 10000

# העלאה ל-EAS:
eas credentials
```

### 2. Google Play Console
- [ ] חשבון מפתח ($25 חד פעמי)
- [ ] יצירת אפליקציה חדשה
- [ ] Package name: `com.mycardz.app`

### 3. AAB (App Bundle)
```bash
# בנייה לחנות (לא APK):
eas build --platform android --profile production
```

---

## 🔄 תהליך מעבר Preview → Production

### שלב 1: הכנות (לפני בנייה)

1. **עדכון app.json:**
   - `slug`: `"cardz-app"` (במקום `"my-new-test-app"`)
   - `version`: `"1.0.0"`
   - `ios.buildNumber`: `"1"`
   - `android.versionCode`: `1`
   - `runtimeVersion`: `"1.0.0"` (קבוע)

2. **עדכון מספרי גרסה באפליקציה:**
   - `business_selector.tsx`: `V1.0.0` (שני פלטפורמות)
   - `PunchCard.tsx`: `V1.0.0` (שני פלטפורמות)

3. **בדיקת .gitignore:**
   - ✅ `google-services.json`
   - ✅ `GoogleService-Info.plist`
   - ✅ `.env`

### שלב 2: הגדרת Credentials

**iOS:**
```bash
# 1. הגדרת Distribution Certificate
eas credentials

# 2. בחירה/יצירת Provisioning Profile
# 3. וידוא Push Notifications Capability
```

**Android:**
```bash
# 1. העלאת production keystore
eas credentials

# 2. הגדרת alias + passwords
```

### שלב 3: בנייה ראשונה

**גיבוי לפני בנייה:**
```bash
git add -A
git commit -m "Production ready: V1.0.0"
git push origin main
git push origin restore_checkpoints
```

**בנייה:**
```bash
# בנייה נפרדת לכל פלטפורמה:
eas build --platform android --profile production
eas build --platform ios --profile production

# או שניהם ביחד:
eas build --platform all --profile production
```

### שלב 4: בדיקות לפני הגשה

- [ ] התקנה על מכשירים פיזיים
- [ ] בדיקת כל תהליכי הליבה:
  - התחברות/הרשמה
  - NFC ניקוב
  - Push Notifications
  - GPS ומיקום
  - כרטיסיות ושוברים
  - חבר מביא חבר
- [ ] בדיקת רספונסיביות (טלפון/טאבלט)
- [ ] בדיקת ביצועים (זמן טעינה, זיכרון)

### שלב 5: הגשה לחנויות

**Google Play:**
```bash
eas submit --platform android --profile production
```

**App Store:**
```bash
eas submit --platform ios --profile production
```

---

## 🔧 OTA Updates בפרודקשן

### כללים:

1. **לא לדחוף ישירות ל-production ללא בדיקה:**
   ```bash
   # רע:
   eas update --branch production --message "תיקון"
   
   # טוב:
   # קודם preview → בדיקה → אחר כך production
   eas update --branch preview --message "תיקון באג X"
   # לאחר בדיקה מקיפה:
   eas update --branch production --message "תיקון באג X [נבדק]"
   ```

2. **גרסה חדשה לכל עדכון:**
   - Preview: V30.65 → V30.66
   - Production: V1.0.0 → V1.0.1

3. **changelog מפורט:**
   - מה השתנה
   - מה תוקן
   - מה נבדק

---

## 📝 Checklist סופי לפני שחרור

### תשתית
- [ ] Firebase Production מוגדר
- [ ] Supabase Production/Staging מוכן
- [ ] EAS Secrets כל המפתחות
- [ ] Apple Developer חשבון פעיל
- [ ] Google Play חשבון מוכן

### קוד
- [ ] אין console.log רגישים
- [ ] אין credentials קשיחים
- [ ] Logger mode='production'
- [ ] Error handling מלא
- [ ] גרסאות מסונכרנות

### בדיקות
- [ ] כל התכונות נבדקו במכשירים אמיתיים
- [ ] Android + iOS
- [ ] טלפון + טאבלט
- [ ] בדיקות stress (ניקוב מרובה, notifications)

### חנויות
- [ ] צילומי מסך מוכנים
- [ ] תיאור עברית + אנגלית
- [ ] מדיניות פרטיות מפורסמת
- [ ] URL לאתר/תמיכה

### תיעוד
- [ ] README מעודכן
- [ ] הוראות התקנה למפתחים
- [ ] דוקומנטציית API
- [ ] Change log

---

## 🚨 סיכונים והמלצות

### סיכונים מזוהים:

1. **iOS לא נבדק מספיק**
   - המלצה: בדיקה מקיפה על 3+ מכשירי iOS לפני שחרור

2. **אין הפרדה בין Firebase Dev/Prod**
   - המלצה: ליצור project נפרד או environments

3. **מספור גרסאות לא אחיד**
   - המלצה: להתחיל מחדש מ-V1.0.0 לפרודקשן

4. **אין בדיקות אוטומטיות**
   - המלצה: לפחות smoke tests לפני כל שחרור

### תוכנית הפחתת סיכונים:

1. **Soft Launch:**
   - שחרור ראשון ל-10-20 משתמשים בלבד
   - ניטור צמוד למשך שבוע
   - תיקונים מהירים אם נדרש

2. **Rollback Plan:**
   - שמירת build קודם זמין
   - יכולת OTA rollback מהיר
   - גיבוי DB לפני עדכונים גדולים

3. **ניטור:**
   - Firebase Crashlytics
   - Supabase logs
   - User feedback channel

---

## 📅 לוח זמנים מוצע

### שבוע 1: הכנות iOS
- יום 1-2: Firebase iOS + בדיקות
- יום 3-4: Apple Developer setup
- יום 5: Preview build iOS + בדיקות מקיפות

### שבוע 2: Production Builds
- יום 1-2: הגדרת production profiles
- יום 3: בנייה ראשונה
- יום 4-5: בדיקות מקיפות

### שבוע 3: הגשה לחנויות
- יום 1-2: הכנת חומרים (צילומים, תיאורים)
- יום 3: הגשה ל-Google Play
- יום 4: הגשה ל-App Store
- יום 5: מעקב אחר סטטוס

### שבוע 4: Soft Launch
- שחרור לקבוצה קטנה
- ניטור צמוד
- תיקונים אם נדרש

---

## 🎓 לקחים מתהליך הפיתוח

### מה עבד טוב:
- ✅ OTA Updates חוסכים זמן
- ✅ EAS Build מפשט הרבה
- ✅ גיבויים תכופים מונעים אובדן עבודה
- ✅ לוגים מפורטים עוזרים בדיבוג

### מה ללמוד ממנו:
- ⚠️ להתחיל עם הפרדת סביבות מהיום הראשון
- ⚠️ לשמור מספור גרסאות עקבי מההתחלה
- ⚠️ לבדוק iOS מוקדם יותר
- ⚠️ לבנות בדיקות אוטומטיות

---

## 📞 נקודות תמיכה

### בעיות EAS/Expo:
- Expo Discord: https://chat.expo.dev
- Expo Docs: https://docs.expo.dev

### בעיות Firebase:
- Firebase Support
- Stack Overflow

### בעיות Supabase:
- Supabase Discord
- Supabase Docs: https://supabase.com/docs

---

**📌 הערה:** מסמך זה חי ומתעדכן. כל שינוי בתהליך יתועד כאן.

**עדכון אחרון:** 14/01/2026
