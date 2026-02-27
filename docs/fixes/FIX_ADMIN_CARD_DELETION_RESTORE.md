# תיקון בעיות מחיקת כרטיסייה ושחזור - הוראות לאדמין

## סטטוס: 🔴 קריטי - דורש תיקון מיידי

## סיכום הבעיות

### 1. מחיקת כרטיסייה לא עובדת
**מיקום:** `src/components/CustomerManagement.tsx` - `handleDeleteCustomer` (שורה 665-697)

**בעיה:** הקוד מנסה למחוק מ-`PunchCards` אבל המחיקה נחסמת בגלל RLS Policy

**פתרון:** להריץ את `sql/fix_punchcards_rls_delete.sql` ב-Supabase SQL Editor

### 2. שחזור משחזר את כל הלקוח במקום כרטיסייה ספציפית
**מיקום:** `src/components/LogsManager.tsx` - שורה 998-1040

**בעיה:** הקוד משחזר את `customers` במקום `PunchCards`

**פתרון:** לשנות את הקוד לשחזר רק את הכרטיסייה הספציפית

---

## שלב 1: תיקון RLS Policies ב-Supabase

### פעולות נדרשות:

1. **פתח Supabase SQL Editor**
2. **הרץ את הקבצים הבאים בסדר הזה:**

```sql
-- 1. תיקון DELETE Policy
-- העתק והדבק את התוכן מ: sql/fix_punchcards_rls_delete.sql

-- 2. תיקון SELECT Policy (אם לא קיים)
-- העתק והדבק את התוכן מ: sql/fix_punchcards_rls_select.sql

-- 3. תיקון UPDATE Policy (לשחזור)
-- העתק והדבק את התוכן מ: sql/fix_punchcards_rls_update.sql

-- 4. תיקון INSERT Policy (אם לא קיים)
-- העתק והדבק את התוכן מ: sql/fix_punchcards_rls_insert.sql
```

---

## שלב 2: תיקון קוד CustomerManagement.tsx

### בעיה: מחיקת כרטיסייה לא עובדת

**קוד נוכחי (שגוי):**
```typescript
const handleDeleteCustomer = async () => {
  const cardNumber = customerToDelete.punchCard.card_number
  const { error: deleteErr } = await supabase
    .from('PunchCards')
    .delete()
    .eq('card_number', cardNumber)
```

**תיקון נדרש:**

1. **הוסף בדיקת שגיאה והצגת הודעה:**
```typescript
const handleDeleteCustomer = async () => {
  const cardNumber = customerToDelete.punchCard.card_number
  
  if (!cardNumber) {
    alert('שגיאה: לא נמצא מספר כרטיסייה למחיקה');
    return;
  }
  
  const { data, error: deleteErr } = await supabase
    .from('PunchCards')
    .delete()
    .eq('card_number', cardNumber)
    .select(); // הוסף select כדי לראות מה נמחק
  
  if (deleteErr) {
    console.error('[DELETE_CARD] Error:', deleteErr);
    alert(`שגיאה במחיקת כרטיסייה: ${deleteErr.message}`);
    return;
  }
  
  if (!data || data.length === 0) {
    alert('הכרטיסייה לא נמצאה או כבר נמחקה');
    return;
  }
  
  // הצג הודעה על הצלחה
  alert('הכרטיסייה נמחקה בהצלחה');
  
  // רענון הרשימה
  // ... קוד רענון
```

---

## שלב 3: תיקון קוד LogsManager.tsx

### בעיה: שחזור משחזר את כל הלקוח במקום כרטיסייה ספציפית

**קוד נוכחי (שגוי):**
```typescript
// שחזור הלקוח - גם את השם אם נשמר ב-deleted_name
const restoreData: any = { 
  deleted_at: null, 
  hard_delete_after: null 
}
const { error: upErr } = await supabase
  .from('customers')
  .update(restoreData)
  .eq('customer_phone', row.customer_phone)
```

**תיקון נדרש:**

