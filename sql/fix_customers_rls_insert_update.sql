-- תיקון RLS Policies - מאפשר הוספת לקוח מחדש ושחזור לקוח שנמחק (תוך 30 יום)

-- Policy ל-INSERT - מאפשר הוספת לקוח חדש (גם אם נמחק בעבר - upsert יטופל)
drop policy if exists "Allow insert customers" on public.customers;
create policy "Allow insert customers"
on public.customers
for insert
to anon, authenticated
with check (true); -- מאפשר הוספת כל לקוח

-- Policy ל-UPDATE - מאפשר עדכון ושחזור לקוח
-- מאפשר עדכון גם אם deleted_at לא null (לשחזור תוך 30 יום)
drop policy if exists "Allow update customers" on public.customers;
create policy "Allow update customers"
on public.customers
for update
to anon, authenticated
using (
  -- מאפשר עדכון אם:
  -- 1. הלקוח לא נמחק (deleted_at is null)
  -- 2. או הלקוח נמחק אבל תוך 30 יום (לשחזור)
  deleted_at is null 
  or (deleted_at is not null and hard_delete_after > now())
)
with check (
  -- מאפשר עדכון ל:
  -- 1. לקוח פעיל (deleted_at is null)
  -- 2. או שחזור (מאפס deleted_at)
  deleted_at is null 
  or (deleted_at is not null and hard_delete_after > now())
);

-- Policy נוסף ל-SELECT לאדמין - לראות גם לקוחות שנמחקו (אם יש role של admin)
-- אם אין role של admin, אפשר להסיר policy זה
-- drop policy if exists "Allow admin view deleted customers" on public.customers;
-- create policy "Allow admin view deleted customers"
-- on public.customers
-- for select
-- to authenticated
-- using (
--   -- כאן צריך לבדוק אם המשתמש הוא אדמין
--   -- לדוגמה: auth.jwt() ->> 'role' = 'admin'
--   true -- זמני - צריך להתאים לפי מערכת ההרשאות
-- );

