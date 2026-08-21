# Release Notes - v1.0.2

## תאריך: פברואר 2026
## Android versionCode: 19+

---

## שינויים בגרסה זו

### 1. תיקון באג קריטי: ניתוב NFC לעסק שגוי
**חומרה:** קריטי - בקשות ניקוב מגיעות לאדמין של עסק אחר!

**תיאור הבאג:**
כשלקוח סרק NFC של עסק 0020 (ג'וי), בקשת הניקוב נשלחה לאדמין של עסק 0001 (גוטלה).

**שורש הבעיה:**
- NFCPunchModal קיבל `nfcString` מ-`localBusiness.nfc_string`
- `localBusiness` הוא state שיכול להכיל נתונים של עסק קודם (race condition)
- `startPunchFlow` חיפש עסק ב-DB לפי `nfc_string` - ומצא את העסק הלא נכון
- הבעיה מחמירה כש-`nfc_string` היה NULL (עסקים חדשים) כי אז NFCPunchModal לא הוצג כלל

**קבצים שהשתנו:**

#### `hooks/useNFCPunch.ts`
- `startPunchFlow` מקבל פרמטר חדש `businessCodeOverride` (אופציונלי)
- אם `businessCodeOverride` מסופק - מזהה עסק ישירות לפי `business_code` (אמין 100%)
- אם לא - fallback לזיהוי לפי `nfc_string` (התנהגות קודמת)
- **אין שבירת backward compatibility** - הפרמטר אופציונלי

#### `components/NFCPunch/NFCPunchModal.tsx`
- prop חדש: `businessCode` (אופציונלי)
- מעביר את `businessCode` ל-`startPunchFlow` כפרמטר רביעי
- **אין שבירת backward compatibility** - ה-prop אופציונלי

#### `app/(tabs)/PunchCard.tsx`
- מעביר `resolvedBusinessCode` (שמגיע מ-URL params) ל-NFCPunchModal כ-`businessCode`
- `resolvedBusinessCode` = `businessCodeStr || business?.business_code`
- `businessCodeStr` מגיע ישירות מה-Deep Link URL → תמיד נכון

**שרשרת התיקון:**
```
NFC Tag URL → [code].tsx → businessCode param → PunchCard
  → resolvedBusinessCode → NFCPunchModal.businessCode
  → startPunchFlow(nfcString, phone, card, businessCode)
  → query DB by business_code (NOT nfc_string) → correct business!
```

---

### 2. כפתור בקשת ניקוב ידני - Android (מ-1.0.1 build 22)
נכלל בגרסה זו. ראה `RELEASE_v1.0.1_build23.md` לפרטים.

### 3. עדכון מדיניות פרטיות (מ-1.0.1 build 22)
נכלל בגרסה זו. ראה `RELEASE_v1.0.1_build23.md` לפרטים.

---

## תיקונים מצד DB (בוצעו בנפרד):

- כל העסקים שהיה להם `nfc_string = NULL` עודכנו עם ערכים ייחודיים
- קוד האדמין עודכן ליצירת `nfc_string` אוטומטית לעסקים חדשים

---

## שחזור (Rollback)

### לשחזור תיקון NFC routing:

**`hooks/useNFCPunch.ts`** - בפונקציה `startPunchFlow`:
הסר את הפרמטר `businessCodeOverride` ואת הבלוק שמחפש לפי `business_code`. השאר רק את `identifyBusinessByNFC(nfcString)`.

**`components/NFCPunch/NFCPunchModal.tsx`:**
הסר את ה-prop `businessCode` מה-interface ומה-destructuring. הסר את הפרמטר הרביעי מהקריאה ל-`startPunchFlow`.

**`app/(tabs)/PunchCard.tsx`:**
הסר את `businessCode={resolvedBusinessCode || localBusiness.business_code}` מה-NFCPunchModal.

---

## בדיקות נדרשות:

1. ✅ סריקת NFC של עסק 0020 → בקשה מגיעה לאדמין 0020 (לא 0001!)
2. ✅ סריקת NFC של עסק 0001 → ממשיך לעבוד כרגיל
3. ✅ לחיצה על כפתור ניקוב ידני (Android) → בקשה לעסק הנכון
4. ✅ לחיצה על כפתור ניקוב ידני (iOS) → סריקה + בקשה לעסק הנכון
5. ✅ Prepaid ניקוב ישיר → עובד כרגיל
6. ✅ לא Prepaid → בקשה לאדמין הנכון
7. ✅ מעבר בין עסקים (0001 → 0020) → לא שומר state ישן
