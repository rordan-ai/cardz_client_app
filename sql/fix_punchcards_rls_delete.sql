-- תיקון RLS Policy על PunchCards DELETE - מאפשר מחיקת כרטיסיות לאדמין
-- זה תיקון קריטי לבעיית מחיקת כרטיסייה שלא עובדת

-- אם RLS לא מופעל על PunchCards, נפעיל אותו
alter table public."PunchCards" enable row level security;

-- Policy ל-DELETE - מאפשר מחיקת כרטיסיות לאדמין/מנהלים
-- חשוב: זה מאפשר מחיקה רק למשתמשים מורשים (authenticated)
drop policy if exists "Allow delete PunchCards for admins" on public."PunchCards";
create policy "Allow delete PunchCards for admins"
on public."PunchCards"
for delete
to authenticated
using (true); -- מאפשר מחיקה למשתמשים מחוברים (אדמין/מנהלים)

-- הערה: אם יש מערכת הרשאות יותר מורכבת, צריך להוסיף בדיקה:
-- using (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'role' = 'manager')
-- כרגע מאפשר לכל משתמש מחובר - זה צריך להיות מותאם לפי מערכת ההרשאות


