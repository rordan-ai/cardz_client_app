import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

interface NFCState {
  isSupported: boolean;
  isEnabled: boolean;
  isReading: boolean;
  lastTag: string | null;
  error: string | null;
}

interface UseNFCReturn extends NFCState {
  initNFC: () => Promise<boolean>;
  startReading: () => Promise<string | null>;
  stopReading: () => Promise<void>;
  parseBusinessId: (tagData: string) => string | null;
}

// נעילה גלובלית למניעת קריאות NFC מקבילות
let isNfcLocked = false;

export const useNFC = (): UseNFCReturn => {
  const [state, setState] = useState<NFCState>({
    isSupported: false,
    isEnabled: false,
    isReading: false,
    lastTag: null,
    error: null,
  });

  // אתחול NFC
  const initNFC = useCallback(async (): Promise<boolean> => {
    try {
      const supported = await NfcManager.isSupported();
      console.log('[NFC] Supported:', supported);
      
      if (!supported) {
        setState(prev => ({ ...prev, isSupported: false, error: 'NFC not supported' }));
        return false;
      }

      await NfcManager.start();
      const enabled = await NfcManager.isEnabled();
      console.log('[NFC] Enabled:', enabled);

      setState(prev => ({ 
        ...prev, 
        isSupported: true, 
        isEnabled: enabled,
        error: enabled ? null : 'NFC is disabled'
      }));

      return enabled;
    } catch (error) {
      console.log('[NFC] Error:', 'init', error);
      setState(prev => ({ ...prev, error: 'Failed to initialize NFC' }));
      return false;
    }
  }, []);

  // התחלת קריאה - עם נעילה למניעת קריאות מקבילות
  const startReading = useCallback(async (): Promise<string | null> => {
    // בדיקת נעילה - אם כבר יש קריאה פעילה, לא מתחילים חדשה
    if (isNfcLocked) {
      return null;
    }
    
    isNfcLocked = true;
    
    try {
      setState(prev => ({ ...prev, isReading: true, error: null }));

      // בקשת טכנולוגיית NFC
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // קריאת ה-tag
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        setState(prev => ({ ...prev, isReading: false, error: 'No tag found' }));
        isNfcLocked = false;
        return null;
      }

      // פענוח הנתונים
      let tagData: string | null = null;

      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const ndefRecord = tag.ndefMessage[0];
        if (ndefRecord.payload) {
          // המרת payload לטקסט
          const payload = ndefRecord.payload;
          // דילוג על byte ראשון (language code length) ו-language code
          const langCodeLength = payload[0] & 0x3f;
          const textBytes = payload.slice(1 + langCodeLength);
          tagData = String.fromCharCode(...textBytes);
        }
      }

      console.log('[NFC] Tag read:', tagData);
      setState(prev => ({ ...prev, isReading: false, lastTag: tagData }));

      // ניקוי
      await NfcManager.cancelTechnologyRequest();
      isNfcLocked = false;

      return tagData;
    } catch (error: any) {
      // התעלמות משגיאות NFC רגילות - לא מדפיסים לקונסול
      const msg = error?.message || '';
      if (!msg.includes('request at a time') && !msg.includes('requestTagEvent')) {
        console.log('[NFC] Error:', 'read', msg || error);
      }
      
      setState(prev => ({ 
        ...prev, 
        isReading: false, 
        error: msg || 'Failed to read NFC tag' 
      }));
      
      // ניקוי במקרה של שגיאה
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {}
      
      isNfcLocked = false;
      return null;
    }
  }, []);

  // עצירת קריאה ושחרור נעילה
  const stopReading = useCallback(async (): Promise<void> => {
    try {
      await NfcManager.cancelTechnologyRequest();
      setState(prev => ({ ...prev, isReading: false }));
    } catch (error) {
      // התעלמות משגיאות stop
    }
    isNfcLocked = false;
  }, []);

  // פענוח מזהה עסק מהמחרוזת
  const parseBusinessId = useCallback((tagData: string): string | null => {
    if (!tagData) return null;
    
    // המחרוזת צריכה להיות בפורמט שהאדמין הגדיר
    // פשוט מחזירים את המחרוזת כמות שהיא - ההתאמה תתבצע מול DB
    console.log('[NFC] Business identified:', tagData);
    return tagData;
  }, []);

  // ניקוי בעת unmount
  useEffect(() => {
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  return {
    ...state,
    initNFC,
    startReading,
    stopReading,
    parseBusinessId,
  };
};

export default useNFC;




