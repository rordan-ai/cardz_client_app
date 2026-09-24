import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../components/supabaseClient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// מפתח לשמירת מספר טלפון
const BIOMETRIC_PHONE_KEY = 'biometric_phone';

// Timeout לאישור אדמין (5 דקות) — מיושר לטיים-אאוט של צד האדמין. אם יהיה קצר מזה,
// אישור-מאוחר (בדק' 2-4) "נופל בשקט": הבקשה אושרה אך הלקוח כבר הפסיק להאזין ולא ננקב.
const ADMIN_APPROVAL_TIMEOUT = 300000;

// מצבי הפלואו
export type PunchFlowState = 
  | 'idle'
  | 'identifying'      // זיהוי לקוח
  | 'selecting_card'   // בחירת כרטיסייה
  | 'card_full'        // כרטיסייה מלאה - שאלה לפתיחת חדשה
  | 'waiting_approval' // ממתין לאישור אדמין
  | 'punching'         // מבצע ניקוב
  // 'rewarding_punch' הוסר - במקום זה משתמשים ב-'card_full' לניקוב מזכה
  | 'success'
  | 'error'
  | 'timeout';

export interface CustomerCard {
  card_number: string;
  product_code: string;
  product_name: string;
  used_punches: number;
  total_punches: number;
  prepaid: string;
  benefit: string;
  status: string;
}

export interface PunchRequest {
  id: string;
  business_code: string;
  customer_phone: string;
  card_number: string;
  product_name: string;
  is_prepaid: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'timeout';
}

interface UseNFCPunchReturn {
  flowState: PunchFlowState;
  customerPhone: string | null;
  customerCards: CustomerCard[];
  selectedCard: CustomerCard | null;
  currentBusinessCode: string | null;
  currentBusinessName: string | null;
  currentPunchMode: string | null;
  error: string | null;
  
  // פעולות
  startPunchFlow: (nfcString: string, customerPhone?: string, preSelectedCardNumber?: string, businessCode?: string) => Promise<void>;
  identifyWithBiometric: () => Promise<boolean>;
  identifyWithPhone: (phone: string) => Promise<boolean>;
  selectCard: (card: CustomerCard) => void;
  cancelFlow: () => void;
  resetFlow: () => void;
}

