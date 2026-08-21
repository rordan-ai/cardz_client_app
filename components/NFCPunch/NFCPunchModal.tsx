import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNFCPunch } from '../../hooks/useNFCPunch';
import { supabase } from '../../components/supabaseClient';
import { getBenefitText } from '../../components/BusinessContext';
import logger from '../../utils/logger';

const { width } = Dimensions.get('window');

interface NFCPunchModalProps {
  visible: boolean;
  businessId: number;
  businessName: string;
  nfcString: string;
  businessCode?: string; // קוד עסק ישיר - מונע באג state ישן
  customerPhone: string; // מספר הטלפון של הלקוח המחובר (כבר מזוהה!)
  selectedCardNumber?: string; // מספר הכרטיסייה שכבר נבחרה (אופציונלי)
  brandColor?: string;
  onClose: () => void;
  onSuccess: (punchedCardNumber?: string) => void; // מעביר את מספר הכרטיסייה שננקבה
  onCardRenewed?: (newCardNumber: string) => void;
  onNeedCardSelection?: () => void; // נקרא כשצריך לפתוח מודאל בחירת כרטיסייה ראשי
}

export const NFCPunchModal: React.FC<NFCPunchModalProps> = ({
  visible,
  businessId,
  businessName,
  nfcString,
  businessCode: businessCodeFromProps,
  customerPhone: customerPhoneFromProps,
  selectedCardNumber,
  brandColor: rawBrandColor = '#9747FF',
  onClose,
  onSuccess,
  onCardRenewed,
  onNeedCardSelection,
}) => {
  // הגנת קונטרסט: רקע המודאל לבן, וכפתורי/טקסטי המותג נצבעים ב-login_brand_color
  // של העסק. מותג לבן/בהיר מדי = טקסט לבן על רקע לבן. במקרה כזה נופלים לסגול ברירת המחדל.
  const brandColor = React.useMemo(() => {
    const fallback = '#9747FF';
    let hex = String(rawBrandColor || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.82 ? fallback : rawBrandColor;
  }, [rawBrandColor]);
  const {
    flowState,
    customerPhone,
    customerCards,
    selectedCard,
    currentBusinessCode,
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
  const hasStartedRef = useRef(false);
  const initialSelectedCardNumberRef = useRef<string | undefined>(undefined);
  const selectedCardRef = useRef(selectedCard); // ref לשמירת selectedCard עדכני
  const [renewing, setRenewing] = React.useState(false);
  const [renewalSuccessMessage, setRenewalSuccessMessage] = React.useState<string | null>(null);
  const [renewalErrorMessage, setRenewalErrorMessage] = React.useState<string | null>(null);
  const [businessRewardData, setBusinessRewardData] = React.useState<any>(null);

  // עדכון ref כשה-selectedCard משתנה (לפתרון stale closure)
  useEffect(() => {
    selectedCardRef.current = selectedCard;
  }, [selectedCard]);

  // שליפת נתוני הטבה של העסק (reward_type וכו')
  useEffect(() => {
    if (visible && currentBusinessCode) {
      (async () => {
        const { data } = await supabase
          .from('businesses')
          .select('reward_type, reward_discount_percent, reward_discount_product, reward_custom_gift, reward_custom_text')
          .eq('business_code', currentBusinessCode)
          .single();
        if (data) setBusinessRewardData(data);
      })();
    }
  }, [visible, currentBusinessCode]);

  // התחלת פלואו כשהמודאל נפתח
  // שולחים את מספר הטלפון ומספר הכרטיסייה כי הלקוח כבר מזוהה וכבר בחר כרטיסייה!
  useEffect(() => {
    // איפוס נעילה כשסוגרים את המודאל
    if (!visible) {
      hasStartedRef.current = false;
      initialSelectedCardNumberRef.current = undefined;
      return;
    }

    // חשוב: לא להפעיל מחדש startPunchFlow בגלל שינוי ב-selectedCardNumber בזמן שהמודאל פתוח
    // (למשל אחרי חידוש כרטיסייה), אחרת נוצר ניקוב/אישור נוסף לא רצוי.
    if (hasStartedRef.current) return;

    if (visible && nfcString && customerPhoneFromProps) {
      hasStartedRef.current = true;
      initialSelectedCardNumberRef.current = selectedCardNumber;
      startPunchFlow(nfcString, customerPhoneFromProps, selectedCardNumber, businessCodeFromProps);
    }
  }, [visible, nfcString, customerPhoneFromProps, selectedCardNumber, startPunchFlow]);

  // לוג לדיבאג - מעקב אחר שינויי flowState
  useEffect(() => {
    console.log('[NFCPunchModal] flowState changed to:', flowState);
  }, [flowState, visible]);

  // כשהלקוח מזוהה (יש טלפון מהקונטקסט) והגענו ל-selecting_card - סוגרים את המודאל
  // כי בחירת כרטיסייה צריכה להתבצע במודאל הראשי של PunchCard, לא כאן
  useEffect(() => {
    if (flowState === 'selecting_card' && customerPhoneFromProps && !selectedCardNumber) {
      console.log('[NFCPunchModal] Customer identified but no card selected - opening main card selection');
      // מודיעים ל-PunchCard לפתוח את מודאל הבחירה הראשי לפני סגירת המודאל הנוכחי
      onNeedCardSelection?.();
      handleClose();
    }
  }, [flowState, customerPhoneFromProps, selectedCardNumber, onNeedCardSelection]);

  const handleClose = () => {
    resetFlow();
    setPhoneInput('');
    setShowPhoneInput(false);
    setRenewing(false);
    setRenewalSuccessMessage(null);
    setRenewalErrorMessage(null);
    onClose();
  };

  // טיפול בהצלחה
  useEffect(() => {
    if (flowState === 'success') {
      setTimeout(() => {
        // מעביר את מספר הכרטיסייה שננקבה בפועל (מה-ref העדכני או מה-props)
        // חשוב: משתמשים ב-ref ולא ב-state כי ה-setTimeout יכול "ללכוד" state ישן (stale closure)
        const punchedCardNumber = selectedCardRef.current?.card_number || selectedCardNumber;
        console.log('[NFCPunchModal] Closing with punchedCardNumber:', punchedCardNumber);
        onSuccess(punchedCardNumber);
        handleClose();
      }, 2000);
    }
  }, [flowState, selectedCardNumber, onSuccess, handleClose]);

  const handleRenewCard = async () => {
    if (renewing) return;
    setRenewalErrorMessage(null);
    setRenewalSuccessMessage(null);

    const businessCode = currentBusinessCode;
    const cardNumber = selectedCard?.card_number || selectedCardNumber;
    const productName = selectedCard?.product_name || businessName || 'מוצר';

    if (!businessCode || !cardNumber || !customerPhoneFromProps) {
      setRenewalErrorMessage('חסרים פרטים לחידוש הכרטיסייה. נסה שוב.');
      return;
    }

    setRenewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('punch-card-renew', {
        body: {
          business_code: businessCode,
          customer_phone: customerPhoneFromProps,
          card_number: cardNumber,
        },
      });

      if (error) {
        console.log('[NFC] Error:', 'punch-card-renew.invoke', error);
        setRenewalErrorMessage('שגיאה בחידוש הכרטיסייה. נסה שוב.');
        setRenewing(false);
        return;
      }

      const newCardNumber = (data as any)?.new_card_number as string | undefined;
      if (!newCardNumber) {
        setRenewalErrorMessage('שגיאה בחידוש הכרטיסייה. נסה שוב.');
        setRenewing(false);
        return;
      }

      // עדכון מסך הכרטיסייה מאחורי המודאל
      onCardRenewed?.(newCardNumber);

      // הודעת הצלחה + סגירה אחרי 3 שניות (לפי הפלואו)
      setRenewalSuccessMessage(`הונפקה לך כרטיסיית ${productName} חדשה בהצלחה`);
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (e) {
      console.log('[NFC] Error:', 'punch-card-renew', e);
      setRenewalErrorMessage('שגיאה בחידוש הכרטיסייה. נסה שוב.');
      setRenewing(false);
    }
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
              keyExtractor={(item) => item.card_number}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cardItem, { borderColor: brandColor }]}
                  onPress={() => selectCard(item)}
                >
                  <Text style={styles.cardName}>{item.product_name}</Text>
                  <Text style={styles.cardPunches}>
                    {item.used_punches}/{item.total_punches} ניקובים
                  </Text>
                  {item.prepaid === 'כן' && (
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
            <Text style={styles.message}>הניקוב נשלח לאישור בית העסק</Text>
            <ActivityIndicator size="large" color={brandColor} style={styles.loader} />
            <Text style={styles.hint}>נעדכן אותך ברגע שהניקוב יאושר/יבוצע</Text>
          </View>
        );

      case 'punching':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>מבצע ניקוב</Text>
            <ActivityIndicator size="large" color={brandColor} style={styles.loader} />
          </View>
        );

      case 'card_full':
        return (
          <View style={styles.content}>
            <Text style={styles.fullCardIcon}>🎉</Text>
            <Text style={styles.title}>הכרטיסייה מלאה!</Text>
            <Text style={styles.message}>
              סיימת למלא את כל הניקובים בכרטיסייה זו.{'\n'}
              האם לפתוח כרטיסייה חדשה?
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: brandColor }]}
                onPress={() => {
                  console.log('[NFC] User requested new card');
                  handleRenewCard();
                }}
                disabled={renewing}
              >
                <Text style={styles.buttonText}>כן, פתח חדשה</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonOutline, { borderColor: brandColor }]}
                onPress={handleClose}
                disabled={renewing}
              >
                <Text style={[styles.buttonOutlineText, { color: brandColor }]}>
                  לא תודה
                </Text>
              </TouchableOpacity>
            </View>
            {renewing && <ActivityIndicator size="large" color={brandColor} style={styles.loader} />}
            {!!renewalSuccessMessage && <Text style={styles.successMessage}>{renewalSuccessMessage}</Text>}
            {!!renewalErrorMessage && <Text style={styles.errorMessage}>{renewalErrorMessage}</Text>}
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
              onPress={() => startPunchFlow(nfcString, customerPhoneFromProps)}
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
  successMessage: {
    fontSize: 16,
    color: '#1e7f3b',
    textAlign: 'center',
    marginTop: 12,
  },
  fullCardIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
});

export default NFCPunchModal;




