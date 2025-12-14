
# 🚀 Enhanced MCP Agent Communication System - מדריך שימוש

## ✨ תכונות חדשות בגרסה 2.0

### 🔄 **Smart Retry** - ניסיונות חוזרים חכמים
- ניסיונות חוזרים אוטומטיים עם Exponential Backoff
- עד 3 ניסיונות עם השהיות הולכות וגדלות
- התאוששות אוטומטית משגיאות רשת

### 📊 **Status Tracking** - מעקב סטטוס מתקדם
- מעקב אחר מצב כל הודעה בזמן אמת
- סטטוסים זמינים: `pending` → `sent` → `delivered` → `read` → `processing` → `completed` / `failed`

### 🎯 **Queue Management** - ניהול תור הודעות
- 3 רמות עדיפות: `high`, `normal`, `low`
- עיבוד לפי סדר עדיפות
- מעקב אחר גודל התור

### ⚡ **Event-driven Messaging** - הודעות מונעות אירועים
- האזנה אוטומטית להודעות חדשות
- התראות בזמן אמת (לסוכנים, לא למשתמש)
- ללא צורך ב-polling ידני

### ✅ **Pre-send Validation** - בדיקות אוטומטיות מחוזקות
- **בדיקה חובה לפני כל שליחת הודעה - אין אפשרות לעקוף!**
  1. **חובה: ההודעה חייבת להיות דוח מסכם** - מילים חובה: "דוח מסכם", "סיכום", "מסקנה", "הושלם"
  2. **חובה: חייב לציין שהצגת למשתמש** - מילים חובה: "הצגתי למשתמש", "דיווחתי למשתמש"
  3. **אורך מינימלי** - לפחות 20 תווים עם פרטים
  4. **איסור על מילות עתיד** - אסור: "אתחיל", "אעבוד", "אבדוק"

---

## 🛠️ כלים זמינים

### 1️⃣ `send_message` - שליחת הודעה משופרת
```javascript
mcp_AgentsCommunication_send_message({
  from: "ADMIN",
  to: "CLIENT", 
  message: "דוח מסכם: המשימה הושלמה בהצלחה. הצגתי למשתמש את התוצאות.",
  context: {
    taskId: "task_123",
    priority: "high"  // high/normal/low
  },
  priority: "high",
  skipValidation: false  // true לדלג על בדיקות אוטומטיות
})
```

**תגובה:**
```json
{
  "success": true,
  "messageId": "msg_456",
  "status": "delivered",
  "priority": "high"
}
```

### 2️⃣ `read_messages` - קריאת הודעות עם Event Listener
```javascript
mcp_AgentsCommunication_read_messages({
  agent_name: "ADMIN",
  enableEventListener: true  // הפעלת האזנה אוטומטית
})
```

**תגובה:**
```json
{
  "messages": [...],
  "eventListenerEnabled": true,
  "queueStatus": {
    "high": 2,
    "normal": 5,
    "low": 1
  }
}
```

### 3️⃣ `get_message_status` - בדיקת סטטוס הודעה
```javascript
mcp_AgentsCommunication_get_message_status({
  messageId: "msg_456"
})
```

### 4️⃣ `get_queue_status` - מצב התור
```javascript
mcp_AgentsCommunication_get_queue_status({
  agent_name: "ADMIN"
})
```

---

## 🔧 התקנה ועדכון

### שלב 1: עדכון הטבלאות ב-Supabase
```sql
-- הרץ ב-Supabase SQL Editor:
-- קובץ: supabase/migrations/20251030_enhanced_agent_communication.sql
```

### שלב 2: Reload MCP Servers
1. לחץ `Ctrl+Shift+P`
2. חפש "Reload MCP Servers"
3. בחר באפשרות

### שלב 3: בדיקת המערכת
```bash
cd shared-mcp-server
npm run test
```

---

## 📋 דוגמאות שימוש

### דוגמה 1: הודעות שייכשלו (מחוזק!)
```javascript
// ❌ הודעה שתיכשל - אין דוח מסכם
mcp_AgentsCommunication_send_message({
  from: "ADMIN",
  to: "CLIENT",
  message: "התחל לעבוד על המשימה"
})

// ❌ הודעה שתיכשל - יש דוח מסכם אבל לא הצגה למשתמש
mcp_AgentsCommunication_send_message({
  from: "ADMIN", 
  to: "CLIENT",
  message: "דוח מסכם: המשימה הושלמה"
})

// תגובה מחוזקת:
{
  "success": false,
  "blocked": true,
  "validationErrors": [
    "🚫 חובה: ההודעה חייבת להיות דוח מסכם!",
    "💡 הוסף אחד מהמילים: \"דוח מסכם\", \"סיכום\", \"מסקנה\", \"דוח סופי\", \"הושלם\"",
    "❌ דוגמה שגויה: \"התחלתי לעבוד על המשימה\"",
    "✅ דוגמה נכונה: \"דוח מסכם: המשימה הושלמה בהצלחה\"",
    "🚫 חובה: חייב לציין שהצגת למשתמש את התוצאה!",
    "💡 הוסף אחד מהמילים: \"הצגתי למשתמש\", \"דיווחתי למשתמש\", \"הסברתי למשתמש\""
  ],
  "message": "🚫 הודעה נחסמה! חובה לעמוד בדרישות הבדיקה.",
  "instructions": [
    "1️⃣ ודא שההודעה מתחילה ב'דוח מסכם:' או מכילה 'סיכום'",
    "2️⃣ ודא שההודעה מכילה 'הצגתי למשתמש' או 'דיווחתי למשתמש'",
    "3️⃣ ודא שההודעה מתארת מה שכבר בוצע (לא מה שעתיד להתבצע)",
    "4️⃣ אין אפשרות לעקוף את הבדיקות - זה חובה!"
  ]
}
```

