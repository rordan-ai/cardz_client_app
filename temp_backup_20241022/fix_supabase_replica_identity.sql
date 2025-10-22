-- תיקון בעיית replica identity בטבלת businesses
-- הרץ את הקוד הזה ב-SQL Editor של Supabase

-- 1. הוספת replica identity לטבלת businesses
ALTER TABLE public.businesses REPLICA IDENTITY FULL;

-- 2. וידוא שהטבלה מוגדרת נכון
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN relreplident = 'f' THEN 'FULL - מוגדר נכון'
        WHEN relreplident = 'd' THEN 'DEFAULT - עלול לגרום לבעיות'
        WHEN relreplident = 'n' THEN 'NOTHING - לא מוגדר'
        ELSE 'אחר'
    END as replica_identity_status
FROM pg_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
WHERE pt.schemaname = 'public' 
AND pt.tablename = 'businesses';

-- 3. בדיקה שהטבלה מופעלת ב-Realtime
SELECT 
    schemaname,
    tablename,
    'מופעל ב-Realtime' as realtime_status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'businesses';

-- הערה: אם השורה הקודמת לא מחזירה תוצאות, הרץ את זה:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses; 