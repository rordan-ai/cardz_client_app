-- תיקון הלקוח הקיים ללא שם (0002, 0544515199)
-- אם זהו לקוח שנמחק חלקית - נשלים את המחיקה
-- אם לא - נשאיר אותו כפי שהוא (רק נבדוק)

-- בדיקה ראשונית - מה המצב הנוכחי
-- select business_code, customer_phone, name, deleted_at, hard_delete_after
-- from public.customers
-- where business_code = '0002' and customer_phone = '0544515199';

-- אם name ריק אבל deleted_at null - זה מצב לא תקין
-- נשחזר את name אם יש לוג/היסטוריה, או נסמן כ-deleted אם זהו אכן לקוח שנמחק

-- הערה: יש להריץ את זה ידנית ב-Supabase SQL Editor אחרי בדיקה
-- כי אנחנו לא יודעים בוודאות אם זה לקוח שנמחק או תקלה

-- אפשרות 1: אם זהו לקוח שנמחק - נשלים את המחיקה:
-- update public.customers
-- set deleted_at = now(),
--     hard_delete_after = now() + interval '30 days'
-- where business_code = '0002' 
--   and customer_phone = '0544515199'
--   and name = ''
--   and deleted_at is null;

-- אפשרות 2: אם זהו תקלה - נשחזר את השם (אם יש לוג/היסטוריה):
-- update public.customers
-- set name = 'שם לקוח' -- להחליף בשם האמיתי אם יש
-- where business_code = '0002' 
--   and customer_phone = '0544515199'
--   and name = '';

-- בינתיים - רק בדיקה:
select 
  business_code, 
  customer_phone, 
  name, 
  deleted_at, 
  hard_delete_after,
  case 
    when name = '' and deleted_at is null then 'מצב לא תקין - name ריק אבל לא נמחק'
    when name = '' and deleted_at is not null then 'נמחק כראוי (soft delete)'
    when name != '' and deleted_at is null then 'פעיל תקין'
    else 'מצב אחר'
  end as status
from public.customers
where business_code = '0002' 
  and customer_phone = '0544515199';

