# 🛠️ חוקי עבודה קונקרטיים - CARDZ

**מדריך עבודה מעשי לסוכנים**

---

## 🖥️ **עבודה עם טרמינל**

### **🔤 בעיית אותיות עברית בטרמינל**

**הבעיה המרכזית:**
כשהמקלדת בעברית, PowerShell מפרש מקשים כתווים עבריים:
- `cd` נהיה `בג`
- `dir` נהיה `גןר`  
- `npm` נהיה `מפצ`
- `git` נהיה `עןאg`

**פתרונות מיידיים:**
```bash
# הפתרון המועדף - תמיד
cmd /c "git status"
cmd /c "npm run dev"
cmd /c "dir src"

# פתרונות נוספים
Get-ChildItem src/  # במקום dir
Set-Location src/   # במקום cd
```

**הוראות למשתמש:**
1. **החלפת שפה לאנגלית** כברירת מחדל בסיסטם
2. **פתיחת VS Code/Cursor טרמינל** כשהמקלדת באנגלית
3. **שימוש ב-cmd /c** תמיד כשאני בעברית

### **🗺️ בעיית התמצאות בסביבת העבודה**

**הבעיה המרכזית:**
הסוכן לא מצליח להתמצא או לזהות במה שהוא נמצא:
- לא מבין שהוא ב-pager במקום ב-shell רגיל
- לא קורא תגובות הטרמינל כראוי
- לא מזהה מתי פקודות נכשלות או נתקעות
- לא שם לב להודעות שגיאה או התראות

**דוגמאות לאיבוד התמצאות:**
```
# הטרמינל מראה:
Pattern not found  (press RETURN)

# הסוכן חושב שהוא ב-shell ומנסה:
git status  # זה לא יעבוד!

# או שהטרמינל מראה:
'head' is not recognized as an internal command

# הסוכן ממשיך להשתמש ב-head במקום לחפש חלופה
```

**פתרון והתנהגות נכונה:**
1. **קריאה מעמיקה** של כל תגובת טרמינל לפני פקודה הבאה
2. **זיהוי סביבה** - האם אני ב-shell, ב-pager, או במצב אחר?
3. **תגובה מותאמת** לסביבה הנוכחית
4. **דיווח כנה** כשלא מבין או לא יודע

**סימני אזהרה לבעיית התמצאות:**
- פקודות לא מתבצעות כצפוי
- הודעות שגיאה שחוזרות על עצמן
- תוצאות לא הגיוניות מפקודות
- תחושה של "תקיעה" במשהו

### **🔄 בעיית תקיעה ב-Pager (less/more)**

**סימני זיהוי:**
```
Pattern not found  (press RETURN)
HELP -- Press RETURN for more, or q when done
h  H                 Display this help.
q  :q  Q  :Q  ZZ     Exit.
```

**פתרון מיידי:**
1. **זיהוי המצב** - אני ב-pager, לא ב-shell רגיל
2. **יציאה** - לחיצה על `q` או `RETURN`
3. **המשך** - רק אחר כך פקודות חדשות

**מניעה מראש:**
```bash
# תוספת למניעת pager
git --no-pager log --oneline -20
git --no-pager branch -a
git --no-pager diff
```

### **⚡ פקודות PowerShell מומלצות**

**במקום פקודות DOS:**
```powershell
# קריאת תיקיות
Get-ChildItem        # במקום dir
Get-ChildItem -Path src/  # עם נתיב

# ניווט
Set-Location src/    # במקום cd
Push-Location        # שמירת מיקום
Pop-Location         # חזרה למיקום

# הצגת תוכן
Get-Content file.txt # במקום type
```

**פקודות היברידיות מוצלחות:**
```bash
cmd /c "פקודה"      # הכי בטוח
powershell "פקודה"  # אלטרנטיבה
```

---

## 📋 **פקודות Git - קריאה וחיפוש**

### **📊 מידע בסיסי על Repository**

