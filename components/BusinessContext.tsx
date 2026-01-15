import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

interface Business {
  business_code: string;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  login_brand_color?: string;
  login_background_image?: string;
  background_login_page_color?: string;
  card_background_color?: string;
  entry_signup_text_color?: string;
  entry_click_icon_color?: string;
  business_whatsapp?: string;
  business_phone?: string;
  max_punches?: number;
  punched_icon?: string;
  unpunched_icon?: string;
  card_text_color?: string;
  logo_size?: number;
  expiration_date?: string;
  // שדות הטבה מותאמת (reward)
  reward_type?: 'free_product' | 'discount_percent' | 'custom_gift' | 'custom_text';
  reward_discount_percent?: number;
  reward_discount_product?: string;
  reward_custom_gift?: string;
  reward_custom_text?: string;
}

interface BusinessContextType {
  business: Business | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setBusiness: (business: Business) => void;
  setBusinessCode: (code: string) => Promise<void>;
  setCustomerPhone: (phone: string) => void;
  customerPhone: string | null;
}

const BusinessContext = createContext<BusinessContextType>({
  business: null,
  loading: true,
  refresh: async () => {},
  setBusiness: () => {},
  setBusinessCode: async () => {},
});

export const useBusiness = () => useContext(BusinessContext);

// פונקציית עזר לחישוב טקסט ההטבה לפי הגדרות העסק
export const getBenefitText = (business: Business | null, productName: string): string => {
  if (!business) return `${productName} חינם`;
  
  switch (business.reward_type) {
    case 'discount_percent':
      const product = business.reward_discount_product?.trim() || productName;
      return `הנחה של ${business.reward_discount_percent || 0}% על ${product}`;
    
    case 'custom_gift':
      return business.reward_custom_gift?.trim() || 'מתנה';
    
    case 'custom_text':
      return business.reward_custom_text?.trim() || 'הטבה מיוחדת';
    
    case 'free_product':
    default:
      return `${productName} חינם`;
  }
};

export const BusinessProvider = ({ children }: { children: React.ReactNode }) => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false); // מתחיל כ-false כי אין עסק לטעון בהתחלה
  const [currentBusinessCode, setCurrentBusinessCode] = useState<string | null>(null);
  const currentBusinessCodeRef = useRef(currentBusinessCode);

  useEffect(() => {
    currentBusinessCodeRef.current = currentBusinessCode;
  }, [currentBusinessCode]);

  const fetchBusiness = useCallback(async (businessCode?: string): Promise<Business | null> => {
    const codeToFetch = businessCode || currentBusinessCodeRef.current;
    if (!codeToFetch) {
      console.log('[BusinessContext] No business code to fetch');
      setLoading(false);
      return null;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('business_code', codeToFetch)
      .single();
    
    if (error) {
      console.error('❌ שגיאה בטעינת נתוני עסק:', error);
    }
    
    setBusiness(data);
    setLoading(false);
    return data; // מחזיר את הנתונים החדשים
  }, []);

  const refreshBusiness = async () => {
    await fetchBusiness();
  };

  const setBusinessCode = useCallback(async (code: string) => {
    setCurrentBusinessCode(code);
    // Explicitly fetch business data and wait for it to complete
    await fetchBusiness(code);
  }, [fetchBusiness]);

  // UseEffect for initial load if needed, but setBusinessCode handles direct updates
  useEffect(() => {
    // Only fetch if not already loaded or if code changed externally
    if (currentBusinessCode && (!business || business.business_code !== currentBusinessCode)) {
      fetchBusiness(currentBusinessCode);
    }
  }, [currentBusinessCode, business, fetchBusiness]);

  return (
    <BusinessContext.Provider value={{ 
      business, 
      loading, 
      refresh: refreshBusiness, 
      setBusiness,
      setBusinessCode 
    }}>
      {children}
    </BusinessContext.Provider>
  );
}; 