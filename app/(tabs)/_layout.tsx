import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { BusinessProvider } from '../../components/BusinessContext';

export default function Layout() {
  // FCM Setup - רק קבלת טוקן והרשאות
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const setupFCM = async () => {
      try {
        // בקשת הרשאות
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) return;

        // קבלת טוקן ושמירה
        const token = await messaging().getToken();
        await AsyncStorage.setItem('global_fcm_token', token);

        // onTokenRefresh
        messaging().onTokenRefresh(async (newToken: string) => {
          await AsyncStorage.setItem('global_fcm_token', newToken);
          await AsyncStorage.setItem('fcm_token_pending_registration', 'true');
        });

        // Listeners ריקים כפי שביקשת
        messaging().onMessage(async () => {});
        messaging().setBackgroundMessageHandler(async () => Promise.resolve());
        
      } catch (error) {
        console.error('FCM Setup Error:', error);
      }
    };

    setupFCM();
  }, []);

  return (
    <BusinessProvider>
      <Slot />
    </BusinessProvider>
  );
}
