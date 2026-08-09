================================================================================
  רשימת טיפול מושלמת — נושאים פתוחים (צד הקליינט, cards_project)
  נערך: 09.08.2026 · אחראי ביצוע: סוכן הקליינט (פיתוח/תיקונים)
  מקורות: בדיקת קוד + חנויות + handoff מסוכן האדמין + תשובות ל-5 שאלות
  הפניה מלאה מהאדמין: docs/CLIENT_HANDOFF_20260728.md (בריפו האדמין)
================================================================================

################################################################################
  ⚠️ קונטקסט קריטי משותף — לקרוא לפני כל משימה שנוגעת ל-DB
################################################################################

  - Supabase prod משותף: noqfwkxzmvpkorcaymcb
  - הזדהות: Firebase. גישה ל-DB עם anon key **בלי JWT**.
  - מ-27/05/2026 RLS דולק: SELECT של anon על טבלאות מוקשחות מחזיר
    **0 שורות בשקט** (בלי שגיאה).
  - 🚀 דיפלוי Edge: **האדמין פורס**. אנחנו כותבים → שולחים → הוא סוקר, פורס, מאמת.
  - 🧪 **סביבת פיתוח מבודדת (החלטת המשתמש):** כל הפיתוח/בדיקות ב-**ענף Supabase
    preview** נפרד מהפרוד, שהאדמין מקים + זורע בו נתוני דמו סינתטיים (לא לקוחות
    אמיתיים). **אסור להצביע/לגעת בפרוד.** ממתינים ל-URL+anon key של הענף מהאדמין,
    ואז בונים גרסת בדיקה של ה-RN שמצביעה לענף. P1/P2/P3/P5 נבדקים שם end-to-end.

  ⛔ מלכודת-על (חלה על נושאים ב', ג' וכל INSERT ל-activity_logs):
     אסור לשרשר `.select()` ל-INSERT על טבלה עם SELECT חסום.
     כל הפעולה נכשלת אטומית (שגיאה 42501) ושום דבר לא נכתב — בשקט.
     זו הסיבה שאבדו לוגי ניקוב 7.5 שבועות. INSERT בלבד, ללא .select().

  🛑 פרוטוקול 42501 (נושא ד'): לא לתקן הרשאות DB לבד — קודם דיווח לאדמין.

################################################################################
  0. חוזה השקה משותף — 🔒 נעול (מקור אמת: cards-admin-web/docs/SHARED_SUPABASE_INTEGRATION.md §5)
################################################################################

  SELECT ל-anon:
    פתוח: PunchCards, customers, products, businesses, punch_requests,
          voucher_logs, voucher_types, inbox, referrals.
    חסום (מחזיר 0 בשקט): activity_logs, push_messages/deliveries/events,
          device_tokens, referral_events, voucher_links.
  INSERT ל-anon פתוח: activity_logs, punch_requests, voucher_logs, PunchCards,
          customers, inbox, referrals, voucher_types.  ⛔ תמיד בלי .select()!

  punch_requests: status pending→approved/rejected/completed/timeout ·
          is_prepaid bool (default false) · ב-Realtime publication (anon מקבל UPDATE).
  activity_logs עמודות: id, business_code, user_id, user_type, action_type,
     action_details(jsonb), target_entity, source, ip_address, user_agent, timestamp, created_at.
     NOT NULL: business_code/user_type/action_type. ⚠️ **אין** עמודות
     card_number/customer_phone/action/details — מזהים נכנסים ל-action_details(jsonb)
     או ל-user_id/target_entity! מסוננים בתצוגה: punch_added/removed/used/unuse ·
     source נמדד למונה רק ל-add_customer (mobile/web). ⚠️ **CHECK constraint על source** —
     ערכים חוקיים בלבד: manual/barcode/nfc/auto/api/web/mobile ('nfc_auto' → 23514 check_violation!).
     CHECK על user_type: customer/business_user/system. action_type: ללא CHECK.
  Edge: כולם verify_jwt=false (כולל customer-activity-log — האימות כולו עלינו: Firebase ידני).
  ⚠️ טריגר trg_sync_total_punches: כל UPDATE ל-PunchCards דורס total_punches
     מ-max_punches. prepaid בבעלות האדמין בלבד.
  FCM data payload (יציב): { from, screen:'/(tabs)/PunchCard', voucher_id?, image_url? }.
  app_config.minimum_version: בבעלות הקליינט בלבד (האדמין לא נוגע).

  מטריצת יוזמה/ביצוע (מאושר ומאומת בקוד):
    • ניקוב ישיר (prepaid+auto): הלקוח יוזם + מבצע.
    • בקשה→אישור: הלקוח יוזם, האדמין מבצע.
    • ניקוב יזום-אדמין (קופאי, nfcPunchService): האדמין יוזם + מבצע → used_punches
      ישירות + activity_logs source:'nfc'. הלקוח רואה דרך Realtime על PunchCards.

################################################################################
  1. רשימת ביצוע מדורגת
################################################################################

  ✅ סדר ביצוע מאושר (תואם עם האדמין): P2 → P3 → P1 → P4 → P5
     (קודם P2/P3 — מהירים, בלי Edge, מזינים מיד את דשבורד האדמין; ואז P1
      Edge חדש; ואז P4 חקירה; ולבסוף P5 הצ'קבוקס.)

--------------------------------------------------------------------------------
  🔴 P1 — נושא א' — לוג "הפעילות שלי" של הלקוח ריק (מאז 27/05)
  מקור: אדמין · סטטוס: פתוח, מוכן לביצוע
--------------------------------------------------------------------------------
  תסמין: מסך "הפעילות שלי" באפליקציה ריק.
  שורש: קריאת anon ישירה ל-activity_logs מוחזרת 0 ע"י RLS. הנתונים קיימים,
        נקראים רק דרך Edge (service_role).

  לביצוע — Edge function חדש `customer-activity-log`:
    1. מקבל Firebase ID token.
    2. ✅ אימות token מאפס (אין דפוס קיים להעתיק — admin-activity-logs לא
       מאמת קורא בכלל, לכן אסור לנו — enumeration):
       - לאמת מול המפתחות הציבוריים של Google securetoken.
       - projectId = **business-digital-punch-cards** (מחרוזת, לא המספר!).
       - לבדוק iss = https://securetoken.google.com/business-digital-punch-cards
       - לבדוק aud = business-digital-punch-cards , exp תקף.
       - לחלץ phone_number **מה-token המאומת** → זה פילטר השאילתה
         (לא פרמטר חופשי מה-body).
    3. שולף כמו mode by_phone לפי התבנית:
       supabase/functions/admin-activity-logs/index.ts
       מקורות: activity_logs (user_id/target_entity=phone; למעט
       punch_added/removed/used/unuse), punch_requests,
       voucher_logs (customer_phone).
    4. reconstructed=true → להציג בכתום.
    5. צד הקליינט: להחליף את הקריאה הישירה במסך הפעילות בקריאה ל-Edge.
    → כשמוכן: לשלוח את קוד ה-Edge לאדמין לפריסה.

--------------------------------------------------------------------------------
  🔴 P2 — נושא ב' — הצטרפות-מרחוק לא נרשמת (BUG-02)
  מקור: אדמין · סטטוס: פתוח, מוכן לביצוע
--------------------------------------------------------------------------------
  תסמין: "הצטרפות מרחוק" בדשבורד = 0 תמיד. הקליינט לא רשם source='mobile'.

  לביצוע: אחרי הצטרפות מוצלחת → `insert` ל-activity_logs (⛔ בלי .select()):
    - business_code            (NOT NULL)
    - user_type: 'customer'    (NOT NULL)
    - action_type: 'add_customer'  (NOT NULL)
    - source: 'mobile'         ← למונה בדשבורד
    - user_id = customer_phone · target_entity = customer_phone  ← ל-לוג הלקוח
    - action_details: { customer_phone, customer_name, product_code, product_name }

--------------------------------------------------------------------------------
  🟡 P3 — נושא ג' — אימות רישום לוגי ניקוב מהקליינט
  מקור: אדמין · סטטוס: פתוח (אימות; אולי גם תיקון)
--------------------------------------------------------------------------------
  לוודא שכל מסלולי הניקוב רושמים ל-activity_logs (⛔ בלי .select()) עם:
    - action_type: 'punch' או 'nfc_punch'
      ⚠️ **לא** punch_added/removed/used/unuse (מסוננים כ-duplicates טריגר).
    - source: 'mobile' , user_id/target_entity = טלפון.
  ✅ נעילת source: source **מוגבל ב-CHECK** ל-{manual,barcode,nfc,auto,api,web,mobile}
    — **'nfc_auto' לא חוקי (23514)**. למונה: נמדד רק ל-add_customer ('mobile'→מרחוק ·
    אחר→web · ActivityLogModal:79). ⇒ הניקוב-הישיר **חייב** לעבור ל-source:'mobile'
    (גם בגלל העמודות השגויות וגם בגלל ה-CHECK). (תיקון לאמירה קודמת: source אינו חופשי.)
  🐞 **ממצא — PunchCard.tsx:244:** ה-insert הנפרד הזה (עמודות שגויות customer_phone/
    action/details + חוסר user_type + source='nfc_auto' פסול ב-CHECK) **נכשל בשקט**.
    ✅ **תמונת פרוד מדויקת (מאושר):** 10,678 רשומות punch/**web** = ניקובי-**אדמין**
    (קופאי, CustomerManagement.tsx:790, user_type:'business_user'). **אין טריגר**
    שכותב לוג ניקוב (רק trg_sync_total_punches לסנכרון total). ⇒ **ניקוב-ישיר-לקוח
    (prepaid+auto) לא מייצר שום רשומת לוג היום** (0 רשומות; הכרטיסייה מתקדמת בלי לוג).
    → P3 מוסיף את **הרשומה היחידה** — אין כפילות.
    🔑 **כלל למניעת כפילות (מאושר):** רושמים punch/mobile **רק** לניקוב-ישיר-לקוח
    שאנחנו מבצעים; לניקוב דרך בקשה→אישור **לא רושמים כלום** (האדמין רושם web/nfc).
    תיקון ב-P3 (בענף) — נעול ומאושר: {business_code, user_type:'customer',
    action_type:'punch', source:'mobile', user_id=phone, target_entity=phone,
    action_details:{ card_number, punches:'X/Y' }} — ⛔ בלי .select().
    ⚠️ action_type='punch' דווקא (לא 'nfc_punch' — שמור לניקובי-אדמין nfc_punch/nfc).
    חלוקה נקייה: ניקוב-ישיר-לקוח=punch/mobile · ניקוב-אדמין=nfc_punch/nfc.

--------------------------------------------------------------------------------
  🟠 P4 — נושא ד' — CHG-11: אימות גרסאות-עבר מול פונקציות DB נעולות
  מקור: אדמין · סטטוס: פתוח (חקירה, report-first) · הרשימה המלאה התקבלה
--------------------------------------------------------------------------------
  11 פונקציות ש-EXECUTE ל-anon ננעל עליהן — להריץ `git log --all -S"<fn>"`:
    get_businesses, get_customers, get_invoices, get_user_activities,
    get_products, get_inactive_customers, get_business_stats,
    get_business_name, hard_delete_gc, cleanup_old_punch_requests,
    check_nfc_string_exists
  בטוחות (לא ננעלו): customer_self_delete, verification_store_tokens,
    verification_verify_token, get_current_user_business_code.
  אם גרסה ישנה נפוצה בשטח קראה לאחת הנעולות → 42501 →
  🛑 דיווח מיידי לאדמין (שחזור GRANT נקודתי מוכן, פקודה אחת). לא לתקן לבד.
  ✅ **תוצאה (09.08.2026): נקי.** git log --all -S על כל 11 + חיפוש rpc בהיסטוריה:
     9 פונקציות = 0 אזכורים; 2 (check_nfc_string_exists, cleanup_old_punch_requests)
     רק ב-docs/schema, **0 קריאות rpc מקוד אי-פעם**. הקוד קורא רק ל-customer_self_delete
     (בטוחה). → אין 42501, אין צורך בשחזור GRANT. P4 הושלם.

--------------------------------------------------------------------------------
  🔵 P5 — A1 — צ'קבוקס לעקיפת ניקוב-ישיר ב-prepaid+auto
  מקור: משתמש (פיצ'ר חדש) · סטטוס: פתוח · ✅ לא חסום (האדמין אישר היתכנות)
--------------------------------------------------------------------------------
  אפיון: צ'קבוקס שכשמסומן — עוקף את (prepaid=כן וגם punch_mode=auto), כך
         שההתנהגות מנותבת כאילו prepaid=לא, punch_mode=auto (בקשת ניקוב לאדמין
         + "ממתין לאישור") במקום ניקוב ישיר.

  ✅ אישור היתכנות מהאדמין (סופי):
     - Edge `punch-request-create` **קיים ופרוס** (ACTIVE v5, service_role,
       verify_jwt=false). בקשות הניקוב היום תקינות — אין באג. (ה-discrepantcy
       היה source-drift בריפו האדמין בלבד, לא משפיע עלינו.)
       התנהגות: מוודא בעלות כרטיסייה+active → INSERT ל-punch_requests pending
       כולל is_prepaid.
     - זרימת האישור (PunchRequestsListener) = **סטטוס בלבד** — אגנוסטית ל-prepaid,
       לא תישבר. לנתב prepaid+auto לאישור: ליצור punch_requests עם is_prepaid=true
       (ה-UI באדמין כבר מציג ומאשר).
     - Edge `punch-card-renew` פרוס — מחדש **רק כרטיסייה מלאה** (used≥total),
       מאפס used_punches, renewal_count++, ו**כופה prepaid='לא'** בחידוש.
       → prepaid כבר נתמך גם בבקשה וגם בחידוש.
     - 🔑 **הניקוב עצמו (increment used_punches) מיושם תמיד ע"י האדמין** בזרימת
       האישור (אושר ע"י המשתמש). הקליינט רק מנוי ל-Realtime ומשקף 'completed'
       (useNFCPunch.ts:293 — על approved מציג 'punching', על completed קורא
       ומציג הצלחה/card_full; אינו מבצע increment).
       → P5 בצד הקליינט = **ניתוב בלבד**: אין צורך בלוגיקת ניקוב חדשה אצלנו.

  נקודות קוד (חובה לגדר את שתיהן):
    - app/(tabs)/PunchCard.tsx:172 — canDirectPunch: `&& !checkbox`.
    - hooks/useNFCPunch.ts:547 — 🔴 קריטי: `if (isPrepaid && !checkbox)` אחרת
      המודאל ינקב prepaid ישירות והפיצ'ר לא יעבוד.
    - עמודה (מאושר, האדמין מוסיף): `prepaid_requires_approval` boolean NOT NULL
      default false על `businesses` (רמת-עסק). ה-UI (טוגל ב-BusinessSettings) =
      באחריות האדמין. אנחנו: לשלוף אותה ב-[code].tsx:48, identifyBusinessByNFC:361,
      ובשליפת ה-business ב-PunchCard (להוסיף לעמודות ה-.select).
    - ה-response handler הקיים (useNFCPunch.ts:293) כבר משקף 'completed' —
      זהה ל-non-prepaid; אין קוד ניקוב חדש. רק לוודא שהכרטיסייה מוצגת נכון.

  סיכונים: ברירת מחדל=false · 2 נקודות אכיפה (canDirectPunch + isPrepaid) לגדר
     בשתיהן · גרסאות ישנות יתעלמו מהצ'קבוקס (תקף ממהדורה חדשה).

################################################################################
  2. Play Console — משימות תפעול (לטיפול היום)
################################################################################
  (פירוט מלא: TODO_PLAY_CONSOLE.md)
  C1. אימות אפליקציות למפתחי Android — ⏰ דדליין 30.09.2026. פתוח.
  C2. קישור עומק (App Link) לא מאומת — דומיין לא משויך. פתוח.

################################################################################
  3. סגור / נדחה — לקונטקסט (לא לטיפול)
################################################################################
  - gutale-caffe-453919 (Google Cloud) — נמחק (pending deletion 30 יום).
  - "איחוד UI כרטיסייה ידני↔NFC" — אושר כאפיון מכוון, לא באג. נסגר.
  - פיגור iOS — לא קיים. שתי החנויות חיות 1.0.5 (03/03): Android(25)+iOS(28).
  - נושא ה' (אדמין, WebView/voucher_links) — נסגר. לא לנסות שוב הקשחת
    voucher_links (anon נשאר פתוח — החלטת משתמש).
  - נושא ו' (אדמין, הקשחת policies) — נדחה. לא לנעול voucher_types/inbox/referrals.

################################################################################
  פרוטוקול חזרה לאדמין: סטטוס בכתב לכל נושא (בוצע / ממצאים / חוסמים) + עדכון.
################################################################################
