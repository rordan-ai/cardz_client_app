-- בדיקת הסכמה האמיתית של טבלת businesses
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'businesses' 
AND table_schema = 'public'
AND column_name LIKE '%icon%'
ORDER BY ordinal_position;

-- בדיקת נתוני העסק 0001
SELECT 
    business_code,
    name,
    max_punches,
    punched_icon,
    unpunched_icon,
    punched_icon,
    unpunched_icon,
    logo
FROM businesses 
WHERE business_code = '0001'; 