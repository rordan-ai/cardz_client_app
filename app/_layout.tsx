import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  // Global FCM Setup - מאזין לכל הפושים בלי קשר למסך הנוכחי
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    // Dynamic import של Firebase - רק ב-native
    const messaging = require('@react-native-firebase/messaging').default;

    // בקשת הרשאות להתראות
    const requestPermissions = async () => {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // קבלת טוקן FCM גלובלי
        const token = await messaging().getToken();
        await AsyncStorage.setItem('global_fcm_token', token);
      }
    };

    requestPermissions();

    // Listener להודעות שמגיעות כשהאפליקציה פתוחה (Foreground)
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage: any) => {
      if (!remoteMessage.data) return;

      const { businessCode, customerPhone } = remoteMessage.data;
      
      if (!businessCode || !customerPhone) {
        return;
      }

      // יצירת מפתח ייחודי לשמירה לפי עסק + לקוח
      const storageKey = `notifications_${businessCode}_${customerPhone}`;

      try {
        // טעינת הודעות קיימות
        const existingNotifications = await AsyncStorage.getItem(storageKey);
        const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];

        // הוספת ההודעה החדשה
        const newNotification = {
          id: Date.now().toString(),
          title: remoteMessage.notification?.title || 'התראה חדשה',
          body: remoteMessage.notification?.body || '',
          timestamp: new Date().toISOString(),
          read: false,
          data: remoteMessage.data,
        };

        notifications.unshift(newNotification); // הוספה בתחילת המערך

        // שמירה חזרה
        await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
      } catch (error) {
        console.error('Error saving notification:', error);
      }
    });

    // Listener להודעות שנפתחו מה-notification tray
    const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp((remoteMessage: any) => {
      // כאן אפשר לנתב למסך מסוים אם צריך
    });

    // בדיקה אם האפליקציה נפתחה מהודעה
    messaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          // כאן אפשר לנתב למסך מסוים אם צריך
        }
      });

    // ניקוי
    return () => {
      unsubscribeOnMessage();
      unsubscribeOnNotificationOpenedApp();
    };
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
      </Stack>
    </>
  );
} 