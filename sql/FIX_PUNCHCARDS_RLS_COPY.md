# תיקון RLS Policies על PunchCards

## ⚠️ חשוב: העתק רק את הקוד בין השורות, לא את הסימנים ```sql או ```

---

## בלוק 1: הפעלת RLS על PunchCards

```sql
alter table public."PunchCards" enable row level security;
```

**להעתקה:** העתק רק את השורה: `alter table public."PunchCards" enable row level security;`

---

## בלוק 2: תיקון DELETE Policy

```sql
drop policy if exists "Allow delete PunchCards for admins" on public."PunchCards";
create policy "Allow delete PunchCards for admins"
on public."PunchCards"
for delete
to authenticated
using (true);
```

**להעתקה:** העתק רק את 6 השורות של הקוד (מ-drop policy עד using (true);)

---

## בלוק 3: תיקון SELECT Policy

```sql
drop policy if exists "Allow select PunchCards" on public."PunchCards";
create policy "Allow select PunchCards"
on public."PunchCards"
for select
to authenticated, anon
using (true);
```

**להעתקה:** העתק רק את 6 השורות של הקוד (מ-drop policy עד using (true);)

---

## בלוק 4: תיקון UPDATE Policy

```sql
drop policy if exists "Allow update PunchCards for admins" on public."PunchCards";
create policy "Allow update PunchCards for admins"
on public."PunchCards"
for update
to authenticated
using (true)
with check (true);
```

**להעתקה:** העתק רק את 7 השורות של הקוד (מ-drop policy עד with check (true);)

---

## בלוק 5: תיקון INSERT Policy

```sql
drop policy if exists "Allow insert PunchCards" on public."PunchCards";
create policy "Allow insert PunchCards"
on public."PunchCards"
for insert
to authenticated, anon
with check (true);
```

**להעתקה:** העתק רק את 6 השורות של הקוד (מ-drop policy עד with check (true);)

---

## בלוק 6: בדיקה

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'PunchCards';
```

**להעתקה:** העתק רק את 3 השורות של הקוד (מ-SELECT עד PunchCards;)


