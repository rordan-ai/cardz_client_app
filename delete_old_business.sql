-- מחיקת עסק ישן עם קוד 00 וכל הרשומות התלויות
-- סדר הפעולות: קודם מחיקת רשומות תלויות, אחר כך מחיקת העסק עצמו

-- 1. מחיקת לקוחות של העסק הישן
DELETE FROM public.customers WHERE business_code = '00';

-- 2. מחיקת מוצרים של העסק הישן
DELETE FROM public.products WHERE business_code = '00';

-- 3. מחיקת כרטיסיות של העסק הישן
DELETE FROM public.PunchCards WHERE business_code = '00';

-- 4. מחיקת תוספות של העסק הישן
DELETE FROM public.add_on WHERE business_code = '00';

-- 5. מחיקת חשבוניות של העסק הישן
DELETE FROM public.invoices WHERE business_code = '00';

-- 6. מחיקת לוגים OTP של העסק הישן
DELETE FROM public.otp_logs WHERE business_id = '00';

-- 7. מחיקת לוגים Push של העסק הישן
DELETE FROM public.push_logs WHERE business_id = '00';

-- 8. מחיקת סיכומי שימוש של העסק הישן
DELETE FROM public.usage_summaries WHERE business_id = '00';

-- 9. מחיקת העסק עצמו (רק אחרי מחיקת כל הרשומות התלויות)
DELETE FROM public.businesses WHERE business_code = '00';

-- הודעה על סיום הפעולה
SELECT 'עסק עם קוד 00 נמחק בהצלחה' AS result; 