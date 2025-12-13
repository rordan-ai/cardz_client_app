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
  const [punchRequestId, setPunchRequestId] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);

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
    setPunchRequestId(null);
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
    productName: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('punch_requests')
        .insert({
          business_code: businessCode,
          customer_phone: phone,
          card_number: card.card_number,
          product_name: productName,
          is_prepaid: card.prepaid === 'כן',
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) throw error;
      
      console.log('[NFC] Punch request sent:', data.id);
      return data.id;
    } catch (err) {
      console.log('[NFC] Error:', 'sendRequest', err);
      return null;
    }
  }, []);

  // ביצוע ניקוב ישיר (לכרטיסיות Prepaid)
  const executePunch = useCallback(async (
    card: CustomerCard,
    phone: string
  ): Promise<{ success: boolean; isRewardingPunch: boolean }> => {
    try {
      const newPunches = card.used_punches + 1;
      const isRewardingPunch = newPunches >= card.total_punches;

      // UPDATE PunchCards
      const { error: updateError } = await supabase
        .from('PunchCards')
        .update({ used_punches: newPunches })
        .eq('card_number', card.card_number);

      if (updateError) {
        console.log('[NFC] Error updating PunchCards:', updateError);
        return { success: false, isRewardingPunch: false };
      }

      // INSERT activity_logs
      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          action_type: 'punch',
          card_number: card.card_number,
          customer_phone: phone,
          performed_by: 'client',
          source: 'nfc',
          details: {
            previous_punches: card.used_punches,
            new_punches: newPunches,
            total_punches: card.total_punches,
            is_rewarding: isRewardingPunch,
            product_name: card.benefit || card.product_name
          }
        });

      if (logError) {
        console.log('[NFC] Error logging activity:', logError);
        // לא נכשל - הניקוב כבר בוצע
      }

      console.log('[NFC] Punch executed successfully, rewarding:', isRewardingPunch);
      return { success: true, isRewardingPunch };
    } catch (err) {
      console.log('[NFC] Error:', 'executePunch', err);
      return { success: false, isRewardingPunch: false };
    }
  }, []);

  // האזנה לתגובת אדמין
  const subscribeToResponse = useCallback((requestId: string) => {
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
        
        if (newStatus === 'approved' || newStatus === 'completed') {
          cleanup();
          setFlowState('success');
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
        await processPunch(businessCode, preSelectedCard);
        return;
      }
      // אם הכרטיסייה הנבחרת לא נמצאה - נמשיך לפי הלוגיקה הרגילה
      console.log('[NFC] Pre-selected card not found, falling back to normal flow');
    }

    if (cards.length === 1) {
      // כרטיסייה אחת - ממשיכים
      await processPunch(businessCode, cards[0]);
    } else {
      // F4: יותר מכרטיסייה אחת - צריך לבחור
      setFlowState('selecting_card');
    }
  }, [customerPhone, fetchCustomerCards]);

  // עיבוד ניקוב
  const processPunch = useCallback(async (businessCode: string, card: CustomerCard) => {
    setSelectedCard(card);

    // F5: בדיקת הגעה למקסימום
    const isAtMax = card.used_punches >= card.total_punches;
    if (isAtMax) {
      console.log('[NFC] Card at max punches - showing renewal prompt');
      // הצגת מודאל עם שאלה לפתיחת כרטיסייה חדשה
      setFlowState('card_full');
      return;
    }

    const isPrepaid = card.prepaid === 'כן';
    
    if (isPrepaid) {
      // ✅ Prepaid - קליינט מבצע ניקוב ישירות!
      setFlowState('punching');
      
      const result = await executePunch(card, customerPhone!);
      
      if (result.success) {
        if (result.isRewardingPunch) {
          // ניקוב מזכה - הצגת קונפטי + סאונד + מודאל חגיגי
          console.log('[NFC] Rewarding punch! Showing celebration');
          setFlowState('rewarding_punch');
        }
        setFlowState('success');
      } else {
        setError('שגיאה בביצוע הניקוב');
        setFlowState('error');
      }
    } else {
      // לא Prepaid - צריך אישור אדמין
      setFlowState('waiting_approval');
      
      // שליחת בקשה לאדמין
      const requestId = await sendPunchRequest(businessCode, customerPhone!, card, card.benefit || 'מוצר');
      
      if (requestId) {
        setPunchRequestId(requestId);
        // מאזינים לתגובה
        subscribeToResponse(requestId);
        
        // Timeout
        timeoutRef.current = setTimeout(() => {
          console.log('[NFC] Timeout occurred');
          cleanup();
          setError('יתכן שיש בעיית תקשורת או שבית העסק השתהה באישור הניקוב, נסה שוב');
          setFlowState('timeout');
        }, ADMIN_APPROVAL_TIMEOUT);
      } else {
        setError('שגיאה בשליחת בקשת הניקוב');
        setFlowState('error');
      }
    }
  }, [customerPhone, executePunch, sendPunchRequest, subscribeToResponse, cleanup]);

  // Effect להמשך אחרי הזנת מספר
  useEffect(() => {
    if (customerPhone && currentBusinessCode && flowState === 'identifying') {
      continueFlowWithPhone(currentBusinessCode);
    }
  }, [customerPhone, currentBusinessCode, flowState, continueFlowWithPhone]);

  // Effect להמשך אחרי בחירת כרטיסייה
  useEffect(() => {
    if (selectedCard && currentBusinessCode && flowState === 'selecting_card') {
      processPunch(currentBusinessCode, selectedCard);
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




