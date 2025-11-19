-- תיקון RLS Policy על PunchCards UPDATE - מאפשר עדכון כרטיסיות
-- זה חשוב לשחזור כרטיסיות (למשל: status = 'active')

-- Policy ל-UPDATE - מאפשר עדכון כרטיסיות לאדמין/מנהלים
drop policy if exists "Allow update PunchCards for admins" on public."PunchCards";
create policy "Allow update PunchCards for admins"
on public."PunchCards"
for update
to authenticated
using (true) -- מאפשר עדכון למשתמשים מחוברים
with check (true); -- מאפשר עדכון לכל הערכים

-- הערה: אם יש מערכת הרשאות יותר מורכבת, צריך להוסיף בדיקה:
-- using (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'role' = 'manager')


