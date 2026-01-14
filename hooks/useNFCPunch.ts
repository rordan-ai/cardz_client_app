import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../components/supabaseClient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// מפתח לשמירת מספר טלפון
const BIOMETRIC_PHONE_KEY = 'biometric_phone';

// Timeout לאישור אדמין (60 שניות)
const ADMIN_APPROVAL_TIMEOUT = 60000;

// מצבי הפלואו
export type PunchFlowState = 
  | 'idle'
  | 'identifying'      // זיהוי לקוח
  | 'selecting_card'   // בחירת כרטיסייה
  | 'card_full'        // כרטיסייה מלאה - שאלה לפתיחת חדשה
  | 'waiting_approval' // ממתין לאישור אדמין
  | 'punching'         // מבצע ניקוב
  | 'rewarding_punch'  // ניקוב מזכה - קונפטי וסאונד
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
  startPunchFlow: (nfcString: string, customerPhone?: string, preSelectedCardNumber?: string) => Promise<void>;
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
  const subscriptionRef = useRef<any>(null);
  const punchLockRef = useRef(false);
  const punchModeRef = useRef<string | null>(null);

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
    punchLockRef.current = false;
    punchModeRef.current = null;
  }, [cleanup]);

  // ביטול
  const cancelFlow = useCallback(() => {
    console.log('[NFC] Flow cancelled');
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
    // שמירה כדי שבפעם הבאה הזיהוי הביומטרי ישלים את המספר בלי הזנה חוזרת
    try {
      await SecureStore.setItemAsync(BIOMETRIC_PHONE_KEY, phone);
    } catch {}
    return true;
  }, []);

  // שליפת כרטיסיות לקוח
  const fetchCustomerCards = useCallback(async (phone: string, businessCode: string): Promise<CustomerCard[]> => {
    try {
      const { data, error } = await supabase
        .from('PunchCards')
        .select('card_number, product_code, used_punches, total_punches, prepaid, benefit, status')
        .eq('customer_phone', phone)
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
        await supabase.from('user_activities').insert({
          customer_id: phone,
          business_code: businessCode,
          action_type: 'punch',
          action_time: new Date().toISOString(),
          amount: 1,
          source: 'nfc',
        });
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
                console.log('[CONFETTI-useNFCPunch] 🎉 Setting flowState to rewarding_punch (after admin completion)', { used, total });
                setFlowState('rewarding_punch');
                return;
              }
              console.log('[CONFETTI-useNFCPunch] Setting flowState to success (not rewarding)', { used, total });
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
  const identifyBusinessByNFC = useCallback(async (nfcString: string): Promise<{ business_code: string; name: string; punch_mode: string } | null> => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('business_code, name, punch_mode')
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
  const startPunchFlow = useCallback(async (nfcString: string, customerPhoneFromContext?: string, preSelectedCardNumber?: string) => {
    try {
      resetFlow();
      
      console.log('[NFC] Starting punch flow with phone:', customerPhoneFromContext, 'preSelectedCard:', preSelectedCardNumber);

      // F2: זיהוי עסק לפי nfc_string
      const business = await identifyBusinessByNFC(nfcString);
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
    if (isPrepaid) {
      setFlowState('punching');
      const result = await executePunch(
        { ...card, used_punches: latestUsed, total_punches: latestTotal },
        phone,
        businessCode
      );
      if (result.success) {
        if (result.isRewardingPunch) {
          console.log('[CONFETTI-useNFCPunch] 🎉 Setting flowState to rewarding_punch (prepaid direct punch)');
          setFlowState('rewarding_punch');
          return; // לא משחררים נעילה כאן — המודאל יתקדם למסך חידוש/סגירה
        }
        console.log('[CONFETTI-useNFCPunch] Setting flowState to success (prepaid, not rewarding)');
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




