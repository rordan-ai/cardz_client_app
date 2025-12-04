# מחיקת כל הנתונים משלושת העסקים - ניקוי מלא

## ⚠️ אזהרה: פעולות הרסניות - מוחקות את כל הנתונים!

**חשוב מאוד:**
1. ודא שיש לך גיבוי לפני הרצה
2. הרץ את הבלוקים בסדר הזה
3. אחרי המחיקה - בקש מהאדמין למחוק את רשימת השחזור

---

## בלוק 1: מחיקת כל הלקוחות

```sql
DELETE FROM public.customers
WHERE business_code IN ('0001', '0002', '0003');
```

---

## בלוק 2: מחיקת כל הכרטיסיות

```sql
DELETE FROM public."PunchCards"
WHERE business_code IN ('0001', '0002', '0003');
```

---

## בלוק 3: בדיקה - וידוא שהכל נמחק

```sql
SELECT COUNT(*) as customers_count
FROM public.customers
WHERE business_code IN ('0001', '0002', '0003');

SELECT COUNT(*) as punchcards_count
FROM public."PunchCards"
WHERE business_code IN ('0001', '0002', '0003');
```

**תוצאה צפויה:** שני ה-COUNT אמורים להיות 0

---

## מה לעשות אחרי המחיקה:

1. ✅ ודא שהכל נמחק (בלוק 3)
2. ✅ בקש מהאדמין למחוק את רשימת השחזור
3. ✅ התחל בדיקות מסודרות מחדש


