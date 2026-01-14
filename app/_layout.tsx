import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { Linking, Platform } from 'react-native';

// לכידת Initial URL מוקדם ככל האפשר - ברמת המודול לפני כל רנדור
// זה מבטיח שלא נפספס את ה-URL גם אם יש עיכוב בטעינת tabs layout
let _capturedInitialUrl: string | null = null;
let _initialUrlCaptured = false;
let _resolveInitialUrl: (url: string | null) => void;
export const initialUrlPromise = new Promise<string | null>(resolve => {
  _resolveInitialUrl = resolve;
});

// קריאה מיידית - רצה בזמן טעינת המודול
if (Platform.OS !== 'web') {
  Linking.getInitialURL().then(url => {
    _capturedInitialUrl = url;
    _initialUrlCaptured = true;
    _resolveInitialUrl(url);
    if (url) {
      console.log('[RootLayout] Captured initial URL early:', url);
    }
  }).catch(err => {
    console.log('[RootLayout] Failed to capture initial URL:', err);
    _initialUrlCaptured = true;
    _resolveInitialUrl(null);
  });
} else {
  // Web fallback
  _initialUrlCaptured = true;
  _resolveInitialUrl(null);
}

// פונקציה לקבלת ה-URL שנלכד - לשימוש ב-tabs layout
export const getCapturedInitialUrl = (): string | null => _capturedInitialUrl;
export const isInitialUrlCaptured = (): boolean => _initialUrlCaptured;

export default function RootLayout() {
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