export const useNFCPunch = (): UseNFCPunchReturn => {
  const [flowState, setFlowState] = useState<PunchFlowState>('idle');
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<CustomerCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentBusinessCode, setCurrentBusinessCode] = useState<string | null>(null);
  const [currentBusinessName, setCurrentBusinessName] = useState<string | null>(null);
  const [currentPunchMode, setCurrentPunchMode] = useState<string | null>(null);
  const [punchRequestId, setPunchRequestId] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ref שמשקף את punchRequestId — לגישה יציבה מ-cancelFlow (בלי stale closure).
  const punchRequestIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const punchLockRef = useRef(false);
  const punchModeRef = useRef<string | null>(null);
  const prepaidApprovalRef = useRef<boolean>(false); // P5: צ'קבוקס prepaid_requires_approval ברמת-עסק

  // ניקוי
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, []);

  // איפוס
  const resetFlow = useCallback(() => {
    cleanup();
    setFlowState('idle');
    setCustomerPhone(null);
    setCustomerCards([]);
    setSelectedCard(null);
    setError(null);
    setCurrentBusinessCode(null);
    setCurrentBusinessName(null);
    setCurrentPunchMode(null);
    setPunchRequestId(null);
    punchRequestIdRef.current = null;
    punchLockRef.current = false;
    punchModeRef.current = null;
  }, [cleanup]);

  // ביטול
  const cancelFlow = useCallback(() => {
    console.log('[NFC] Flow cancelled');
    // ביטול ע"י לקוח → סימון הבקשה כ-rejected כדי שתיעלם מתור-האישורים של האדמין.
    // best-effort fire-and-forget, ⛔ בלי .select() (אם anon UPDATE חסום ב-RLS → no-op שקט,
    // בלי 42501; הבקשה תיפוג בכל מקרה ב-timeout). ממתין לאישור האדמין על מנגנון ה-UPDATE.
    const rid = punchRequestIdRef.current;
    if (rid) {
      supabase
        .from('punch_requests')
        .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: 'auto' })
        .eq('id', rid)
        .then(({ error }) => {
          if (error) console.log('[NFC] cancel status update failed (RLS?):', error.code, error.message);
        });
    }
    resetFlow();
  }, [resetFlow]);

  // זיהוי ביומטרי
  const identifyWithBiometric = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[NFC] Biometric result: attempting');
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'אמת את זהותך',
        cancelLabel: 'ביטול',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        if (savedPhone) {
          console.log('[NFC] Biometric result: success');
          setCustomerPhone(savedPhone);
          return true;
        }
      }
      
      console.log('[NFC] Biometric result: failed');
      return false;
    } catch (err) {
      console.log('[NFC] Error:', 'biometric', err);
      return false;
    }
  }, []);

  // זיהוי עם מספר טלפון
  const identifyWithPhone = useCallback(async (phone: string): Promise<boolean> => {
    if (!phone || !phone.match(/^05\d{8}$/)) {
      setError('מספר טלפון לא תקין');
      return false;
    }
    setCustomerPhone(phone);
    // השמירה כזהות המכשיר עברה ל-continueFlowWithPhone, אחרי שנמצאה כרטיסייה —
    // כאן המספר עדיין לא אומת, ושמירתו הנציחה טעויות הקלדה
    return true;
  }, []);

  // שליפת כרטיסיות לקוח
  const fetchCustomerCards = useCallback(async (phone: string, businessCode: string): Promise<CustomerCard[]> => {
    try {
      // וריאנטים זהים לשאר המסלול (PunchCard, business/[code], _layout): לקוחות שהוקמו
      // מהאדמין נשמרים לעיתים בפורמט 972. זו הייתה השאילתה היחידה עם התאמה מדויקת,
      // ולכן לקוח כזה ראה את הכרטיסייה שלו וקיבל "אין לך כרטיסייה פעילה בעסק זה".
      // ⚠️ הווריאנטים רק לחיפוש — הטלפון בפורמט 05 ממשיך לכל הכתיבות שאחריו
      // (זהות המכשיר מחייבת 05; ה-Edge של בקשת הניקוב מנרמל ומשווה בעצמו).
      const clean = phone.replace(/[^0-9]/g, '');
      const variants = Array.from(new Set([
        clean,
        /^05\d{8}$/.test(clean) ? `972${clean.slice(1)}` : clean,
        /^9725\d{8}$/.test(clean) ? `0${clean.slice(3)}` : clean,
      ].filter(Boolean)));
      const { data, error } = await supabase
        .from('PunchCards')
        .select('card_number, product_code, used_punches, total_punches, prepaid, benefit, status')
        .in('customer_phone', variants)
        .eq('business_code', businessCode)
        .eq('status', 'active');

      if (error) throw error;
      
      // הוספת product_name מה-benefit או product_code
      return (data || []).map(card => ({
        ...card,
        product_name: card.benefit || card.product_code || 'מוצר'
      }));
    } catch (err) {
      console.log('[NFC] Error:', 'fetchCards', err);
      return [];
    }
  }, []);

  // בחירת כרטיסייה
  const selectCard = useCallback((card: CustomerCard) => {
    setSelectedCard(card);
  }, []);

  // שליחת בקשת ניקוב
  const sendPunchRequest = useCallback(async (
    businessCode: string,
    phone: string,
    card: CustomerCard,
    productName: string,
    customerName?: string
  ): Promise<string | null> => {
    try {
      const isRewardPunch = (card.used_punches + 1) >= card.total_punches;
      
      // שימוש ב-Edge Function כדי לעקוף בעיות RLS/הרשאות ביצירת punch_requests
      const { data, error } = await supabase.functions.invoke('punch-request-create', {
        body: {
          business_code: businessCode,
          customer_phone: phone,
          customer_name: customerName || 'לקוח',
          card_number: card.card_number,
          product_name: productName,
          is_prepaid: card.prepaid === 'כן',
          current_punches: card.used_punches + 1,
          total_punches: card.total_punches,
          is_rewarding: isRewardPunch
        }
      });

      if (error) {
        // לוג מפורט כדי להבין למה הפונקציה מחזירה non-2xx
        let errorBody = '';
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.text === 'function') {
            errorBody = await ctx.text();
          }
        } catch {}
        console.log('[NFC] Error:', 'sendRequest.invoke', error, errorBody);
        return null;
      }

      const requestId = (data as any)?.id as string | undefined;
      if (!requestId) {
        console.log('[NFC] Error:', 'sendRequest.invoke', 'Missing id');
        return null;
      }

      console.log('[NFC] Punch request sent:', requestId);
      return requestId;
    } catch (err) {
      console.log('[NFC] Error:', 'sendRequest', err);
      return null;
    }
  }, []);

  // ביצוע ניקוב ישיר (לכרטיסיות Prepaid / auto)
  const executePunch = useCallback(async (
    card: CustomerCard,
    phone: string,
    businessCode: string
  ): Promise<{ success: boolean; isRewardingPunch: boolean; atMax?: boolean }> => {
    try {
      const newPunches = card.used_punches + 1;
      const isRewardingPunch = newPunches >= card.total_punches;

      // UPDATE PunchCards (אטומי + חסימה מעל המקסימום)
      // אם כבר ב-max, ה-update יחזיר 0 שורות ולא ייחשב "הצלחה שקטה".
      const { data: updatedRows, error: updateError } = await supabase
        .from('PunchCards')
        .update({ used_punches: newPunches })
        .eq('card_number', card.card_number)
        .lt('used_punches', card.total_punches)
        .select('card_number, used_punches, total_punches');

      if (updateError) {
        console.log('[NFC] Error updating PunchCards:', updateError);
        return { success: false, isRewardingPunch: false };
      }

      // אם לא עודכנה אף שורה - או שהכרטיס כבר מלא, או שהכרטיס לא נמצא/לא תואם
      if (!updatedRows || updatedRows.length === 0) {
        console.log('[NFC] Punch update affected 0 rows (at max or card not found):', card.card_number);
        return { success: false, isRewardingPunch: false, atMax: true };
      }

      // לוג לקוח: user_activities (קיים אצלך; activity_logs אצלך ללא card_number ולכן נכשל)
      try {
        // amount הוסר — העמודה לא קיימת בטבלה וה-insert נכשל בשקט
        const { error: uaError } = await supabase.from('user_activities').insert({
          customer_id: phone,
          business_code: businessCode,
          action_type: 'punch',
          action_time: new Date().toISOString(),
          source: 'nfc',
        });
        if (uaError) console.log('[NFC] user_activities insert error:', uaError);
      } catch (logErr) {
        console.log('[NFC] Error logging user_activities:', logErr);
        // לא נכשל - הניקוב כבר בוצע
      }

      console.log('[CONFETTI-useNFCPunch] Punch executed successfully, isRewardingPunch:', isRewardingPunch, { newPunches, totalPunches: card.total_punches });
      return { success: true, isRewardingPunch };
    } catch (err) {
      console.log('[NFC] Error:', 'executePunch', err);
      return { success: false, isRewardingPunch: false };
    }
  }, []);

  // האזנה לתגובת אדמין
  const subscribeToResponse = useCallback((requestId: string, cardNumber: string) => {
    console.log('[NFC] Subscribing to response for:', requestId);
    
    subscriptionRef.current = supabase
      .channel(`punch_request_${requestId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'punch_requests',
        filter: `id=eq.${requestId}`
      }, (payload) => {
        const newStatus = payload.new.status;
        console.log('[NFC] Realtime response:', newStatus);
        
        if (newStatus === 'approved') {
          // באישור (מצב semi_auto) האדמין עדיין עשוי לבצע את הניקוב בפועל רגע אחר כך
          setFlowState('punching');
          return;
        }

        if (newStatus === 'completed') {
          // אחרי השלמת ניקוב - נבדוק אם זה ניקוב מזכה כדי להפעיל חגיגה בקליינט
          (async () => {
            try {
              const { data: cardRow, error: cardErr } = await supabase
                .from('PunchCards')
                .select('used_punches, total_punches')
                .eq('card_number', cardNumber)
                .maybeSingle();

              if (cardErr) {
                console.log('[NFC] Error:', 'fetchCardAfterCompleted', cardErr);
              }

              cleanup();

              const used = Number((cardRow as any)?.used_punches ?? NaN);
              const total = Number((cardRow as any)?.total_punches ?? NaN);
              const rewarding = Number.isFinite(used) && Number.isFinite(total) && used >= total;

              if (rewarding) {
                console.log('[useNFCPunch] Rewarding punch detected - showing card_full for renewal', { used, total });
                setFlowState('card_full');
                return;
              }
              console.log('[useNFCPunch] Setting flowState to success (not rewarding)', { used, total });
              setFlowState('success');
            } catch (e) {
              console.log('[NFC] Error:', 'fetchCardAfterCompleted', e);
              cleanup();
              setFlowState('success');
            }
          })();
          return;
        } else if (newStatus === 'rejected') {
          cleanup();
          setError('בית העסק לא אישר את הניקוב');
          setFlowState('error');
        }
      })
      .subscribe();
  }, [cleanup]);

  // זיהוי עסק לפי nfc_string
  const identifyBusinessByNFC = useCallback(async (nfcString: string): Promise<{ business_code: string; name: string; punch_mode: string; prepaid_requires_approval?: boolean } | null> => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*') // P5: '*' כדי לכלול prepaid_requires_approval; graceful בפרוד לפני שהעמודה קיימת
        .eq('nfc_string', nfcString)
        .single();
      
      if (error || !data) {
        console.log('[NFC] Business not found for nfc_string:', nfcString);
        return null;
      }
      
      return data;
    } catch (err) {
      console.log('[NFC] Error:', 'identifyBusiness', err);
      return null;
    }
  }, []);

  // התחלת פלואו ניקוב
  // customerPhoneFromContext - מספר הטלפון של הלקוח המחובר (כבר מזוהה!)
  // preSelectedCardNumber - מספר הכרטיסייה שכבר נבחרה (אם הלקוח כבר בתוך כרטיסייה ספציפית)
  const startPunchFlow = useCallback(async (nfcString: string, customerPhoneFromContext?: string, preSelectedCardNumber?: string, businessCodeOverride?: string) => {
    try {
      resetFlow();
      
      console.log('[NFC] Starting punch flow with phone:', customerPhoneFromContext, 'preSelectedCard:', preSelectedCardNumber, 'businessCodeOverride:', businessCodeOverride);

      let business: { business_code: string; name: string; punch_mode: string; prepaid_requires_approval?: boolean } | null = null;

      if (businessCodeOverride) {
        // זיהוי עסק ישירות לפי business_code (מונע באג state ישן)
        const { data, error } = await supabase
          .from('businesses')
          .select('*') // P5: '*' כדי לכלול prepaid_requires_approval; graceful בפרוד
          .eq('business_code', businessCodeOverride)
          .single();
        if (!error && data) {
          business = data;
          console.log('[NFC] Business identified by code:', business.business_code);
        }
      }

      if (!business) {
        // fallback: זיהוי לפי nfc_string
        business = await identifyBusinessByNFC(nfcString);
      }

      if (!business) {
        setError('תג NFC לא מזוהה');
        setFlowState('error');
        return;
      }

      // F1: בדיקת מצב ניקוב ידני
      if (business.punch_mode === 'manual') {
        setError('לא ניתן לבצע ניקוב אוטומטי כרגע, אנא פנו לקופאי לביצוע הניקוב');
        setFlowState('error');
        return;
      }

      setCurrentBusinessCode(business.business_code);
      setCurrentBusinessName(business.name);
      const mode = business.punch_mode || null;
      setCurrentPunchMode(mode);
      // חשוב: state אסינכרוני; משתמשים גם ב-ref כדי למנוע stale mode בתהליך המיידי
      punchModeRef.current = mode;
      // P5: לכידת הצ'קבוקס — אם דלוק, prepaid מנותב לאישור-אדמין במקום ניקוב ישיר
      prepaidApprovalRef.current = (business as any).prepaid_requires_approval === true;

      // אם יש מספר טלפון מהקונטקסט (הלקוח כבר מזוהה בכרטיסייה)
      // אין צורך בהזדהות ביומטרית נוספת!
      if (customerPhoneFromContext) {
        setCustomerPhone(customerPhoneFromContext);
        // ממשיכים ישירות לשליפת כרטיסיות (או לניקוב ישיר אם יש כרטיסייה נבחרת)
        await continueFlowWithPhone(business.business_code, customerPhoneFromContext, preSelectedCardNumber);
        return;
      }

      // רק אם אין מספר טלפון - מנסים הזדהות ביומטרית
      setFlowState('identifying');
      const biometricSuccess = await identifyWithBiometric();
      
      if (!biometricSuccess) {
        // ממתינים להזנת מספר ידנית
        // ה-UI יציג את ה-prompt
        return;
      }

      // יש לנו מספר טלפון מהביומטריה - נמשיך
      await continueFlowWithPhone(business.business_code);
      
    } catch (err) {
      console.log('[NFC] Error:', 'startFlow', err);
      setError('שגיאה בהתחלת תהליך הניקוב');
      setFlowState('error');
    }
  }, [resetFlow, identifyWithBiometric, identifyBusinessByNFC]);

  // המשך פלואו אחרי זיהוי
  // preSelectedCardNumber - אם הלקוח כבר בחר כרטיסייה ספציפית, ננקב אותה ישירות
  const continueFlowWithPhone = useCallback(async (businessCode: string, phoneOverride?: string, preSelectedCardNumber?: string) => {
    const phone = phoneOverride || customerPhone;
    if (!phone) return;

    console.log('[NFC] Continue flow with phone:', phone, 'business:', businessCode, 'preSelectedCard:', preSelectedCardNumber);

    // F6/F3: שליפת כרטיסיות - מסננים לפי העסק הנוכחי בלבד!
    const cards = await fetchCustomerCards(phone, businessCode);
    
    if (cards.length === 0) {
      setError('אין לך כרטיסייה פעילה בעסק זה');
      setFlowState('error');
      return;
    }

    // נמצאה כרטיסייה ⇒ המספר אומת ⇒ נשמר כזהות המכשיר. שלושת המפתחות נכתבים יחד:
    // כתיבת biometric_phone לבדה הייתה משאירה את saved_phone על ערך ישן, וסימון
    // האימות (שמחזיק את המספר) היה מצביע על מספר אחר מזה שבשדה שהטופס קורא.
    // ⚠️ זהות מאומתת של אדם אחר לא נדרסת (מכשיר משפחתי) — אותו כלל כמו בטופס הרישום
    try {
      const verifiedPhone = await AsyncStorage.getItem('identity_verified');
      if (!verifiedPhone || verifiedPhone === phone) {
        const existing = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        if (existing !== phone) {
          await SecureStore.setItemAsync(BIOMETRIC_PHONE_KEY, phone);
        }
        await AsyncStorage.multiSet([['saved_phone', phone], ['identity_verified', phone]]);
      }
    } catch {}

    setCustomerCards(cards);

    // אם יש כרטיסייה נבחרת מראש - מוצאים אותה ומנקבים ישירות!
    if (preSelectedCardNumber) {
      const preSelectedCard = cards.find(c => c.card_number === preSelectedCardNumber);
      if (preSelectedCard) {
        console.log('[NFC] Using pre-selected card:', preSelectedCardNumber);
        await processPunch(businessCode, preSelectedCard, phone);
        return;
      }
      // אם הכרטיסייה הנבחרת לא נמצאה - נמשיך לפי הלוגיקה הרגילה
      console.log('[NFC] Pre-selected card not found, falling back to normal flow');
    }

    if (cards.length === 1) {
      // כרטיסייה אחת - ממשיכים
      await processPunch(businessCode, cards[0], phone);
    } else {
      // F4: יותר מכרטיסייה אחת - צריך לבחור
      setFlowState('selecting_card');
    }
  }, [customerPhone, fetchCustomerCards]);

  // עיבוד ניקוב
  const processPunch = useCallback(async (businessCode: string, card: CustomerCard, phoneOverride?: string) => {
    if (punchLockRef.current) {
      console.log('[NFC] Ignored punch - lock active');
      return;
    }
    punchLockRef.current = true;
    setSelectedCard(card);
    const phone = phoneOverride || customerPhone;
    if (!phone) {
      console.log('[NFC] Error:', 'processPunch', 'Missing customer phone');
      setError('חסר מספר טלפון לביצוע ניקוב');
      setFlowState('error');
      punchLockRef.current = false;
      return;
    }

    // F5: בדיקת הגעה למקסימום (תמיד מול שרת כדי למנוע ניקוב מעל המקסימום גם אם ה-UI לא התעדכן עדיין)
    let latestUsed = card.used_punches;
    let latestTotal = card.total_punches;
    try {
      const { data: cardRow } = await supabase
        .from('PunchCards')
        .select('used_punches, total_punches')
        .eq('card_number', card.card_number)
        .maybeSingle();
      if (cardRow) {
        latestUsed = Number((cardRow as any).used_punches ?? latestUsed);
        latestTotal = Number((cardRow as any).total_punches ?? latestTotal);
      }
    } catch {}

    const isAtMax = Number.isFinite(latestUsed) && Number.isFinite(latestTotal) && latestUsed >= latestTotal;
    if (isAtMax) {
      console.log('[NFC] Card at max punches - showing renewal prompt');
      // הצגת מודאל עם שאלה לפתיחת כרטיסייה חדשה
      setFlowState('card_full');
      punchLockRef.current = false;
      return;
    }

    const isPrepaid = card.prepaid === 'כן';
    const effectiveMode = punchModeRef.current ?? currentPunchMode;
    console.log('[NFC] processPunch route:', {
      businessCode,
      currentPunchMode: effectiveMode,
      isPrepaid,
      cardNumber: card.card_number,
    });

    // לפי אפיון: כרטיסייה Prepaid בלבד מבצעת ניקוב ישיר.
    // כל כרטיסייה שאינה Prepaid חייבת לעבור אישור אדמין (בלי קשר ל-punch_mode של העסק).
    // אפיון מעודכן (21.08): ב-semi_auto ניקוב prepaid עובר **תמיד** אישור אדמין,
    // בלי קשר לצ'קבוקס. ה-flag prepaid_requires_approval ממשיך לשלוט רק במצב auto.
    const p5RouteToApproval = effectiveMode === 'semi_auto' || (prepaidApprovalRef.current && effectiveMode === 'auto');
    if (isPrepaid && !p5RouteToApproval) {
      setFlowState('punching');
      const result = await executePunch(
        { ...card, used_punches: latestUsed, total_punches: latestTotal },
        phone,
        businessCode
      );
      if (result.success) {
        if (result.isRewardingPunch) {
          console.log('[useNFCPunch] Rewarding punch (prepaid) - showing card_full for renewal');
          setFlowState('card_full');
          return; // לא משחררים נעילה כאן — המודאל יתקדם למסך חידוש/סגירה
        }
        console.log('[useNFCPunch] Setting flowState to success (prepaid, not rewarding)');
        setFlowState('success');
      } else {
        if (result.atMax) {
          setFlowState('card_full');
          punchLockRef.current = false;
          return;
        }
        setError('שגיאה בביצוע הניקוב');
        setFlowState('error');
      }
      punchLockRef.current = false;
      return;
    }

    // לא Prepaid: שולחים בקשה לאדמין וממתינים
    setFlowState('waiting_approval');

    const requestId = await sendPunchRequest(
      businessCode,
      phone,
      { ...card, used_punches: latestUsed, total_punches: latestTotal },
      card.benefit || 'מוצר',
      undefined // ב-Hook הזה customerName לא תמיד זמין, נשלח undefined והפונקציה תשים 'לקוח' כברירת מחדל
    );

    if (requestId) {
      setPunchRequestId(requestId);
      punchRequestIdRef.current = requestId;
      subscribeToResponse(requestId, card.card_number);

      timeoutRef.current = setTimeout(() => {
        console.log('[NFC] Timeout occurred');
        cleanup();
        setError('יתכן שיש בעיית תקשורת או שבית העסק השתהה באישור הניקוב, נסה שוב');
        setFlowState('timeout');
        punchLockRef.current = false;
      }, ADMIN_APPROVAL_TIMEOUT);
    } else {
      setError('שגיאה בשליחת בקשת הניקוב');
      setFlowState('error');
      punchLockRef.current = false;
    }
  }, [customerPhone, currentPunchMode, sendPunchRequest, subscribeToResponse, cleanup, executePunch]);

  // Effect להמשך אחרי הזנת מספר
  useEffect(() => {
    if (customerPhone && currentBusinessCode && flowState === 'identifying') {
      continueFlowWithPhone(currentBusinessCode);
    }
  }, [customerPhone, currentBusinessCode, flowState, continueFlowWithPhone]);

  // Effect להמשך אחרי בחירת כרטיסייה
  useEffect(() => {
    if (selectedCard && currentBusinessCode && flowState === 'selecting_card') {
      processPunch(currentBusinessCode, selectedCard, customerPhone || undefined);
    }
  }, [selectedCard, currentBusinessCode, flowState, processPunch]);

  // ניקוי בעת unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    flowState,
    customerPhone,
    customerCards,
    selectedCard,
    currentBusinessCode,
    currentBusinessName,
    currentPunchMode,
    error,
    startPunchFlow,
    identifyWithBiometric,
    identifyWithPhone,
    selectCard,
    cancelFlow,
    resetFlow,
  };
};

export default useNFCPunch;




