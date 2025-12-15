# 📋 תיעוד פיצ'ר NFC - לוג פיתוח

## 🎯 מטרה
מימוש ניקוב כרטיסיות באמצעות NFC בשלושה מצבים: ידני, חצי-אוטומטי, אוטומטי.

## 📅 תאריך התחלה: 05/12/2024

---

## 🔄 סטטוס נוכחי

| שלב | סטטוס | הערות |
|-----|-------|-------|
| 1. תשתית | ✅ הושלם | react-native-nfc-manager, הרשאות, manifest |
| 2. Supabase | ✅ הושלם | SQL Schema + פרומפט לאדמין ב-docs/admin_nfc/ |
| 3. Hooks | ✅ הושלם | useNFC.ts, useNFCPunch.ts |
| 4. UI | ✅ הושלם | components/NFCPunch/NFCPunchModal.tsx |
| 5. אינטגרציה | ✅ הושלם | PunchCard.tsx - שינוי מינימלי |
| 6. בדיקות | ⏳ ממתין | נדרש מכשיר פיזי עם NFC |
| 7. ניקיון | ⏳ ממתין | - |

---

## 📝 לוג פעולות

### שלב 1: תשתית
- [ ] התקנת react-native-nfc-manager
- [ ] הרשאות Android
- [ ] הרשאות iOS
- [ ] Prebuild

---

## 🏗️ ארכיטקטורה

### חלוקת אחריות
- **קליינט:** קריאת NFC, זיהוי לקוח, בחירת כרטיסייה, שליחת בקשה, קבלת תגובה
- **אדמין:** קבלת בקשה, אישור/דחייה, ביצוע ניקוב, שליחת Push, לוגים

### מחרוזת NFC
- פורמט: נקבע על ידי האדמין
- אחסון: `businesses.nfc_string` (Supabase)
- בדיקת כפילויות: פונקציית RPC

### פלואו ניקוב (15 מצבים)
ראה קובץ נפרד או שאל את הסוכן על הפלואו המלא.

---

## 🔔 הודעות קבועות

| אירוע | הודעה |
|-------|-------|
| בחירת כרטיסייה | "נמצאה יותר מכרטיסייה אחת, נא בחר/י את כרטיסיית המוצר לניקוב" |
| הזדהות ביומטרית | "מעוניינים להזדהות באופן ביומטרי? כך לא תידרשו להקיש את מספר הטלפון שלכם מעתה ולתמיד" |
| ממתין לאישור | "מחכה לאישור ממסוף העסק!" |
| Timeout | "יתכן שיש בעיית תקשורת או שבית העסק השתהה באישור הניקוב, נסה שוב" |
| ניקוב בוצע | "בוצע ניקוב ע"י [שם העסק] בתאריך DD/MM/YYYY" |

---

## 📁 קבצים שנוצרו/שונו

| קובץ | סטטוס | תיאור |
|------|-------|-------|
| `hooks/useNFC.ts` | ✅ | קריאת NFC, אתחול, פענוח |
| `hooks/useNFCPunch.ts` | ✅ | לוגיקת פלואו מלאה, Realtime |
| `components/NFCPunch/NFCPunchModal.tsx` | ✅ | מודאל UI מלא |
| `components/NFCPunch/index.ts` | ✅ | export |
| `app/(tabs)/PunchCard.tsx` | ✅ | אינטגרציה (שינוי מינימלי) |
| `app.json` | ✅ | הרשאות NFC |
| `android/.../AndroidManifest.xml` | ✅ | NFC permissions + intents |
| `docs/admin_nfc/ADMIN_NFC_PROMPT.md` | ✅ | פרומפט לסוכן אדמין |
| `docs/admin_nfc/SUPABASE_NFC_SCHEMA.sql` | ✅ | SQL Schema |

---

## ⚠️ נקודות חשובות לסוכן הבא

1. **לא לשנות קוד קיים** - רק להוסיף
2. **UI נפרד** - כל הקומפוננטות בתיקייה נפרדת
3. **Realtime** - תקשורת עם אדמין דרך Supabase Realtime
4. **Timeout** - 60 שניות לאישור אדמין
5. **לוגים** - רק 7 לוגים קריטיים לאבחון

---

## 🔗 תלויות באדמין

האדמין צריך לבצע:
1. הוספת עמודות ל-businesses
2. יצירת טבלת punch_requests
3. Enable Realtime
4. מימוש צד האדמין (קבלת בקשות, אישור, ניקוב)
5. שליחת Push ללקוח

---

## 📱 iOS Build Credentials (עדכון: 10/12/2024)

### פרטי אפליקציה
| שדה | ערך |
|-----|-----|
| **App** | @rordan/my-new-test-app |
| **Bundle Identifier** | com.cardz.app |

### Distribution Certificate
| שדה | ערך |
|-----|-----|
| **Serial Number** | 44621BE3E76AAF3B93996ADAD4572EF5 |
| **Expiration Date** | Sat, 05 Dec 2026 18:12:39 GMT+0200 |
| **Apple Team** | C4N93LK5V7 (Ramy Ordan - Individual) |

### Provisioning Profile (Ad Hoc)
| שדה | ערך |
|-----|-----|
| **Developer Portal ID** | J3Y7JFX2PL |
| **Status** | ✅ active |
| **Expiration** | Sat, 05 Dec 2026 18:12:39 GMT+0200 |
| **Apple Team** | C4N93LK5V7 (Ramy Ordan - Individual) |

### Provisioned Devices
| מכשיר | UDID |
|-------|------|
| **iPhone** | `00008110-001835CA1E51801E` |