**בדיקת מצב נוכחי:**
```bash
# מצב הrepo
git --no-pager status
git remote -v
git branch --show-current

# עדכון מהremote
git fetch origin
git --no-pager branch -r  # ברנצ'ים מרוחקים
git --no-pager branch -a  # כל הברנצ'ים
```

### **📖 קריאת היסטוריית קומיטים**

**רשימות קומיטים:**
```bash
# קומיטים בסיסיים
git --no-pager log --oneline
git --no-pager log --oneline -20
git --no-pager log --oneline --all

# עם פרטים נוספים
git --no-pager log --stat
git --no-pager log --graph --oneline --all
git --no-pager log --since="2025-01-01"
```

**מידע על קומיט ספציפי:**
```bash
# פרטי קומיט
git --no-pager show commit_hash
git --no-pager show commit_hash --name-only
git --no-pager show commit_hash --stat

# רשימת קבצים בקומיט
git --no-pager ls-tree -r commit_hash
git --no-pager ls-tree -r commit_hash | grep "\.tsx$"
```

### **🔍 חיפוש מתקדם**

**חיפוש במסרי קומיט:**
```bash
# חיפוש במסר
git --no-pager log --grep="Marketing"
git --no-pager log --grep="ווצ'ר"
git --no-pager log --all --grep="פרסום"

# חיפוש בתוכן השינויים
git --no-pager log -S "MarketingCenter"
git --no-pager log -S "renderCouponsContent"
git --no-pager log -p -S "voucher"
```

**חיפוש קבצים:**
```bash
# קובץ ספציפי בהיסטוריה
git --no-pager log --follow -- "src/components/MarketingCenter.tsx"
git --no-pager log --all --full-history -- "*Marketing*"

# קבצים שנמחקו
git --no-pager log --diff-filter=D --summary
git --no-pager log --diff-filter=D --name-only
```

**תוכן קובץ מקומיט ספציפי:**
```bash
# הצגת תוכן קובץ
git show commit_hash:path/to/file.tsx

# חיפוש בתוכן
git show commit_hash:src/App.tsx | grep -i "marketing"
git show commit_hash:assets/cursor_main_agent_chat.md | grep -n "ווצ'ר"
```

### **🌿 עבודה עם Branches**

**מעבר בין ברנצ'ים:**
```bash
# מעבר לbranchברנצ'
git checkout branch_name
git checkout origin/restore_checkpoints

# יצירה ומעבר
git checkout -b new_branch_name

# חזרה למיין
git checkout main
```

**השוואות בין ברנצ'ים:**
```bash
# השוואת ברנצ'ים
git --no-pager diff main..other_branch
git --no-pager diff --name-only main..other_branch

# קומיטים שאין במקומי
git --no-pager log origin/main ^main
git --no-pager log main..origin/main
```

### **💾 שחזור מגיבויים**

**מברנץ' restore_checkpoints:**
```bash
# גישה לברנץ' הגיבויים
git fetch origin
git --no-pager branch -r | grep restore_checkpoints
git checkout origin/restore_checkpoints

# רשימת קבצים זמינים
git --no-pager ls-tree -r HEAD
git --no-pager ls-tree -r HEAD | grep -i marketing

# שחזור קובץ ספציפי
git show HEAD:src/components/MarketingCenter.tsx > recovered_MarketingCenter.tsx
git show HEAD:path/to/vouchers.tsx > recovered_vouchers.tsx
```

**מgit stash:**
```bash
# רשימת stashes
git stash list
git --no-pager stash show stash@{0}

# שחזור מstash
git stash show -p stash@{0}
git stash apply stash@{0}
```

---

## 🎨 **חוקי עיצוב ו-UI**

### **🎯 ברירות מחדל לכותרות**

**צבעים מותרים בלבד:**
- **רקע בהיר**: שחור `#000000` או `#1f2937`
- **רקע כהה**: לבן `#ffffff`

