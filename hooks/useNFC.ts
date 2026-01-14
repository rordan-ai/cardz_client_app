import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcAdapter, NfcEvents } from 'react-native-nfc-manager';

// דגלים לביטול צליל המערכת באנדרואיד
const READER_MODE_FLAGS = Platform.OS === 'android' ? (
  NfcAdapter.FLAG_READER_NFC_A |
  NfcAdapter.FLAG_READER_NFC_B |
  NfcAdapter.FLAG_READER_NFC_V |
  NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
) : 0;

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
let _globalNfcLocked = false;

export const useNFC = (): UseNFCReturn => {
  const [state, setState] = useState<NFCState>({
    isSupported: false,
    isEnabled: false,
    isReading: false,
    lastTag: null,
    error: null,
  });

  const resolveRef = useRef<((value: string | null) => void) | null>(null);
  const isInstanceLockedRef = useRef(false);

  // פענוח תג NFC - תומך ב-Text Records וגם URI Records
  const parseTag = (tag: any): string | null => {
    if (!tag) return null;
    
    if (tag.ndefMessage && tag.ndefMessage.length > 0) {
      const ndefRecord = tag.ndefMessage[0];
      
      // בדיקת סוג הרשומה: TNF (Type Name Format)
      // TNF=1 עם RTD="T" = Text Record
      // TNF=1 עם RTD="U" = URI Record
      const tnf = ndefRecord.tnf;
      const type = ndefRecord.type;
      const payload = ndefRecord.payload;
      
      if (!payload || payload.length === 0) return null;
      
      // זיהוי סוג הרשומה לפי type
      const typeString = type ? String.fromCharCode(...type) : '';
      console.log('[NFC] Record type:', typeString, 'TNF:', tnf);
      
      // URI Record (type = "U" או 0x55)
      if (typeString === 'U' || (type && type[0] === 0x55)) {
        // URI Record: בית ראשון = prefix code, שאר = URI
        const prefixCode = payload[0];
        const uriBytes = payload.slice(1);
        const uriPath = String.fromCharCode(...uriBytes);
        
        // Prefix codes נפוצים (לפי NDEF spec)
        const prefixes: { [key: number]: string } = {
          0x00: '',           // No prefix
          0x01: 'http://www.',
          0x02: 'https://www.',
          0x03: 'http://',
          0x04: 'https://',
        };
        
        const prefix = prefixes[prefixCode] || '';
        const fullUri = prefix + uriPath;
        console.log('[NFC] URI Record parsed:', fullUri);
        return fullUri;
      }
      
      // Text Record (type = "T" או 0x54) - פורמט ישן
      if (typeString === 'T' || (type && type[0] === 0x54) || !typeString) {
        // Text Record: בית ראשון = אורך קוד שפה, אחריו טקסט
        const langCodeLength = payload[0] & 0x3f;
        const textBytes = payload.slice(1 + langCodeLength);
        const text = String.fromCharCode(...textBytes);
        console.log('[NFC] Text Record parsed:', text);
        return text;
      }
      
      // Fallback - נסה לקרוא כטקסט רגיל
      console.log('[NFC] Unknown record type, trying raw text');
      return String.fromCharCode(...payload);
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
        // רישום Event Listener לקבלת תגי NFC (Android)
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

        // הפעלת Foreground Dispatch (Android בלבד)
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

  // התחלת קריאה
  const startReading = useCallback(async (): Promise<string | null> => {
    // בדיקת נעילה - גם גלובלית וגם של המופע הנוכחי
    if (_globalNfcLocked || isInstanceLockedRef.current) {
      console.log('[NFC] Already reading or globally locked, skipping');
      return null;
    }
    
    isInstanceLockedRef.current = true;
    _globalNfcLocked = true;
    setState(prev => ({ ...prev, isReading: true, error: null }));

    try {
      if (Platform.OS === 'ios') {
        // iOS: צריך להתחיל session מפורש עם requestTechnology
        console.log('[NFC] iOS: Starting NFC session');
        await NfcManager.requestTechnology(NfcTech.Ndef, {
          alertMessage: 'קרב את התג לסריקה'
        });
        
        const tag = await NfcManager.getTag();
        console.log('[NFC] iOS: Tag received:', tag);
        
        const tagData = parseTag(tag);
        setState(prev => ({ ...prev, lastTag: tagData, isReading: false }));
        
        await NfcManager.cancelTechnologyRequest();
        isInstanceLockedRef.current = false;
        _globalNfcLocked = false;
        return tagData;
        
      } else {
        // Android: מחכה לאירוע מה-event listener
        return new Promise((resolve) => {
          resolveRef.current = (tagData) => {
            console.log('[NFC] Android: Tag read via listener:', tagData);
            isInstanceLockedRef.current = false;
            _globalNfcLocked = false;
            resolve(tagData);
          };

          // טיימר קצר יותר ללופים מהירים (5 שניות במקום 30)
          setTimeout(() => {
            if (resolveRef.current) {
              resolveRef.current = null;
              isInstanceLockedRef.current = false;
              _globalNfcLocked = false;
              setState(prev => ({ ...prev, isReading: false }));
              resolve(null);
            }
          }, 5000);
        });
      }
    } catch (error) {
      console.log('[NFC] Error:', 'startReading', error);
      setState(prev => ({ ...prev, isReading: false, error: 'Failed to read tag' }));
      isInstanceLockedRef.current = false;
      _globalNfcLocked = false;
      
      // ניקוי iOS session
      if (Platform.OS === 'ios') {
        try {
          await NfcManager.cancelTechnologyRequest();
        } catch {}
      }
      
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
    isInstanceLockedRef.current = false;
    _globalNfcLocked = false;
  }, []);

  // פענוח מזהה עסק מהמחרוזת
  // תומך בשני פורמטים:
  // 1. Text Record: "0002" (תאימות לאחור)
  // 2. URI Record: "mycardz://business/0002" (חדש - עובד ברקע ב-iOS)
  const parseBusinessId = useCallback((tagData: string): string | null => {
    if (!tagData) return null;
    
    // אם זה URI עם scheme שלנו - חילוץ business code
    if (tagData.startsWith('mycardz://business/')) {
      const businessCode = tagData.replace('mycardz://business/', '');
      console.log('[NFC] Business identified from URI:', businessCode);
      return businessCode;
    }
    
    // אחרת - מחרוזת פשוטה (תאימות לאחור לתגים ישנים)
    console.log('[NFC] Business identified from text:', tagData);
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
      _globalNfcLocked = false;
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
