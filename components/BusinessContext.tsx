import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const BUSINESS_CODE = '0001';

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
  const [loading, setLoading] = useState(true);
  const [currentBusinessCode, setCurrentBusinessCode] = useState(BUSINESS_CODE);

  const fetchBusiness = async (businessCode?: string) => {
    setLoading(true);
    const codeToFetch = businessCode || currentBusinessCode;
    console.log('🔄 טוען נתוני עסק:', codeToFetch);
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('business_code', codeToFetch)
      .single();
    
    if (error) {
      console.error('❌ שגיאה בטעינת נתוני עסק:', error);
    } else {
      console.log('✅ נתוני עסק נטענו בהצלחה:', data?.name);
      console.log('🖼️ תמונת רקע:', data?.login_background_image);
    }
    
    setBusiness(data);
    setLoading(false);
    return data; // מחזיר את הנתונים החדשים
  };

  const refreshBusiness = async () => {
    console.log('🔄 מרענן נתוני עסק עבור קוד:', currentBusinessCode);
    const oldData = business;
    const newData = await fetchBusiness(currentBusinessCode);
    console.log('📊 השוואת נתונים:', {
      oldImage: oldData?.login_background_image,
      newImage: newData?.login_background_image,
      changed: oldData?.login_background_image !== newData?.login_background_image
    });
  };

  const setBusinessCode = async (code: string) => {
    console.log('🏢 מחליף קוד עסק ל:', code);
    setCurrentBusinessCode(code);
    await fetchBusiness(code);
  };

  useEffect(() => {
    fetchBusiness();
  }, []);

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