-- בדיקת הסכמה האמיתית של טבלת products
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- בדיקת המוצרים הקיימים
SELECT 
    business_code,
    product_code,
    product_name,
    LENGTH(product_code) as code_length
FROM products 
ORDER BY business_code, product_code; 