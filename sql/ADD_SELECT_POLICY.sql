-- ============================================================================
-- הוספת SELECT Policy שחסר
-- ============================================================================

drop policy if exists "Allow select PunchCards" on public."PunchCards";
create policy "Allow select PunchCards"
on public."PunchCards"
for select
to authenticated, anon
using (true);


