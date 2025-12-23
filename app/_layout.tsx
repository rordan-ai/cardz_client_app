import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Linking } from 'react-native';
import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../components/supabaseClient';

const BIOMETRIC_PHONE_KEY = 'biometric_phone';

export default function RootLayout() {
  const router = useRouter();
  const nfcHandledRef = useRef(false);

  // NFC Deep Link Handler - intercepts mycardz://business/XXXX
  useEffect(() => {
    const handleNfcDeepLink = async (url: string) => {
      if (nfcHandledRef.current) return;
      
      console.log('[RootLayout] Deep link:', url);
      
      if (!url.startsWith('mycardz://business/')) return;
      
      const businessCode = url.replace('mycardz://business/', '');
      console.log('[RootLayout] Business:', businessCode);
      
      nfcHandledRef.current = true;

      try {
        let savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        
        // המרה לפורמט בינלאומי אם צריך
        if (savedPhone && /^05\d{8}$/.test(savedPhone)) {
          savedPhone = `972${savedPhone.slice(1)}`;
        }
        
        console.log('[RootLayout] Phone:', savedPhone ? 'exists' : 'none');
        
        if (!savedPhone) {
          // אין ביומטרי - למסך כניסה
          console.log('[RootLayout] → customers-login');
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
          .eq('customer_phone', savedPhone)
          .eq('business_code', businessCode)
          .eq('status', 'active');

        const isAuto = businessData?.punch_mode === 'auto';
        const hasSingle = cards && cards.length === 1;
        const isPrepaid = hasSingle ? cards[0].prepaid === 'כן' : false;

        console.log('[RootLayout] auto:', isAuto, 'single:', hasSingle, 'prepaid:', isPrepaid);

        // ניווט ישיר ל-PunchCard עם הפרמטרים המתאימים
        console.log('[RootLayout] → PunchCard');
        router.replace({
          pathname: '/(tabs)/PunchCard',
          params: {
            phone: savedPhone,
            businessCode,
            nfcLaunch: 'true',
            autoPunch: (isAuto && hasSingle && isPrepaid) ? 'true' : 'false'
          }
        });
      } catch (err) {
        console.error('[RootLayout] Error:', err);
        router.replace('/(tabs)/business_selector');
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleNfcDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => handleNfcDeepLink(url));
    return () => subscription.remove();
  }, []);

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <style id="hide-rnw-debug-overlay">{`[tabindex="0"][class*="r-backgroundColor"][class*="r-borderColor"], [tabindex="0"][style*="transition-duration"]{display:none!important;outline:none!important;}`}</style>
        </Head>
      )}
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="business" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
