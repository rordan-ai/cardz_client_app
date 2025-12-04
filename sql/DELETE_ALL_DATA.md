# מחיקת כל הנתונים משלושת העסקים

## בלוק 1: מחיקת כל הלקוחות

```sql
DELETE FROM public.customers
WHERE business_code IN ('0001', '0002', '0003');
```

## בלוק 2: מחיקת כל הכרטיסיות

```sql
DELETE FROM public."PunchCards"
WHERE business_code IN ('0001', '0002', '0003');
```

## בלוק 3: בדיקה - וידוא שהכל נמחק

```sql
SELECT COUNT(*) as customers_count
FROM public.customers
WHERE business_code IN ('0001', '0002', '0003');

SELECT COUNT(*) as punchcards_count
FROM public."PunchCards"
WHERE business_code IN ('0001', '0002', '0003');
```