**אסור בהחלט:**
- גרדיאנטים של כל סוג
- צבעים מורכבים (כחול, ירוק, וכו')
- webkit-text-fill-color עם צבעים אחרים

**תבנית CSS חובה לכותרות:**
```css
.title-class {
  color: #000000 !important;                    /* או #ffffff */
  background: transparent !important;
  background-image: none !important;
  -webkit-background-clip: unset !important;
  -webkit-text-fill-color: #000000 !important; /* או #ffffff */
}
```

### **📱 רספונסיביות**

**חלוקת מכשירים:**
- **מובייל**: עד 480px
- **טאבלט**: 481-1024px  
- **דסקטופ**: מעל 1025px

**כללי אצבע למובייל:**
- אזורי לחיצה מינימום 44px
- הסתרת אלמנטים לא קריטיים
- עריכה אנכית
- פישוט טקסטים

**הפרדת קבצי CSS:**
```
Component.css           # משותף
Component.mobile.css    # מובייל בלבד
Component.tablet.css    # טאבלט בלבד
Component.desktop.css   # דסקטופ בלבד
```

---

## 🔧 **פתרון בעיות נפוצות**

### **🚫 בעיית פסים אפורים לא רצויים**

**מקורות נפוצים:**
- `border-bottom` על אלמנטים הורה
- כללי CSS כלליים על `td`, `tr`
- `border-top` על sections
- `border-left` על barcode elements

**שיטת פתרון:**
1. **בדיקת שרשרת ההורים** - לא רק האלמנט עצמו
2. **חיפוש כללי CSS גלובליים**
3. **שימוש ב-DevTools** לזיהוי מקור
4. **Override ספציפי:**
```css
.problematic-element {
  border: none !important;
  border-bottom: none !important;
  border-top: none !important;
}
```

### **⚡ בעיות TypeScript/Build**

**שגיאות נפוצות וטיפול:**
- **Missing imports**: תמיד לבדוק נתיבים
- **Type errors**: לא לנחש - לבדוק הגדרות
- **Build failures**: לתקן לפני commit, לא אחריו

**עצירה במקרה של לולאה:**
- מקסימום 3 ניסיונות תיקון באותו קובץ
- אחר כך - דיווח למשתמש ובקשת הנחיה

---

## 📝 **פרוטוקולי עבודה**

### **🔒 מנגנון בקרת ציותנות**

**לפני כל שינוי קוד - חובה:**
```
☐ קראתי את הבקשה המדויקת ללא פרשנות
☐ שמרתי את המצב הקודם לשחזור אפשרי  
☐ זיהיתי מה אסור לי לגעת בו
☐ זיהיתי בדיוק מה צריך לשנות
☐ וידאתי שאני לא מוסיף יוזמות לא מאושרות
☐ תכננתי צעדים קטנים עם אישור ביניים
☐ בדקתי שאני לא משנה פונקציונליות עובדת
```

### **🎯 עקרונות עבודה יומיים**

**DO (לעשות):**
- שינויים מינימליים בלבד
- שאלות כשלא בטוח
- תיעוד כל שינוי
- בדיקת רספונסיביות תמיד
- שמירת קוד עובד

**DON'T (לא לעשות):**
- יוזמות לא מאושרות
- שינוי קוד שעובד ללא סיבה
- הוספת features לא מבוקשות
- שינוי לוגיקה עסקית ללא אישור
- פתרונות מסובכים ללא צורך

### **🚨 התמודדות עם כישלונות**

**כשמשהו לא עובד:**
1. **הפסקה מיידית** - לא להמשיך לשבש
2. **בדיקה מתודית** של הבעיה
3. **שחזור למצב עובד** אם אפשר
4. **דיווח כנה** למשתמש על המצב
5. **בקשת הנחיה** לפני המשך

**אסור בהחלט:**
- המצאת פתרונות ללא ידע
- הסתרת כישלונות
- ניסיון "תיקון" בלי הבנה
- המשך שינויים כשמשהו שבור

---

## 💾 **יצירת גיבוי**

### **🎯 מתי ליצור גיבוי**

**חובה ליצור גיבוי לפני:**
- שינויים מבניים גדולים (פיצול קומפוננטים)
- מחיקת קוד משמעותי
- שינוי ארכיטקטורה
- עבודה על state management
- סוף יום עבודה או הפסקה ארוכה

**סוגי גיבוי:**
- **גיבוי מקומי**: commits במאגר המקומי
- **גיבוי מרוחק**: push לGitHub (אם אפשר)
- **גיבוי קבצים**: העתקת קבצים קריטיים

### **📋 נוהל גיבוי מסודר - צעד אחר צעד**

#### **🔍 שלב 1: בדיקת מצב נוכחי**
```bash
# הודעת פתיחה
cmd /c "echo 🔍 בדיקת מצב פרויקט לפני גיבוי"

# בדיקת מצב Git
git status
git --no-pager log --oneline -3

# בדיקת branches זמינים
git --no-pager branch -a

# בדיקת קבצים שלא נוספו
git --no-pager ls-files --others --exclude-standard
```

#### **📊 שלב 2: יצירת commit מפורט**
```bash
# commit עם תיאור מפורט של המצב
git commit --allow-empty -m "📦 FULL PROJECT BACKUP - [תיאור השלב]

🎯 Development Status:
✅ [רשימת מה שהושלם]
⚠️ [בעיות ידועות]
🔄 [מה הבא בתוכנית]

📊 Code Status:
- Components: [מספר ומצב]
- Features: [מה עובד]
- Issues: [בעיות טכניות]

⏰ Backup Time: $(date)"
```

#### **📝 שלב 3: יצירת דו"ח מצב**
```bash
# יצירת קובץ דו"ח עם תאריך ושעה
# backup_report_YYYYMMDD_HHMMSS.md
```

**תוכן הדו"ח חייב לכלול:**
- מצב הפרויקט (branch, commits, status)
- קבצים חדשים/שונים
- התקדמות בפיתוח
- בעיות ידועות
- תוכנית הבאה
- הערות חשובות

#### **📋 שלב 4: הוספת הדו"ח לגיבוי**
```bash
# הוספה לgit
cmd /c "git add backup_report_*.md"
git commit -m "[DOCS]: Backup report - [תיאור קצר]"
```

#### **🌐 שלב 5: גיבוי לbranch restore_checkpoints**

**רוטינת גיבוי מלאה לbranch הגיבויים:**

```bash
# שלב 1: הוספת קבצים והכנת commit במיין
git add .
git commit -m "📦 FULL PROJECT BACKUP - [תיאור השלב]

🎯 Development Status:
✅ [מה הושלם]
⚠️ [בעיות ידועות]
🔄 [מה הבא]

📊 Code Status:
- Components: [מצב קומפוננטות]
- Features: [מה עובד]
- Issues: [בעיות טכניות]"

# שלב 2: מעבר לbranch הגיבויים
git checkout restore_checkpoints

# שלב 3: הוספת עדכונים נוספים אם יש (חוקי עבודה וכו')
git add .
git commit -m "🚨 עדכון: [תיאור העדכון]"

# שלב 4: push לremote (טיפול בconflicts אם נדרש)
# אם push רגיל נכשל:
git push origin restore_checkpoints --force-with-lease

# שלב 5: חזרה למיין
git checkout main

# שלב 6: וידוא שלמות הגיבוי - 100% מהקבצים
cmd /c "echo 🔍 מוודא שלמות הגיבוי..."

# בדיקת מספר קבצים במיין (PowerShell)
cmd /c "echo 📊 קבצים במיין:"
$mainFiles = (git ls-tree -r --name-only HEAD).Count
echo "מספר קבצים במיין: $mainFiles"

# בדיקת מספר קבצים בגיבוי  
cmd /c "echo 📊 קבצים ב-restore_checkpoints:"
$backupFiles = (git ls-tree -r --name-only restore_checkpoints).Count
echo "מספר קבצים בגיבוי: $backupFiles"

# השוואת מספרי קבצים
if ($mainFiles -eq $backupFiles) {
    cmd /c "echo ✅ מספר קבצים זהה - $mainFiles קבצים"
} else {
    cmd /c "echo ⚠️ הבדל במספר קבצים! מיין: $mainFiles, גיבוי: $backupFiles"
}

# השוואת commits אחרונים
cmd /c "echo 📊 השוואת commits:"
cmd /c "echo מיין - commit אחרון:"
git --no-pager log --oneline -1
cmd /c "echo restore_checkpoints - commit אחרון:"
git --no-pager log --oneline -1 restore_checkpoints

# וידוא שאין קבצים שלא tracked
cmd /c "echo 📊 בדיקת קבצים לא tracked:"
$untracked = git ls-files --others --exclude-standard
if (-not $untracked) {
    cmd /c "echo ✅ אין קבצים לא tracked"
} else {
    cmd /c "echo ⚠️ נמצאו קבצים לא tracked:"
    $untracked
}

# בדיקת working directory נקי
if ((git diff --quiet) -and (git diff --staged --quiet)) {
    cmd /c "echo ✅ Working directory נקי"
} else {
    cmd /c "echo ⚠️ יש שינויים שלא committed"
    git --no-pager diff --name-only
}

cmd /c "echo ✅ גיבוי הושלם ואומת ב-restore_checkpoints"
```

**⚠️ טיפול בבעיות נפוצות:**

```bash
# אם צריך לבטל merge עם conflicts:
git merge --abort

# אם push נכשל (branch behind):
git push origin restore_checkpoints --force-with-lease

# אם יש שינויים לא committed לפני checkout:
git stash
git checkout restore_checkpoints
git stash pop  # אחרי שחזרתי למיין
```

### **⚠️ טיפול בבעיות גיבוי**

#### **🚫 בעיית API Keys בהיסטוריה**
```bash
# זיהוי הבעיה
# GitHub Push Protection מונע push

# מחיקת קבצים עם secrets
git rm path/to/secret/file.txt
git commit -m "Remove files with secrets"

# הבעיה נשארת בהיסטוריה!
# פתרון: history rewriting (מתקדם)
```

#### **🔄 Merge Conflicts**
```bash
# בעת git pull
git pull origin main

# אם יש conflicts:
# 1. פתיחת קבצים עם conflicts
# 2. פתרון ידני של הconflicts
# 3. הוספה לstaging
git add conflicted_file.md
git commit  # לסיום הmerge
```

#### **📊 בדיקת גודל Repository**
```bash
# בדיקת גודל
cmd /c "git count-objects -vH"

# זיהוי קבצים גדולים
cmd /c "git ls-tree -r -t -l --full-name HEAD | sort -n -k 4"
```

### **✅ רשימת בדיקה לגיבוי מוצלח**

**לפני הגיבוי:**
```
☐ בדקתי מצב Git נוכחי
☐ זיהיתי קבצים חדשים/שונים  
☐ תיעדתי מה השתנה מהגיבוי האחרון
☐ ודאתי שהאפליקציה עובדת
```

**במהלך הגיבוי:**
```
☐ יצרתי commit מפורט עם תיאור מלא
☐ יצרתי דו"ח מצב מקיף
☐ הוספתי הכל לgit
☐ ניסיתי push (גם אם נכשל)
```

**אחרי הגיבוי:**
```
☐ ודאתי שהcommit נוצר בהצלחה
☐ בדקתי שמספר הקבצים זהה בין main לrestore_checkpoints
☐ ודאתי שאין קבצים לא tracked
☐ בדקתי שworking directory נקי
☐ השוויתי commits אחרונים
☐ תיעדתי בעיות (אם היו)
☐ האפליקציה עדיין עובדת
☐ יש לי נתיב חזרה ברור
☐ 100% מהקבצים נשמרו בגיבוי
```

### **🎯 דוגמה למבנה דו"ח גיבוי**

```markdown
# דו"ח גיבוי - DD/MM/YYYY HH:MM

## מצב הפרויקט:
- **Branch:** main
- **Commit אחרון:** [hash] [message]  
- **Status:** [clean/changes/ahead of remote]

## קבצים בגיבוי:
- **חדשים:** [רשימה]
- **שונים:** [רשימה] 
- **נמחקו:** [רשימה]

## התקדמות פיתוח:
### ✅ הושלם:
[רשימת משימות שהושלמו]

### ⚠️ בתהליך:
[מה שנמצא באמצע]

### 🔄 הבא:
[התוכנית הבאה]

## בעיות ידועות:
[רשימת בעיות שצריך לטפל בהן]

## הערות:
[הערות חשובות למפתח הבא]
```

---

## 🔄 **עדכונים ושיפורים**

**קובץ זה מתעדכן באופן שוטף בהתאם לבעיות וחוויות חדשות.**

**תאריך יצירה:** יום יצירת הקובץ  
**עדכון אחרון:** [יתעדכ

עדכון אחרון של פקודות מגיט האב: 
# פקודות GitHub לסוכן AI – לכל הסביבות

להלן רשימה של פקודות Git (גיט) ו-GitHub שימושיות לביצוע פעולות נפוצות, כולל הסבר קצר על כל פקודה. הפקודות מתאימות לכל סביבה (Windows, MacOS, Linux) ומיועדות להרצה על ידי סוכן AI או כל משתמש.

---

### 1. שיבוט (Clone) של רפוזיטורי
```bash
git clone https://github.com/OWNER/REPO.git
```
**הסבר:** מוריד עותק מלא של הרפוזיטורי למחשב המקומי.

---

### 2. יצירת רפוזיטורי חדש (Repository)
#### דרך האתר:
- נכנסים ל-[github.com](https://github.com) > לוחצים על New repository > ממלאים שם ותיאור > יוצרים.
#### דרך CLI:
```bash
gh repo create NAME --public|--private --description "תיאור"
```
**הסבר:** יוצר רפוזיטורי חדש ב-GitHub (דורש התקנת gh).

---

### 3. יצירת ענף חדש (Branch)
```bash
git checkout -b branch-name
```
**הסבר:** יוצר ועובר לענף חדש שנקרא "branch-name".

---

### 4. מעבר בין ענפים
```bash
git checkout branch-name
```
**הסבר:** עובר לענף קיים בשם "branch-name".

---

### 5. שליחת קבצים חדשים לסטייג' (Add)
```bash
git add .
```
**הסבר:** מסמן את כל הקבצים ששונו להוספה לקומיט.

---

### 6. ביצוע קומיט (Commit)
```bash
git commit -m "הודעת קומיט"
```
**הסבר:** יוצר קומיט עם ההודעה שציינתם.

---

### 7. שליחת שינויים ל-GitHub (Push)
```bash
git push origin branch-name
```
**הסבר:** שולח את השינויים לענף המתאים ברפוזיטורי ב-GitHub.

---

### 8. משיכת עדכונים מהרפוזיטורי (Pull)
```bash
git pull origin branch-name
```
**הסבר:** מושך עדכונים מהענף המתאים ב-GitHub אל סביבת העבודה המקומית.

---

### 9. מיזוג ענף (Merge)
```bash
git merge branch-name
```
**הסבר:** ממזג את השינויים מענף "branch-name" אל הענף הנוכחי.

---

### 10. הצגת סטטוס השינויים
```bash
git status
```
**הסבר:** מציג אילו קבצים שונו, נוספו או ממתינים לקומיט.

---

### 11. הצגת ההיסטוריה של הקומיטים
```bash
git log
```
**הסבר:** מציג את היסטוריית הקומיטים ברפוזיטורי.

---

### 12. מחיקת ענף מקומי
```bash
git branch -d branch-name
```
**הסבר:** מוחק ענף מקומי בשם "branch-name".

---

### 13. מחיקת ענף מהשרת (GitHub)
```bash
git push origin --delete branch-name
```
**הסבר:** מוחק ענף מרחוק (מהרפוזיטורי ב-GitHub).

---

### 14. סטאש (שמירת שינויים זמנית)
```bash
git stash
```
**הסבר:** שומר זמנית את כל השינויים שלא קיימתם עליהם קומיט, ומנקה את סביבת העבודה.

---

### 15. החזרת שינויים מהסטאש
```bash
git stash pop
```
**הסבר:** מחזיר את השינויים האחרונים ששמרתם בסטאש.

---

### 16. שיחזור קובץ לגרסה האחרונה מהענף
```bash
git checkout -- path/to/file
```
**הסבר:** משחזר קובץ יחיד לגרסה האחרונה שלו בענף הנוכחי.

---

## פעולות גיבוי (Backup)

### יצירת עותק גיבוי של כל הרפוזיטורי (כולל כל היסטוריית גיט)
```bash
git clone --mirror https://github.com/OWNER/REPO.git
```
**הסבר:** יוצר עותק מלא של כל ההיסטוריה, כולל רפרנסים, ענפים ותגיות – מתאים לגיבוי.

#### לשמירת גיבוי לקובץ tar
```bash
tar -czf REPO-backup-$(date +%Y%m%d).tar.gz REPO.git
```
**הסבר:** יוצר קובץ גיבוי דחוס של הרפוזיטורי להעלאה או שמירה.

---

### שיחזור רפוזיטורי מגיבוי
```bash
git clone --mirror /path/to/REPO-backup.tar.gz
# או
tar -xzf REPO-backup.tar.gz
cd REPO.git
git clone --bare . ../REPO-restored.git
```
**הסבר:** פותח את הגיבוי ומאפשר לעבוד ממנו או להעלות מחדש ל-GitHub.

#### העלאת רפוזיטורי מגיבוי ל-GitHub
```bash
cd REPO.git
git remote set-url origin https://github.com/OWNER/NEW_REPO.git
git push --mirror
```
**הסבר:** דוחף את כל ההיסטוריה לענף חדש ב-GitHub.

---

## פקודות GitHub דרך CLI (gh)

### כניסה לחשבון GitHub
```bash
gh auth login
```
**הסבר:** כניסה עם הרשאות ל-GitHub דרך הכלי gh.

---

### יצירת Pull Request חדש
```bash
gh pr create --base main --head branch-name --title "כותרת" --body "תיאור"
```
**הסבר:** יוצר Pull Request מהענף "branch-name" אל הענף הראשי (main).

---

### מיזוג Pull Request מהיר
```bash
gh pr merge PR_NUMBER
```
**הסבר:** ממזג Pull Request לפי המספר שלו.

---

### הצגת רשימת Pull Requests פתוחים
```bash
gh pr list
```
**הסבר:** מציג את כל הפול ריקווסטים הפתוחים ברפוזיטורי.

---

### יצירת Issue חדש
```bash
gh issue create --title "כותרת" --body "תיאור"
```
**הסבר:** יוצר משימה חדשה (Issue) ברפוזיטורי.

---

### הצגת Issues פתוחים
```bash
gh issue list
```
**הסבר:** מציג את כל המשימות הפתוחות ברפוזיטורי.

---

## סיכום

הפקודות האלו מכסות את רוב הפעולות הנפוצות שדורש סוכן AI או מפתח בעבודה עם Git ו-GitHub, בכל מערכת הפעלה. יש לוודא כי הכלים git ו-gh מותקנים ומוגדרים כראוי בסביבה בה תרצו לעבוד.