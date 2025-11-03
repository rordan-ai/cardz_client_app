import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, Modal, Text, View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BusinessProvider } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';

const sanitizeBody = (body: string, voucherUrl?: string) => {
  let result = body;
  if (voucherUrl) {
    result = result.replace(voucherUrl, '');
    result = result.replace(/🎁?\s*קישור לשובר[:：]?\s*/g, '');
  }
  return result.trim();
};

export default function Layout() {
  const [notification, setNotification] = useState<{ title: string; body: string; voucherUrl?: string } | null>(null);

  // אתחול FCM Service - רץ פעם אחת בלבד
  useEffect(() => {
    FCMService.initialize();
  }, []);

  // האזנה להתראות FCM
  useEffect(() => {
          const listener = DeviceEventEmitter.addListener('show_inapp_notification', (data: { title: string; body: string; voucherUrl?: string }) => {
      setNotification(data);
    });
    return () => listener.remove();
  }, []);

  return (
    <BusinessProvider>
      <Slot />
      {/* מודל התראה מובנה באפליקציה עם RTL מלא */}
      <Modal visible={!!notification} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{notification?.title}</Text>
            <Text style={styles.modalBody}>
              {notification ? sanitizeBody(notification.body, notification.voucherUrl) : ''}
            </Text>
            {notification?.voucherUrl ? (
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => {
                  if (notification?.voucherUrl) {
                    Linking.openURL(notification.voucherUrl);
                  }
                }}
              >
                <MaterialCommunityIcons name="gift-outline" size={20} color="#FFFFFF" style={styles.modalActionIcon} />
                <Text style={styles.modalActionButtonText}>צפה בשובר</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.modalButton} onPress={() => setNotification(null)}>
              <Text style={styles.modalButtonText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </BusinessProvider>
  );
} 

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    alignItems: 'flex-end',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    alignSelf: 'center',
  },
  modalBody: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  modalActionButton: {
    backgroundColor: '#0F9FB8',
    paddingVertical: 12,
    borderRadius: 8,
    paddingHorizontal: 36,
    alignSelf: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalActionIcon: {
    marginRight: 6,
  },
  modalActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#1E51E9',
    paddingVertical: 12,
    borderRadius: 8,
    paddingHorizontal: 40,
    alignSelf: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
