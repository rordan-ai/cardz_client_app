# מנגנון האזנה אוטומטי לאדמין

## מה זה עושה?
מנגנון זה מאפשר תקשורת אוטומטית עם סוכן האדמין במקרים הבאים:
1. כשיש בנייה חדשה (build)
2. כשיש שינויי קוד משמעותיים
3. כשהמשתמש כותב ! (סימן קריאה) בהודעה

## איך זה עובד?

### 1. MCP AgentsCommunication
הוגדר ב-`.cursor/mcp.json`:
```json
{
  "AgentsCommunication": {
    "command": "node",
    "args": ["shared-mcp-server/agents-comm.js"]
  }
}
```

### 2. שליחת הודעות לאדמין
```typescript
// מתוך הקוד:
await mcp_AgentsCommunication_send_message({
  from: "CLIENT",
  to: "ADMIN",
  message: "תוכן ההודעה",
  context: { /* מידע נוסף */ }
});
```

### 3. קריאת הודעות מהאדמין
```typescript
const messages = await mcp_AgentsCommunication_read_messages({
  agent_name: "CLIENT"
});
```

## דוגמאות שימוש

### בעת בנייה:
```
🔨 Build completed
Context: {
  type: "build",
  timestamp: "2025-10-26T12:00:00Z"
}
```

### בעת שינוי קוד:
```
📝 Code changes detected: 3 files
Context: {
  type: "code_change",
  files: ["app/(tabs)/PunchCard.tsx", "components/FCMService.ts"]
}
```

### כשהמשתמש כותב !:
```
⚠️ User alert: [תוכן ההודעה]
Context: {
  type: "user_alert",
  urgent: true
}
```

## הפעלה ידנית (אופציונלי)
```bash
node .cursor/auto-notify-admin.js
```

## הערות
- המנגנון משתמש ב-MCP server שרץ ברקע
- ההודעות נשמרות ב-shared-mcp-server
- האדמין יכול לקרוא את ההודעות בכל עת

