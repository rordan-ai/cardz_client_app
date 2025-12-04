-- תיקון RLS Policy על PunchCards SELECT - מאפשר קריאת כרטיסיות
-- זה חשוב כדי שהאדמין יוכל לראות כרטיסיות גם של לקוחות שנמחקו (soft delete)

-- Policy ל-SELECT - מאפשר קריאת כרטיסיות
drop policy if exists "Allow select PunchCards" on public."PunchCards";
create policy "Allow select PunchCards"
on public."PunchCards"
for select
to authenticated, anon
using (true); -- מאפשר קריאה לכולם (כי יש סינון לפי business_code בקוד)

-- הערה: הסינון לפי business_code מתבצע בקוד האפליקציה
-- אם רוצים סינון ברמת RLS, אפשר להוסיף:
-- using (business_code = current_setting('app.business_code', true))


