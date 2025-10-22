# 🎯 מדריך פשוט - חיבור Frontend למערכת חבר מביא חבר

## 📌 מה יש לך כרגע?
1. **שדה ליצירת קוד הזמנה** - בפרופיל הלקוח
2. **שדה להכנסת קוד הזמנה** - בטופס הרשמה למשתמש חדש

## 🎯 מה צריך לקרות?
כשלקוח חדש נרשם עם קוד הזמנה, המערכת צריכה:
1. לתת לו שובר מתנה מיידי
2. לתת למזמין שובר אחרי שהמוזמן ביצע פעולה ראשונה

---

## 🔧 מה שינינו ב-Supabase בשבילך

### טבלאות חדשות שהוספנו:

#### 1. `voucher_types` - סוגי שוברים
```sql
-- כבר יצרנו 2 שוברי מערכת אוטומטית לכל עסק:
-- שובר מספר 1: "חבר מזמין חבר" (למי שמזמין)
-- שובר מספר 2: "חבר מוזמן מחבר" (למי שמוזמן)
```

#### 2. `referral_settings` - הגדרות לכל עסק
```sql
-- מכיל:
-- enabled: boolean - האם הפיצ'ר פעיל
-- inviter_voucher_type_id - איזה שובר מקבל המזמין
-- invited_voucher_type_id - איזה שובר מקבל המוזמן
```

#### 3. שדרגנו את טבלת `referrals` הקיימת:
```sql
-- הוספנו שדות:
-- inviter_benefit_id - מזהה השובר של המזמין
-- invited_benefit_id - מזהה השובר של המוזמן
```

---

## 📝 מה אתה צריך לעשות - 3 צעדים בלבד

### צעד 1: יצירת קוד הזמנה (כבר יש לך)
```javascript
// הקוד שלך כבר עובד - רק וודא שהפורמט הוא:
const referralCode = `${businessCode}_${customerPhone}_REF`
// דוגמה: "BIZ123_0501234567_REF"
```

### צעד 2: שליחת קוד ההזמנה בהרשמה
```javascript
// בטופס הרשמה, כשיש קוד הזמנה:
const registerNewCustomer = async (formData) => {
  // 1. רישום רגיל של הלקוח (כמו שאתה עושה היום)
  const { data: customer } = await supabase
    .from('customers')
    .insert({
      customer_phone: formData.phone,
      name: formData.name,
      business_code: formData.businessCode,
      birthday: formData.birthday
      // ... שאר השדות שלך
    })

  // 2. אם יש קוד הזמנה - יצירת רשומת הזמנה
  if (formData.referralCode) {
    // פענוח הקוד
    const parts = formData.referralCode.split('_')
    const inviterBusinessCode = parts[0]
    const inviterPhone = parts[1]
    
    // יצירת רשומת הזמנה
    await supabase
      .from('referrals')
      .insert({
        inviter_phone: inviterPhone,
        invited_phone: formData.phone,
        business_code: inviterBusinessCode,
        status: 'pending',
        referral_date: new Date()
      })
    
    // זהו! השאר יקרה אוטומטית בצד השרת
  }
}
```

### צעד 3: הצגת השוברים שהתקבלו
```javascript
// בדף השוברים של הלקוח
const getMyVouchers = async () => {
  const { data: vouchers } = await supabase
    .from('benefits')
    .select('*')
    .eq('customer_phone', currentUserPhone)
    .eq('type', 'referral')
    .in('status', ['active', 'pending'])
  
  return vouchers
}
```

---

## 🔄 מה קורה אוטומטית (לא צריך לתכנת)

### כשמישהו נרשם עם קוד הזמנה:
1. ✅ **מיידית** - המוזמן מקבל שובר פעיל (status: 'active')
2. ⏳ **ממתין** - המזמין מקבל שובר ממתין (status: 'pending')

### כשהמוזמן מבצע ניקוב ראשון:
1. ✅ השובר של המזמין הופך לפעיל אוטומטית
2. 📱 שניהם מקבלים התראה (אם הגדרת notifications)

---

## 📊 שדות בטבלאות שאתה צריך להכיר