1. **שנה את הקוד לשחזר רק את הכרטיסייה הספציפית:**
```typescript
// שחזור כרטיסייה ספציפית (לא כל הלקוח)
const cardNumber = row.card_number; // צריך להיות card_number מהשורה

if (!cardNumber) {
  alert('שגיאה: לא נמצא מספר כרטיסייה לשחזור');
  return;
}

// שחזור הכרטיסייה - החזרת status ל-active
const { data, error: upErr } = await supabase
  .from('PunchCards')
  .update({ 
    status: 'active' // או כל ערך אחר שמציין שהכרטיסייה פעילה
  })
  .eq('card_number', cardNumber)
  .select();

if (upErr) {
  console.error('[RESTORE_CARD] Error:', upErr);
  alert(`שגיאה בשחזור כרטיסייה: ${upErr.message}`);
  return;
}

if (!data || data.length === 0) {
  alert('הכרטיסייה לא נמצאה');
  return;
}

// אם צריך גם לשחזר את הלקוח (אם הוא נמחק):
// רק אם הלקוח נמחק (deleted_at לא null) ואנחנו רוצים לשחזר אותו גם
const customerPhone = row.customer_phone;
const businessCode = row.business_code;

if (customerPhone && businessCode) {
  // בדיקה אם הלקוח נמחק
  const { data: customerData } = await supabase
    .from('customers')
    .select('deleted_at')
    .eq('customer_phone', customerPhone)
    .eq('business_code', businessCode)
    .maybeSingle();
  
  // אם הלקוח נמחק, נשחזר אותו גם
  if (customerData?.deleted_at) {
    const { error: restoreCustomerErr } = await supabase
      .from('customers')
      .update({
        deleted_at: null,
        hard_delete_after: null,
        name: row.deleted_name || row.name || '' // שחזור השם אם נשמר
      })
      .eq('customer_phone', customerPhone)
      .eq('business_code', businessCode);
    
    if (restoreCustomerErr) {
      console.error('[RESTORE_CUSTOMER] Error:', restoreCustomerErr);
      // לא נעצור כאן - הכרטיסייה כבר שוחזרה
    }
  }
}

alert('הכרטיסייה שוחזרה בהצלחה');
// רענון הרשימה
```

---

## שלב 4: תיקון הצגת שמות לקוחות

### בעיה: שמות לקוחות לא מופיעים

**תיקון נדרש ב-CustomerManagement.tsx:**

```typescript
// במקום:
const displayName = customer.deleted_name || (customer.name && customer.name.trim() ? customer.name : null)

// שנה ל:
const displayName = customer.name && customer.name.trim() 
  ? customer.name 
  : (customer.deleted_name && customer.deleted_name.trim() 
      ? customer.deleted_name 
      : 'לקוח ללא שם');
```

---

## בדיקות נדרשות

לאחר התיקונים, יש לבדוק:

1. ✅ מחיקת כרטיסייה עובדת - הכרטיסייה נמחקת מהטבלה
2. ✅ שחזור כרטיסייה עובד - רק הכרטיסייה הספציפית משוחזרת
3. ✅ שמות לקוחות מופיעים - גם אם השם ריק, מציג "לקוח ללא שם"
4. ✅ מחיקת לקוח (soft delete) עדיין עובדת - לא נפגעה

---

## הערות חשובות

1. **הפרדה בין מחיקת כרטיסייה למחיקת לקוח:**
   - מחיקת כרטיסייה = DELETE מ-`PunchCards` (hard delete)
   - מחיקת לקוח = UPDATE ב-`customers` עם `deleted_at` (soft delete)

2. **RLS Policies:**
   - הקבצים ב-`sql/` מכילים את כל ה-Policies הנדרשים
   - חשוב להריץ אותם בסדר הנכון

3. **שחזור:**
   - שחזור כרטיסייה = UPDATE ב-`PunchCards` (למשל: `status = 'active'`)
   - שחזור לקוח = UPDATE ב-`customers` (למשל: `deleted_at = NULL`)

---

## אם יש בעיות

1. בדוק את הלוגים ב-Supabase (Logs → Database)
2. בדוק את ה-RLS Policies (Authentication → Policies)
3. בדוק שהפונקציות קיימות (Database → Functions)


