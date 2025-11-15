import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, Modal, Text, View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BusinessProvider } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';

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

  const showTimedToast = (message: string, ms = 3000) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), ms);
  };

  const ALERT_BRIDGE_JS = `
    (function() {
      var __bridge = window.ReactNativeWebView && window.ReactNativeWebView.postMessage ? window.ReactNativeWebView : null;
      if (!__bridge) return;
      window.alert = function(msg){ __bridge.postMessage(JSON.stringify({ type: 'alert', message: String(msg||'') })); };
      window.confirm = function(msg){ __bridge.postMessage(JSON.stringify({ type: 'confirm', message: String(msg||'') })); return true; };
      window.prompt = function(msg, def){ __bridge.postMessage(JSON.stringify({ type: 'prompt', message: String(msg||'') })); return ''; };
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

  return (
    <BusinessProvider>
      <Slot />
      {/* מודל התראה מובנה באפליקציה עם RTL מלא */}
      <Modal visible={!!notification} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* כותרת עם היילייט עדין מאחור */}
            <View style={styles.titleWrap}>
              <View style={styles.titleHighlight} />
              <Text style={styles.modalTitle}>{notification?.title}</Text>
            </View>
            {/* הטמעת Canva אם קיים קישור בגוף ההודעה */}
            {(() => {
              const url = extractCanvaUrl(notification?.body);
              if (!url) return null;
              return (
                <View style={styles.embedContainer}>
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
                      // לכל alert שנשלח מתוך הדף – נציג הודעת מערכת במקום דיאלוג
                      showTimedToast('השובר נשמר לגלריית התמונות בהצלחה');
                    }}
                    onShouldStartLoadWithRequest={(req) => {
                      // לאפשר רק ניווט בתוך דומיין canva כדי למנוע דיאלוגי מערכת
                      try {
                        const host = new URL(req.url).hostname;
                        if (host.endsWith('canva.com') || host.endsWith('canva.cn')) return true;
                      } catch {}
                      return false;
                    }}
                    style={styles.webview}
                  />
                </View>
              );
            })()}
            <Text style={styles.modalBody}>
              {notification ? sanitizeBody(notification.body, notification.voucherUrl) : ''}
            </Text>
            {/* שורת כפתורים מפולפלת בסגנון גלולה */}
            <View style={styles.buttonsRow}>
              {notification?.voucherUrl ? (
                <TouchableOpacity
                  style={[styles.pillButton, styles.viewPill]}
                  onPress={() => {
                    if (notification?.voucherUrl) {
                      let url = notification.voucherUrl;
                      const phone = FCMService.getCurrentPhone();
                      if (phone) {
                        const separator = url.includes('?') ? '&' : '?';
                        url = `${url}${separator}phone=${phone}`;
                      }
                      // חזרה לפתיחה בדפדפן חיצוני כמו בקומיט המקורי
                      Linking.openURL(url);
                    }
                  }}
                >
                  <Text style={styles.pillText}>צפה בשובר</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.pillButton, styles.closePill]} onPress={() => setNotification(null)}>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.webviewCard}>
            <TouchableOpacity
              style={styles.webviewClose}
              onPress={() => setInlineUrl(null)}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#666', fontFamily: 'Heebo' }}>×</Text>
            </TouchableOpacity>
            {inlineUrl ? (
              <WebView
                source={{ uri: inlineUrl }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                setSupportMultipleWindows={false}
                userAgent="Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36"
                injectedJavaScriptBeforeContentLoaded={ALERT_BRIDGE_JS}
                injectedJavaScript={ALERT_BRIDGE_JS}
                onMessage={(e) => {
                  showTimedToast('השובר נשמר לגלריית התמונות בהצלחה');
                }}
                onShouldStartLoadWithRequest={(req) => {
                  // לאפשר רק ניווט באותו מקור (origin) כמו ה-URL הראשי של השובר
                  try {
                    const next = new URL(req.url);
                    const base = new URL(inlineUrl!);
                    if (next.origin === base.origin) return true;
                  } catch {}
                  return false;
                }}
                style={styles.webview}
              />
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
  titleWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  titleHighlight: {
    position: 'absolute',
    width: '70%',
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 999,
  },
  embedContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    width: '92%',
    height: '80%',
    overflow: 'hidden',
  },
  webviewClose: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    alignSelf: 'center',
    fontFamily: 'Heebo',
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
