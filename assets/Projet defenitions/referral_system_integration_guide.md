# 📋 מדריך אינטגרציה - מערכת חבר מביא חבר
## סנכרון בין Backend (Admin) ל-Frontend (Customer App)

---

## 🎯 סקירה כללית

מערכת "חבר מביא חבר" מאפשרת ללקוחות להזמין חברים ולקבל תגמולים.
המערכת פועלת דרך Supabase כשכבת הנתונים המשותפת בין שני הממשקים.

---

## 📊 מבנה טבלאות Supabase

### 1. טבלת `voucher_types` (סוגי שוברים)
```sql
voucher_types {
  id: uuid                    -- מזהה ייחודי
  business_code: varchar      -- קוד העסק
  system_type: text           -- 'referral_inviter' | 'referral_invited' | NULL
  voucher_number: integer     -- מספר השובר (1-2 שמורים למערכת)
  name: text                  -- שם השובר
  type: text                  -- סוג השובר (referral)
  value: jsonb                -- ערך/הטבה
  validity_months: integer    -- תוקף בחודשים
  conditions: text            -- תנאי מימוש
  is_system: boolean          -- האם שובר מערכת
  is_deletable: boolean       -- האם ניתן למחיקה
  is_active: boolean          -- סטטוס פעיל
  created_at: timestamp
  updated_at: timestamp
}
```

### 2. טבלת `referrals` (הזמנות)
```sql
referrals {
  id: bigint                      -- מזהה ייחודי
  inviter_phone: text             -- טלפון המזמין
  invited_phone: text             -- טלפון המוזמן
  business_code: text             -- קוד העסק
  referral_date: timestamp        -- תאריך ההזמנה
  reward_given: boolean           -- האם ניתן תגמול
  status: text                    -- 'pending' | 'completed' | 'cancelled'
  inviter_benefit_id: bigint      -- ID של שובר המזמין
  invited_benefit_id: bigint      -- ID של שובר המוזמן
  inviter_voucher_type_id: uuid   -- סוג שובר המזמין
  invited_voucher_type_id: uuid   -- סוג שובר המוזמן
  updated_at: timestamp
}
```

### 3. טבלת `benefits` (שוברים שהונפקו)
```sql
benefits {
  id: bigint                   -- מזהה ייחודי
  business_code: text          -- קוד העסק
  customer_phone: text         -- טלפון הלקוח
  type: text                   -- 'referral' לשוברי חבר מביא חבר
  value: numeric               -- ערך השובר
  status: text                 -- 'active' | 'used' | 'expired' | 'cancelled'
  code: text                   -- קוד שובר ייחודי
  expiration_date: timestamp   -- תאריך תפוגה
  voucher_type_id: uuid        -- קישור לסוג השובר
  related_referral_id: bigint  -- קישור להזמנה
  created_at: timestamp
  updated_at: timestamp
}
```

### 4. טבלת `referral_settings` (הגדרות חבר מביא חבר)
```sql
referral_settings {
  id: uuid                           -- מזהה ייחודי
  business_code: varchar             -- קוד העסק
  enabled: boolean                   -- האם הפיצ'ר פעיל
  inviter_voucher_type_id: uuid      -- ID של שובר המזמין
  invited_voucher_type_id: uuid      -- ID של שובר המוזמן
  max_invites_per_customer: integer  -- מגבלת הזמנות פר לקוח
  min_action_for_activation: text    -- 'registration' | 'first_punch' | 'first_purchase'
  auto_send_voucher: boolean         -- שליחה אוטומטית
  custom_message: text               -- הודעה מותאמת
  created_at: timestamp
  updated_at: timestamp
}
```

---

## 🔄 טריגרים וזרימת נתונים

### 1. יצירת קוד הזמנה (Frontend → Backend)

**Frontend צריך ליצור:**
```javascript
// בפרופיל/כרטיסיית הלקוח
const generateReferralCode = (customerPhone, businessCode) => {
  // דוגמה: BIZ123_0501234567_REF
  return `${businessCode}_${customerPhone}_REF`
}
```

**שמירה ב-localStorage:**
```javascript
localStorage.setItem('my_referral_code', referralCode)
```

### 2. הרשמה עם קוד הזמנה (Frontend → Supabase)

**בטופס הרשמה - שדה נוסף:**
```javascript
// רכיב קלט קוד הזמנה
<input 
  type="text" 
  placeholder="קוד הזמנה (אופציונלי)"
  value={referralCode}
  onChange={(e) => setReferralCode(e.target.value)}
/>
```

