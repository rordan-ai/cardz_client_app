import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../components/supabaseClient';
import { PopupData } from '../components/MarketingPopup';

type TriggerLocation = 'entry' | 'after_punch' | 'after_phone';

interface UseMarketingPopupsOptions {
  businessCode: string;
  customerPhone?: string;
  trigger: TriggerLocation;
  enabled?: boolean;
}

interface UseMarketingPopupsReturn {
  currentPopup: PopupData | null;
  showPopup: boolean;
  closePopup: () => void;
  triggerPopup: () => void;
}

// מפתח לאחסון ספירת הצגות
const getViewCountKey = (businessCode: string, popupId: number) => 
  `popup_view_count_${businessCode}_${popupId}`;

export function useMarketingPopups({
  businessCode,
  customerPhone,
  trigger,
  enabled = true,
}: UseMarketingPopupsOptions): UseMarketingPopupsReturn {
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [currentPopup, setCurrentPopup] = useState<PopupData | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedRef = useRef(false);

  // שליפת פופאפים פעילים מהשרת
  useEffect(() => {
    if (!businessCode || !enabled) return;
    
    const fetchPopups = async () => {
      try {
        if (__DEV__) console.log('[MarketingPopups] Fetching for:', { businessCode, trigger });
        
        const { data, error } = await supabase
          .from('popups')
          .select('*')
          .eq('business_code', businessCode)
          .eq('is_active', true)
          .eq('trigger_location', trigger);

        if (error) {
          if (__DEV__) console.log('[MarketingPopups] Error fetching popups:', error);
          return;
        }

        const validPopups = (data || []) as PopupData[];
        
        if (__DEV__) {
          console.log('[MarketingPopups] Fetched popups:', {
            businessCode,
            trigger,
            count: validPopups.length,
          });
        }

        setPopups(validPopups);
      } catch (e) {
        if (__DEV__) console.log('[MarketingPopups] Exception:', e);
      }
    };

    fetchPopups();
  }, [businessCode, trigger, enabled]);

  // בדיקת מגבלת הצגות והצגת פופאפ
  useEffect(() => {
    if (popups.length === 0 || !enabled || processedRef.current) return;
    
    const processPopups = async () => {
      processedRef.current = true;
      
      for (const popup of popups) {
        // בדיקת מגבלת הצגות
        if (popup.show_count_per_user !== -1) {
          const key = getViewCountKey(businessCode, popup.id);
          const storedCount = await AsyncStorage.getItem(key);
          const count = storedCount ? parseInt(storedCount, 10) : 0;
          
          if (count >= popup.show_count_per_user) {
            if (__DEV__) console.log('[MarketingPopups] Skipping popup (view limit reached):', popup.id);
            continue;
          }
        }

        // נמצא פופאפ תקין להצגה
        setCurrentPopup(popup);
        
        if (__DEV__) console.log('[MarketingPopups] Will show popup:', { 
          id: popup.id, 
          duration_seconds: popup.duration_seconds,
          display_duration: popup.display_duration 
        });
        
        // הצגה מיידית (ללא השהייה)
        if (__DEV__) console.log('[MarketingPopups] Showing popup now');
        setShowPopup(true);
        
        // לוג צפייה בפופאפ לטבלת user_activities
        try {
          await supabase.from('user_activities').insert({
            customer_id: customerPhone || null,
            business_code: businessCode,
            action_type: 'popup_view',
            action_time: new Date().toISOString(),
            source: 'mobile'
          });
          if (__DEV__) console.log('[MarketingPopups] Logged popup view for popup:', popup.id);
        } catch (logError) {
          if (__DEV__) console.log('[MarketingPopups] Failed to log popup view:', logError);
        }
        
        // עדכון ספירת הצגות
        const key = getViewCountKey(businessCode, popup.id);
        const storedCount = await AsyncStorage.getItem(key);
        const count = storedCount ? parseInt(storedCount, 10) : 0;
        await AsyncStorage.setItem(key, String(count + 1));
        
        break; // מציג רק פופאפ אחד
      }
    };

    processPopups();
  }, [popups, enabled, businessCode]);

  // סגירת פופאפ
  const closePopup = useCallback(() => {
    if (__DEV__) console.log('[MarketingPopups] Closing popup');
    setShowPopup(false);
    setCurrentPopup(null);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // הפעלה ידנית (לשימוש עתידי)
  const triggerPopup = useCallback(() => {
    processedRef.current = false;
  }, []);

  // ניקוי timeout בעת unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    currentPopup,
    showPopup,
    closePopup,
    triggerPopup,
  };
}
