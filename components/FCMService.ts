import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { Platform, DeviceEventEmitter, Linking } from 'react-native';
import { supabase } from './supabaseClient';

class FCMService {
  private static instance: FCMService;
  private deviceId: string | null = null;
  private initializationPromise: Promise<void> | null = null;
  
  private constructor() {}
  
  static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  // אתחול FCM - לקרוא מיד בהפעלת האפליקציה
  async initialize() {
    if (Platform.OS === 'web') return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }
  
  private async doInitialize() {
    
    try {
      // בקשת הרשאות
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('FCM permissions not granted');
        return;
      }

      // קבלת או יצירת device ID
      let deviceId = await AsyncStorage.getItem('device_unique_id');
      if (!deviceId) {
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem('device_unique_id', deviceId);
      }
      this.deviceId = deviceId;

      // קבלת FCM token
      const token = await messaging().getToken();
      if (token) {
        await this.registerDevice(token);
        await AsyncStorage.setItem('global_fcm_token', token);
      }

      // האזנה לעדכוני טוקן
      messaging().onTokenRefresh(async (newToken) => {
        await this.registerDevice(newToken);
        await AsyncStorage.setItem('global_fcm_token', newToken);
      });

      // האזנה להודעות (foreground)
      messaging().onMessage(async (remoteMessage) => {
        console.log('FCM Message received:', remoteMessage);
        // שמירת ההודעה ב-AsyncStorage
        if (remoteMessage.data?.business_code) {
          await this.saveNotification(remoteMessage);
        }
        // הצגת אינדיקציה למשתמש כאשר האפליקציה בחזית (דרך אירוע גלובלי במקום Alert ש-LTR בלבד)
        const title = remoteMessage.notification?.title || 'הודעה חדשה';
        const body = remoteMessage.notification?.body || '';
        const voucherUrl = remoteMessage.data?.voucher_url;
        DeviceEventEmitter.emit('show_inapp_notification', { title, body, voucherUrl });
      });

      // פתיחת קישורי שובר בעת לחיצה על ההתראה כשהאפליקציה ברקע
      messaging().onNotificationOpenedApp(async (remoteMessage) => {
        const voucherUrl = remoteMessage?.data?.voucher_url;
        if (voucherUrl) {
          try {
            await Linking.openURL(voucherUrl);
          } catch (err) {
            console.error('Failed to open voucher URL from notification (background):', err);
          }
        }
      });

      // פתיחת קישורי שובר כאשר האפליקציה נפתחת מתוך התראה במצב סגור
      const initialNotification = await messaging().getInitialNotification();
      const initialVoucherUrl = initialNotification?.data?.voucher_url;
      if (initialVoucherUrl) {
        try {
          await Linking.openURL(initialVoucherUrl);
        } catch (err) {
          console.error('Failed to open voucher URL from initial notification:', err);
        }
      }

    } catch (error) {
      console.error('FCM initialization error:', error);
    }
  }

  // רישום המכשיר בסופרבייס (ללא תלות במספר טלפון)
  private async registerDevice(token: string) {
    if (!this.deviceId) return;

    try {
      console.log('[FCM] Calling register-device-token with:', {
        device_id: this.deviceId,
        token: token.substring(0, 20) + '...',
        platform: Platform.OS,
        environment: 'prod'
      });
      
      const { data, error } = await supabase.functions.invoke('register-device-token', {
        body: {
          device_id: this.deviceId,
          token: token,
          platform: Platform.OS,
          environment: 'prod'
        }
      });

      console.log('[FCM] register-device-token response:', {
        data: data,
        error: error
      });

      if (error) {
        console.error('Device registration error:', error);
      } else {
        console.log('Device registered successfully');
      }
    } catch (error) {
      console.error('Device registration error:', error);
    }
  }

  // הוספת business_code למכשיר
  async addBusinessCode(businessCode: string) {
    console.log('FCMService: addBusinessCode called with:', businessCode);
    
    // ודא שהאתחול הושלם
    if (this.initializationPromise) {
      console.log('FCMService: Waiting for initialization to complete...');
      await this.initializationPromise;
    }
    
    console.log('FCMService: deviceId:', this.deviceId);
    
    if (!this.deviceId) {
      console.error('FCMService: No deviceId available even after initialization');
      return;
    }

    try {
      console.log('FCMService: Calling add-business-to-device edge function');
      const { data, error } = await supabase.functions.invoke('add-business-to-device', {
        body: {
          device_id: this.deviceId,
          business_code: businessCode
        }
      });
      
      console.log('[FCM] add-business-to-device response:', {
        data: data,
        error: error
      });

      if (!error) {
        // שמירה מקומית של העסקים הרשומים
        const registeredBusinesses = await AsyncStorage.getItem('registered_businesses');
        const businesses = registeredBusinesses ? JSON.parse(registeredBusinesses) : [];
        if (!businesses.includes(businessCode)) {
          businesses.push(businessCode);
          await AsyncStorage.setItem('registered_businesses', JSON.stringify(businesses));
        }
      }
    } catch (error) {
      console.error('Add business code error:', error);
    }
  }

  // שמירת הודעה ב-AsyncStorage
  private async saveNotification(remoteMessage: any) {
    const businessCode = remoteMessage.data?.business_code;
    if (!businessCode) return;

    const notification = {
      id: Date.now().toString(),
      title: remoteMessage.notification?.title || '',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data,
      timestamp: new Date().toISOString(),
      read: false
    };

    const storageKey = `notifications_${businessCode}`;
    const existing = await AsyncStorage.getItem(storageKey);
    const notifications = existing ? JSON.parse(existing) : [];
    
    notifications.unshift(notification);
    // שמירת עד 50 הודעות אחרונות
    if (notifications.length > 50) {
      notifications.pop();
    }
    
    await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
  }

  // יצירת device ID ייחודי
  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // פונקציות עזר לקריאת נתונים
  async getNotifications(businessCode: string) {
    const storageKey = `notifications_${businessCode}`;
    const data = await AsyncStorage.getItem(storageKey);
    return data ? JSON.parse(data) : [];
  }

  async markAsRead(businessCode: string, notificationId: string) {
    const storageKey = `notifications_${businessCode}`;
    const data = await AsyncStorage.getItem(storageKey);
    if (!data) return;

    const notifications = JSON.parse(data);
    const notification = notifications.find((n: any) => n.id === notificationId);
    if (notification) {
      notification.read = true;
      await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
    }
  }

  async deleteNotification(businessCode: string, notificationId: string) {
    const storageKey = `notifications_${businessCode}`;
    const data = await AsyncStorage.getItem(storageKey);
    if (!data) return;

    const notifications = JSON.parse(data);
    const filtered = notifications.filter((n: any) => n.id !== notificationId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
  }
}

export default FCMService.getInstance();
