import 'expo-router/entry';

import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function saveNotification(remoteMessage) {
  try {
    const businessCode = remoteMessage?.data?.business_code;
    if (!businessCode) return;

    const notification = {
      id: Date.now().toString(),
      title: remoteMessage?.notification?.title || '',
      body: remoteMessage?.notification?.body || '',
      data: remoteMessage?.data || {},
      timestamp: new Date().toISOString(),
      read: false,
    };

    const storageKey = `notifications_${businessCode}`;
    const existing = await AsyncStorage.getItem(storageKey);
    const notifications = existing ? JSON.parse(existing) : [];

    notifications.unshift(notification);
    if (notifications.length > 50) notifications.pop();

    await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
  } catch (_) {
    // ignore
  }
}

// Register background handler at the root scope per RNFirebase requirements
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    if (remoteMessage?.data?.business_code) {
      await saveNotification(remoteMessage);
    }
  } catch (_) {}
  return Promise.resolve();
});







