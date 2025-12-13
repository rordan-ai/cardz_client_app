import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcAdapter, NfcEvents } from 'react-native-nfc-manager';

// דגלים לביטול צליל המערכת באנדרואיד
const READER_MODE_FLAGS = 
  NfcAdapter.FLAG_READER_NFC_A |
  NfcAdapter.FLAG_READER_NFC_B |
  NfcAdapter.FLAG_READER_NFC_V |
  NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS; // ביטול צליל המערכת!

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
  checkLaunchTag: () => Promise<string | null>;
  checkBackgroundTag: () => Promise<string | null>;
}

// נעילה גלובלית למניעת קריאות NFC מקבילות
let isNfcLocked = false;

// Callback גלובלי לטיפול בתג שנקרא
let onTagDiscoveredCallback: ((tagData: string | null) => void) | null = null;

export const useNFC = (): UseNFCReturn => {
  const [state, setState] = useState<NFCState>({
    isSupported: false,
    isEnabled: false,
    isReading: false,
    lastTag: null,
    error: null,
  });

  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  // פענוח תג NFC
  const parseTag = (tag: any): string | null => {
    if (!tag) return null;
    
    if (tag.ndefMessage && tag.ndefMessage.length > 0) {
      const ndefRecord = tag.ndefMessage[0];
      if (ndefRecord.payload) {
        const payload = ndefRecord.payload;
        const langCodeLength = payload[0] & 0x3f;
        const textBytes = payload.slice(1 + langCodeLength);
        return String.fromCharCode(...textBytes);
      }
    }
    return null;
  };

  // אתחול NFC עם Foreground Dispatch
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

      if (enabled) {
        // רישום Event Listener לקבלת תגי NFC
        NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
          console.log('[NFC] Tag discovered via event:', tag);
          const tagData = parseTag(tag);
          setState(prev => ({ ...prev, lastTag: tagData, isReading: false }));
          
          // אם יש resolve callback, קרא לו
          if (resolveRef.current) {
            resolveRef.current(tagData);
            resolveRef.current = null;
          }
        });

        // הפעלת Foreground Dispatch (Android)
        if (Platform.OS === 'android') {
          try {
            await NfcManager.registerTagEvent({
              isReaderModeEnabled: true,
              readerModeFlags: READER_MODE_FLAGS,
              readerModeDelay: 10,
            });
            console.log('[NFC] Foreground dispatch enabled');
          } catch (readerErr) {
            console.log('[NFC] Foreground dispatch error:', readerErr);
          }
        }
      }

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

  // התחלת קריאה - מחכה לאירוע מה-event listener
  const startReading = useCallback(async (): Promise<string | null> => {
    // בדיקת נעילה - אם כבר יש קריאה פעילה, לא מתחילים חדשה
    if (isNfcLocked) {
      return null;
    }
    
    isNfcLocked = true;
    setState(prev => ({ ...prev, isReading: true, error: null }));

    return new Promise((resolve) => {
      // שמירת ה-resolve callback
      resolveRef.current = (tagData) => {
        console.log('[NFC] Tag read via listener:', tagData);
        isNfcLocked = false;
        resolve(tagData);
      };

      // Timeout של 30 שניות
      setTimeout(() => {
        if (resolveRef.current) {
          resolveRef.current = null;
          isNfcLocked = false;
          setState(prev => ({ ...prev, isReading: false }));
          resolve(null);
        }
      }, 30000);
    });
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

  // בדיקת תג שהפעיל את האפליקציה (Android בלבד)
  const checkLaunchTag = useCallback(async (): Promise<string | null> => {
    if (Platform.OS !== 'android') return null;
    
    try {
      const launchTag = await NfcManager.getLaunchTagEvent();
      if (launchTag) {
        console.log('[NFC] Launch tag found:', launchTag);
        const tagData = parseTag(launchTag);
        setState(prev => ({ ...prev, lastTag: tagData }));
        return tagData;
      }
    } catch (error) {
      console.log('[NFC] No launch tag');
    }
    return null;
  }, []);

  // בדיקת תג רקע (Android בלבד)
  const checkBackgroundTag = useCallback(async (): Promise<string | null> => {
    if (Platform.OS !== 'android') return null;
    
    try {
      const backgroundTag = await NfcManager.getBackgroundTag();
      if (backgroundTag) {
        console.log('[NFC] Background tag found:', backgroundTag);
        const tagData = parseTag(backgroundTag);
        setState(prev => ({ ...prev, lastTag: tagData }));
        // נקה את התג אחרי קריאה
        await NfcManager.clearBackgroundTag();
        return tagData;
      }
    } catch (error) {
      console.log('[NFC] No background tag');
    }
    return null;
  }, []);

  // ניקוי בעת unmount
  useEffect(() => {
    return () => {
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.unregisterTagEvent().catch(() => {});
      NfcManager.cancelTechnologyRequest().catch(() => {});
      resolveRef.current = null;
      isNfcLocked = false;
    };
  }, []);

  return {
    ...state,
    initNFC,
    startReading,
    stopReading,
    parseBusinessId,
    checkLaunchTag,
    checkBackgroundTag,
  };
};

export default useNFC;




