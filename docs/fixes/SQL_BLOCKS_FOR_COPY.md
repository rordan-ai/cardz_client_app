# 🔧 בלוקי SQL להעתקה מהירה - תיקון RLS Policies על PunchCards

## 📋 הוראות שימוש:
1. פתח את הקובץ `sql/FIX_PUNCHCARDS_RLS_BLOCKS.sql`
2. כל בלוק מופרד עם קווי הפרדה ברורים
3. לחץ על אייקון העתקה (📋) בצד ימין למעלה של כל בלוק
4. הדבק והרץ כל בלוק ב-Supabase SQL Editor בסדר הזה
5. **חשוב:** בדוק את התוצאות לפני שליחה לאדמין

---

## 🔧 בלוק 1: הפעלת RLS על PunchCards

```sql
alter table public."PunchCards" enable row level security;
```

---

## 🗑️ בלוק 2: תיקון DELETE Policy (קריטי למחיקת כרטיסייה)

```sql
drop policy if exists "Allow delete PunchCards for admins" on public."PunchCards";
create policy "Allow delete PunchCards for admins"
on public."PunchCards"
for delete
to authenticated
using (true);
```

---

## 👁️ בלוק 3: תיקון SELECT Policy

```sql
drop policy if exists "Allow select PunchCards" on public."PunchCards";
create policy "Allow select PunchCards"
on public."PunchCards"
for select
to authenticated, anon
using (true);
```

---

## ✏️ בלוק 4: תיקון UPDATE Policy (קריטי לשחזור כרטיסייה)

```sql
drop policy if exists "Allow update PunchCards for admins" on public."PunchCards";
create policy "Allow update PunchCards for admins"
on public."PunchCards"
for update
to authenticated
using (true)
with check (true);
```

---

## ➕ בלוק 5: תיקון INSERT Policy

```sql
drop policy if exists "Allow insert PunchCards" on public."PunchCards";
create policy "Allow insert PunchCards"
on public."PunchCards"
for insert
to authenticated, anon
with check (true);
```

---

## ✅ בלוק 6: בדיקה - וידוא שה-Policies נוצרו

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'PunchCards';
```

**תוצאה צפויה:** אמור להציג 4 policies (SELECT, INSERT, UPDATE, DELETE)

---

## ⚠️ הערות חשובות:

1. **סדר ההרצה:** חשוב להריץ את הבלוקים בסדר הזה (1→2→3→4→5)
2. **בדיקה:** אחרי הרצת כל הבלוקים, הרץ את בלוק הבדיקה
3. **שגיאות:** אם יש שגיאה, עצור ובדוק מה הבעיה לפני המשך
4. **גיבוי:** מומלץ לבצע גיבוי לפני הרצת ה-SQL (אם יש נתונים חשובים)

---

## 📝 מה לעשות אחרי הרצה מוצלחת:

1. ✅ בדוק שהכל עובד - נסה למחוק כרטיסייה מהאדמין
2. ✅ בדוק שחזור - נסה לשחזר כרטיסייה שנמחקה
3. ✅ רק אחרי שבדקת - שלח את ההוראות לאדמין לתיקון הקוד

