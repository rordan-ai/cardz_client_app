import * as MediaLibrary from 'expo-media-library';
import { Slot, useRouter, usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';
import { BusinessProvider, useBusiness } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';
import { supabase } from '../../components/supabaseClient';
import { getCapturedInitialUrl, initialUrlPromise } from '../_layout';

const BIOMETRIC_PHONE_KEY = 'biometric_phone';
const LAST_NFC_TAG_KEY = 'last_nfc_tag_id';
const NFC_TAG_COOLDOWN_MS = 30000; // 30 שניות - לא לטפל באותו תג שוב

/**
 * בדיקה אם תג NFC כבר טופל לאחרונה (למניעת ניקוב כפול)
 */
const isTagAlreadyHandled = async (tagId: string): Promise<boolean> => {
  try {
    const stored = await SecureStore.getItemAsync(LAST_NFC_TAG_KEY);
    if (!stored) return false;
    
    const { id, timestamp } = JSON.parse(stored);
    const elapsed = Date.now() - timestamp;
    
    // אם אותו תג נקרא תוך cooldown - כבר טופל
    if (id === tagId && elapsed < NFC_TAG_COOLDOWN_MS) {
      console.log('[NfcHandler] Tag already handled recently:', tagId, 'elapsed:', elapsed);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * שמירת תג NFC שטופל
 */
const markTagAsHandled = async (tagId: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(LAST_NFC_TAG_KEY, JSON.stringify({
      id: tagId,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.log('[NfcHandler] Failed to save tag ID:', err);
  }
};

/**
 * פענוח תג NFC מ-NfcManager.getLaunchTagEvent()
 */
const parseNfcTag = (tag: any): string | null => {
  if (!tag?.ndefMessage?.length) return null;
  
  const record = tag.ndefMessage[0];
  const payload = record.payload;
  if (!payload?.length) return null;
  
  const type = record.type;
  const typeString = type ? String.fromCharCode(...type) : '';
  
  // URI Record (type = 'U' או 0x55)
  if (typeString === 'U' || (type?.[0] === 0x55)) {
    const prefixCode = payload[0];
    const uriPath = String.fromCharCode(...payload.slice(1));
    const prefixes: { [key: number]: string } = {
      0x00: '', 0x01: 'http://www.', 0x02: 'https://www.', 0x03: 'http://', 0x04: 'https://'
    };
    return (prefixes[prefixCode] || '') + uriPath;
  }
  
  // Text Record (type = 'T' או 0x54)
  if (typeString === 'T' || (type?.[0] === 0x54)) {
    const langLen = payload[0] & 0x3f;
    if (1 + langLen >= payload.length) return null;
    return String.fromCharCode(...payload.slice(1 + langLen));
  }
  
  // סוג רשומה לא מוכר - להחזיר null
  console.log('[NfcHandler] Unknown NDEF record type:', typeString);
  return null;
};

/**
 * קומפוננט פנימי לטיפול ב-NFC Deep Links
 * חייב להיות בתוך BusinessProvider כדי להשתמש ב-useBusiness
 */
function NfcDeepLinkHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { setBusinessCode } = useBusiness();
  // מונע עיבוד כפול של אותו URL התחלתי בלבד
  const initialUrlHandledRef = useRef(false);
  // מונע עיבוד מקבילי של deep links
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // אם אנחנו כבר במסך PunchCard - אנחנו לא רוצים שה-Layout ינהל את ה-NFC
    // כדי למנוע קונפליקטים ונעילות (PunchCard מנהל את ה-NFC בעצמו)
    if (pathname.includes('PunchCard')) {
      console.log('[NfcHandler] PunchCard active, disabling layout NFC listener');
      return;
    }

    const handleNfcDeepLink = async (url: string, isInitialUrl: boolean = false) => {
      // מניעת עיבוד כפול של URL התחלתי
      if (isInitialUrl && initialUrlHandledRef.current) return;
      // מניעת עיבוד מקבילי - בדיקה וסימון אטומיים
      if (isProcessingRef.current) return;
      isProcessingRef.current = true; // סימון מיידי למניעת race condition
      
      console.log('[NfcHandler] Deep link received:', url, isInitialUrl ? '(initial)' : '(event)');
      
      // תמיכה ב-3 פורמטים:
      // 1. mycardz://business/0002 (custom scheme - Android)
      // 2. https://punchcards.digital/business/0002 (Universal Link - iOS Background Tag Reading)
      // 3. https://punchcards.digital/b/0002 (קיצור)
      let businessCode: string | null = null;
      
      if (url.startsWith('mycardz://business/')) {
        // וולידציה: רק 4 ספרות
        const match = url.match(/^mycardz:\/\/business\/(\d{4})$/);
        businessCode = match ? match[1] : null;
      } else if (url.includes('punchcards.digital/business/')) {
        // תומך גם ב-app.punchcards.digital וגם ב-punchcards.digital
        const match = url.match(/punchcards\.digital\/business\/(\d{4})/);
        businessCode = match ? match[1] : null;
      } else if (url.includes('punchcards.digital/b/')) {
        const match = url.match(/punchcards\.digital\/b\/(\d{4})/);
        businessCode = match ? match[1] : null;
      }
      
      if (!businessCode) {
        console.log('[NfcHandler] Not a valid deep link, ignoring:', url);
        isProcessingRef.current = false; // שחרור הנעילה
        return;
      }
      
      console.log('[NfcHandler] Business code:', businessCode);
      
      try {
        const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        
        // נרמול מספר טלפון לפורמט מקומי (05XXXXXXXX) - הכרחי לשאילתות מול האדמין
        const getPhoneVariants = (p: string | null) => {
          if (!p) return [];
          let clean = p.replace(/[^0-9]/g, '');
          let variants = [clean];
          
          if (clean.startsWith('05') && clean.length === 10) {
            variants.push('972' + clean.slice(1));
            variants.push(clean.slice(1)); // 5XXXXXXXX
          } else if (clean.startsWith('972') && clean.length === 12) {
            variants.push('0' + clean.slice(3));
            variants.push(clean.slice(3)); // 5XXXXXXXX
          } else if (clean.startsWith('5') && clean.length === 9) {
            variants.push('0' + clean);
            variants.push('972' + clean);
          }
          
          return [...new Set(variants)].filter(v => v.length >= 9);
        };

        const phoneVariants = getPhoneVariants(savedPhone);
        const phoneLocal = phoneVariants.find(v => v.startsWith('05')) || (phoneVariants.length > 0 ? phoneVariants[0] : null);
        
        console.log('[NfcHandler] Saved phone:', savedPhone ? 'exists' : 'none');
        
        // עדכון business context לפני routing
        console.log('[NfcHandler] Setting business context:', businessCode);
        
        // Wait for business context to be fully set and loaded
        await setBusinessCode(businessCode);
        console.log('[NfcHandler] Business context updated and loaded');
        
        if (!savedPhone) {
          // אין ביומטרי - למסך כניסה עם העסק מוגדר
          console.log('[NfcHandler] → customers-login (no phone)');
          router.replace({
            pathname: '/(tabs)/customers-login',
            params: { businessCode, fromDeepLink: 'true' }
          });
          return;
        }

        // יש ביומטרי - בדיקת סוג כרטיסייה
        const { data: businessData } = await supabase
          .from('businesses')
          .select('punch_mode')
          .eq('business_code', businessCode)
          .single();

        const { data: cards } = await supabase
          .from('PunchCards')
          .select('prepaid')
          .in('customer_phone', phoneVariants)
          .eq('business_code', businessCode)
          .eq('status', 'active');

        const isAuto = businessData?.punch_mode === 'auto';
        const hasSingle = cards && cards.length === 1;
        const isPrepaid = hasSingle ? cards[0].prepaid === 'כן' : false;

        console.log('[NfcHandler] auto:', isAuto, 'single:', hasSingle, 'prepaid:', isPrepaid);

        // ניווט ישיר ל-PunchCard עם הפרמטרים המתאימים
        console.log('[NfcHandler] → PunchCard');
        router.replace({
          pathname: '/(tabs)/PunchCard',
          params: {
            phone: savedPhone,
            businessCode,
            nfcLaunch: 'true',
            autoPunch: (isAuto && hasSingle && isPrepaid) ? 'true' : 'false'
          }
        });

        // סימון URL התחלתי כמטופל רק לאחר הצלחה
        if (isInitialUrl) initialUrlHandledRef.current = true;
      } catch (err) {
        console.error('[NfcHandler] Error:', err);
        // במקרה של שגיאה - עדיין נלך למסך כניסה עם העסק
        await setBusinessCode(businessCode);
        router.replace({
          pathname: '/(tabs)/customers-login',
          params: { businessCode, fromDeepLink: 'true' }
        });
      } finally {
        // שחרור הנעילה מיידי - מנגנון isTagAlreadyHandled כבר מונע עיבוד כפול של אותו תג
        isProcessingRef.current = false;
      }
    };

    // בדיקת URL התחלתי (כשהאפליקציה נפתחת מ-NFC)
    const checkInitialUrl = async () => {
      // 1. נסה קודם את ה-URL שנלכד ברמת root layout (מוקדם יותר)
      // נמתין ללכידה הראשונית שתסתיים
      const capturedUrl = await initialUrlPromise;
      if (capturedUrl) {
        console.log('[NfcHandler] Using captured initial URL:', capturedUrl);
        await handleNfcDeepLink(capturedUrl, true);
        return;
      }
      
      // 2. Fallback: נסה Linking.getInitialURL (במקרה שהלכידה נכשלה)
      const url = await Linking.getInitialURL();
      console.log('[NfcHandler] Initial URL from Linking:', url);
      if (url) {
        await handleNfcDeepLink(url, true); // isInitialUrl = true
        return;
      }
      
      // 3. Fallback לאנדרואיד: נסה NfcManager.getLaunchTagEvent / getBackgroundTag
      if (Platform.OS === 'android') {
        try {
          // פונקציית עזר להמרת tag data ל-deep link
          const tagDataToDeepLink = (tagData: string): string | null => {
            // כבר URL תקין
            if (tagData.startsWith('mycardz://') || tagData.includes('punchcards.digital/')) {
              return tagData;
            }
            // קוד עסק בלבד (4 ספרות)
            if (tagData.match(/^\d{4}$/)) {
              return `mycardz://business/${tagData}`;
            }
            return null;
          };
          
          // בדיקת תג שהפעיל את האפליקציה
          const launchTag = await NfcManager.getLaunchTagEvent();
          if (launchTag) {
            console.log('[NfcHandler] Launch tag found');
            // בדיקה אם כבר טיפלנו בתג הזה (למניעת ניקוב כפול בפתיחה ידנית)
            const tagId = launchTag.id || (launchTag.ndefMessage && launchTag.ndefMessage.length > 0 ? JSON.stringify(launchTag.ndefMessage[0].payload) : `no_id_${Date.now()}`);
            if (await isTagAlreadyHandled(tagId)) {
              console.log('[NfcHandler] Launch tag already handled, skipping');
            } else {
              const tagData = parseNfcTag(launchTag);
              if (tagData) {
                console.log('[NfcHandler] Tag data:', tagData);
                const deepLink = tagDataToDeepLink(tagData);
                if (deepLink) {
                  await markTagAsHandled(tagId); // סימון שטיפלנו בתג
                  await handleNfcDeepLink(deepLink, true); // isInitialUrl = true
                  return;
                }
              }
            }
          }
          
          // בדיקת תג רקע
          const bgTag = await NfcManager.getBackgroundTag();
          if (bgTag) {
            console.log('[NfcHandler] Background tag found');
            const tagData = parseNfcTag(bgTag);
            if (tagData) {
              const deepLink = tagDataToDeepLink(tagData);
              if (deepLink) {
                await NfcManager.clearBackgroundTag();
                await handleNfcDeepLink(deepLink, true); // isInitialUrl = true
                return;
              }
            }
          }
        } catch (err) {
          console.log('[NfcHandler] NfcManager fallback error:', err);
        }
      }
    };
    
    checkInitialUrl();

    // האזנה ל-deep links בזמן שהאפליקציה פתוחה
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[NfcHandler] URL event:', url);
      handleNfcDeepLink(url, false); // isInitialUrl = false - זו סריקה חדשה
    });
    
    return () => subscription.remove();
  }, [router, setBusinessCode, pathname]);

  return null; // קומפוננט זה לא מרנדר כלום
}

const sanitizeBody = (body: string, voucherUrl?: string) => {
  let result = body;
  if (voucherUrl) {
    result = result.replace(voucherUrl, '');
    result = result.replace(/🎁?\s*קישור לשובר[:：]?\s*/g, '');
  }
  // הסרת קישורי Canva מהטקסט אם קיימים (כאשר נציגם ב-WebView)
  result = result.replace(/https?:\/\/(?:www\.)?canva\.com\/design\/[^\s)]+/g, '');
  return result.trim();
};

