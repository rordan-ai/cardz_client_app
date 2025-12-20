import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface Business {
  business_code: string;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  login_brand_color?: string;
  login_background_image?: string;
  business_whatsapp?: string;
  business_phone?: string;
  max_punches?: number;
  punched_icon?: string;
  unpunched_icon?: string;
  card_text_color?: string;
  logo_size?: number;
  expiration_date?: string;
  // אפשר להוסיף שדות נוספים לפי הצורך
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

export const BusinessProvider = ({ children }: { children: React.ReactNode }) => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false); // מתחיל כ-false כי אין עסק לטעון בהתחלה
  const [currentBusinessCode, setCurrentBusinessCode] = useState<string | null>(null);

  const fetchBusiness = async (businessCode?: string) => {
    const codeToFetch = businessCode || currentBusinessCode;
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
  };

  const refreshBusiness = async () => {
    const oldData = business;
    const newData = await fetchBusiness(currentBusinessCode);
  };

  const setBusinessCode = async (code: string) => {
    setCurrentBusinessCode(code);
    await fetchBusiness(code);
  };

  // לא טוען עסק אוטומטית - רק כשמגדירים business code מפורש
  useEffect(() => {
    if (currentBusinessCode) {
      fetchBusiness(currentBusinessCode);
    }
  }, [currentBusinessCode]);

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