**בעת שליחת הרשמה:**
```javascript
const registerWithReferral = async (userData) => {
  // 1. רישום הלקוח החדש
  const { data: newCustomer, error: customerError } = await supabase
    .from('customers')
    .insert({
      customer_phone: userData.phone,
      name: userData.name,
      business_code: userData.businessCode,
      // ... שאר השדות
    })

  // 2. אם יש קוד הזמנה - יצירת רשומת referral
  if (userData.referralCode) {
    // פענוח קוד ההזמנה
    const [bizCode, inviterPhone] = userData.referralCode.split('_')
    
    // יצירת רשומת הזמנה
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .insert({
        inviter_phone: inviterPhone,
        invited_phone: userData.phone,
        business_code: bizCode,
        status: 'pending'
      })
      .select()
      .single()

    // 3. טריגר אוטומטי ליצירת שוברים
    await createReferralVouchers(referral.id)
  }
}
```

### 3. יצירת שוברים אוטומטית (Supabase Function)

```javascript
const createReferralVouchers = async (referralId) => {
  // קבלת פרטי ההזמנה
  const { data: referral } = await supabase
    .from('referrals')
    .select('*, referral_settings(*)')
    .eq('id', referralId)
    .single()

  // יצירת שובר למוזמן (מיידי)
  const { data: invitedVoucher } = await supabase
    .from('benefits')
    .insert({
      business_code: referral.business_code,
      customer_phone: referral.invited_phone,
      type: 'referral',
      status: 'active',  // פעיל מיד
      voucher_type_id: referral.referral_settings.invited_voucher_type_id,
      related_referral_id: referralId,
      expiration_date: // חישוב לפי validity_months
    })

  // יצירת שובר למזמין (ממתין)
  const { data: inviterVoucher } = await supabase
    .from('benefits')
    .insert({
      business_code: referral.business_code,
      customer_phone: referral.inviter_phone,
      type: 'referral',
      status: 'pending',  // ממתין לתנאי
      voucher_type_id: referral.referral_settings.inviter_voucher_type_id,
      related_referral_id: referralId,
      expiration_date: // חישוב לפי validity_months
    })

  // עדכון IDs בטבלת referrals
  await supabase
    .from('referrals')
    .update({
      inviter_benefit_id: inviterVoucher.id,
      invited_benefit_id: invitedVoucher.id
    })
    .eq('id', referralId)
}
```

### 4. הפעלת שובר המזמין (Trigger on PunchCards/Activity)

```javascript
// טריגר SQL ב-Supabase
CREATE OR REPLACE FUNCTION activate_inviter_voucher()
RETURNS TRIGGER AS $$
DECLARE
  referral_record RECORD;
BEGIN
  -- בדיקה אם הלקוח הוא מוזמן
  SELECT * INTO referral_record
  FROM referrals
  WHERE invited_phone = NEW.customer_phone
    AND business_code = NEW.business_code
    AND status = 'pending';
  
  IF FOUND THEN
    -- הפעלת שובר המזמין
    UPDATE benefits
    SET status = 'active'
    WHERE id = referral_record.inviter_benefit_id;
    
    -- עדכון סטטוס ההזמנה
    UPDATE referrals
    SET status = 'completed',
        reward_given = true
    WHERE id = referral_record.id;
    
    -- שליחת notification (optional)
    INSERT INTO notifications (...)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- חיבור הטריגר לטבלת PunchCards
CREATE TRIGGER after_first_punch
AFTER INSERT ON PunchCards
FOR EACH ROW
EXECUTE FUNCTION activate_inviter_voucher();
```

---

## 📱 רכיבי UI נדרשים ב-Frontend

### 1. מסך שיתוף קוד הזמנה
```jsx
// ShareReferralScreen.jsx
const ShareReferralScreen = () => {
  const myCode = generateReferralCode(userPhone, businessCode)
  
  return (
    <View>
      <Text>הקוד שלך: {myCode}</Text>
      <Button onPress={() => shareViaWhatsApp(myCode)}>
        שתף בWhatsApp
      </Button>
      <Button onPress={() => copyToClipboard(myCode)}>
        העתק קוד
      </Button>
    </View>
  )
}
```