const extractCanvaUrl = (text?: string): string | null => {
  if (!text) return null;
  const match = text.match(/https?:\/\/(?:www\.)?canva\.com\/design\/[^\s)]+/);
  return match ? match[0] : null;
};

export default function Layout() {
  const [notification, setNotification] = useState<{ title: string; body: string; voucherUrl?: string } | null>(null);
  const [inlineUrl, setInlineUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const pushWebViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const isSavingRef = useRef(false);

  const showTimedToast = (message: string, ms = 3000) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), ms);
  };

  // פונקציה לשמירת שובר לגלריה באמצעות ViewShot
  const saveVoucherToGallery = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    
    try {
      // בקשת הרשאות
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showTimedToast('נדרשת הרשאה לגישה לגלריה');
        return;
      }
      
      // לכידת התמונה מ-ViewShot
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
      });
      
      // שמירה לגלריה
      await MediaLibrary.createAssetAsync(uri);
      showTimedToast('השובר נשמר לגלריה בהצלחה! 📸');
    } catch (error) {
      console.error('[SaveToGallery] Error:', error);
      showTimedToast('שגיאה בשמירת השובר');
    } finally {
      setTimeout(() => { isSavingRef.current = false; }, 500);
    }
  };

  const ALERT_BRIDGE_JS = `
    (function() {
      var __bridge = window.ReactNativeWebView && window.ReactNativeWebView.postMessage ? window.ReactNativeWebView : null;
      if (!__bridge) return;
      
      // החלפת alert/confirm/prompt
      window.alert = function(msg){ __bridge.postMessage(JSON.stringify({ type: 'alert', message: String(msg||'') })); };
      window.confirm = function(msg){ __bridge.postMessage(JSON.stringify({ type: 'confirm', message: String(msg||'') })); return true; };
      window.prompt = function(msg, def){ __bridge.postMessage(JSON.stringify({ type: 'prompt', message: String(msg||'') })); return ''; };
      
      // חיבור כפתור "הוסף לגלריה"
      function attachSaveButton() {
        var btns = document.querySelectorAll('button');
        btns.forEach(function(btn) {
          if (btn.textContent && btn.textContent.includes('גלריה') && !btn.__saveAttached) {
            btn.__saveAttached = true;
            btn.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              __bridge.postMessage(JSON.stringify({ type: 'save-to-gallery' }));
              return false;
            };
          }
        });
      }
      
      // ניסיון מיידי + retry כל 500ms עד 10 שניות
      attachSaveButton();
      var attempts = 0;
      var interval = setInterval(function() {
        attempts++;
        attachSaveButton();
        if (attempts >= 20) clearInterval(interval);
      }, 500);
    })();
  `;

  // CSS מוזרק להתאמת תצוגת השובר באפליקציה
  const VOUCHER_STYLE_JS = `
    (function() {
      var style = document.createElement('style');
      style.textContent = \`
        /* הקטנת השובר ב-10% */
        .voucher-card-display {
          transform: scale(0.75) !important;
          transform-origin: center center !important;
        }
        /* העלאת התוכן (לא הברקוד) ב-60px - כשמסובב 90° זה שמאלה */
        .voucher-card-display .voucher-content,
        .voucher-card-display .voucher-text,
        .voucher-card-display .voucher-title,
        .voucher-card-display .voucher-description,
        .voucher-card-display .voucher-details,
        .voucher-card-display .business-name,
        .voucher-card-display .business-logo {
          transform: translateX(-60px) !important;
        }
        /* הסתרת כפתור ה-X הלא פעיל באמצע השובר */
        .close-button,
        .voucher-display-content > button.close-button,
        button[aria-label="סגור"] {
          display: none !important;
          visibility: hidden !important;
        }
        /* הסתרת כפתור הדפסה */
        .print-button,
        button.print-button,
        button[class*="print"] {
          display: none !important;
          visibility: hidden !important;
        }
        /* עיצוב כפתור גלריה - מלבן שטוח לכל רוחב */
        .save-button,
        button.save-button,
        button[class*="save"] {
          width: 100% !important;
          max-width: 280px !important;
          height: 44px !important;
          border-radius: 8px !important;
          margin: 10px auto !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-direction: row !important;
          white-space: nowrap !important;
          font-size: 16px !important;
          font-weight: bold !important;
        }
      \`;
      document.head.appendChild(style);
    })();
  `;

  // אתחול FCM Service - רץ פעם אחת בלבד
  useEffect(() => {
    FCMService.initialize();
  }, []);


  // האזנה להתראות FCM
  useEffect(() => {
          const listener = DeviceEventEmitter.addListener('show_inapp_notification', (data: { title: string; body: string; voucherUrl?: string }) => {
      setNotification(data);
    });
    return () => listener.remove();
  }, []);

  const runVoucherDiagnostics = (source: string, targetUrl: string) => {
    console.log(`[VoucherDiag-${source}] Inline URL:`, targetUrl);
    try {
      const parsed = new URL(targetUrl);
      const pingUrl = `${parsed.origin}/__vite_ping`;
      fetch(pingUrl)
        .then(async (res) => {
          const text = await res.text();
          console.log(`[VoucherDiag-${source}] __vite_ping status:`, res.status, 'ok:', res.ok);
          console.log(`[VoucherDiag-${source}] __vite_ping body:`, text.slice(0, 120));
        })
        .catch((err) => console.error(`[VoucherDiag-${source}] __vite_ping failed:`, err));
    } catch (err) {
      console.error(`[VoucherDiag-${source}] diagnostics error:`, err);
    }
  };

  useEffect(() => {
    if (inlineUrl) {
      runVoucherDiagnostics('PUSH', inlineUrl);
    }
  }, [inlineUrl]);

  const appendPhoneToVoucherUrl = (rawUrl: string) => {
    let url = rawUrl;
    const phone = FCMService.getCurrentPhone();
    // הוספת phone רק אם לא קיים כבר בכתובת
    if (phone && !url.includes('phone=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}phone=${encodeURIComponent(phone)}`;
    }
    // Cache busting - מוסיף timestamp למניעת cache
    const cacheBustSeparator = url.includes('?') ? '&' : '?';
    url = `${url}${cacheBustSeparator}t=${Date.now()}`;
    return url;
  };

  const handleInternalVoucherOpen = () => {
    if (!notification?.voucherUrl) return;
    const prepared = appendPhoneToVoucherUrl(notification.voucherUrl);
    setInlineUrl(prepared);
  };

  return (
    <BusinessProvider>
      <NfcDeepLinkHandler />
      <Slot />
      {/* מודל התראה מובנה באפליקציה עם RTL מלא */}
      <Modal visible={!!notification} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* מסגרת פנימית דקה עם inset 2px סביב כל כרטיס הפוש */}
            <View style={styles.modalCardInsetOverlay} pointerEvents="none" />
            {/* כותרת עם רקע אפור מעוגל המתאים עצמו לגודל הטקסט */}
            <View style={styles.titleWrap}>
              <View style={styles.titlePill}>
                <Text style={styles.modalTitle}>{notification?.title}</Text>
              </View>
            </View>
            {/* הטמעת Canva אם קיים קישור בגוף ההודעה */}
            {(() => {
              const url = extractCanvaUrl(notification?.body);
              if (!url) return null;
              return (
                <View style={styles.embedContainer}>
                  <View style={styles.embedInsetWrap}>
                    <View style={styles.embedInsetBorder}>
                      <WebView
                        source={{ uri: url }}
                        originWhitelist={['*']}
                        javaScriptEnabled
                        domStorageEnabled
                        allowsInlineMediaPlayback
                        setSupportMultipleWindows={false}
                        userAgent="Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36"
                        injectedJavaScriptBeforeContentLoaded={ALERT_BRIDGE_JS}
                        injectedJavaScript={ALERT_BRIDGE_JS}
                        onMessage={(e) => {
                          // טיפול בהודעות מה-WebView
                          try {
                            const data = JSON.parse(e.nativeEvent.data);
                            // הודעות bridge (alert/confirm/prompt) - להציג רק אם זה alert על שמירה
                            if (data.type === 'alert' && data.message?.includes('שמור')) {
                              showTimedToast('השובר נשמר לגלריית התמונות בהצלחה');
                            }
                            // סוגים אחרים (confirm, prompt) - לא להציג toast
                          } catch {
                            // אם זו לא הודעת JSON - להתעלם
                          }
                        }}
                        onShouldStartLoadWithRequest={(req) => {
                          // לאפשר רק ניווט בתוך דומיין canva כדי למנוע דיאלוגי מערכת
                          try {
                            const host = new URL(req.url).hostname.toLowerCase();
                            // בדיקה מאובטחת: רק canva.com/canva.cn או subdomain לגיטימי שלהם
                            const isCanva = host === 'canva.com' || host === 'canva.cn' ||
                                           host.endsWith('.canva.com') || host.endsWith('.canva.cn');
                            if (isCanva) return true;
                          } catch {}
                          return false;
                        }}
                        style={styles.webview}
                      />
                    </View>
                  </View>
                </View>
              );
            })()}
            <Text style={styles.modalBody}>
              {notification ? sanitizeBody(notification.body, notification.voucherUrl) : ''}
            </Text>
            {/* שורת כפתורים מפולפלת בסגנון גלולה */}
            <View style={styles.buttonsRow}>
              {notification?.voucherUrl ? (
                <TouchableOpacity style={[styles.pillButton, styles.viewPill]} onPress={handleInternalVoucherOpen}>
                  <View style={styles.pillInsetOverlay} pointerEvents="none" />
                  <Text style={styles.pillText}>צפה בשובר</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.pillButton, styles.closePill]} onPress={() => setNotification(null)}>
                <View style={styles.pillInsetOverlay} pointerEvents="none" />
                <Text style={styles.pillText}>סגור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast הודעת מערכת ל-3 שניות */}
      <Modal visible={toast.visible} transparent animationType="fade">
        <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 40 }}>
            <View style={styles.toastCard}>
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          </View>
        </View>
      </Modal>
      {/* WebView פנימי לצפייה בשובר – ללא דיאלוג מערכת חיצוני */}
      <Modal visible={!!inlineUrl} transparent animationType="fade" onRequestClose={() => setInlineUrl(null)}>
        <View style={[styles.modalBackdrop, { justifyContent: 'flex-start', alignItems: 'stretch' }]}>
          <View style={styles.webviewCard}>
            <TouchableOpacity
              style={styles.webviewClose}
              onPress={() => setInlineUrl(null)}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#666', fontFamily: 'Heebo' }}>×</Text>
            </TouchableOpacity>
            {inlineUrl ? (
              <ViewShot ref={viewShotRef} style={{ flex: 1 }}>
              <WebView
                ref={pushWebViewRef}
                source={{ uri: inlineUrl }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                setSupportMultipleWindows={false}
                cacheEnabled={false}
                incognito={true}
                userAgent="Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36"
                injectedJavaScriptBeforeContentLoaded={ALERT_BRIDGE_JS}
                injectedJavaScript={ALERT_BRIDGE_JS + VOUCHER_STYLE_JS}
                onMessage={(e) => {
                  try {
                    const data = JSON.parse(e.nativeEvent.data);
                    // טיפול בכפתור שמירה לגלריה
                    if (data.type === 'save-to-gallery') {
                      console.log('[PUSH] Save to gallery requested');
                      saveVoucherToGallery().catch(err => console.error('[PUSH] Save error:', err));
                      return;
                    }
                    if (data.type === 'diagnostics') {
                      console.log('[VoucherDiag-PUSH] Diagnostics payload:', data);
                      if (data.viewport) {
                        console.log('[VoucherDiag-PUSH] === VIEWPORT INFO ===');
                        console.log('[VoucherDiag-PUSH] innerWidth:', data.viewport.innerWidth);
                        console.log('[VoucherDiag-PUSH] innerHeight:', data.viewport.innerHeight);
                        console.log('[VoucherDiag-PUSH] devicePixelRatio:', data.viewport.devicePixelRatio);
                        console.log('[VoucherDiag-PUSH] screen:', data.viewport.screenWidth, 'x', data.viewport.screenHeight);
                        console.log('[VoucherDiag-PUSH] document:', data.viewport.documentWidth, 'x', data.viewport.documentHeight);
                        console.log('[VoucherDiag-PUSH] ======================');
                      }
                    }
                  } catch {
                    // התעלם משגיאות פרסינג
                  }
                }}
                onLoadStart={(event) => console.log('[VoucherDiag-PUSH] WebView onLoadStart:', event.nativeEvent.url)}
                onLoadEnd={(event) => {
                  console.log('[VoucherDiag-PUSH] WebView onLoadEnd:', event.nativeEvent.url);
                  setTimeout(() => {
                    pushWebViewRef.current?.injectJavaScript(`
                      (function(){
                        try {
                          const htmlPreview = document.body ? document.body.innerHTML.substring(0, 500) : '';
                          const payload = {
                            type: 'diagnostics',
                            location: window.location.href,
                            hash: window.location.hash,
                            title: document.title,
                            bodyLength: document.body ? document.body.innerHTML.length : 0,
                            htmlPreview: htmlPreview,
                            viewport: {
                              innerWidth: window.innerWidth,
                              innerHeight: window.innerHeight,
                              devicePixelRatio: window.devicePixelRatio,
                              screenWidth: screen.width,
                              screenHeight: screen.height,
                              documentWidth: document.documentElement.clientWidth,
                              documentHeight: document.documentElement.clientHeight
                            }
                          };
                          console.log('[VoucherDiag-PUSH] Viewport:', JSON.stringify(payload.viewport));
                          console.log('[VoucherDiag-PUSH] HTML Preview:', htmlPreview);
                          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
                        } catch(err) {
                          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'diagnostics-error', message: err.message }));
                        }
                      })();
                    `);
                  }, 500);
                }}
                onError={(event) => console.log('[VoucherDiag-PUSH] WebView onError:', event.nativeEvent)}
                onHttpError={(event) => console.log('[VoucherDiag-PUSH] WebView onHttpError:', event.nativeEvent)}
                onNavigationStateChange={(navState) => console.log('[VoucherDiag-PUSH] navigation:', navState.url, 'loading:', navState.loading)}
                onShouldStartLoadWithRequest={(req) => {
                  try {
                    const next = new URL(req.url);
                    const base = new URL(inlineUrl!);
                    if (next.origin === base.origin) return true;
                  } catch {}
                  return false;
                }}
                style={styles.webview}
              />
              </ViewShot>
            ) : null}
          </View>
        </View>
      </Modal>
    </BusinessProvider>
  );
} 

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    alignItems: 'flex-end',
  },
  modalCardInsetOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
  },
  titleWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  titlePill: {
    backgroundColor: '#E9E9E9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  embedContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#000000',
  },
  embedInsetWrap: {
    flex: 1,
    padding: 2,
    backgroundColor: '#FFFFFF',
  },
  embedInsetBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 6,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewCard: {
    flex: 1,
    backgroundColor: 'white',
  },
  voucherInsetWrap: {
    flex: 1,
    padding: 2,
  },
  voucherInsetBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
  },
  webviewClose: {
    position: 'absolute',
    top: 26,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: 'bold',
    marginBottom: 0,
    textAlign: 'center',
    alignSelf: 'center',
    fontFamily: 'Heebo',
    includeFontPadding: false,
  },
  modalBody: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'right',
    alignSelf: 'flex-end',
    fontFamily: 'Heebo',
  },
  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  pillButton: {
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 999,
    width: 110,
    alignItems: 'center',
  },
  pillInsetOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 999,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'normal',
    textAlign: 'center',
    fontFamily: 'Heebo',
  },
  closePill: {
    backgroundColor: '#1E51E9',
  },
  viewPill: {
    backgroundColor: '#0F9FB8',
  },
  toastCard: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    maxWidth: '90%',
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Heebo',
  },
});
