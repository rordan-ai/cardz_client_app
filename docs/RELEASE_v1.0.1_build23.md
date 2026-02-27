# Release Notes - v1.0.1 (Build 23 Android / Build 23 iOS)

## תאריך: ינואר 2026

---

## שינויים בגרסה זו

### 1. תיקון מדיניות פרטיות (Privacy Policy) - iOS + Android
**סיבה:** ריג'קט Apple Guideline 5.1.2 - Data Use and Sharing

**קבצים שהשתנו:**
- `docs/PRIVACY_POLICY.md` - קובץ התיעוד
- `app/(tabs)/PunchCard.tsx` - מדיניות פרטיות in-app (סעיפים 2 ו-8)
- `app/(tabs)/business_selector.tsx` - מדיניות פרטיות in-app (סעיפים 2 ו-8)

**שינויים:**
- **סעיף 2:** הוספת הצהרה מפורשת: "אין Tracking לפי הגדרת Apple" - האפליקציה אינה מקשרת מידע משתמש עם צדדים שלישיים, אינה משתפת מזהים לרימרקטינג, ואינה משתמשת ב-IDFA
- **סעיף 2:** הוספת הבהרה על תקשורת שיווקית פנימית (פופאפים/הודעות מהעסק ללקוחות שלו)
- **סעיף 8:** מחיקת אזכור שגוי של "Google Analytics אנונימי" (לא קיים בקוד!)
- **סעיף 8:** שינוי כותרת ל"קוקיז, אנליטיקה ומעקב"
- **סעיף 8:** הצהרה מפורשת: "אין שימוש ב-Google Analytics, IDFA, או כלי מעקב אחרים"
- **סעיף 8:** הבהרה על תקשורת שיווקית פנימית ללא שיתוף חיצוני

**שינויים ב-App Store Connect:**
- App Privacy: Phone Number + Name → Purpose שונה ל-"App Functionality" (במקום "Tracking")
- "Used for Tracking" → No
- Usage Data + Crash Data → Analytics, Not Linked, Not Tracking

---

### 2. כפתור בקשת ניקוב ידני - Android (חדש!)
**סיבה:** משתמשי Android ללא הגדרות ביומטריות לא יכלו לשלוח בקשת ניקוב לאדמין

**קובץ שהשתנה:**
- `app/(tabs)/PunchCard.tsx` - שורות 2272-2305

**שינוי:**
- הוסר התנאי `Platform.OS === 'ios'` מכפתור בקשת הניקוב
- הכפתור מוצג כעת **בשתי הפלטפורמות** (iOS + Android)
- **iOS:** התנהגות זהה לקודם - לחיצה → סריקת NFC פיזית → פתיחת NFCPunchModal
- **Android:** לחיצה → פתיחת NFCPunchModal ישירות (ללא סריקה - כי Android קורא NFC ברקע)
- הכפתור כולל בדיקת cooldown (`nfcCooldownRef`) למניעת לחיצות כפולות
- אייקון זהה בשתי הפלטפורמות: `NFC_ISO_BOTTEN.png`
- תוויות נגישות מותאמות לפלטפורמה

**תלויות שנבדקו:**
- NFCPunchModal - מקבל `customerPhone`, `nfcString`, `selectedCardNumber` מ-props, לא נדרש שינוי
- useNFCPunch hook - לוגיקת `startPunchFlow` תומכת ב-`customerPhoneFromContext` שמדלג על ביומטריה - ללא שינוי
- cooldown mechanism - נשמר (`nfcCooldownRef.current`)
- אין שינוי בלוגיקה העסקית של ניקובים, prepaid, או אישור אדמין

**פלואו Android אחרי התיקון:**
1. משתמש נכנס לכרטיסייה (עם/בלי ביומטריה)
2. רואה כפתור ניקוב (אייקון NFC)
3. לוחץ → NFCPunchModal נפתח
4. **כרטיסייה Prepaid:** ניקוב ישיר אוטומטי
5. **כרטיסייה לא Prepaid:** בקשה נשלחת לאדמין → ממתין לאישור

---

## שחזור (Rollback)

### לשחזור שינוי הכפתור:
החלף בקובץ `app/(tabs)/PunchCard.tsx` את הכפתור בשורות 2272-2305 חזרה ל:
```tsx
{Platform.OS === 'ios' && (
  <TouchableOpacity
    style={{ marginTop: 20, alignItems: 'center', justifyContent: 'center' }}
    onPress={async () => {
      try {
        await initNFC();
        const tagData = await startReading();
        if (tagData) {
          setCardSelectionVisible(false);
          setTimeout(() => setNfcModalVisible(true), 100);
        }
      } catch (err) {
        console.log('[iOS NFC] Scan error:', err);
      }
    }}
    accessibilityLabel="סרוק תג NFC לניקוב"
    accessibilityRole="button"
  >
    <Image source={require('../../assets/icons/NFC_ISO_BOTTEN.png')} style={{ width: 80, height: 80 }} resizeMode="contain" />
  </TouchableOpacity>
)}
```

### לשחזור מדיניות פרטיות:
ברנץ' `restore_checkpoints` מכיל את הגרסה הקודמת.

---

## מלל לחנויות (Store Description)

### What's New (English):
- Updated Privacy Policy for full compliance
- Added manual punch request button for Android users
- Bug fixes and performance improvements

### מה חדש (עברית):
- עדכון מדיניות פרטיות
- הוספת כפתור בקשת ניקוב ידני למשתמשי Android
- תיקוני באגים ושיפורי ביצועים
