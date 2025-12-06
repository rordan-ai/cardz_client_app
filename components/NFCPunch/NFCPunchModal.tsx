import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { useNFCPunch, CustomerCard, PunchFlowState } from '../../hooks/useNFCPunch';

const { width } = Dimensions.get('window');

interface NFCPunchModalProps {
  visible: boolean;
  businessId: number;
  businessName: string;
  nfcString: string;
  brandColor?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NFCPunchModal: React.FC<NFCPunchModalProps> = ({
  visible,
  businessId,
  businessName,
  nfcString,
  brandColor = '#9747FF',
  onClose,
  onSuccess,
}) => {
  const {
    flowState,
    customerPhone,
    customerCards,
    selectedCard,
    error,
    startPunchFlow,
    identifyWithBiometric,
    identifyWithPhone,
    selectCard,
    cancelFlow,
    resetFlow,
  } = useNFCPunch();

  const [phoneInput, setPhoneInput] = React.useState('');
  const [showPhoneInput, setShowPhoneInput] = React.useState(false);

  // התחלת פלואו כשהמודאל נפתח
  useEffect(() => {
    if (visible && businessId && nfcString) {
      startPunchFlow(businessId, nfcString);
    }
  }, [visible, businessId, nfcString]);

  // טיפול בהצלחה
  useEffect(() => {
    if (flowState === 'success') {
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    }
  }, [flowState]);

  const handleClose = () => {
    resetFlow();
    setPhoneInput('');
    setShowPhoneInput(false);
    onClose();
  };

  const handlePhoneSubmit = async () => {
    const success = await identifyWithPhone(phoneInput);
    if (success) {
      setShowPhoneInput(false);
    }
  };

  const handleBiometricRetry = async () => {
    const success = await identifyWithBiometric();
    if (!success) {
      setShowPhoneInput(true);
    }
  };

  const handleSkipBiometric = () => {
    setShowPhoneInput(true);
  };

  // רינדור לפי מצב
  const renderContent = () => {
    switch (flowState) {
      case 'identifying':
        if (showPhoneInput) {
          return (
            <View style={styles.content}>
              <Text style={styles.title}>הזנת מספר טלפון</Text>
              <Text style={styles.message}>הזן את מספר הנייד שלך לזיהוי</Text>
              <TextInput
                style={[styles.phoneInput, { borderColor: brandColor }]}
                placeholder="05XXXXXXXX"
                keyboardType="phone-pad"
                value={phoneInput}
                onChangeText={setPhoneInput}
                maxLength={10}
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: brandColor }]}
                onPress={handlePhoneSubmit}
              >
                <Text style={styles.buttonText}>המשך</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View style={styles.content}>
            <Text style={styles.title}>זיהוי לקוח</Text>
            <Text style={styles.message}>
              מעוניינים להזדהות באופן ביומטרי?{'\n'}
              כך לא תידרשו להקיש את מספר הטלפון שלכם מעתה ולתמיד
            </Text>
            <ActivityIndicator size="large" color={brandColor} style={styles.loader} />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: brandColor }]}
                onPress={handleBiometricRetry}
              >
                <Text style={styles.buttonText}>כן, זהה אותי</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonOutline, { borderColor: brandColor }]}
                onPress={handleSkipBiometric}
              >
                <Text style={[styles.buttonOutlineText, { color: brandColor }]}>
                  הזן מספר ידנית
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'selecting_card':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>בחירת כרטיסייה</Text>
            <Text style={styles.message}>
              נמצאה יותר מכרטיסייה אחת, נא בחר/י את כרטיסיית המוצר לניקוב
            </Text>
            <FlatList
              data={customerCards}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cardItem, { borderColor: brandColor }]}
                  onPress={() => selectCard(item)}
                >
                  <Text style={styles.cardName}>{item.product_name}</Text>
                  <Text style={styles.cardPunches}>
                    {item.current_punches}/{item.total_punches} ניקובים
                  </Text>
                  {item.is_prepaid && (
                    <Text style={[styles.prepaidBadge, { backgroundColor: brandColor }]}>
                      שולם מראש
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              style={styles.cardList}
            />
          </View>
        );

      case 'waiting_approval':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>ממתין לאישור</Text>
            <Text style={styles.message}>מחכה לאישור ממסוף העסק!</Text>
            <ActivityIndicator size="large" color={brandColor} style={styles.loader} />
            <Text style={styles.hint}>אנא המתן, האדמין יאשר בקרוב...</Text>
          </View>
        );

      case 'punching':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>מבצע ניקוב</Text>
            <ActivityIndicator size="large" color={brandColor} style={styles.loader} />
          </View>
        );

      case 'success':
        return (
          <View style={styles.content}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.title}>ניקוב בוצע בהצלחה!</Text>
            <Text style={styles.message}>
              בוצע ניקוב ע"י {businessName}
            </Text>
          </View>
        );

      case 'error':
      case 'timeout':
        return (
          <View style={styles.content}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.title}>שגיאה</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: brandColor }]}
              onPress={() => startPunchFlow(businessId, nfcString)}
            >
              <Text style={styles.buttonText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* כפתור סגירה */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  phoneInput: {
    width: '100%',
    height: 50,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginVertical: 8,
    minWidth: 150,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonOutline: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    marginVertical: 8,
    minWidth: 150,
  },
  buttonOutlineText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  cardList: {
    width: '100%',
    maxHeight: 300,
  },
  cardItem: {
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    marginVertical: 6,
    position: 'relative',
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cardPunches: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  prepaidBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default NFCPunchModal;




