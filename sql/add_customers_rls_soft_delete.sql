-- RLS Policy למניעת הצגת לקוחות שנמחקו (soft delete)
-- רק לקוחות עם deleted_at = null יוצגו בשאילתות רגילות

-- אם RLS לא מופעל, נפעיל אותו
alter table public.customers enable row level security;

-- Policy למניעת הצגת לקוחות שנמחקו (soft delete)
drop policy if exists "Exclude soft-deleted customers" on public.customers;
create policy "Exclude soft-deleted customers"
on public.customers
for select
using (deleted_at is null);

-- Policy לאפשר עדכון דרך RPC function (security definer)
-- הפונקציה customer_self_delete רצה כ-security definer ולכן תעקוף את ה-RLS

-- Policy לאדמין - יוכל לראות גם לקוחות שנמחקו (אם נדרש)
-- אם יש role של admin, אפשר להוסיף policy נוסף כאן

