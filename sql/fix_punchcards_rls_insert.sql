-- תיקון RLS Policy על PunchCards INSERT - מאפשר יצירת כרטיסיות חדשות
-- זה חשוב להוספת לקוחות חדשים

-- Policy ל-INSERT - מאפשר יצירת כרטיסיות חדשות
drop policy if exists "Allow insert PunchCards" on public."PunchCards";
create policy "Allow insert PunchCards"
on public."PunchCards"
for insert
to authenticated, anon
with check (true); -- מאפשר יצירה לכולם (כי יש סינון לפי business_code בקוד)

-- הערה: הסינון לפי business_code מתבצע בקוד האפליקציה
-- אם רוצים סינון ברמת RLS, אפשר להוסיף:
-- with check (business_code = current_setting('app.business_code', true))


