================================================================================
  תוכנית יישום לפרודקשן — צד הקליינט (cards_project)
  מקבילה ל: cards-admin-web/docs/DEV_BRANCH_PROD_ROLLOUT.md (מסמך משותף, בעלים=אדמין)
  נערך: 09.08.2026 · אחראי: סוכן הקליינט
================================================================================

################################################################################
  חוקי סוכנים מחייבים (מאומצים — DEV_BRANCH_PROD_ROLLOUT.md §7)
################################################################################
  כתיבה:
  1. פרוד noqfwkxzmvpkorcaymcb: סכמה/RLS/GRANT/פונקציות DB = **בלעדית לאדמין**
     (Change Gate + אישור משתמש). הקליינט **לא מריץ DDL/DML על פרוד**.
  2. introspection על פרוד = read-only בלבד. אין כתיבת-בדיקה על פרוד.
  3. כתיבה לטבלאות משותפות — רק לפי חוזי הערכים (CHECK: source/user_type).
     ⛔ לעולם לא .select() על טבלה עם SELECT חסום (42501).
  4. Edge לפרוד = **רק האדמין פורס**. אנחנו כותבים → שולחים → הוא סוקר/פורס/מאמת.
  5. ענף הבדיקה — כתיבות מותרות; פרוד — לא.
  סדר:
  1. סכמה/חוזה לפני קוד שמשתמש בו.
  2. דיווח לפני שבירה (נקודת השקה משותפת → דיווח לפני ביצוע).
  3. rollout: P2/P3 → P5 (סכמה→UI→ניתוב) → P1 (Edge→אימות→שחרור) → P4 → מחיקת ענף.
  4. 42501 → עצירה מיידית + דיווח לפני תיקון.
  5. אימות בענף לפני פרוד — אין שחרור בלי אימות end-to-end בענף.

################################################################################
  תוספות צד-קליינט (מחייבות אותנו)
################################################################################
  C1. 🔴 **בטיחות קונפיג:** הצבעת config/environment.ts לענף הבדיקה = **test-only**.
      **חובה להחזיר ל-prod לפני כל commit / EAS build / הגשה לחנות.**
      אסור לדחוף/לשחרר גרסה שמצביעה לענף. (בדיקה חובה לפני build.)
  C2. **git:** commit רק ל-`FIX_DEV_2602` (או feature branch). `main` חסום ע"י
      hooks (pre-commit/pre-push). merge ל-main ב-PR רק לשחרור.
      remote: origin = github.com/rordan-ai/cardz_client_app.
  C3. **iOS לא ניתן לאמולציה במכונה (Windows):** אין ios/ folder + Simulator=macOS.
      אימות iOS = EAS build → TestFlight/מכשיר פיזי לפני חנות. אמולטור אנדרואיד
      (Pixel_7) זמין לבדיקה מקומית.

################################################################################
  Change-log — שינויי קוד לפרוד
