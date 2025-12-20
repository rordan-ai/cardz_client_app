import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../components/supabaseClient';
import { useBusiness } from '../../components/BusinessContext';

const BIOMETRIC_PHONE_KEY = 'biometric_phone';

/**
 * Route handler for NFC deep links
 * URL format: mycardz://business/0002
 * This route processes the deep link and redirects to the appropriate screen
 */
export default function BusinessDeepLinkHandler() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { setBusinessCode } = useBusiness();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processDeepLink = async () => {
      if (!code) {
        console.log('[DeepLink Route] No business code');
        router.replace('/(tabs)/business_selector');
        return;
      }

      console.log('[DeepLink Route] Processing business code:', code);

      try {
        // בדיקה 1: יש מספר טלפון שמור?
        const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        console.log('[DeepLink Route] Saved phone:', savedPhone ? 'exists' : 'none');

        // הגדרת העסק בקונטקסט
        await setBusinessCode(code);

        if (!savedPhone) {
          // אין טלפון שמור - עבור לדף כניסה
          router.replace({
            pathname: '/(tabs)/customers-login',
            params: { businessCode: code, nfcLaunch: 'true' }
          });
          return;
        }

        // בדיקה 2: שליפת פרטי עסק ומצב ניקוב
        const { data: businessData } = await supabase
          .from('businesses')
          .select('business_code, punch_mode')
          .eq('business_code', code)
          .single();

        console.log('[DeepLink Route] Business data:', businessData);

        // בדיקה 3: כמה כרטיסיות יש ללקוח בעסק זה?
        const { data: cards } = await supabase
          .from('PunchCards')
          .select('card_number')
          .eq('customer_phone', savedPhone)
          .eq('business_code', code)
          .eq('status', 'active');

        console.log('[DeepLink Route] Active cards:', cards?.length || 0);

        // תנאים לניקוב אוטומטי:
        // 1. punch_mode === 'auto'
        // 2. יש בדיוק כרטיסייה אחת
        const isAutoMode = businessData?.punch_mode === 'auto';
        const hasSingleCard = cards && cards.length === 1;

        if (isAutoMode && hasSingleCard) {
          console.log('[DeepLink Route] Auto-punch conditions met! Going directly to PunchCard');
          router.replace({
            pathname: '/(tabs)/PunchCard',
            params: { 
              phone: savedPhone, 
              businessCode: code,
              nfcLaunch: 'true',
              autoPunch: 'true'
            }
          });
        } else {
          console.log('[DeepLink Route] Going to customers-login');
          router.replace({
            pathname: '/(tabs)/customers-login',
            params: { businessCode: code, nfcLaunch: 'true' }
          });
        }
      } catch (error) {
        console.log('[DeepLink Route] Error:', error);
        // במקרה של שגיאה - עבור לדף כניסה
        await setBusinessCode(code);
        router.replace({
          pathname: '/(tabs)/customers-login',
          params: { businessCode: code, nfcLaunch: 'true' }
        });
      }
    };

    processDeepLink();
  }, [code]);

  // מסך טעינה בזמן העיבוד
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1E51E9" />
      <Text style={styles.text}>טוען...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Rubik',
  },
});