### טבלת `referrals` - רשומת הזמנה
```javascript
{
  id: 123,                        // נוצר אוטומטית
  inviter_phone: "0501234567",    // מי הזמין (מהקוד)
  invited_phone: "0509876543",    // מי הוזמן (מהרישום)
  business_code: "BIZ123",         // קוד העסק
  status: "pending",               // pending -> completed
  referral_date: "2024-01-15",    // תאריך ההזמנה
  reward_given: false              // האם ניתן תגמול
}
```

### טבלת `benefits` - שוברים שהונפקו
```javascript
{
  id: 456,                         // נוצר אוטומטית
  customer_phone: "0501234567",    // למי השובר
  business_code: "BIZ123",         // קוד העסק
  type: "referral",                // סוג השובר
  value: 15,                       // ערך השובר
  status: "active",                // active/pending/used/expired
  code: "VOUCHER_ABC123",          // קוד שובר ייחודי
  expiration_date: "2024-04-15"   // תוקף
}
```

---

## ⚠️ נקודות חשובות

### 1. בדיקת תקינות קוד
```javascript
// לפני השליחה, בדוק שהקוד תקין:
const isValidReferralCode = (code) => {
  const parts = code.split('_')
  return parts.length === 3 && parts[2] === 'REF'
}
```

### 2. מניעת הזמנה עצמית
```javascript
// וודא שהלקוח לא מזמין את עצמו:
if (inviterPhone === formData.phone) {
  alert("לא ניתן להזמין את עצמך")
  return
}
```

### 3. Real-time Updates (אופציונלי)
```javascript
// אם רוצים עדכונים בזמן אמת:
supabase
  .from('benefits')
  .on('INSERT', payload => {
    if (payload.new.customer_phone === currentUserPhone) {
      // רענן את רשימת השוברים
      getMyVouchers()
    }
  })
  .subscribe()
```

---

## 🚨 מה לא צריך לעשות

1. **לא צריך** ליצור שוברים ידנית - זה קורה אוטומטית
2. **לא צריך** לבדוק מתי להפעיל את שובר המזמין - יש טריגר אוטומטי
3. **לא צריך** לחשב תאריכי תפוגה - מחושב אוטומטית

---

## 📞 בעיות נפוצות ופתרונות

### בעיה: השובר לא נוצר
**פתרון:** בדוק ש-`referral_settings.enabled = true` לעסק

### בעיה: שובר המזמין לא מופעל
**פתרון:** וודא שהמוזמן ביצע פעולה (ניקוב/רכישה)

### בעיה: קוד הזמנה לא עובד
**פתרון:** בדוק שהפורמט הוא `BUSINESSCODE_PHONE_REF`

---

## ✅ סיכום - רק 3 דברים לזכור

1. **צור קוד**: `${businessCode}_${phone}_REF`
2. **שלח בהרשמה**: רשומה בטבלת `referrals`
3. **הצג שוברים**: query לטבלת `benefits`

**כל השאר קורה אוטומטית! 🎉**

---

## 🔗 דוגמת קוד מלאה

```javascript
// === קובץ: ReferralSystem.js ===

// 1. יצירת קוד הזמנה
export const generateMyReferralCode = (businessCode, phone) => {
  return `${businessCode}_${phone}_REF`
}

// 2. רישום עם קוד הזמנה
export const registerWithReferral = async (formData) => {
  // רישום הלקוח
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      customer_phone: formData.phone,
      name: formData.name,
      business_code: formData.businessCode
    })
  
  if (error) throw error
  
  // אם יש קוד הזמנה
  if (formData.referralCode) {
    const [bizCode, inviterPhone] = formData.referralCode.split('_')
    
    // יצירת הזמנה
    await supabase
      .from('referrals')
      .insert({
        inviter_phone: inviterPhone,
        invited_phone: formData.phone,
        business_code: bizCode,
        status: 'pending'
      })
  }
  
  return customer
}

// 3. קבלת השוברים שלי
export const getMyReferralVouchers = async (phone) => {
  const { data } = await supabase
    .from('benefits')
    .select('*')
    .eq('customer_phone', phone)
    .eq('type', 'referral')
  
  return data
}
```

**זהו! פשוט וקל 🚀**
