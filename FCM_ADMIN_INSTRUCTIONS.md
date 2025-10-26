# הנחיות לאדמין - עדכון מערכת Push Notifications

## סקירה
המערכת עודכנה כך ש-Push Notifications יעבדו **ללא תלות במספר טלפון**. המכשיר יקבל הודעות גם כשהאפליקציה סגורה וגם כשאין משתמש מחובר.

## שינויים שבוצעו בצד הקליינט:
1. **FCMService חדש** - מנהל את כל נושא ה-FCM באופן מרכזי
2. **רישום אוטומטי** - המכשיר נרשם מיד עם הפעלת האפליקציה
3. **הסרת תלות בטלפון** - הרישום לא תלוי יותר במספר טלפון

## שינויים נדרשים ב-Supabase:

### 1. עדכון טבלת device_tokens
```sql
-- הוספת עמודה חדשה device_id (אם לא קיימת)
ALTER TABLE device_tokens 
ADD COLUMN IF NOT EXISTS device_id TEXT UNIQUE;

-- הוספת עמודה למערך business_codes
ALTER TABLE device_tokens 
ADD COLUMN IF NOT EXISTS business_codes TEXT[] DEFAULT '{}';

-- הסרת החובה ממספר טלפון (אם רלוונטי)
ALTER TABLE device_tokens 
ALTER COLUMN phone_number DROP NOT NULL;

-- יצירת אינדקס על device_id
CREATE INDEX IF NOT EXISTS idx_device_tokens_device_id 
ON device_tokens(device_id);

-- יצירת אינדקס על business_codes
CREATE INDEX IF NOT EXISTS idx_device_tokens_business_codes 
ON device_tokens USING GIN(business_codes);
```

### 2. יצירת/עדכון Edge Functions:

#### א. עדכון `register-device-token`:
```typescript
// Edge Function: register-device-token
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { device_id, token, platform, environment } = await req.json()
    
    if (!device_id || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Upsert device token
    const { error } = await supabase
      .from('device_tokens')
      .upsert({
        device_id,
        token,
        platform,
        environment,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

#### ב. יצירת `add-business-to-device` חדש:
```typescript
// Edge Function: add-business-to-device
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { device_id, business_code } = await req.json()
    
    if (!device_id || !business_code) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // הוספת business_code למערך (אם לא קיים)
    const { error } = await supabase.rpc('add_business_to_device', {
      p_device_id: device_id,
      p_business_code: business_code
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

### 3. יצירת Database Function:
```sql
-- פונקציה להוספת business_code למכשיר
CREATE OR REPLACE FUNCTION add_business_to_device(
  p_device_id TEXT,
  p_business_code TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE device_tokens 
  SET business_codes = array_append(
    COALESCE(business_codes, '{}'), 
    p_business_code
  )
  WHERE device_id = p_device_id 
  AND NOT (p_business_code = ANY(COALESCE(business_codes, '{}')));
  
  -- אם לא נמצא המכשיר, זרוק שגיאה
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 4. עדכון לוגיקת שליחת Push:
כשהאדמין שולח push notification לעסק מסוים:

```sql
-- מציאת כל המכשירים הרשומים לעסק
SELECT DISTINCT token 
FROM device_tokens 
WHERE business_code = ANY(business_codes)
AND environment = 'prod';
```

### 5. הסרת business_code ממכשיר (אופציונלי):
```sql
CREATE OR REPLACE FUNCTION remove_business_from_device(
  p_device_id TEXT,
  p_business_code TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE device_tokens 
  SET business_codes = array_remove(business_codes, p_business_code)
  WHERE device_id = p_device_id;
END;
$$ LANGUAGE plpgsql;
```

## יתרונות הארכיטקטורה החדשה:
1. **קבלת הודעות תמיד** - גם כשהאפליקציה סגורה
2. **ללא תלות במספר טלפון** - המכשיר מקבל הודעות גם ללא התחברות
3. **תמיכה במספר עסקים** - מכשיר אחד יכול לקבל הודעות ממספר עסקים
4. **ניהול פשוט יותר** - הפרדה ברורה בין device token למשתמש

## בדיקות מומלצות:
1. התקנת האפליקציה במכשיר חדש
2. וידוא שה-device נרשם אוטומטית
3. כניסה לעסק מסוים ווידוא שהעסק נוסף למכשיר
4. שליחת הודעת בדיקה מהאדמין
5. וידוא קבלת ההודעה גם כשהאפליקציה סגורה

## הערות חשובות:
- השינוי תואם לאחור - מכשירים ישנים ימשיכו לעבוד
- מומלץ לבצע את השינויים בסביבת בדיקה תחילה
- יש לגבות את הטבלה לפני השינויים