### 2. שדה קוד הזמנה בהרשמה
```jsx
// RegistrationForm.jsx
<TextInput
  placeholder="יש לך קוד הזמנה? הכנס כאן"
  value={referralCode}
  onChangeText={setReferralCode}
  style={styles.optionalField}
/>
```

### 3. תצוגת שוברים פעילים
```jsx
// MyVouchersScreen.jsx
const MyVouchers = () => {
  const [vouchers, setVouchers] = useState([])
  
  useEffect(() => {
    // מאזין לשוברים שלי
    const subscription = supabase
      .from('benefits')
      .on('*', payload => {
        if (payload.new.customer_phone === userPhone) {
          fetchVouchers()
        }
      })
      .subscribe()
  }, [])
  
  return (
    <FlatList
      data={vouchers}
      renderItem={({ item }) => (
        <VoucherCard 
          voucher={item}
          onUse={() => useVoucher(item.id)}
        />
      )}
    />
  )
}
```

### 4. היסטוריית הזמנות
```jsx
// ReferralHistoryScreen.jsx
const ReferralHistory = () => {
  const [invites, setInvites] = useState([])
  
  // הזמנות שלי
  const fetchMyInvites = async () => {
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('inviter_phone', userPhone)
      .order('referral_date', { ascending: false })
    
    setInvites(data)
  }
  
  return (
    <View>
      <Text>הזמנת {invites.length} חברים</Text>
      <Text>מתוכם {invites.filter(i => i.status === 'completed').length} פעילים</Text>
      {/* רשימת הזמנות */}
    </View>
  )
}
```

---

## 🔔 Real-time Subscriptions

### Frontend צריך להאזין ל:
```javascript
// 1. שוברים חדשים
supabase
  .from('benefits')
  .on('INSERT', payload => {
    if (payload.new.customer_phone === userPhone) {
      showNotification('קיבלת שובר חדש!')
    }
  })
  .subscribe()

// 2. שינוי סטטוס שובר
supabase
  .from('benefits')
  .on('UPDATE', payload => {
    if (payload.new.status === 'active' && payload.old.status === 'pending') {
      showNotification('השובר שלך פעיל כעת!')
    }
  })
  .subscribe()

// 3. הזמנות חדשות
supabase
  .from('referrals')
  .on('INSERT', payload => {
    if (payload.new.inviter_phone === userPhone) {
      showNotification('מישהו השתמש בקוד ההזמנה שלך!')
    }
  })
  .subscribe()
```

---

## 📝 APIs נדרשים

### 1. API לקבלת קוד הזמנה
```javascript
GET /api/my-referral-code
Response: {
  code: "BIZ123_0501234567_REF",
  totalInvites: 5,
  successfulInvites: 3
}
```

### 2. API לאימות קוד הזמנה
```javascript
POST /api/validate-referral-code
Body: { code: "BIZ123_0501234567_REF" }
Response: { 
  valid: true,
  inviterName: "יוסי כהן"
}
```

### 3. API למימוש שובר
```javascript
POST /api/use-voucher
Body: { voucherId: "uuid-123" }
Response: { 
  success: true,
  message: "השובר מומש בהצלחה"
}
```

---

## ⚠️ נקודות חשובות לסנכרון

1. **מניעת כפילויות**: בדיקה שאותו טלפון לא מזמין את עצמו
2. **תוקף שוברים**: חישוב אוטומטי של expiration_date
3. **סטטוס pending**: שובר המזמין נשאר pending עד לפעולה ראשונה
4. **Real-time updates**: שימוש ב-Supabase Realtime לעדכונים מיידיים
5. **Error handling**: טיפול בכשלים ברישום/יצירת שוברים

---

## 🚀 צעדי יישום מומלצים

1. **Backend (Admin):**
   - [x] יצירת שוברי מערכת אוטומטית
   - [x] הכנת SQL schema
   - [ ] בניית קומפוננטת ReferralManager
   - [ ] חיבור לSupabase

2. **Frontend (Customer):**
   - [ ] הוספת שדה קוד הזמנה בהרשמה
   - [ ] מסך שיתוף קוד
   - [ ] תצוגת שוברים
   - [ ] היסטוריית הזמנות

3. **Supabase:**
   - [ ] יצירת טבלאות
   - [ ] הגדרת triggers
   - [ ] הגדרת RLS policies
   - [ ] בדיקות אינטגרציה

---

## 📞 איש קשר לשאלות
בכל שאלה או בעיה באינטגרציה, ניתן לפנות דרך הממשק הניהולי.