### דוגמה 2: הודעה תקינה
```javascript
mcp_AgentsCommunication_send_message({
  from: "ADMIN", 
  to: "CLIENT",
  message: "דוח מסכם: יצרתי דוח מכירות מלא. הצגתי למשתמש את כל הנתונים והגרפים.",
  context: { taskCompleted: true }
})

// תגובה:
{
  "success": true,
  "messageId": "msg_789",
  "status": "delivered"
}
```

### דוגמה 3: ניסיון עקיפה (לא עובד יותר!)
```javascript
// ❌ ניסיון עקיפה - לא יעבוד!
mcp_AgentsCommunication_send_message({
  from: "ADMIN",
  to: "CLIENT", 
  message: "עדכון ביניים: עדיין עובד על המשימה",
  skipValidation: true  // לא עוזר - הבדיקות חובה!
})

// תגובה:
{
  "success": false,
  "blocked": true,
  "message": "🚫 הודעה נחסמה! חובה לעמוד בדרישות הבדיקה.",
  "bypassAttempt": true,  // המערכת זיהתה ניסיון עקיפה
  "validationErrors": [...],
  "instructions": [
    "1️⃣ ודא שההודעה מתחילה ב'דוח מסכם:' או מכילה 'סיכום'",
    "2️⃣ ודא שההודעה מכילה 'הצגתי למשתמש' או 'דיווחתי למשתמש'",
    "3️⃣ ודא שההודעה מתארת מה שכבר בוצע (לא מה שעתיד להתבצע)",
    "4️⃣ אין אפשרות לעקוף את הבדיקות - זה חובה!"
  ]
}
```

---

## 🎯 תרחישי שימוש נפוצים

### 1. תקשורת רגילה עם מעקב
```javascript
// שליחה
const result = await mcp_AgentsCommunication_send_message({...});
const messageId = result.messageId;

// מעקב אחר הסטטוס
const status = await mcp_AgentsCommunication_get_message_status({ messageId });
```

### 2. הודעות דחופות
```javascript
mcp_AgentsCommunication_send_message({
  from: "ADMIN",
  to: "CLIENT",
  message: "דוח מסכם דחוף: שגיאה קריטית זוהתה. הצגתי למשתמש הודעת שגיאה.",
  priority: "high",
  context: { urgent: true }
})
```

### 3. האזנה אוטומטית
```javascript
// הפעלת האזנה פעם אחת
mcp_AgentsCommunication_read_messages({
  agent_name: "ADMIN",
  enableEventListener: true
});

// מעתה הסוכן יקבל התראות אוטומטיות על הודעות חדשות
```

---

## 🚨 **הוראות חובה לסוכנים - קרא בעיון!**

### 📋 **רשימת בדיקה לפני כל הודעה:**
```
☐ האם סיימתי את כל המשימה? (לא רק התחלתי)
☐ האם ההודעה מתחילה ב"דוח מסכם:" או מכילה "סיכום"?
☐ האם ההודעה מכילה "הצגתי למשתמש" או "דיווחתי למשתמש"?
☐ האם ההודעה מתארת מה שכבר בוצע (לא מה שאעשה)?
☐ האם ההודעה ארוכה מ-20 תווים עם פרטים?
```

### ✅ **מילים שחובה להשתמש בהן:**
- **לדוח מסכם:** "דוח מסכם", "סיכום", "מסקנה", "דוח סופי", "הושלם", "בוצע"
- **להצגה למשתמש:** "הצגתי למשתמש", "דיווחתי למשתמש", "הסברתי למשתמש", "הראיתי למשתמש"

### ❌ **מילים אסורות (יגרמו לכישלון):**
- "אתחיל", "אתחל", "אעבוד", "אבדוק", "אנסה" - אלה מילות עתיד!

### 🔒 **חשוב לדעת:**
- **אין אפשרות לעקוף את הבדיקות** - גם עם `skipValidation: true`
- **כל ניסיון עקיפה נרשם ומדווח**
- **הודעות שלא עוברות בדיקה נחסמות לחלוטין**

