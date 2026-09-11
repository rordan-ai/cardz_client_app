import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { BackButton } from '../../components/BackButton';
import { useBusiness } from '../../components/BusinessContext';
import MarketingPopup from '../../components/MarketingPopup';
import { supabase } from '../../components/supabaseClient';
import { useMarketingPopups } from '../../hooks/useMarketingPopups';

// מפתח לשמירה מאובטחת - מספר טלפון בלבד (לא קשור לעסק ספציפי)
const BIOMETRIC_PHONE_KEY = 'biometric_phone';
// המספר שעבר אימות מול ה-DB. מחזיק את המספר עצמו ולא דגל בוליאני: דגל גלובלי
// היה "מאשר" כל מספר שבמקרה שמור במפתח אחר, וכך מספר שגוי מגרסה קודמת היה מקבל
// חותמת אימות. מכשירים מגרסאות קודמות שמרו טלפון בלי אימות ⇒ אין להם מפתח כזה.
const IDENTITY_VERIFIED_KEY = 'identity_verified';
// תקרה לשאילתת האימות: מעליה חוזרים להתנהגות הקודמת (fail-open) כדי שרשת איטית
// לא תהפוך את כפתור הכניסה למת.
const VALIDATION_TIMEOUT_MS = 2500;
const LotteryIcon = require('../../assets/images/LOTTARY.png');
const ShareIcon = require('../../assets/images/SHARE.png');
const PhoneIcon = require('../../assets/images/PHONE.png');
const WhatsappIcon = require('../../assets/images/whatsapp.png');
// האסט המקורי מהאמולטור של האדמין (יד לבנה על שקוף) — פריטי מלא מול תצוגת ההגדרות
const ClickIcon = require('../../assets/images/click_hand_admin.png');
const HamburgerIcon = require('../../assets/images/hamburger_menu.png');
const BiometricIcon = require('../../assets/icons/biometric.png');
const FaceRecognitionIcon = require('../../assets/icons/Face ID (1).png');

const windowWidth = Dimensions.get('window').width;

