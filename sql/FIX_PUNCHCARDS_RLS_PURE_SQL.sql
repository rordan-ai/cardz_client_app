-- ============================================================================
-- בלוק 1: הפעלת RLS על PunchCards
-- ============================================================================

alter table public."PunchCards" enable row level security;

-- ============================================================================
-- בלוק 2: תיקון DELETE Policy
-- ============================================================================

drop policy if exists "Allow delete PunchCards for admins" on public."PunchCards";
create policy "Allow delete PunchCards for admins"
on public."PunchCards"
for delete
to authenticated
using (true);

-- ============================================================================
-- בלוק 3: תיקון SELECT Policy
-- ============================================================================

drop policy if exists "Allow select PunchCards" on public."PunchCards";
create policy "Allow select PunchCards"
on public."PunchCards"
for select
to authenticated, anon
using (true);

-- ============================================================================
-- בלוק 4: תיקון UPDATE Policy
-- ============================================================================

drop policy if exists "Allow update PunchCards for admins" on public."PunchCards";
create policy "Allow update PunchCards for admins"
on public."PunchCards"
for update
to authenticated
using (true)
with check (true);

-- ============================================================================
-- בלוק 5: תיקון INSERT Policy
-- ============================================================================

drop policy if exists "Allow insert PunchCards" on public."PunchCards";
create policy "Allow insert PunchCards"
on public."PunchCards"
for insert
to authenticated, anon
with check (true);

-- ============================================================================
-- בלוק 6: בדיקה - וידוא שה-Policies נוצרו
-- ============================================================================

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'PunchCards';


