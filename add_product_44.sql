-- הוספת מוצר חדש לעסק 0002
INSERT INTO public.products (
  business_code, 
  product_code, 
  product_name, 
  product_type, 
  price
) VALUES (
  '0002', '44', 'כריך גבינה קטן', 'כריכים', 18.00
);

-- בדיקה שהמוצר נוסף
SELECT * FROM public.products WHERE business_code = '0002'; 