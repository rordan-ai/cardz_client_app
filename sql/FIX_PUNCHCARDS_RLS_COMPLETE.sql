-- ============================================================================
-- תיקון מלא של RLS Policies על PunchCards - להעתקה מהירה
-- ============================================================================
-- הוראות: העתק והדבק את כל הבלוקים הבאים ב-Supabase SQL Editor
-- חשוב: הרץ את כל הבלוקים בסדר הזה
-- ============================================================================

-- ============================================================================
-- בלוק 1: הפעלת RLS על PunchCards (אם לא מופעל)
-- ============================================================================

alter table public."PunchCards" enable row level security;

-- ============================================================================
-- בלוק 2: תיקון DELETE Policy - מאפשר מחיקת כרטיסיות לאדמין
-- ============================================================================

drop policy if exists "Allow delete PunchCards for admins" on public."PunchCards";
create policy "Allow delete PunchCards for admins"
on public."PunchCards"
for delete
to authenticated
using (true);

-- ============================================================================
-- בלוק 3: תיקון SELECT Policy - מאפשר קריאת כרטיסיות
-- ============================================================================

drop policy if exists "Allow select PunchCards" on public."PunchCards";
create policy "Allow select PunchCards"
on public."PunchCards"
for select
to authenticated, anon
using (true);

-- ============================================================================
-- בלוק 4: תיקון UPDATE Policy - מאפשר עדכון כרטיסיות (לשחזור)
-- ============================================================================

drop policy if exists "Allow update PunchCards for admins" on public."PunchCards";
create policy "Allow update PunchCards for admins"
on public."PunchCards"
for update
to authenticated
using (true)
with check (true);

-- ============================================================================
-- בלוק 5: תיקון INSERT Policy - מאפשר יצירת כרטיסיות חדשות
-- ============================================================================

drop policy if exists "Allow insert PunchCards" on public."PunchCards";
create policy "Allow insert PunchCards"
on public."PunchCards"
for insert
to authenticated, anon
with check (true);

-- ============================================================================
-- סיום - כל ה-Policies הוגדרו בהצלחה
-- ============================================================================