## ⚠️ הערות חשובות

1. **בדיקות אוטומטיות מחוזקות** - אין אפשרות לעקוף, חובה לעמוד בדרישות
2. **Event Listener** - מופעל אוטומטית ומספק התראות בזמן אמת לסוכנים
3. **Smart Retry** - כל פעולה מנסה שוב אוטומטית במקרה של כישלון
4. **Queue Management** - הודעות מעובדות לפי עדיפות
5. **Status Tracking** - מעקב מלא אחר מצב כל הודעה
6. **Bypass Monitoring** - כל ניסיון עקיפה נרשם ומדווח למשתמש

---

## 🔍 פתרון בעיות

### בעיה: הודעה נכשלת בבדיקות
**פתרון:** וודא שההודעה כוללת "דוח מסכם" ו"הצגתי למשתמש"

### בעיה: Event Listener לא עובד  
**פתרון:** וודא ש-`enableEventListener: true` ושהטבלאות עודכנו

### בעיה: הודעות לא מגיעות
**פתרון:** בדוק `get_queue_status` ו-`get_message_status`

---

## 🧯 פרוטוקול חירום: טרמינל תקוע (Cursor + Windows)

> מטרה: לשחרר טרמינל **בלי לסכן גיבוי/קומיטים** ובלי להשאיר ריפו במצב נעול.

### 1) זיהוי מה נתקע (הכי נפוץ)
- **Pager פתוח (`less`)**: אם הרצת `git log`/`git diff`/`git show` ונפתח מסך גלילה
  - **פתרון**: לחץ `q`
- **עורך נפתח ב-`git commit`** (vim/nano/notepad)
  - **vim**: `Esc` ואז `:q!` ואז Enter
  - **nano**: `Ctrl+X` (ואם שואל לשמור → `N`)
- **ננעל אינדקס (`.git/index.lock`)** בעקבות Git שנקטע
- **פקודה “כבדה” שנתקעה** (למשל `grep -R` על תיקיות גדולות)

### 2) פעולות מיידיות בטוחות (לא הורסות גיט)
1. **עצור את מה שרץ**:
   - בטרמינל: `Ctrl+C` (פעמיים אם צריך)
2. **אל תמשיך להריץ פקודות ארוכות באותו טרמינל**.
3. ב־Cursor:
   - `Terminal: Kill All Terminals`
   - `Terminal: Create New Terminal`
4. **בחר PowerShell כ-Default** (כדי להימנע מבאגים של Git Bash/MSYS):
   - `Terminal: Select Default Profile` → **PowerShell**

### 3) אימות שהריפו לא “בסכנה” אחרי תקיעה
ב־PowerShell בתוך תיקיית הפרויקט:
```powershell
cd C:\cardz_curser\cards_project
git status
```
- אם רואים `nothing to commit, working tree clean` → מצוין.
- אם יש שינויים לא מתוכננים ב־`.cursor/rules/*` (או כל קובץ אחר) → **לא לקמטל מיד**; קודם לבדוק `git diff` ולהחזיר עם `git restore -- <file>` אם זה זבל.

### 4) טיפול בנעילת Git (index.lock) בצורה בטוחה
> עושים זאת **רק** אם אין תהליך Git פעיל.

ב־PowerShell:
```powershell
cd C:\cardz_curser\cards_project
Get-ChildItem .git\index.lock -ErrorAction SilentlyContinue
```
אם הקובץ קיים:
1. ודא שאין תהליך Git פעיל:
```powershell
Get-Process git -ErrorAction SilentlyContinue
```
2. אם אין תהליך Git:
```powershell
Remove-Item .git\index.lock -Force
git status
```

### 5) מניעה (כדי שלא ייתקע שוב)
- **לא להריץ פקודות “כבדות”** על `C:\Users\<user>\.cursor\...` או תיקיות ענק (לוגים/History) מתוך טרמינל משולב.
- **להעדיף PowerShell** לפקודות ניהול תהליכים (Kill/Stop) במקום Git Bash.
- **להימנע מ־`git commit` שפותח עורך**:
  - תמיד להשתמש ב־`git commit -m "message"` (ולא להשאיר את העורך להיפתח).
- **לבטל pager של Git** כדי למנוע `less`:
```powershell
git config --global core.pager cat
git config --global pager.branch false
git config --global pager.log false
```
- **אם מופיע טקסט כמו `[200~` לפני פקודה**: זה סימן לבעיה בהדבקה/terminal mode.
  - פתרון מהיר: לסגור את כל הטרמינלים ב־Cursor (`Kill All Terminals`) ולפתוח מחדש **PowerShell**.

---

## 📞 תמיכה

המערכת כוללת לוגים מפורטים ומעקב שגיאות. בדוק את הקונסול לפרטים נוספים על כל פעולה.
