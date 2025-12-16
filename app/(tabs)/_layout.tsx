import { Slot } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BusinessProvider } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';
import * as MediaLibrary from 'expo-media-library';
import ViewShot, { captureRef } from 'react-native-view-shot';

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
