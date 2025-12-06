import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../supabase';
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
  | 'waiting_approval' // ממתין לאישור אדמין
  | 'punching'         // מבצע ניקוב
  | 'success'
  | 'error'
  | 'timeout';

export interface CustomerCard {
  id: number;
  product_name: string;
  current_punches: number;
  total_punches: number;
  is_prepaid: boolean;
}

export interface PunchRequest {
  id: string;
  business_id: number;
  customer_phone: string;
  card_id: number;
  product_name: string;
  is_prepaid: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'timeout';
}

interface UseNFCPunchReturn {
  flowState: PunchFlowState;
  customerPhone: string | null;
  customerCards: CustomerCard[];
  selectedCard: CustomerCard | null;
  error: string | null;
  
  // פעולות
  startPunchFlow: (businessId: number, nfcString: string) => Promise<void>;
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
  const [currentBusinessId, setCurrentBusinessId] = useState<number | null>(null);
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
    setCurrentBusinessId(null);
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
  const fetchCustomerCards = useCallback(async (phone: string, businessId: number): Promise<CustomerCard[]> => {
    try {
      const { data, error } = await supabase
        .from('customer_cards')
        .select('id, product_name, current_punches, total_punches, is_prepaid')
        .eq('customer_phone', phone)
        .eq('business_id', businessId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
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
    businessId: number,
    phone: string,
    card: CustomerCard
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('punch_requests')
        .insert({
          business_id: businessId,
          customer_phone: phone,
          card_id: card.id,
          product_name: card.product_name,
          is_prepaid: card.is_prepaid,
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

  // התחלת פלואו ניקוב
  const startPunchFlow = useCallback(async (businessId: number, nfcString: string) => {
    try {
      resetFlow();
      setCurrentBusinessId(businessId);
      setFlowState('identifying');

      // נסיון זיהוי ביומטרי קודם
      const biometricSuccess = await identifyWithBiometric();
      
      if (!biometricSuccess) {
        // ממתינים להזנת מספר ידנית
        // ה-UI יציג את ה-prompt
        return;
      }

      // יש לנו מספר טלפון - נמשיך
      await continueFlowWithPhone(businessId);
      
    } catch (err) {
      console.log('[NFC] Error:', 'startFlow', err);
      setError('שגיאה בהתחלת תהליך הניקוב');
      setFlowState('error');
    }
  }, [resetFlow, identifyWithBiometric]);

  // המשך פלואו אחרי זיהוי
  const continueFlowWithPhone = useCallback(async (businessId: number) => {
    if (!customerPhone) return;

    // שליפת כרטיסיות
    const cards = await fetchCustomerCards(customerPhone, businessId);
    
    if (cards.length === 0) {
      setError('לא נמצאו כרטיסיות פעילות בעסק זה');
      setFlowState('error');
      return;
    }

    setCustomerCards(cards);

    if (cards.length === 1) {
      // כרטיסייה אחת - ממשיכים
      await processPunch(businessId, cards[0]);
    } else {
      // יותר מכרטיסייה אחת - צריך לבחור
      setFlowState('selecting_card');
    }
  }, [customerPhone, fetchCustomerCards]);

  // עיבוד ניקוב
  const processPunch = useCallback(async (businessId: number, card: CustomerCard) => {
    setSelectedCard(card);

    if (card.is_prepaid) {
      // Prepaid - ניקוב אוטומטי (דרך האדמין)
      setFlowState('punching');
      const requestId = await sendPunchRequest(businessId, customerPhone!, card);
      
      if (requestId) {
        setPunchRequestId(requestId);
        // מאזינים לתגובה (האדמין יבצע אוטומטית)
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
    } else {
      // לא Prepaid - צריך אישור אדמין
      setFlowState('waiting_approval');
      const requestId = await sendPunchRequest(businessId, customerPhone!, card);
      
      if (requestId) {
        setPunchRequestId(requestId);
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
  }, [customerPhone, sendPunchRequest, subscribeToResponse, cleanup]);

  // Effect להמשך אחרי הזנת מספר
  useEffect(() => {
    if (customerPhone && currentBusinessId && flowState === 'identifying') {
      continueFlowWithPhone(currentBusinessId);
    }
  }, [customerPhone, currentBusinessId, flowState, continueFlowWithPhone]);

  // Effect להמשך אחרי בחירת כרטיסייה
  useEffect(() => {
    if (selectedCard && currentBusinessId && flowState === 'selecting_card') {
      processPunch(currentBusinessId, selectedCard);
    }
  }, [selectedCard, currentBusinessId, flowState, processPunch]);

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




