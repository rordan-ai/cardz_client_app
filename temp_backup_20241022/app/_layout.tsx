import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    // רישום FCM גלובלי - יקרה מיד כשהאפליקציה נטענת
    const setupFCM = async () => {
      try {
        // FCM Setup - הודעות דיבאג הוסרו לייצור
        
        // בקשת הרשאות
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
        if (!enabled) {
          return;
        }
        
        // קבלת טוקן
        const fcmToken = await messaging().getToken();
        // Token saved to AsyncStorage
        
        // שמירת הטוקן ב-AsyncStorage לשימוש מאוחר יותר
        await AsyncStorage.setItem('global_fcm_token', fcmToken);
        
        // הגדרת listeners להתראות
        const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
          // שמירת ההתראה ב-AsyncStorage
          try {
            const globalToken = await AsyncStorage.getItem('global_fcm_token');
            const businessCode = remoteMessage.data?.businessCode;
            const customerPhone = remoteMessage.data?.customerPhone;
            
            if (businessCode && customerPhone) {
              const storageKey = `notifications_${businessCode}_${customerPhone}`;
              const existingNotifications = await AsyncStorage.getItem(storageKey);
              const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
              
              const newNotification = {
                id: Date.now().toString(),
                title: remoteMessage.notification?.title || 'התראה חדשה',
                body: remoteMessage.notification?.body || '',
                timestamp: Date.now(),
                read: false
              };
              
              notifications.unshift(newNotification);
              await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
            }
          } catch (error) {
            // Error saving notification - handled silently
          }
          
          // התראה התקבלה - מציג Alert
          Alert.alert(
            remoteMessage.notification?.title || 'התראה חדשה',
            remoteMessage.notification?.body || 'התקבלה התראה',
            [{ text: 'OK' }]
          );
        });

        const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
          // טיפול בלחיצה על התראה
        });

        // בדיקה אם האפליקציה נפתחה מהתראה
        messaging()
          .getInitialNotification()
          .then(remoteMessage => {
            if (remoteMessage) {
              // האפליקציה נפתחה מהתראה
            }
          });

        // ניקוי בעת סגירת האפליקציה
        return () => {
          unsubscribeOnMessage();
          unsubscribeOnNotificationOpenedApp();
        };
      } catch (error) {
        // FCM Setup Error - handled silently
      }
    };

    setupFCM();
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