################################################################################
  ✅ סטטוס: **פיתוח P1–P5 הושלם** (09.08.2026). 7 commits, נדחפו ל-FIX_DEV_2602.
     81d2e78 P2+P3 · 045c262+8394226 P5 · b6d41ec+8b9456b P1 Edge · b3c8d88 P1 client ·
     dcd6050 nul cleanup. tsc: 0 שגיאות חדשות. פרוד לא נגע.
     ⏸️ סבב אימות מרוכז (P1 happy-path + Android + NFC) — ממתין ל-Firebase test phone
     מהמשתמש. **לא משחררים/מעלים כלום עד האימות.**
  | # | משימה | קבצים | תמצית שינוי | אומת בענף | בפרוד/חנות |
  |---|-------|-------|-------------|:---------:|:----------:|
  | P2 | הצטרפות→mobile | newclient_form.tsx | insert activity_logs | 🟡 payload ✓ | ⬜ |
  | P3 | תיקון לוג ניקוב | PunchCard.tsx:244 | insert punch/mobile | 🟡 payload ✓ | ⬜ |

  צעד 0 (09.08 — אימות בענף): P2 add_customer/mobile=OK · P3 punch/mobile=OK ·
    שלילי nfc_auto→23514 · .select()→42501. Payloads נעולים.
  קוד RN נכתב (09.08): P2 = newclient_form.tsx:356 (insert הצטרפות, fire-and-forget,
    בלי .select()) · P3 = PunchCard.tsx:244 (תוקן ה-insert השבור → punch/mobile/customer,
    card_number ב-action_details, fire-and-forget).
    ✅ אישור אדמין (service_role בענף): 2 שורות mobile נחתו · מונה הצטרפות-מרחוק=2.
    ✅ Committed 81d2e78 ב-FIX_DEV_2602. ממתין: בדיקת Android runtime של הזרימה בפועל.
  | P5 | צ'קבוקס prepaid | PunchCard.tsx:117,172 · useNFCPunch.ts:80,361,392,424,547 | גידור + ref + select('*') | 🟡 pre-check ✓ | ⬜ |

  P5 (09.08, commit 045c262): גידור canDirectPunch (+!requiresApproval) · useNFCPunch
    isPrepaid&&!prepaidApprovalRef · select('*') ב-2 שאילתות businesses (graceful לפרוד).
    Pre-check RLS/תלות בענף: businesses.* כולל העמודה · punch_requests SELECT anon ✓ ·
    Edge punch-request-create(is_prepaid=true)→pending ✓. tsc: 0 שגיאות חדשות.
    ⚠️ רולאאוט פרוד: האדמין מוסיף העמודה (Change Gate) + UI טוגל לפני שחרור הגרסה.
  | P1 | Edge activity | supabase/functions/customer-activity-log + PunchCard fetchMyActivityFeed | Edge + חיבור מסך (getIdToken) | ✅ **e2e מאומת** (Edge) | ⬜ |

  P1 e2e (09.08): לכדתי Firebase token אמיתי (דף web + test number + appVerificationDisabledForTesting),
    קראתי ל-Edge בענף → HTTP 200, ok:true, phone:+972501111111 → 4 activity_logs + 2 punch_requests.
    הפיד כלל mobile (P2/P3 שלי) + web — phone matching מכסה הכל. שליליים: no/bad token→401. ✓
    נשאר device-only: זרימת UI מלאה (join) + P5 NFC routing → EAS/מכשיר.

  P1 חיבור מסך (09.08, b3c8d88): fetchMyActivityFeed קורא ל-Edge כמקור סמכותי
    (getIdToken → invoke customer-activity-log → מיפוי activity_logs). האדמין אימת:
    ניקובי-אדמין מתויגים בטלפון (100%) → phone matching מספיק, בלי card_number/user_activities.
    e2e: ממתין ל-Firebase token אמיתי (test phone / הרצת אפליקציה).

  P1 (09.08): נכתב Edge customer-activity-log (jose + securetoken JWKS, iss/aud=
    business-digital-punch-cards; חילוץ phone מה-token; נרמול הגנתי E.164/מקומי;
    קריאת activity_logs+punch_requests+voucher_logs ב-service_role; בלי פרמטר-טלפון חופשי).
    ✅ האדמין פרס בענף (ACTIVE). פורמט טלפון קנוני=מקומי 05... (הנרמול שלי נכון).
    ✅ תיקון voucher_logs: +.eq('business_code') למניעת דליפה חוצה-עסקים (8b9456b).
    ⚠️ חיבור המסך (PunchCard:1567 section 2) דורש **שדרוג שאילתת ה-Edge** — הפיד
    הנוכחי ממפה גם לפי card_number (ניקובי-אדמין) + user_activities, לא רק phone.
    נשלחה שאלת עיצוב לאדמין (איך ניקובי-אדמין מתויגים + מה אמור בפיד). אח"כ:
    שדרוג Edge (card_number matching) → חיבור המסך → e2e עם token אמיתי.

  (הרשימה המלאה + חוזי הערכים: OPEN_ITEMS_CONSOLIDATED.md)
================================================================================

################################################################################
  🧹 צ'קליסט ניקוי לאחר סבב הבדיקות (device round) — לבצע כשמסיימים!
################################################################################
  1. .env → להחזיר ל-prod מ-.env.bak.prod (כרגע מצביע לענף uydcgsjulzqzseqbnjnz).
     פקודה: cp .env.bak.prod .env
  2. Firebase test phone (פרוד) → להסיר: +972503838196 (0503838196).
     [אם נוסף test phone גם ל-0559742991 — להסיר גם אותו.]
  3. Supabase test branch → האדמין ימחק uydcgsjulzqzseqbnjnz (באישור משתמש; עוצר חיוב).
  4. Windows Defender exclusions (המשתמש הוסיף: project/.gradle/SDK) → אופציונלי להסיר,
     החלטת המשתמש (Remove-MpPreference -ExclusionPath "..." כ-admin).
  5. לוודא: אין commit של .env / .env.bak.prod (gitignored ✓).
  6. android/gradle.properties → להחזיר reactNativeArchitectures ל:
     armeabi-v7a,arm64-v8a,x86,x86_64 (צומצם ל-arm64-v8a לבדיקת device בלבד).
     (vfs.watch=false / daemon=false — תיקון Windows לגיטימי, אפשר להשאיר.)
================================================================================
