# פרומפט לסוכן Admin - עדכונים נדרשים בשרת ובאדמין

## תאריך: ינואר 2026
## הקשר: עדכוני גרסה 1.0.1 - אפליקציית הקליינט (Cardz)

---

## משימה 1: תיקון Universal Links / App Links בשרת

### בעיה:
כאשר משתמש סורק תג NFC שמכיל URL כגון `https://app.punchcards.digital/business/0002`, המכשיר פותח **דפדפן** במקום **את האפליקציה**, גם כשהאפליקציה מותקנת. רק בלחיצה על "נסה שוב" בדף הווב האפליקציה נפתחת (דרך custom scheme `mycardz://`).

### סיבה:
קובצי האימות בשרת (`apple-app-site-association` ו-`assetlinks.json`) מכילים ערכים שגויים/לא מעודכנים.

### מה לתקן:

#### 1. Apple - קובץ AASA
**מיקום בשרת:** `https://app.punchcards.digital/.well-known/apple-app-site-association`

**תוכן נוכחי (שגוי):**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "C4N93LK5V7.com.mycompany.mycard",
        "paths": ["/business/*", "/b/*"]
      }
    ]
  }
}
```

**תוכן נכון:**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "C4N93LK5V7.com.mycardz.app",
        "paths": ["/business/*", "/b/*"]
      }
    ]
  }
}
```

**השינוי:** `com.mycompany.mycard` → `com.mycardz.app` (ה-bundleIdentifier האמיתי של האפליקציה ב-iOS)

**דרישות טכניות:**
- הקובץ חייב להיות מוגש ללא סיומת `.json`
- Content-Type: `application/json`
- חייב להיות נגיש ב-HTTPS (לא HTTP)
- אסור redirect (חייב להחזיר 200 ישירות)

#### 2. Android - קובץ assetlinks.json
**מיקום בשרת:** `https://app.punchcards.digital/.well-known/assetlinks.json`

**תוכן נכון:**
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yuladigital.cardz",
      "sha256_cert_fingerprints": ["<SHA256 FINGERPRINT>"]
    }
  }
]
```

**חשוב:** 
- ה-package name השתנה ל-`com.yuladigital.cardz` (לא `com.mycardz.app`)
- צריך לקבל את ה-SHA256 fingerprint מ-Google Play Console → App Signing → SHA-256 certificate fingerprint
- או להריץ: `eas credentials --platform android` ולחפש את ה-SHA256

---

## משימה 2: התייחסות לכפתור בקשת ניקוב ידני (Android)

### מה השתנה באפליקציית הקליינט:
נוסף **כפתור בקשת ניקוב ידני** ב-Android (שהיה קיים רק ב-iOS).

### איך זה עובד:
1. משתמש Android נכנס לכרטיסייה שלו
2. רואה כפתור ניקוב (אייקון NFC) מתחת לכרטיסייה
3. לוחץ על הכפתור
4. נפתח `NFCPunchModal` שמריץ את `startPunchFlow`
5. **כרטיסייה Prepaid:** ניקוב ישיר אוטומטי (ללא אישור אדמין)
6. **כרטיסייה לא Prepaid:** נשלחת בקשה לטבלת `punch_requests` ב-Supabase → **האדמין מקבל בקשת ניקוב ומאשר/דוחה**

### מה האדמין צריך לדעת:
- **אין שינוי בפורמט בקשות הניקוב** - אותה מבנה `punch_requests` בדיוק
- **אין שינוי ב-Realtime** - אותו מנגנון האזנה
- הבקשה תגיע עם `source: 'nfc_client'` (כמו כל בקשת NFC מהקליינט)
- **ההבדל היחיד:** ב-Android הבקשה יכולה להגיע גם **ללא סריקת NFC פיזית** (בלחיצה ידנית על הכפתור)
- **אין צורך בשינוי קוד באדמין** - הפלואו זהה לחלוטין

### פלואו מלא (ללא Prepaid):
```
לקוח Android → לוחץ כפתור ניקוב
→ NFCPunchModal נפתח
→ startPunchFlow עם customerPhone + nfcString + selectedCardNumber
→ בקשה נשמרת ב-punch_requests (status: 'pending')
→ אדמין מקבל התראה
→ אדמין מאשר/דוחה
→ Realtime מעדכן את הקליינט
→ ניקוב מתבצע / הודעת דחייה
```

### פלואו מלא (Prepaid):
```
לקוח Android → לוחץ כפתור ניקוב
→ NFCPunchModal נפתח
→ startPunchFlow עם customerPhone + nfcString + selectedCardNumber
→ ניקוב ישיר (עדכון PunchCards.used_punches + 1)
→ הודעת הצלחה ללקוח
```

---

## משימה 3: בדיקת צריבת תגי NFC

### בעיה אפשרית:
אם תגי NFC צרובים עם `mycardz://business/XXXX` (custom scheme), הם עובדים רק אחרי שהאפליקציה כבר פתוחה.

### המלצה:
לצרוב תגי NFC עם URL מלא: `https://app.punchcards.digital/business/XXXX`
(ולא `mycardz://business/XXXX`)

זה יבטיח:
- אם האפליקציה מותקנת → נפתחת ישירות (אחרי תיקון AASA/assetlinks)
- אם לא מותקנת → דף ווב עם לינקים להורדה

---

## סדר עדיפויות:
1. **קריטי:** תיקון AASA + assetlinks.json בשרת (משפיע על כל משתמש NFC)
2. **מידע:** הכפתור החדש ב-Android לא דורש שינוי באדמין
3. **המלצה:** בדיקת פורמט צריבת תגי NFC
