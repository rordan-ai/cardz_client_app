import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Linking } from 'react-native';
import { useEffect } from 'react';
import { useBusiness } from '../components/BusinessContext';

export default function RootLayout() {
  const router = useRouter();
  const { setBusinessCode } = useBusiness();

  // Deep Link Handler - מטפל ב-NFC URI מברקע (iOS + Android)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('[Deep Link] Received URL:', url);

      // פורמט: mycardz://business/0002
      if (url.startsWith('mycardz://business/')) {
        const businessCode = url.replace('mycardz://business/', '');
        console.log('[Deep Link] Business code extracted:', businessCode);
        
        // הגדרת העסק בקונטקסט
        await setBusinessCode(businessCode);
        
        // ניווט למסך כניסה עם פרמטרים של NFC launch
        router.replace({
          pathname: '/(tabs)/customers-login',
          params: { businessCode, nfcLaunch: 'true' }
        });
      }
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