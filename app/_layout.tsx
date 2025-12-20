import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Linking } from 'react-native';
import { useEffect, useRef } from 'react';
import { useBusiness } from '../components/BusinessContext';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../components/supabaseClient';

const BIOMETRIC_PHONE_KEY = 'biometric_phone';

export default function RootLayout() {
  const router = useRouter();
  const { setBusinessCode } = useBusiness();
  const deepLinkHandled = useRef(false);
  const isRouterReady = useRef(false);
  const pendingDeepLink = useRef<string | null>(null);
  const lastDeepLinkTime = useRef<number>(0);

  // Deep Link Handler - מטפל ב-NFC URI מברקע (iOS + Android)
  useEffect(() => {
    // סימון שה-router מוכן אחרי המתנה קצרה
    const readyTimer = setTimeout(() => {
      isRouterReady.current = true;
      // אם יש deep link ממתין, טפל בו עכשיו
      if (pendingDeepLink.current) {
        processDeepLink(pendingDeepLink.current);
        pendingDeepLink.current = null;
      }
    }, 500);

    const processDeepLink = async (url: string) => {
      // מניעת טיפול כפול - עם cooldown של 5 שניות
      const now = Date.now();
      if (deepLinkHandled.current && (now - lastDeepLinkTime.current) < 5000) {
        console.log('[Deep Link] Ignored - cooldown active');
        return;
      }
      deepLinkHandled.current = true;
      lastDeepLinkTime.current = now;
      
      // איפוס הדגל אחרי 5 שניות לאפשר deep links חדשים
      setTimeout(() => {
        deepLinkHandled.current = false;
      }, 5000);

      console.log('[Deep Link] Processing URL:', url);

      // פורמט: mycardz://business/0002
      if (url.startsWith('mycardz://business/')) {
        const businessCode = url.replace('mycardz://business/', '');
        console.log('[Deep Link] Business code extracted:', businessCode);
        
        try {
          // בדיקה 1: יש מספר טלפון שמור?
          const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
          console.log('[Deep Link] Saved phone:', savedPhone ? 'exists' : 'none');

          if (!savedPhone) {
            // אין טלפון שמור - עבור לדף כניסה
            await setBusinessCode(businessCode);
            router.replace({
              pathname: '/(tabs)/customers-login',
              params: { businessCode, nfcLaunch: 'true' }
            });
            return;
          }

          // בדיקה 2: שליפת פרטי עסק ומצב ניקוב
          const { data: businessData } = await supabase
            .from('businesses')
            .select('business_code, punch_mode')
            .eq('business_code', businessCode)
            .single();

          console.log('[Deep Link] Business data:', businessData);

          // בדיקה 3: כמה כרטיסיות יש ללקוח בעסק זה?
          const { data: cards } = await supabase
            .from('PunchCards')
            .select('card_number')
            .eq('customer_phone', savedPhone)
            .eq('business_code', businessCode)
            .eq('status', 'active');

          console.log('[Deep Link] Active cards:', cards?.length || 0);

          // הגדרת העסק בקונטקסט
          await setBusinessCode(businessCode);

          // תנאים לניקוב אוטומטי:
          // 1. punch_mode === 'auto'
          // 2. יש בדיוק כרטיסייה אחת
          const isAutoMode = businessData?.punch_mode === 'auto';
          const hasSingleCard = cards && cards.length === 1;

          if (isAutoMode && hasSingleCard) {
            console.log('[Deep Link] Auto-punch conditions met! Going directly to PunchCard');
            router.replace({
              pathname: '/(tabs)/PunchCard',
              params: { 
                phone: savedPhone, 
                nfcLaunch: 'true',
                autoPunch: 'true' // פרמטר חדש לניקוב אוטומטי
              }
            });
          } else {
            console.log('[Deep Link] Going to customers-login');
            router.replace({
              pathname: '/(tabs)/customers-login',
              params: { businessCode, nfcLaunch: 'true' }
            });
          }
        } catch (error) {
          console.log('[Deep Link] Error:', error);
          // במקרה של שגיאה - עבור לדף כניסה
          await setBusinessCode(businessCode);
          router.replace({
            pathname: '/(tabs)/customers-login',
            params: { businessCode, nfcLaunch: 'true' }
          });
        }
      }
    };

    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('[Deep Link] Received URL:', url);

      // אם ה-router עדיין לא מוכן, שמור את ה-URL לטיפול מאוחר יותר
      if (!isRouterReady.current) {
        console.log('[Deep Link] Router not ready, storing for later');
        pendingDeepLink.current = url;
        return;
      }

      await processDeepLink(url);
    };

    // מאזין ל-deep links כשהאפליקציה פתוחה
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // בדיקת URL שפתח את האפליקציה (אם הייתה סגורה)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
      clearTimeout(readyTimer);
    };
  }, [router, setBusinessCode]);

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <style id="hide-rnw-debug-overlay">{`[tabindex="0"][class*="r-backgroundColor"][class*="r-borderColor"], [tabindex="0"][style*="transition-duration"]{display:none!important;outline:none!important;}`}</style>
        </Head>
      )}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
} 