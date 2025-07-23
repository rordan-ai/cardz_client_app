-- הוספת מוצרים לדוגמה לעסקים קיימים

-- מוצרים לעסק 0001
INSERT INTO public.products (
  business_code, 
  product_code, 
  product_name, 
  product_type, 
  price
) VALUES 
('0001', '01', 'קפה שחור', 'coffee', 15.00),
('0001', '02', 'קפה עם חלב', 'coffee', 18.00),
('0001', '03', 'קפוצינו', 'coffee', 20.00),
('0001', '04', 'אספרסו', 'coffee', 12.00),
('0001', '00', 'מוצר כללי', 'general', 0.00);

-- מוצרים לעסק 0002
INSERT INTO public.products (
  business_code, 
  product_code, 
  product_name, 
  product_type, 
  price
) VALUES 
('0002', '01', 'קפה שחור', 'coffee', 16.00),
('0002', '02', 'קפה עם חלב', 'coffee', 19.00),
('0002', '03', 'קפוצינו', 'coffee', 22.00),
('0002', '00', 'מוצר כללי', 'general', 0.00);

-- בדיקה שהמוצרים נוספו
SELECT 
  business_code,
  product_code,
  product_name,
  product_type,
  price
FROM public.products 
ORDER BY business_code, product_code; 