export default function CustomersLogin() {
  const router = useRouter();
  const { businessCode: nfcBusinessCode, nfcLaunch, autoPunch } = useLocalSearchParams();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const nfcAutoLoginAttempted = useRef(false);
  const pendingLoginPhoneRef = useRef<string | null>(null);
  // נעילת לחיצה כפולה על "כנס" בזמן שאילתת האימות
  const loginInFlightRef = useRef(false);
  // המספר האחרון שעבר אימות מול ה-DB — שומר שהגדרת ביומטרי לא תנציח מספר שגוי
  const verifiedPhoneRef = useRef<string | null>(null);
  // "אינך רשום בעסק זה" (טעות הקלדה או לקוח שטרם נרשם בעסק)
  const [notRegisteredVisible, setNotRegisteredVisible] = useState(false);

  const resolvedBusinessCode = typeof nfcBusinessCode === 'string' ? nfcBusinessCode : Array.isArray(nfcBusinessCode) ? nfcBusinessCode[0] : null;

  // העברת כוונת ניקוב (NFC/ניקוב-ישיר) הלאה למסך הכרטיסייה — בלי זה בקשת הניקוב אובדת בכניסה
  const nfcLaunchStr = typeof nfcLaunch === 'string' ? nfcLaunch : Array.isArray(nfcLaunch) ? nfcLaunch[0] : null;
  const autoPunchStr = typeof autoPunch === 'string' ? autoPunch : Array.isArray(autoPunch) ? autoPunch[0] : null;
  const punchIntentParams = `${nfcLaunchStr === 'true' ? '&nfcLaunch=true' : ''}${autoPunchStr === 'true' ? '&autoPunch=true' : ''}`;

  const [backgroundImageError, setBackgroundImageError] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const { business, loading, refresh: refreshBusiness, setBusinessCode } = useBusiness();

  // חייב להופיע אחרי useBusiness() — הפניה ל-business/loading/setBusinessCode לפני ההצהרה היא TDZ
  // נטען פעם אחת בלבד: שליפת עסק שנכשלה משאירה business=null (הקונטקסט שומר את
  // הערך הטוב האחרון), ובלי החסם הזה מסך הכניסה היה נתקע על "טוען נתוני עסק"
  // בלולאת ניסיונות, בלי כפתור חזרה. אחרי ניסיון כושל מציגים את הטופס כרגיל.
  const [businessLoadFailed, setBusinessLoadFailed] = useState(false);
  useEffect(() => {
    if (resolvedBusinessCode && !business && !loading && !businessLoadFailed) {
      (async () => {
        try { await setBusinessCode(resolvedBusinessCode); } catch {}
        setBusinessLoadFailed(true);
      })();
    }
  }, [resolvedBusinessCode, business, loading, businessLoadFailed, setBusinessCode]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;

  // מצבי כניסה ביומטרית
  const [biometricSetupModalVisible, setBiometricSetupModalVisible] = useState(false);
  const [resetLoginModalVisible, setResetLoginModalVisible] = useState(false);
  
  // מצב מודאל איפוס הכניסה (אישור → הצלחה)
  const [resetStep, setResetStep] = useState<'confirm' | 'success'>('confirm');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricSetupDone, setBiometricSetupDone] = useState(false);
  const [biometricAuthInProgress, setBiometricAuthInProgress] = useState(false);

  const rawBrandColor = business?.login_brand_color || '#9747FF';
  const loginBackgroundColor = business?.background_login_page_color || '#FBF8F8';
  // הגנת קונטרסט מול רקע המסך בפועל (אותו דפוס כמו במודאל החידוש): צבע מותג
  // קרוב מדי לרקע (למשל #EFEFF1 על רקע בהיר) הופך את אלמנטי ההזדהות לבלתי-נראים
  const _lum = (c?: string | null): number | null => {
    let hex = String(c || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const _bgLum = _lum(loginBackgroundColor) ?? 0.97;
  const ensureContrast = (c?: string | null): string => {
    const lum = _lum(c);
    const fallback = _bgLum > 0.5 ? '#9747FF' : '#FFFFFF';
    if (lum === null) return fallback;
    return Math.abs(lum - _bgLum) < 0.25 ? fallback : (c as string);
  };
  const brandColor = ensureContrast(rawBrandColor);
  // צבעים חדשים עם fallback ל-brandColor
  const signupTextColor = ensureContrast(business?.entry_signup_text_color || rawBrandColor);
  // מיפוי מיושר לאמולטור האדמין (CardSettings, מקור האמת העיצובי):
  // entry_click_icon_color = רקע העיגול/כפתור, ו-login_brand_color רק כ-fallback.
  const clickBtnBgColor = business?.entry_click_icon_color || rawBrandColor;
  // האסט זהה לאמולטור (יד לבנה) ומוצג ללא צביעה. רשת ביטחון יחידה: אם העסק הגדיר
  // רקע כפתור בהיר מאוד — היד הלבנה הייתה נעלמת, ולכן נצבעת בכהה (באמולטור לא מטופל).
  const clickIconTint = (_lum(clickBtnBgColor) ?? 0.3) > 0.7 ? '#333333' : undefined;

  // שמירת הזהות המקומית.
  // `verified` = המספר אושר מול ה-DB בפועל. כשלא ניתן היה לאמת (אין קוד עסק / שגיאה /
  // timeout) שומרים כמו קודם כדי לא לחסום לקוח לגיטימי, אבל **בלי** סימון האימות —
  // אחרת טעות הקלדה ברשת איטית הייתה מקבלת חותמת "מאומת" ונכנסת לטופס הרישום.
  const persistIdentity = useCallback(async (p: string, verified: boolean) => {
    try {
      await AsyncStorage.setItem('saved_phone', p);
      // חובה גם ב-SecureStore: מטפל ה-NFC (_layout) וניתוב ה-DeepLink קוראים את
      // BIOMETRIC_PHONE_KEY — בלי זה לקוח בכניסה ידנית (ללא ביומטרי) נזרק לכניסה בכל צמדה
      await SecureStore.setItemAsync(BIOMETRIC_PHONE_KEY, p);
      // כניסה מוצלחת = לקוח קיים — מסך הפתיחה יציג "בחירת עסק" (רישום ראשוני)
      await AsyncStorage.setItem('initial_registration_done', 'true');
      if (verified) await AsyncStorage.setItem(IDENTITY_VERIFIED_KEY, p);
    } catch (error) {
      console.error('שגיאה בשמירת מספר טלפון:', error);
    }
  }, []);

  // אימות שהמספר שהוקש אכן שייך ללקוח בעסק הזה — לפני שהוא נשמר כזהות המכשיר.
  // תלת-מצבי במכוון, כי "אושר" ו"לא ניתן לבדוק" הן תוצאות שונות לגמרי:
  //   'confirmed'  — נמצאה רשומת לקוח (או כרטיסייה פעילה) ⇒ מותר לסמן כמאומת
  //   'not_found'  — הבדיקה רצה והחזירה ריק ⇒ טעות הקלדה או לקוח שטרם נרשם בעסק
  //   'unverified' — אין קוד עסק / שגיאה / timeout ⇒ fail-open: לא חוסמים לקוח
  //                  לגיטימי בגלל תקלת רשת, אבל גם לא מסמנים את המספר כמאומת
  const checkRegistration = useCallback(async (p: string): Promise<'confirmed' | 'not_found' | 'unverified'> => {
    // קוד העסק מגיע מהפרמטר (NFC/deep-link) או מהקונטקסט (בחירה מהרשימה) — כמו ב-PunchCard
    const code = resolvedBusinessCode || business?.business_code;
    if (!code) return 'unverified';
    // וריאנטים זהים ל-PunchCard: לקוחות שהוקמו מהאדמין עשויים להישמר בפורמט 972
    const variants = Array.from(new Set([p, `972${p.slice(1)}`]));
    const withTimeout = <T,>(pr: PromiseLike<T>): Promise<T | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return Promise.race([
        Promise.resolve(pr),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), VALIDATION_TIMEOUT_MS); }),
      ]).finally(() => { if (timer) clearTimeout(timer); });
    };
    try {
      const res = await withTimeout(
        supabase.from('customers').select('customer_phone')
          .in('customer_phone', variants).eq('business_code', code).is('deleted_at', null).limit(1)
      );
      if (!res || res.error) return 'unverified'; // timeout / שגיאה
      if (res.data && res.data.length > 0) return 'confirmed';
      // אין רשומת לקוח. בדיקה צולבת בטבלה שנייה לפני שחוסמים: אם קיימת כרטיסייה
      // פעילה, מדובר באי-עקביות (או בחסימת קריאה על customers) ולא בטעות הקלדה.
      const cards = await withTimeout(
        supabase.from('PunchCards').select('card_number')
          .in('customer_phone', variants).eq('business_code', code).eq('status', 'active').limit(1)
      );
      if (!cards || cards.error) return 'unverified';
      return cards.data && cards.data.length > 0 ? 'confirmed' : 'not_found';
    } catch {
      return 'unverified';
    }
  }, [resolvedBusinessCode, business?.business_code]);

  // פונקציה לאימות ביומטרי (מוגדרת לפני שימוש ב-useEffect כדי לא ליצור ReferenceError)
  const authenticateBiometric = useCallback(async (): Promise<boolean> => {
    try {
      setBiometricAuthInProgress(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'אמת את זהותך לכניסה מהירה',
        cancelLabel: 'ביטול',
        disableDeviceFallback: false,
      });
      setBiometricAuthInProgress(false);
      return result.success;
    } catch (error) {
      setBiometricAuthInProgress(false);
      if (__DEV__) console.error('[Biometric] Auth error:', error);
      return false;
    }
  }, []);

  // איפוס כניסה — מחיקת הזיהוי המקומי בלבד, ללא אימות SMS.
  // הרציונל (אושר 22.08): הכניסה הרגילה היא הקלדת טלפון ללא אימות, כך שאימות
  // באיפוס לא מגן על דבר — רק הוסיף עלות ותלות ב-Firebase Phone Auth שנשברה.
  const performResetLogin = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_PHONE_KEY);
      await AsyncStorage.multiRemove(['saved_phone', IDENTITY_VERIFIED_KEY]);
      verifiedPhoneRef.current = null;
      setBiometricSetupDone(false);
      setPhone('');
      setResetStep('success');
      // סגירת המודאל אחרי 2 שניות
      setTimeout(() => {
        setResetLoginModalVisible(false);
        setResetStep('confirm');
      }, 2000);
    } catch (e) {
      console.log('[ResetLogin] failed:', e);
      setResetLoginModalVisible(false);
      setResetStep('confirm');
      Alert.alert('שגיאה', 'האיפוס נכשל. נסה/י שוב.');
    }
  }, []);

  // בדיקה אם ביומטריה זמינה במכשיר
  useEffect(() => {
    const checkBiometricAvailability = async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);
        
        // בדיקה אם כבר הוגדרה כניסה ביומטרית (לא קשור לעסק ספציפי)
        const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        setBiometricSetupDone(!!savedPhone);
        
        // אם יש מספר שמור, נטען אותו לשדה הטלפון
        if (savedPhone && !phone) {
          setPhone(savedPhone);
        }
      } catch (error) {
        if (__DEV__) console.error('[Biometric] Check error:', error);
      }
    };
    checkBiometricAvailability();
  }, []);

  // כניסה אוטומטית כשהאפליקציה נפתחה מ-NFC
  useEffect(() => {
    if (nfcLaunch !== 'true' || nfcAutoLoginAttempted.current) return;
    nfcAutoLoginAttempted.current = true;

    const handleNfcAutoLogin = async () => {
      console.log('[NFC Login] Auto-login triggered for business:', nfcBusinessCode);
      
      // בדיקה אם יש מספר טלפון שמור
      const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
      if (!savedPhone) {
        console.log('[NFC Login] No saved phone, showing login form');
        return;
      }

      // ניסיון אימות ביומטרי
      if (biometricAvailable) {
        console.log('[NFC Login] Attempting biometric auth');
        const authSuccess = await authenticateBiometric();
        if (authSuccess) {
          console.log('[NFC Login] Biometric auth success, navigating to PunchCard with businessCode:', resolvedBusinessCode);
          router.replace({
            pathname: '/(tabs)/PunchCard',
            params: { phone: savedPhone, nfcLaunch: 'true', ...(resolvedBusinessCode ? { businessCode: resolvedBusinessCode } : {}) }
          });
          return;
        }
      }
      
      // אם ביומטריה לא זמינה או נכשלה - ממלאים את הטלפון ומציגים את הטופס
      setPhone(savedPhone);
      console.log('[NFC Login] Pre-filled phone, showing login form');
    };

    // המתנה קצרה לטעינת state של biometric
    const timer = setTimeout(handleNfcAutoLogin, 300);
    return () => clearTimeout(timer);
  }, [nfcLaunch, nfcBusinessCode, biometricAvailable, authenticateBiometric, router]);

  // לחיצה על כפתור ביומטרי
  const handleBiometricPress = useCallback(async () => {
    if (!biometricAvailable) {
      Alert.alert('לא זמין', 'זיהוי ביומטרי לא זמין במכשיר זה');
      return;
    }

    if (!biometricSetupDone) {
      // פעם ראשונה - צריך להגדיר
      if (!phone || !phone.match(/^05\d{8}$/)) {
        Alert.alert('נדרש מספר טלפון', 'הזן מספר טלפון תקין לפני הגדרת כניסה ביומטרית');
        return;
      }
      // מסלול כניסה שני שאינו עובר ב-handleLogin: בלי האימות כאן, טעות הקלדה
      // הייתה נשמרת ב-Keychain (ששורד גם מחיקת אפליקציה ב-iOS) והופכת לזהות המכשיר
      if (loginInFlightRef.current) return;
      loginInFlightRef.current = true;
      try {
        const status = await checkRegistration(phone);
        if (status === 'not_found') {
          setNotRegisteredVisible(true);
          return;
        }
        if (status === 'confirmed') verifiedPhoneRef.current = phone;
      } finally {
        loginInFlightRef.current = false;
      }
      setBiometricSetupModalVisible(true);
    } else {
      // כבר מוגדר - אימות וכניסה
      const authenticated = await authenticateBiometric();
      if (authenticated) {
        const savedPhone = await SecureStore.getItemAsync(BIOMETRIC_PHONE_KEY);
        if (savedPhone) {
          router.push(`/(tabs)/PunchCard?phone=${encodeURIComponent(savedPhone)}${resolvedBusinessCode ? `&businessCode=${resolvedBusinessCode}` : ''}${punchIntentParams}`);
        }
      }
    }
  }, [biometricAvailable, biometricSetupDone, phone, authenticateBiometric, router, punchIntentParams, checkRegistration, resolvedBusinessCode]);

  // הגדרת כניסה ביומטרית (פעם ראשונה)
  const setupBiometricLogin = useCallback(async () => {
    setBiometricSetupModalVisible(false);
    
    const authenticated = await authenticateBiometric();
    if (authenticated) {
      try {
        // שמירה מאובטחת של מספר הטלפון בלבד (עובד לכל העסקים).
        // persistIdentity ולא כתיבה נקודתית: כתיבת biometric_phone לבדה הייתה
        // משאירה את saved_phone על ערך ישן ואת סימון האימות "מאשר" אותו.
        // המסלול לכאן עובר תמיד דרך בדיקה (handleLogin / handleBiometricPress),
        // ו-verifiedPhoneRef קובע אם המספר אושר בפועל או רק לא ניתן היה לבדוק.
        await persistIdentity(phone, verifiedPhoneRef.current === phone);

        setBiometricSetupDone(true);
        Alert.alert('הצלחה! 🎉', 'כניסה ביומטרית הוגדרה בהצלחה.\nמעכשיו תוכל להיכנס בלחיצה אחת לכל עסק!');

        router.push(`/(tabs)/PunchCard?phone=${encodeURIComponent(phone)}${resolvedBusinessCode ? `&businessCode=${resolvedBusinessCode}` : ''}${punchIntentParams}`);
      } catch (error) {
        if (__DEV__) console.error('[Biometric] Setup error:', error);
        Alert.alert('שגיאה', 'לא ניתן היה לשמור את ההגדרות');
      }
    }
  }, [phone, authenticateBiometric, router, punchIntentParams, persistIdentity, resolvedBusinessCode]);

  // פופאפים שיווקיים - trigger: entry (בכניסה לאפליקציה)
  const { currentPopup, showPopup, closePopup } = useMarketingPopups({
    businessCode: business?.business_code || '',
    trigger: 'entry',
    enabled: !!business?.business_code && !loading,
  });

  // Debug נתוני עסק
  useEffect(() => {
    if (__DEV__ && business) {
      console.log('Business data loaded');
    }
  }, [business]);

  // טעינת מספר טלפון שמור מהכניסה הקודמת
  useEffect(() => {
    const loadSavedPhone = async () => {
      try {
        const savedPhone = await AsyncStorage.getItem('saved_phone');
        if (savedPhone) {
          setPhone(savedPhone);
        }
          } catch (error) {
      console.error('שגיאה בטעינת מספר טלפון שמור:', error);
    }
    };
    // אסינכרוני ללא חסימה
    setTimeout(() => loadSavedPhone(), 0);
  }, []);

  // איפוס שגיאות תמונה כשהעסק משתנה - ללא חסימה
  useEffect(() => {
    if (business) {
      setBackgroundImageError(false);
      setImageKey(prev => prev + 1);
    }
  }, [business?.business_code]);



  const handleLogin = async () => {
    if (!phone.match(/^05\d{8}$/)) {
      setError('נא להזין מספר טלפון תקין');
      return;
    }
    setError('');
    // מניעת לחיצה כפולה: האימות הוא קריאת רשת, ובלי המנעול הזה שתי לחיצות
    // מייצרות שתי שאילתות ושני ניווטים
    if (loginInFlightRef.current) return;
    loginInFlightRef.current = true;
    try {
      const status = await checkRegistration(phone);
      if (status === 'not_found') {
        // לא שומרים שום זהות — או טעות הקלדה או לקוח שטרם נרשם בעסק
        setNotRegisteredVisible(true);
        return;
      }
      if (status === 'confirmed') verifiedPhoneRef.current = phone;
      await persistIdentity(phone, status === 'confirmed');

      // הצעה להפעלת FaceID/ביומטרי לכניסה הבאה (פעם ראשונה אחרי הזנת טלפון)
      if (biometricAvailable && !biometricSetupDone) {
        pendingLoginPhoneRef.current = phone;
        setBiometricSetupModalVisible(true);
        return;
      }

      router.push(`/(tabs)/PunchCard?phone=${encodeURIComponent(phone)}${resolvedBusinessCode ? `&businessCode=${resolvedBusinessCode}` : ''}${punchIntentParams}`);
    } finally {
      loginInFlightRef.current = false;
    }
  };

  const continueLoginWithoutBiometric = useCallback(() => {
    setBiometricSetupModalVisible(false);
    const p = pendingLoginPhoneRef.current || phone;
    pendingLoginPhoneRef.current = null;
    if (p && p.match(/^05\d{8}$/)) {
      router.push(`/(tabs)/PunchCard?phone=${encodeURIComponent(p)}${resolvedBusinessCode ? `&businessCode=${resolvedBusinessCode}` : ''}${punchIntentParams}`);
    }
  }, [phone, router, resolvedBusinessCode, punchIntentParams]);

  const openMenu = () => {
    if (__DEV__) {
      console.log('Opening hamburger menu');
    }
    setMenuVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };
  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setMenuVisible(false));
  };

  const getInternationalPhone = (phone: string) => {
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('0')) {
      p = '972' + p.substring(1);
    }
    return p;
  };

  const handleWhatsappChat = () => {
    if (business?.business_whatsapp) {
      const phone = getInternationalPhone(business.business_whatsapp);
      const url = `https://wa.me/${phone}`;
      Linking.openURL(url);
    } else {
      if (__DEV__) {
        console.log('No whatsapp number');
      }
    }
  };

  const handlePhoneCall = () => {
    if (business?.business_phone) {
      const phone = business.business_phone.replace(/[^0-9]/g, '');
      const url = `tel:${phone}`;
      Linking.openURL(url);
    } else {
      if (__DEV__) {
        console.log('No phone number');
      }
    }
  };

  const handleShareWhatsapp = () => {
    if (business?.name) {
      const message = `היי, שמעת על הכרטיסייה האלקטרונית של ${business.name}? מעבר להטבה על מספר ניקובים יש שם הגרלות והפתעות, משקיעים בנו 😉.`;
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      Linking.openURL(url);
    } else {
      if (__DEV__) {
        console.log('No business name');
      }
    }
  };

  if (loading || (resolvedBusinessCode && !business && !businessLoadFailed)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: loginBackgroundColor }}>
        {/* כפתור המבורגר גם במצב טעינה */}
                 <TouchableOpacity onPress={openMenu} style={{ position: 'absolute', top: Platform.OS === 'ios' ? 70 : 30, alignSelf: 'center' }}>
           <Image source={HamburgerIcon} style={{ width: 36, height: 36, tintColor: '#9747FF' }} />
         </TouchableOpacity>
        <LottieView
          source={{ uri: 'https://cdn.lottielab.com/l/CeHEQyB7hKAF1h.json' }}
          autoPlay
          loop
          style={{ width: 120, height: 120 }}
        />
        <Text style={{ color: '#A39393', fontSize: 16, marginTop: 16, fontFamily: 'Rubik' }}>טוען נתוני עסק...</Text>
        
        {/* תפריט פופאובר גם במצב טעינה */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="none"
          onRequestClose={closeMenu}
        >
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} onPress={closeMenu}>
            <Animated.View
              style={{
                position: 'absolute',
                top: 60,
                left: 0,
                right: 0,
                marginHorizontal: 0,
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 20,
                margin: 16,
                elevation: 6,
                transform: [{ translateY: slideAnim }],
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text style={{ fontSize: 16, color: '#9747FF', fontWeight: 'bold', fontFamily: 'Rubik', textAlign: 'center' }}>טוען נתוני עסק...</Text>
            </Animated.View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles(brandColor).container, { backgroundColor: loginBackgroundColor }]} accessible={false} importantForAccessibility="yes">
      {/* כפתור חזרה ל-iOS */}
      <View style={{ position: 'absolute', bottom: 30, left: 10, zIndex: 100 }}>
        <BackButton fallbackRoute="/(tabs)/business_selector" color={brandColor} />
      </View>
      {/* אייקון המבורגר ממורכז בראש הדף */}
      <TouchableOpacity 
        onPress={openMenu} 
        style={{ alignSelf: 'center', marginTop: 0, marginBottom: 4 }}
        accessibilityLabel="פתח תפריט ראשי"
        accessibilityRole="button"
        accessibilityHint="לחץ לפתיחת תפריט עם אפשרויות נוספות"
      >
        <Image source={HamburgerIcon} style={{ width: 36, height: 36, tintColor: brandColor }} />
      </TouchableOpacity>
      {/* תפריט פופאובר */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} onPress={closeMenu}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 60,
              left: 0,
              right: 0,
              marginHorizontal: 0,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 20,
              margin: 16,
              elevation: 6,
              transform: [{ translateY: slideAnim }],
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            {/* צור קשר עם העסק */}
            <TouchableOpacity 
              onPress={() => {
                if (__DEV__) { console.log('Contact business pressed'); }
                closeMenu();
                handleWhatsappChat();
              }}
              style={{ paddingVertical: 8, paddingHorizontal: 4 }}
              accessibilityLabel={`צור קשר עם ${business?.name || 'העסק'} בוואטסאפ`}
              accessibilityRole="button"
              accessibilityHint="לחץ לפתיחת שיחת וואטסאפ עם העסק"
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Image source={WhatsappIcon} style={{ width: 28, height: 28, marginLeft: 12, tintColor: brandColor }} />
                <Text style={{ fontSize: 16, color: brandColor, fontWeight: 'bold', fontFamily: 'Rubik' }}>צור קשר עם {business?.name || 'העסק'}</Text>
              </View>
            </TouchableOpacity>
            
            {/* בקר באתר של העסק */}
            {business?.business_website ? (
              <TouchableOpacity 
                onPress={() => {
                  if (__DEV__) { console.log('Visit website pressed'); }
                  closeMenu();
                  const url = business.business_website.startsWith('http') 
                    ? business.business_website 
                    : `https://${business.business_website}`;
                  Linking.openURL(url);
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' }}
                accessibilityLabel={`בקר באתר של ${business?.name || 'העסק'}`}
                accessibilityRole="button"
                accessibilityHint="לחץ לפתיחת אתר העסק בדפדפן"
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                  <Ionicons name="globe-outline" size={28} color={brandColor} style={{ marginLeft: 12 }} />
                  <Text style={{ fontSize: 16, color: brandColor, fontWeight: 'bold', fontFamily: 'Rubik' }}>בקר באתר של {business?.name || 'העסק'}</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        </Pressable>
      </Modal>
      {/* עטיפה להזזת כל האלמנטים למעט המבורגר והביומטריה */}
      <View style={{ transform: [{ translateY: -20 }] }}>
      {/* לוגו מבודד */}
      <Image
        key={`business-logo-${imageKey}`}
        source={{ uri: business?.logo || 'https://noqfwkxzmvpkorcaymcb.supabase.co/storage/v1/object/public/logos//caedz_last.png' }}
        style={{ 
          width: 170, 
          height: 170, 
          resizeMode: 'contain',
          transform: [{ scale: 0.68 }],
          zIndex: 1,
          alignSelf: 'center'
        }}
        onLoadStart={() => {}}
        onLoadEnd={() => {}}
        onError={() => {}}
      />
              {/* שאר התוכן יורד למטה */}
      <View style={{ width: '100%', marginTop: 4, alignItems: 'center' }}>
        {/* שם העסק */}
        <Text style={styles(brandColor).businessName} accessibilityRole="header">{business?.name || ''}</Text>
        {/* טקסט כותרת */}
        <Text style={styles(brandColor).mainTitle} accessibilityRole="header">הכרטיסייה שלי</Text>
        {/* טלפון + הרשמה + תמונה */}
        <View style={{ width: windowWidth * 0.8, alignSelf: 'center', marginTop: 3 }}>
          {/* שדה טלפון + כפתור */}
          <View style={styles(brandColor).phoneRow}>
            <View style={{ flex: 1 }}>
              {phone.length === 0 && (
                <Text style={{ position: 'absolute', right: 16, top: 12, fontSize: 10, color: '#A39393', zIndex: 1, fontFamily: 'Rubik' }}>
                  הקש מספר נייד לצפייה בכרטיסייה
                </Text>
              )}
              <TextInput
                style={styles(brandColor).phoneInput}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                accessibilityLabel="שדה הזנת מספר טלפון"
                accessibilityHint="הזן מספר טלפון נייד בן 10 ספרות לצפייה בכרטיסייה"
              />
            </View>
            <TouchableOpacity
              style={[styles(brandColor).clickBtn, { backgroundColor: clickBtnBgColor }]}
              onPress={handleLogin}
              accessibilityLabel="כניסה לכרטיסייה"
              accessibilityRole="button"
              accessibilityHint="לחץ לצפייה בכרטיסייה שלך לאחר הזנת מספר טלפון"
            >
              <Image source={ClickIcon} style={[styles(brandColor).clickIcon, clickIconTint ? { tintColor: clickIconTint } : null]} />
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles(brandColor).errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}
          {/* הרשמה */}
          <View style={[styles(brandColor).registerRow, { justifyContent: 'space-between', width: '100%' }]}>
            <TouchableOpacity
              style={styles(brandColor).registerBtn}
              onPress={() => router.push('/(tabs)/newclient_form')}
              accessibilityLabel="הרשמה לכרטיסייה חדשה"
              accessibilityRole="button"
              accessibilityHint="לחץ להרשמה וקבלת כרטיסייה חדשה"
            >
              <Text style={[styles(brandColor).registerQuestion, { color: signupTextColor }]}>
                אין כרטיסייה? <Text style={{ textDecorationLine: 'underline', fontWeight: 'bold' }}>הרשמ/י לקבלת כרטיסייה</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setResetStep('confirm'); setResetLoginModalVisible(true); }}>
              <Text style={[styles(brandColor).registerText, { color: signupTextColor, textDecorationLine: 'underline', fontWeight: 'bold' }]}>איפוס כניסה</Text>
            </TouchableOpacity>
          </View>
          {/* תמונת נושא */}
          <View style={{ alignItems: 'center', marginTop: -38, width: '100%' }}>
            {(() => {
              // הסרת הלוגיקה הקבועה - שימוש בנתונים דינמיים
              const originalUrl = business?.login_background_image?.trim().replace(/[\r\n\t]/g, '');
              
              if (!originalUrl) {
                return (
                  <Text style={{ textAlign: 'center', color: 'gray', marginVertical: 8 }}>
                    אין תמונת רקע להצגה
                  </Text>
                );
              }
              

              
              return !backgroundImageError ? (
                                  <View style={styles(brandColor).backgroundImageContainer}>
                    <Image
                      key={`${business?.business_code}-${originalUrl}`}
                      source={{ uri: originalUrl }}
                      style={styles(brandColor).backgroundImage}
                      resizeMode="contain"
                      onError={() => {
                        setBackgroundImageError(true);
                      }}
                      onLoad={() => {
                      }}
                    />
                  </View>
              ) : (
                <Text style={{ textAlign: 'center', color: 'red', marginVertical: 8 }}>
                  שגיאה בטעינת תמונת הרקע
                </Text>
              );
            })()}
            {/* אייקון כניסה ביומטרית (iOS: FaceID) - מוסתר כשמודאל ההגדרה או האימות פתוחים */}
            {biometricAvailable && !biometricSetupModalVisible && !biometricAuthInProgress && (
              <TouchableOpacity
                style={styles(brandColor).biometricButton}
                onPress={handleBiometricPress}
                accessibilityLabel={biometricSetupDone ? "כניסה מהירה עם זיהוי ביומטרי" : "הגדרת כניסה ביומטרית"}
                accessibilityRole="button"
                accessibilityHint={biometricSetupDone ? "לחץ לכניסה מהירה באמצעות זיהוי פנים" : "לחץ להגדרת כניסה מהירה עם זיהוי פנים"}
              >
                <Image 
                  source={Platform.OS === 'ios' ? FaceRecognitionIcon : BiometricIcon}
                  style={[
                    styles(brandColor).biometricIcon,
                    { tintColor: brandColor }, // צבע המותג לשני הפלטפורמות
                    { opacity: biometricSetupDone ? 1 : 0.6 }
                  ]} 
                  resizeMode="contain"
                />
                {!biometricSetupDone && (
                  <Text style={[styles(brandColor).biometricHint, { color: brandColor }]}>הגדר כניסה מהירה</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      </View>{/* סגירת עטיפת ההזזה */}

      {/* פופאפ שיווקי - entry */}
      <MarketingPopup
        visible={showPopup}
        popup={currentPopup}
        onClose={closePopup}
      />

      {/* מודאל הגדרת כניסה ביומטרית */}
      <Modal
        visible={biometricSetupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBiometricSetupModalVisible(false)}
      >
        <View style={biometricStyles.overlay}>
          <View style={biometricStyles.container}>
            <Image 
              source={BiometricIcon} 
              style={[biometricStyles.icon, { tintColor: brandColor }]} 
              resizeMode="contain"
            />
            <Text style={biometricStyles.title}>כניסה מהירה 🚀</Text>
            <Text style={biometricStyles.description}>
              רוצה להיכנס לכרטיסיות בלחיצה אחת?{'\n'}
              הגדר כניסה עם טביעת אצבע או זיהוי פנים!
            </Text>
            <Text style={biometricStyles.note}>
              המספר {phone} יישמר בצורה מאובטחת במכשיר שלך בלבד.{'\n'}
              יעבוד לכניסה לכל העסקים שאתה רשום אליהם.
            </Text>
            
            <TouchableOpacity
              style={[biometricStyles.setupButton, { backgroundColor: brandColor }]}
              onPress={setupBiometricLogin}
            >
              <Text style={biometricStyles.setupButtonText}>הגדר עכשיו</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={biometricStyles.cancelButton}
              onPress={continueLoginWithoutBiometric}
            >
              <Text style={biometricStyles.cancelButtonText}>לא עכשיו</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* אין רשומת לקוח בעסק — טעות הקלדה או לקוח שטרם נרשם בעסק. שום זהות לא נשמרה. */}
      <Modal
        visible={notRegisteredVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotRegisteredVisible(false)}
      >
        <View style={biometricStyles.overlay}>
          <View style={biometricStyles.container} accessible={true} accessibilityRole="alert">
            <Text style={biometricStyles.description} accessibilityLiveRegion="assertive">
              נראה שטעית בהקשת מספר הטלפון או שעדיין לא נרשמת כלקוח בעסק שבחרת
            </Text>
            <TouchableOpacity
              style={[biometricStyles.setupButton, { backgroundColor: brandColor }]}
              onPress={() => {
                setNotRegisteredVisible(false);
                const code = resolvedBusinessCode || business?.business_code;
                router.push({
                  pathname: '/(tabs)/newclient_form',
                  params: code ? { businessCode: code } : {},
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="קח אותי לרישום לקוח חדש"
            >
              <Text style={biometricStyles.setupButtonText}>קח אותי לרישום לקוח חדש</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={biometricStyles.cancelButton}
              onPress={() => setNotRegisteredVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="טעיתי, אקיש מחדש"
            >
              <Text style={biometricStyles.cancelButtonText}>טעיתי - אקיש מחדש</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* מודאל איפוס כניסה — אישור → איפוס מקומי → הצלחה (ללא SMS) */}
      <Modal
        visible={resetLoginModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setResetLoginModalVisible(false);
          setResetStep('confirm');
        }}
      >
        <View style={biometricStyles.overlay}>
          <View style={biometricStyles.container}>
            {resetStep === 'confirm' && (
              <>
                <Text style={[biometricStyles.title, { color: '#E53935' }]}>⚠️ איפוס כניסה</Text>
                <Text style={biometricStyles.description}>
                  לאפס את הכניסה במכשיר זה?{'\n'}
                  המספר השמור והזיהוי המהיר יימחקו,{'\n'}
                  ותוכל/י להיכנס עם מספר אחר.
                </Text>

                <TouchableOpacity
                  style={[biometricStyles.setupButton, { backgroundColor: '#E53935' }]}
                  onPress={performResetLogin}
                  accessibilityRole="button"
                  accessibilityLabel="אישור איפוס כניסה"
                >
                  <Text style={biometricStyles.setupButtonText}>איפוס</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={biometricStyles.cancelButton}
                  onPress={() => {
                    setResetLoginModalVisible(false);
                    setResetStep('confirm');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="ביטול"
                >
                  <Text style={biometricStyles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'success' && (
              <>
                <Text style={[biometricStyles.title, { color: '#4CAF50' }]}>✅ הצלחה!</Text>
                <Text style={biometricStyles.description}>
                  הכניסה אופסה בהצלחה.{'\n'}
                  כעת תוכל/י להיכנס עם מספר טלפון חדש.
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* מודאל הצהרת נגישות */}
      <Modal
        visible={accessibilityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccessibilityModalVisible(false)}
      >
        <View style={accessibilityStyles.overlay}>
          <View style={accessibilityStyles.container}>
            {/* כפתור סגירה */}
            <TouchableOpacity 
              style={accessibilityStyles.closeButton}
              onPress={() => setAccessibilityModalVisible(false)}
              accessibilityLabel="סגור הצהרת נגישות"
              accessibilityRole="button"
            >
              <Text style={accessibilityStyles.closeText}>✕</Text>
            </TouchableOpacity>
            
            <ScrollView 
              style={accessibilityStyles.scrollView}
              showsVerticalScrollIndicator={true}
            >
              {/* כותרת ראשית */}
              <Text style={accessibilityStyles.mainTitle}>הצהרת נגישות</Text>
              <Text style={accessibilityStyles.subtitle}>אפליקציית כראדז לכרטיסיות דיגיטליות</Text>

              {/* כללי ורקע משפטי */}
              <Text style={accessibilityStyles.sectionTitle}>כללי ורקע משפטי</Text>
              <Text style={accessibilityStyles.paragraph}>
                אפליקציית כראדז לכרטיסיות דיגיטליות (להלן: "האפליקציה") שואפת לאפשר לכלל המשתמשים, לרבות אנשים עם מוגבלות, שימוש נגיש, שוויוני, מכבד ונוח בשירותיה.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                האפליקציה מונחית ברוחה על ידי חוק שוויון זכויות לאנשים עם מוגבלות ותקנות הנגישות, והיישום נעשה לפי תקן ישראלי ת״י 5568 המבוסס על הנחיות WCAG 2.0 ברמת AA, אשר חלות כיום גם על אפליקציות המספקות שירות לציבור.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                מאחר שטרם פורסם תקן ישראלי טכנולוגי ייעודי ומלא לאפליקציות מובייל, היישום בפועל נשען על שילוב עקרונות WCAG 2.0 AA עם הנחיות הנגישות הרשמיות של Android (גוגל) ו‑iOS (אפל), ועל ניצול מלא ככל הניתן של כלי הנגישות המובנים במכשירים.
              </Text>

              {/* עקרונות יישום באפליקציה */}
              <Text style={accessibilityStyles.sectionTitle}>עקרונות יישום באפליקציה</Text>
              <Text style={accessibilityStyles.paragraph}>
                בהיעדר תקן נפרד לאפליקציות, האפליקציה פועלת בהתאם לעקרונות WCAG 2.0 AA, תוך התאמה ליכולות הנגישות שמספקות מערכות ההפעלה ולמגבלות הפלטפורמה.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                בדיקות נגישות מתבצעות באמצעות כלי הבדיקה של גוגל ואפל (כגון Accessibility Scanner באנדרואיד ו‑Accessibility Inspector ב‑Xcode), לצד בדיקות ידניות עם VoiceOver ו‑TalkBack, כדי לאתר חסמי נגישות ולשפרם בהדרגה.
              </Text>

              {/* התאמה ליכולות הנגישות */}
              <Text style={accessibilityStyles.sectionTitle}>התאמה ליכולות הנגישות באנדרואיד ו‑iOS</Text>
              <Text style={accessibilityStyles.paragraph}>
                האפליקציה מותאמת לשימוש יחד עם כלי הנגישות המובנים במכשירים המבוססים על Android ו‑iOS, ככל שהמשתמש מפעילם במסגרת הגדרות הנגישות של המכשיר, ובכלל זה:
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • תמיכה בקוראי מסך VoiceOver (iOS) ו‑TalkBack (Android), כולל הגדרת שמות ותיאורים נגישים לרכיבים אינטראקטיביים (כפתורים, שדות, אייקונים וקישורים) כדי שהמידע הקולי יהיה מובן ולא טכני.
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • התאמה לתכונות מערכת כלליות כגון הגדלת טקסט, הגדרות תצוגה וניגודיות, מצב כהה, הפחתת תנועה (Reduce Motion) ומאפייני נגישות חזותית נוספים, ככל שנתמכים על ידי מערכת ההפעלה והמכשיר.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                בנוסף, נעשית השתדלות לאפשר שימוש באמצעי קלט ואביזרי עזר הנתמכים על ידי מערכת ההפעלה (כגון מחוות מגע נגישות, מתגים – Switch Control – ואמצעי קלט חלופיים), בכפוף ליכולות הטכנולוגיות של הפלטפורמה.
              </Text>

              {/* התאמות נגישות עיקריות */}
              <Text style={accessibilityStyles.sectionTitle}>התאמות נגישות עיקריות שבוצעו</Text>
              <Text style={accessibilityStyles.paragraph}>
                בין היתר, בוצעו או מצויות בהטמעה התאמות מסוג:
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • הגדרת תוויות (labels) ותיאורי גישה נגישים לרכיבי ממשק עיקריים, כדי לאפשר ניווט והבנת תוכן באמצעות קוראי מסך.
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • סדר ניווט לוגי ועקבי במעבר פוקוס (focus) בין רכיבים שונים במסך, כדי למנוע דילוגים לא צפויים.
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • הקפדה ככל האפשר על ניגודיות מספקת בין טקסט לרקע, בהתאם להנחיות WCAG 2.0 ברמת AA, בכפוף לעיצוב הממשק.
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • תמיכה בהגדלת טקסט/תצוגה לפי הגדרות הנגישות במכשיר, תוך שאיפה לשמירה על ממשק שמיש וקריא גם בהגדלות משמעותיות.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                מגבלות קיימות או חדשות שיתגלו בבדיקות נוספות יתועדו ויטופלו, ככל שהדבר אפשרי מבחינה טכנולוגית ועסקית, בגרסאות עתידיות של האפליקציה.
              </Text>

              {/* היקף התאמה ומגבלות */}
              <Text style={accessibilityStyles.sectionTitle}>היקף התאמה ומגבלות</Text>
              <Text style={accessibilityStyles.paragraph}>
                מאמצים רבים מושקעים כדי שהאפליקציה תעמוד ברוח התקן והחוק, אולם ייתכן שעדיין קיימים מסכים, תהליכים או רכיבים שאינם נגישים באופן מלא, או שדורשים שיפור.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                כמו כן, ייתכנו הגבלות בנגישות לגבי תכנים או שירותים של צדדים שלישיים, המשולבים באפליקציה ואשר אינם בשליטה מלאה של מפעילי האפליקציה.
              </Text>

              {/* דרכי יצירת קשר */}
              <Text style={accessibilityStyles.sectionTitle}>דרכי יצירת קשר לפניות נגישות</Text>
              <Text style={accessibilityStyles.paragraph}>
                במידה ונתקלת בקושי נגישות באפליקציית כראדז, ניתן לפנות אלינו באמצעים הבאים:
              </Text>
              <TouchableOpacity 
                onPress={() => Linking.openURL('mailto:support@punchcards.digital')}
                accessibilityLabel="שלח דואר אלקטרוני לתמיכה"
                accessibilityRole="link"
                accessibilityHint="לחץ לפתיחת אפליקציית המייל ושליחת הודעה לתמיכה"
              >
                <Text style={accessibilityStyles.contactItemClickable}>
                  📧 דואר אלקטרוני: support@punchcards.digital
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => Linking.openURL('https://wa.me/972552482442')}
                accessibilityLabel="שלח הודעת וואטסאפ לתמיכה"
                accessibilityRole="link"
                accessibilityHint="לחץ לפתיחת וואטסאפ ושליחת הודעה לתמיכה"
              >
                <Text style={accessibilityStyles.contactItemClickable}>
                  💬 ווטסאפ (הודעות): ‎+972‑55‑248‑2442
                </Text>
              </TouchableOpacity>
              <Text style={accessibilityStyles.paragraph}>
                לצורך טיפול יעיל בפנייתך, חשוב שהפניה תכלול:
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • תיאור קצר של הבעיה.
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • מיקום המסך שבו נתקלת בקושי (שם מסך/תהליך או תיאור ברור).
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • צילום מסך (אם ניתן).
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>
                • פרטי המכשיר ומערכת ההפעלה (Android/iOS + גרסה), וגרסת האפליקציה.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                פניות נגישות מקבלות עדיפות בטיפול, ותיבדקנה לצורך בחינת תיקון בגרסאות עתידיות של האפליקציה, ככל שהדבר אפשרי.
              </Text>

              {/* עדכון ההצהרה */}
              <Text style={accessibilityStyles.sectionTitle}>עדכון ההצהרה</Text>
              <Text style={accessibilityStyles.paragraph}>
                הצהרת נגישות זו עודכנה לאחרונה בתאריך: 4 בדצמבר 2025.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                האפליקציה והצהרה זו עשויות להתעדכן מעת לעת, בהתאם לשינויים טכנולוגיים, עדכוני מערכות הפעלה, שינויים בעמדת הרגולטור בישראל, או שיפורי נגישות שייושמו באפליקציה.
              </Text>

              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (brandColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor מוגדר דינמית מה-DB
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    color: '#A39393',
    fontSize: 18,
  },
  businessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: brandColor,
    marginBottom: 2,
    textAlign: 'center',
    fontFamily: 'Rubik',
    transform: [{ translateY: -30 }],
  },
  mainTitle: {
    fontSize: 18,
    color: brandColor,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Rubik',
    transform: [{ translateY: -30 }],
  },
  subTitle: {
    fontSize: 16,
    color: '#A29292',
    textAlign: 'center',
    opacity: 0.56,
    marginBottom: 16,
    fontFamily: 'Rubik',
  },
  phoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 6,
    width: windowWidth * 0.8,
    backgroundColor: '#fff',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: brandColor,
    padding: 0,
    height: 48,
    overflow: 'hidden',
    transform: [{ translateY: -25 }],
  },
  phoneInput: {
    flex: 1,
    fontSize: 30,
    backgroundColor: '#fff',
    textAlign: 'right',
    paddingVertical: 0,
    paddingHorizontal: 12,
    fontFamily: 'Rubik',
    height: 48,
  },
  clickBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColor,
    marginRight: 0,
    marginLeft: 0,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
  },
  clickIcon: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  backgroundImageContainer: {
    width: windowWidth * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    alignSelf: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    alignSelf: 'center',
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 0,
    justifyContent: 'center',
    transform: [{ translateY: -25 }],
  },
  registerQuestion: {
    fontSize: 10,
    color: '#0A0000',
    fontWeight: '600',
    fontFamily: 'Rubik',
  },
  registerBtn: {
    // אין עיצוב מיוחד, רק טקסט
  },
  registerText: {
    fontSize: 10,
    color: brandColor,
    fontWeight: '600',
    fontFamily: 'Rubik',
    textDecorationLine: 'none',
  },
  bottomMenu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginTop: 'auto',
    marginBottom: 14.5,
    borderWidth: 0,
    height: 48,
  },
  menuIcon: {
    alignItems: 'center',
    flex: 1,
    padding: 0,
  },
  menuIconCircle: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14.5,
  },
  menuImg: {
    width: 19,
    height: 19,
    resizeMode: 'contain',
  },
  biometricButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? -190 : -85, // iOS: הורד 60 נוספים למטה
    alignSelf: 'center',
    padding: 10,
    alignItems: 'center',
  },
  biometricIcon: {
    width: Platform.OS === 'ios' ? 122 : 91, // iOS: 144 * 0.85 = 122 (הקטנה ב-15%)
    height: Platform.OS === 'ios' ? 122 : 91, // iOS: 144 * 0.85 = 122 (הקטנה ב-15%)
  },
  biometricHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -10,
    fontFamily: 'Rubik',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'Rubik',
  },
});

// סגנונות מודאל הצהרת נגישות
const accessibilityStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '94%',
    height: '90%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Rubik',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 28,
    fontFamily: 'Rubik',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'right',
    marginTop: 20,
    marginBottom: 12,
    fontFamily: 'Rubik',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#e0e0e0',
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: 'Rubik',
  },
  bulletPoint: {
    fontSize: 14,
    color: '#e0e0e0',
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 8,
    paddingRight: 8,
    fontFamily: 'Rubik',
  },
  contactItem: {
    fontSize: 14,
    color: '#7cb3ff',
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 8,
    fontFamily: 'Rubik',
  },
  contactItemClickable: {
    fontSize: 18,
    color: '#7cb3ff',
    textAlign: 'right',
    lineHeight: 28,
    marginBottom: 12,
    fontFamily: 'Rubik',
    textDecorationLine: 'underline',
    paddingVertical: 8,
  },
});

// סגנונות מודאל הגדרת ביומטריה
const biometricStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    fontFamily: 'Rubik',
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
    fontFamily: 'Rubik',
  },
  note: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Rubik',
  },
  setupButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Rubik',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  errorText: {
    color: '#E53935',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Rubik',
  },
}); 