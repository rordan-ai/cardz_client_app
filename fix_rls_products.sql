-- ביטול Row Level Security על טבלת products
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
 
-- בדיקה שהביטול עבד
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'products' AND schemaname = 'public'; 