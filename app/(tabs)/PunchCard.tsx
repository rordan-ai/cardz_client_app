import AsyncStorage from '@react-native-async-storage/async-storage';
// AsyncStorage no longer used for inbox; messages loaded from Supabase inbox table
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Dimensions, FlatList, Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Barcode } from 'react-native-svg-barcode';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';
import { useBusiness } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';
import { getCurrentLogoScale } from '../../components/LogoUtils';
import MarketingPopup from '../../components/MarketingPopup';
import { NFCPunchModal } from '../../components/NFCPunch';
import { supabase } from '../../components/supabaseClient';
import { useMarketingPopups } from '../../hooks/useMarketingPopups';
import { useNFC } from '../../hooks/useNFC';
import { BackButton } from '../../components/BackButton';

const { width, height } = Dimensions.get('window');

export default function PunchCard() {
  const router = useRouter();
  const navigation = useNavigation();
  const { business, refresh: refreshBusiness } = useBusiness();
  const { phone, nfcLaunch } = useLocalSearchParams();
  const phoneStr = typeof phone === 'string' ? phone.trim() : Array.isArray(phone) ? phone[0].trim() : '';
  const isNfcLaunch = nfcLaunch === 'true';
  const phoneIntl = phoneStr && /^05\d{8}$/.test(phoneStr) ? `972${phoneStr.slice(1)}` : phoneStr;
  const [customer, setCustomer] = useState<{ 
    business_code: string; 
    name: string; 
    customer_phone: string; 
  } | null>(null);
  const [punchCard, setPunchCard] = useState<{ 
    card_number: string; 
    used_punches: number; 
    benefit: string; 
    prepaid: string; 
    product_code?: string;
    product_name?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [iconsLoading, setIconsLoading] = useState<{ [key: number]: boolean }>({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [mailVisible, setMailVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    body: string;
    timestamp: number;
    read: boolean;
    voucherUrl?: string;
  }>>([]);
  const [referralVisible, setReferralVisible] = useState(false);
  const [referralData, setReferralData] = useState<{
    inviterBenefit: string | null;
    invitedBenefit: string | null;
    isConfigured: boolean;
  }>({ inviterBenefit: null, invitedBenefit: null, isConfigured: false });
  const [cardSelectionVisible, setCardSelectionVisible] = useState(false);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [pushOptIn, setPushOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [disconnectVisible, setDisconnectVisible] = useState(false);
  const [deletingSelf, setDeletingSelf] = useState(false);
  const [nameEdit, setNameEdit] = useState<string>('');
  const [birthdayEdit, setBirthdayEdit] = useState<string>('');
  const [voucherInlineUrl, setVoucherInlineUrl] = useState<string | null>(null);
  const [voucherToast, setVoucherToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const voucherWebViewRef = useRef<WebView>(null);
  const voucherViewShotRef = useRef<ViewShot>(null);
  const isSavingRef = useRef(false);
  const [activityVisible, setActivityVisible] = useState(false);
  const [accessibilityVisible, setAccessibilityVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityRows, setActivityRows] = useState<Array<{ dateStr: string; actionLabel: string; amount: number }>>([]);
  const [activityNextCursor, setActivityNextCursor] = useState<string | null>(null);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const activityChannelRef = useRef<any>(null);

  const [localBusiness, setLocalBusiness] = useState<{
    id?: number;
    business_code: string;
    name: string;
    business_name?: string;
    logo?: string;
    max_punches: number;
    punched_icon?: string;
    unpunched_icon?: string;
    card_text_color?: string;
    expiration_date?: string;
    nfc_string?: string;
    login_brand_color?: string;
    punch_mode?: string;
  } | null>(null);

  // צבע brand מהאדמין (ברירת מחדל סגול אם אין)
  const brandColor = localBusiness?.login_brand_color || '#9747FF';

  // NFC state
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const { isSupported: nfcSupported, initNFC, startReading, stopReading, parseBusinessId, checkLaunchTag, checkBackgroundTag } = useNFC();
  const nfcLaunchHandled = useRef(false);
  const nfcCooldownRef = useRef(false); // מניעת פתיחה כפולה של מודאל NFC

  // פתיחת מודאל NFC אוטומטית כשהאפליקציה נפתחה מתג NFC
  useEffect(() => {
    if (isNfcLaunch && !nfcLaunchHandled.current && localBusiness?.nfc_string && !nfcCooldownRef.current) {
      nfcLaunchHandled.current = true;
      console.log('[NFC PunchCard] Auto-opening NFC modal from NFC launch');
      // המתנה קצרה לטעינת נתונים
      setTimeout(() => setNfcModalVisible(true), 500);
    }
  }, [isNfcLaunch, localBusiness?.nfc_string]);

  // פונקציה לסגירת מודאל NFC עם cooldown
  const closeNfcModalWithCooldown = () => {
    setNfcModalVisible(false);
    nfcCooldownRef.current = true;
    console.log('[NFC] Modal closed, cooldown started');
    // cooldown של 3 שניות למניעת פתיחה חוזרת מיידית
    setTimeout(() => {
      nfcCooldownRef.current = false;
      console.log('[NFC] Cooldown ended');
    }, 3000);
  };

  const updateBlacklist = async (channel: 'push' | 'sms', isOptIn: boolean) => {
    try {
      const businessCode = localBusiness?.business_code || customer?.business_code;
      const cphone = customer?.customer_phone || phoneStr;
      if (!businessCode || !cphone) return;

      // עדכון מקומי מיידי (לדלג על הצגה במכשיר בלי תעבורת API נוספת)
      try {
        const pushKeyScoped = `push_opt_in_${businessCode}`;
        const smsKeyScoped = `sms_opt_in_${businessCode}`;
        if (channel === 'push') {
          // לשמירה לאחור: גם מפתח כללי וגם פר-עסק
          await AsyncStorage.setItem('push_opt_in', String(isOptIn));
          await AsyncStorage.setItem(pushKeyScoped, String(isOptIn));
          DeviceEventEmitter.emit('preferences_push_opt_in', { optIn: isOptIn });
        } else if (channel === 'sms') {
          // לשמירה לאחור: גם מפתח כללי וגם פר-עסק
          await AsyncStorage.setItem('sms_opt_in', String(isOptIn));
          await AsyncStorage.setItem(smsKeyScoped, String(isOptIn));
        }
      } catch {}
      if (isOptIn) {
        // הסרה מהבלקליסט
        await supabase
          .from('notifications_blacklist')
          .delete()
          .eq('business_code', businessCode)
          .eq('customer_phone', cphone)
          .eq('channel', channel);
        // ניסיון להסרה גם מטבלאות ייעודיות אם קיימות
        const tableName = channel === 'push' ? 'push_blacklist' : 'sms_blacklist';
        await supabase
          .from(tableName)
          .delete()
          .eq('business_code', businessCode)
          .eq('customer_phone', cphone);
      } else {
        // הוספה לבלקליסט
        await supabase
          .from('notifications_blacklist')
          .upsert({ business_code: businessCode, customer_phone: cphone, channel })
          .select();
        // ניסיון גיבוי לטבלאות ייעודיות אם קיימות
        const tableName = channel === 'push' ? 'push_blacklist' : 'sms_blacklist';
        await supabase
          .from(tableName)
          .upsert({ business_code: businessCode, customer_phone: cphone })
          .select();
      }
    } catch (_) {
      // swallow
    }
  };
  const [availableCards, setAvailableCards] = useState<Array<{
    product_code: string;
    card_number: string;
    used_punches: number;
    total_punches: number;
    products?: { product_name: string }[];
  }>>([]);

  // פונקציה ליצירת קוד הזמנה מספרי חדש
  const generateReferralCode = (businessCode: string, customerPhone: string): string => {
    // מספר עסק (4 ספרות) + 4 ספרות אחרונות של טלפון + 4 ספרות רנדומליות
    const businessNumber = businessCode.padStart(4, '0').slice(-4);
    const phoneLast4 = customerPhone.slice(-4);
    const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
    return businessNumber + phoneLast4 + randomDigits;
  };

  // פופאפים שיווקיים - trigger: after_punch (בכניסה לכרטיסייה)
  const { 
    currentPopup: punchPopup, 
    showPopup: showPunchPopup, 
    closePopup: closePunchPopup 
  } = useMarketingPopups({
    businessCode: localBusiness?.business_code || customer?.business_code || '',
    customerPhone: phoneStr,
    trigger: 'after_punch',
    enabled: !!localBusiness?.business_code || !!customer?.business_code,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage(null);
      // שליפת לקוח לפי customer_phone ו-business_code
      const businessCode = business?.business_code;
      if (!businessCode) {
        setErrorMessage('לא נמצא קוד עסק. נא לחזור למסך הראשי.');
        setLoading(false);
        return;
      }
      
      const { data: customers, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_phone', phoneStr)
        .eq('business_code', businessCode)
        .is('deleted_at', null) // מניעת כניסה של לקוח שנמחק (soft delete)
        .limit(1);
      if (customerError) {
        setErrorMessage('לא נמצאה כרטיסייה מתאימה למספר זה. ודא שהזנת את המספר הנכון או שנרשמת לעסק.');
        setLoading(false);
        return;
      }
      if (!customers || customers.length === 0) {
        setErrorMessage('לא נמצאה כרטיסייה מתאימה למספר זה. ודא שהזנת את המספר הנכון או שנרשמת לעסק.');
        setLoading(false);
        return;
      }
      // בדיקה נוספת - אם deleted_at לא null (למקרה שה-RLS לא עובד)
      if (customers[0]?.deleted_at) {
        setErrorMessage('החשבון נמחק ואינו פעיל יותר.');
        setLoading(false);
        return;
      }
      setCustomer(customers[0]);
      
      // בדיקה כמה כרטיסיות יש ללקוח בעסק זה (כולל שם מוצר)
      const { data: customerCards, error: cardsError } = await supabase
        .from('PunchCards')
        .select('product_code, card_number, used_punches, total_punches')
        .eq('customer_phone', phoneStr)
        .eq('business_code', businessCode)
        .eq('status', 'active');
      
      // שליפת שמות המוצרים
      if (customerCards && customerCards.length > 0) {
        const productCodes = customerCards.map(c => c.product_code);
        
        const { data: products } = await supabase
          .from('products')
          .select('product_code, product_name')
          .in('product_code', productCodes)
          .eq('business_code', businessCode);
        
        // חיבור שמות המוצרים לכרטיסיות
        if (products) {
          customerCards.forEach((card: any) => {
            const product = products.find(p => p.product_code === card.product_code);
            if (product) {
              card.products = [{ product_name: product.product_name }];
            }
          });
        }
      }
      
      if (cardsError) {
        setErrorMessage('שגיאה בטעינת כרטיסיות. נסה שוב.');
        setLoading(false);
        return;
      }
      
      // אם אין כרטיסיות כלל
      if (!customerCards || customerCards.length === 0) {
        setErrorMessage('לא נמצאו כרטיסיות פעילות עבור לקוח זה. נא ליצור קשר עם בית העסק.');
        setLoading(false);
        return;
      }
      
      let cardNumber: string;
      let productCode: string;
      let productNameForCard = '';
      
      // אם יש יותר מכרטיסייה אחת - צריך לבחור
      if (customerCards.length > 1) {
        setAvailableCards(customerCards);
        setCardSelectionVisible(true);
        setLoading(false);
        return; // נעצור כאן ונמתין לבחירת המשתמש
      } else {
        // יש כרטיסייה אחת בלבד
        cardNumber = customerCards[0].card_number;
        productCode = customerCards[0].product_code;
        productNameForCard = customerCards[0]?.products?.[0]?.product_name || '';
      }
      
      // שליפת נתוני העסק (כולל max_punches)
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('business_code', businessCode)
        .limit(1);
      
      if (businessData && businessData.length > 0) {
        setLocalBusiness(businessData[0]);
        await refreshBusiness();
        
        // Preload תמונות לשיפור הביצועים
        const businessInfo = businessData[0];
        if (businessInfo.logo) {
          Image.prefetch(businessInfo.logo).catch(() => {});
        }
            if (businessInfo.punched_icon) {
      Image.prefetch(businessInfo.punched_icon).catch(() => {});
    }
    if (businessInfo.unpunched_icon) {
      Image.prefetch(businessInfo.unpunched_icon).catch(() => {});
    }
      }
      
      // שליפת כרטיסייה לפי card_number
      const { data: punchCards, error: punchCardError } = await supabase
        .from('PunchCards')
        .select('business_code, customer_phone, product_code, card_number, total_punches, used_punches, status, created_at, updated_at, benefit, prepaid')
        .eq('card_number', cardNumber)
        .limit(1);
      
      if (punchCardError) {
        setErrorMessage('לא נמצאה כרטיסייה מתאימה למספר זה. ודא שהזנת את המספר הנכון או שנרשמת לעסק.');
        setLoading(false);
        return;
      }
      if (!punchCards || punchCards.length === 0) {
        setErrorMessage('לא נמצאה כרטיסייה מתאימה למספר זה. ודא שהזנת את המספר הנכון או שנרשמת לעסק.');
        setLoading(false);
        return;
      }
      // Fallback: אם לא הצלחנו למפות product_name קודם (למשל בעיית join/mapping),
      // נשלוף ישירות את שם המוצר מהטבלה products לפי product_code של הכרטיסייה.
      if (!productNameForCard) {
        const pc = String((punchCards[0] as any)?.product_code || '').trim();
        if (pc) {
          const { data: prodRow } = await supabase
            .from('products')
            .select('product_name')
            .eq('business_code', businessCode)
            .eq('product_code', pc)
            .maybeSingle();
          productNameForCard = String((prodRow as any)?.product_name || '').trim();
        }
      }

      setPunchCard({
        ...(punchCards[0] as any),
        product_name: productNameForCard,
      } as typeof punchCard);
      setLoading(false);
    };
    if (phoneStr) {
      fetchData();
    }
  }, [phoneStr, business?.business_code]); // תלות רק בקוד העסק, לא בכל האובייקט

  // --- NFC INIT ---
  // אתחול NFC והאזנה
  useEffect(() => {
    let mounted = true;
    let readTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const expectedNfcString = localBusiness?.nfc_string;
    
    const startNFCListening = async () => {
      const enabled = await initNFC();
      if (!enabled) {
        console.log('[NFC] Not available or disabled');
        return;
      }
      
      // בדיקת תג NFC שהפעיל את האפליקציה מרקע (Android בלבד)
      if (Platform.OS === 'android') {
        try {
          // בדיקת תג שהפעיל את האפליקציה
          const launchTag = await checkLaunchTag();
          const launchMatch = launchTag && expectedNfcString && 
            (launchTag === expectedNfcString || expectedNfcString.includes(launchTag) || launchTag.includes(expectedNfcString));
          if (launchMatch && !nfcModalVisible && !nfcCooldownRef.current) {
            console.log('[NFC] App launched with tag:', launchTag);
            // השמעת צליל הצלחה
            try {
              const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/nfc-success.mp3')
              );
              await sound.playAsync();
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync();
                }
              });
            } catch (soundErr) {
              console.log('[NFC] Sound play error:', soundErr);
            }
            setNfcModalVisible(true);
            return; // לא צריך להמשיך להאזנה רגילה אם כבר טיפלנו בתג
          }
          
          // בדיקת תג רקע
          const backgroundTag = await checkBackgroundTag();
          const bgMatch = backgroundTag && expectedNfcString && 
            (backgroundTag === expectedNfcString || expectedNfcString.includes(backgroundTag) || backgroundTag.includes(expectedNfcString));
          if (bgMatch && !nfcModalVisible && !nfcCooldownRef.current) {
            console.log('[NFC] Background tag found:', backgroundTag);
            try {
              const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/nfc-success.mp3')
              );
              await sound.playAsync();
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync();
                }
              });
            } catch (soundErr) {
              console.log('[NFC] Sound play error:', soundErr);
            }
            setNfcModalVisible(true);
            return;
          }
        } catch (err) {
          console.log('[NFC] Launch/background tag check error:', err);
        }
      }
      
      // האזנה רציפה ל-NFC tags עם delay למניעת לופ אינסופי
      const listenForNFC = async () => {
        if (!mounted) return;
        // אם מודאל הניקוב פתוח - לא קוראים תג נוסף (מונע ניקובים כפולים מאותה סריקה)
        if (nfcModalVisible) {
          if (mounted) {
            readTimeoutId = setTimeout(listenForNFC, 500);
          }
          return;
        }
        
        try {
          const tagData = await startReading();
          if (!mounted) return;
          
          if (tagData) {
            const businessNfc = parseBusinessId(tagData);
            // בדיקה שה-tag שייך לעסק הנוכחי - תומך גם בהתאמה מלאה וגם בחלקית
            const isMatch = businessNfc === expectedNfcString || 
                           (expectedNfcString && expectedNfcString.includes(businessNfc || '')) ||
                           (businessNfc && businessNfc.includes(expectedNfcString || ''));
            // בדיקת cooldown למניעת לולאות
            if (isMatch && !nfcCooldownRef.current) {
              // השמעת צליל הצלחה
              try {
                const { sound } = await Audio.Sound.createAsync(
                  require('../../assets/sounds/nfc-success.mp3')
                );
                await sound.playAsync();
                // שחרור הצליל אחרי השמעה
                sound.setOnPlaybackStatusUpdate((status) => {
                  if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                  }
                });
              } catch (soundErr) {
                console.log('[NFC] Sound play error:', soundErr);
              }
              setNfcModalVisible(true);
              // עצירה מיידית של הקריאה כדי שלא תיתפס אותה סריקה שוב
              stopReading().catch?.(() => {});
            }
          }
        } catch (err: any) {
          // התעלמות משגיאות רגילות של NFC
          if (!err?.message?.includes('cancelled') && !err?.message?.includes('request at a time')) {
            console.log('[NFC] Listen error:', err);
          }
        }
        
        // המשך האזנה עם delay של 500ms
        if (mounted) {
          readTimeoutId = setTimeout(listenForNFC, 500);
        }
      };
      
      listenForNFC();
    };
    
    const setupNFC = async () => {
      if (!expectedNfcString) return;
      
      // ב-iOS - לא מתחילים NFC אוטומטית! המשתמש ילחץ על כפתור "סרוק לניקוב"
      if (Platform.OS === 'ios') {
        console.log('[NFC] iOS detected - NFC will be triggered by user button only');
        return;
      }
      
      // באנדרואיד - התחלה אוטומטית
      startNFCListening();
    };
    
    setupNFC();
    
    // Cleanup - עצירת הלופ כשהקומפוננטה מתפרקת
    return () => {
      mounted = false;
      if (readTimeoutId) {
        clearTimeout(readTimeoutId);
      }
      stopReading();
    };
  }, [localBusiness?.nfc_string, initNFC, startReading, stopReading, parseBusinessId, checkLaunchTag, checkBackgroundTag, nfcModalVisible]);

  // --- REALTIME START ---
  // חיבור ל-Realtime לעדכונים מיידיים
  useEffect(() => {
    if (!phoneStr) return;

    const businessCode = customer?.business_code;
    const productCode = punchCard?.product_code;
    const cardNumber = punchCard?.card_number;
    
    if (!businessCode || !productCode || !cardNumber) return;

    // חיבור ל-Realtime לטבלת PunchCards
    const punchCardChannel = supabase
      .channel(`punchcard-${cardNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'PunchCards',
          filter: `card_number=eq.${cardNumber}`
        },
        (payload: { new?: Record<string, any>; old?: Record<string, any> }) => {
          if (payload.new) {
            // לשמור על product_name (שמגיע מטבלת products) גם לאחר עדכוני Realtime
            setPunchCard((prev) => ({
              ...(prev || {}),
              ...(payload.new as any),
            }) as any);
          }
        }
      )
      .subscribe();

    // חיבור ל-Realtime לטבלת businesses
    const businessChannel = supabase
      .channel(`business-${businessCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `business_code=eq.${businessCode}`
        },
                 async (payload: { new?: Record<string, any>; old?: Record<string, any> }) => {
           if (payload.new) {
            await refreshBusiness();
          }
        }
      )
      .subscribe();

    // ניקוי החיבורים כשהקומפוננטה נהרסת
    return () => {
      punchCardChannel.unsubscribe();
      businessChannel.unsubscribe();
      // ניקוי activity subscription אם קיים
      cleanupActivitySubscription();
    };
  }, [phoneStr, customer?.business_code, punchCard?.card_number, punchCard?.product_code]);
  // --- REALTIME END ---

  // רישום העסק למכשיר (ללא תלות במספר טלפון)
  useEffect(() => {
    const registerBusiness = async () => {
      if (!localBusiness) return;
      
      // רישום העסק למכשיר זה
      await FCMService.addBusinessCode(localBusiness.business_code);
    };
    
    registerBusiness();
  }, [localBusiness]);

  // עדכון פרטי משתמש עבור רישום טוקן מלא (טלפון + קוד עסק)
  useEffect(() => {
    const businessCode = localBusiness?.business_code;
    if (!businessCode || !phoneStr) return;

    FCMService.setUserContext(businessCode, phoneStr).catch(() => {});
  }, [localBusiness?.business_code, phoneStr]);

  // טעינת מספר הודעות לא נקראות בלבד (לBadge)
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (localBusiness && phoneStr) {
        try {
          const phoneVariants = [phoneStr, phoneIntl].filter(Boolean);
          const { count } = await supabase
            .from('inbox')
            .select('*', { count: 'exact', head: true })
            .eq('business_code', localBusiness.business_code)
            .in('customer_phone', phoneVariants.length > 0 ? phoneVariants : ['__NO_MATCH__'])
            .eq('status', 'unread');
          
          if (count !== null) {
            setUnreadMessages(count);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[Inbox] Error loading unread count:', error);
          }
        }
      }
    };
    
    loadUnreadCount();
  }, [localBusiness?.business_code, phoneStr]);

  // טעינת נתוני חבר מזמין חבר
  useEffect(() => {
    const fetchReferralData = async () => {
      if (!localBusiness?.business_code) return;
      
      try {
        // שלב 1: בדיקת הגדרות הפיצ'ר בטבלת referral_settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('referral_settings')
          .select('enabled')
          .eq('business_code', localBusiness.business_code)
          .single();
        
        // אם אין רשומה או הפיצ'ר כבוי - לא מוגדר
        if (settingsError || !settingsData || !settingsData.enabled) {
          setReferralData({ inviterBenefit: null, invitedBenefit: null, isConfigured: false });
          return;
        }
        
        // שלב 2: הפיצ'ר פעיל - טעינת השוברים
        const { data, error } = await supabase
          .from('voucher_types')
          .select('*')
          .eq('business_code', localBusiness.business_code)
          .eq('is_system', true)
          .in('system_type', ['referral_inviter', 'referral_invited']);
        
        if (error) {
          if (__DEV__) console.error('[Referral] Error fetching vouchers:', error);
          setReferralData({ inviterBenefit: null, invitedBenefit: null, isConfigured: false });
          return;
        }
        
        const inviterVoucher = data?.find((v: { system_type: string }) => v.system_type === 'referral_inviter');
        const invitedVoucher = data?.find((v: { system_type: string }) => v.system_type === 'referral_invited');
        
        // שליפת הטקסט מתוך ה-value JSON
        const inviterBenefit = inviterVoucher?.value?.text || null;
        const invitedBenefit = invitedVoucher?.value?.text || null;
        
        const isConfigured = !!(inviterBenefit && invitedBenefit);
        
        setReferralData({ inviterBenefit, invitedBenefit, isConfigured });
      } catch (e) {
        if (__DEV__) console.error('[Referral] Exception:', e);
        setReferralData({ inviterBenefit: null, invitedBenefit: null, isConfigured: false });
      }
    };
    
    fetchReferralData();
  }, [localBusiness?.business_code]);

  // עדכון Badge באייקון האפליקציה באמצעות expo-notifications
  useEffect(() => {
    const updateBadge = async () => {
      try {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          await Notifications.setBadgeCountAsync(unreadMessages);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[Inbox] Failed to update app badge:', error);
        }
      }
    };
    updateBadge();
  }, [unreadMessages]);

  // טעינת העדפות Opt-In באופן מתמשך (ברירת מחדל true, אך שומר ערכים אם קיימים ב-AsyncStorage)
  useEffect(() => {
    (async () => {
      try {
        const scopedBusiness = localBusiness?.business_code || customer?.business_code || '';
        const pushKeyScoped = scopedBusiness ? `push_opt_in_${scopedBusiness}` : 'push_opt_in';
        const smsKeyScoped = scopedBusiness ? `sms_opt_in_${scopedBusiness}` : 'sms_opt_in';

        // נסה קודם מפתח פר-עסק, ואז מפתח כללי (תמיכה לאחור)
        let pushStored = await AsyncStorage.getItem(pushKeyScoped);
        if (pushStored === null) {
          pushStored = await AsyncStorage.getItem('push_opt_in');
        }
        if (pushStored !== null) {
          setPushOptIn(pushStored === 'true');
        }

        let smsStored = await AsyncStorage.getItem(smsKeyScoped);
        if (smsStored === null) {
          smsStored = await AsyncStorage.getItem('sms_opt_in');
        }
        if (smsStored !== null) {
          setSmsOptIn(smsStored === 'true');
        }
      } catch {}
    })();
  }, [localBusiness?.business_code, customer?.business_code]);

  // האזנת Realtime ל-inbox לרענון מיידי של החיווי בלבד (Badge) כשהמודאל סגור
  useEffect(() => {
    const businessCode = localBusiness?.business_code;
    if (!phoneStr || !businessCode) return;
    // כאשר מודאל תיבת הדואר פתוח – אין האזנה כלל כדי למנוע קפיצות בגלילה
    if (mailVisible) return;

    const channel = supabase
      .channel(`inbox-${businessCode}-${phoneStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inbox',
          filter: `business_code=eq.${businessCode}`,
        },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (![phoneStr, phoneIntl].includes(row.customer_phone)) return;

          (async () => {
            try {
              const phoneVariants = [phoneStr, phoneIntl].filter(Boolean);
              const { count } = await supabase
                .from('inbox')
                .select('*', { count: 'exact', head: true })
                .eq('business_code', businessCode)
                .in('customer_phone', phoneVariants.length > 0 ? phoneVariants : ['__NO_MATCH__'])
                .eq('status', 'unread');

              if (count !== null) {
                setUnreadMessages(count);
              }
            } catch (_) {
              // בליעת שגיאות כדי לא לפגוע ביציבות
            }
          })();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [localBusiness?.business_code, phoneStr, phoneIntl, mailVisible]);

  // דיאגנוסטיקה ל-URL של השובר כשהוא נטען במודאל הפנימי
  useEffect(() => {
    if (voucherInlineUrl) {
      runVoucherDiagnostics('INBOX', voucherInlineUrl);
    }
  }, [voucherInlineUrl]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={{ fontSize: 18, color: '#A39393', fontFamily: 'Rubik' }}>טוען נתונים...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.loadingContainer, { justifyContent: 'center', alignItems: 'center' }]} accessible={true} accessibilityRole="alert"> 
        <Text style={{ fontSize: 18, color: '#D32F2F', marginBottom: 16, textAlign: 'center', fontFamily: 'Rubik' }} accessibilityLiveRegion="assertive">{errorMessage}</Text>
        <Text style={{ color: '#888', marginBottom: 24, textAlign: 'center' }}>
          נסה שוב ו
          <Text
            style={{ color: '#1E51E9', textDecorationLine: 'underline' }}
            onPress={() => router.push('/customers-login')}
          >
            חזור לדף הכניסה
          </Text>
        </Text>
      </View>
    );
  }

  // לוגיקת קוד כרטיסייה
  const cardCode = punchCard?.card_number || '';

  // לוגיקת ניקובים - שימוש ב-max_punches מהעסק במקום total_punches מהכרטיסייה
  const totalPunches = business?.max_punches || 0;
  const usedPunches = punchCard?.used_punches || 0;
  const unpunched = totalPunches - usedPunches;
  const punchedIcon = business?.punched_icon;
  const unpunchedIcon = business?.unpunched_icon;
  // בשורת "לקבלת" מציגים את שם מוצר הכרטיסייה (למקרה של כמה כרטיסיות בעסק).
  // אם אין לנו product_name, ניפול אחורה ל-benefit / product_code כדי לא להשאיר ריק.
  const benefit = (punchCard?.product_name || '').trim() || (punchCard?.benefit || '').trim() || punchCard?.product_code || '';
  const prepaid = punchCard?.prepaid === 'כן' ? 'כן' : 'לא';

  

  // בניית מערך אייקונים
  const iconsArr = [
    ...Array(usedPunches).fill(punchedIcon),
    ...Array(unpunched).fill(unpunchedIcon),
  ];

  

  // עיצוב גריד 4 אייקונים בשורה
  const iconsPerRow = 4;
  const rows = [];
  for (let i = 0; i < iconsArr.length; i += iconsPerRow) {
    rows.push(iconsArr.slice(i, i + iconsPerRow));
  }

  

  // צבע הטקסט מהעסק או ברירת מחדל
  const cardTextColor = business?.card_text_color || '#6B3F1D';

  // הודעות דמי פשוטות - 2 הודעות לדמו
  // פונקציה למחיקת הודעה
  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase
        .from('inbox')
        .delete()
        .eq('id', notificationId)
        .eq('business_code', localBusiness?.business_code || '')
        .eq('customer_phone', phoneStr || '');
      const updatedNotifications = notifications.filter(n => n.id !== notificationId);
      setNotifications(updatedNotifications);
      setUnreadMessages(updatedNotifications.filter(n => !n.read).length);
    } catch (_) {
      // ignore
    }
  };
  
  // פונקציה לסימון הודעה כנקראה
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('inbox')
        .update({ status: 'read' })
        .eq('id', notificationId)
        .eq('business_code', localBusiness?.business_code || '')
        .eq('customer_phone', phoneStr || '');
      
      // עדכון UI מיד לאחר עדכון ה-inbox
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      setNotifications(updatedNotifications);
      setUnreadMessages(updatedNotifications.filter(n => !n.read).length);
      
      // לוג קריאת הודעה לטבלת user_activities (לא חוסם את ה-UI)
      (async () => {
        try {
          await supabase.from('user_activities').insert({
            customer_id: phoneStr || '',
            business_code: localBusiness?.business_code || '',
            action_type: 'inbox_read',
            action_time: new Date().toISOString(),
            source: 'mobile'
          });
          if (__DEV__) console.log('[Inbox] Logged inbox_read');
        } catch (err: unknown) {
          if (__DEV__) console.log('[Inbox] Failed to log inbox_read:', err);
        }
      })();
    } catch (_) {
      // ignore
    }
  };

  // פונקציה לבחירת כרטיסייה
  const handleCardSelection = async (selectedCard: typeof availableCards[0]) => {
    setCardSelectionVisible(false);
    setLoading(true);
    
    // המשך טעינת נתוני הכרטיסייה שנבחרה
    const { data: punchCard, error: punchCardError } = await supabase
      .from('PunchCards')
      .select('*')
      .eq('card_number', selectedCard.card_number)
      .single();

    if (punchCardError || !punchCard) {
      setErrorMessage('שגיאה בטעינת הכרטיסייה. נסה שוב.');
      setLoading(false);
      return;
    }

    // שליפת נתוני העסק
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('business_code', business?.business_code)
      .single();

    if (businessError || !businessData) {
      setErrorMessage('שגיאה בטעינת נתוני העסק. נסה שוב.');
      setLoading(false);
      return;
    }

    // אם אין product_name על ה-card שנבחר (מיפוי products לא הצליח), נביא fallback מהטבלה.
    let selectedProductName = selectedCard?.products?.[0]?.product_name || '';
    if (!selectedProductName && selectedCard?.product_code) {
      const { data: prodRow } = await supabase
        .from('products')
        .select('product_name')
        .eq('business_code', business?.business_code)
        .eq('product_code', selectedCard.product_code)
        .maybeSingle();
      selectedProductName = String((prodRow as any)?.product_name || '').trim();
    }

    setLocalBusiness(businessData);
    setPunchCard({
      ...(punchCard as any),
      product_name: selectedProductName,
    } as any);
    setLoading(false);
  };

  // גשר לביטול alert בדף השובר ולהחליפו בטוסט פנימי + חיבור כפתור שמירה
  const ALERT_BRIDGE_JS = `
    (function() {
      var __bridge = window.ReactNativeWebView && window.ReactNativeWebView.postMessage ? window.ReactNativeWebView : null;
      if (!__bridge) return;
      
      // החלפת alert/confirm/prompt
      window.alert = function(msg){ __bridge.postMessage(JSON.stringify({ type: 'alert', message: String(msg||'') })); };
      window.confirm = function(msg){ __bridge.postMessage(JSON.stringify({ type: 'confirm', message: String(msg||'') })); return true; };
      window.prompt = function(msg, def){ __bridge.postMessage(JSON.stringify({ type: 'prompt', message: String(msg||'') })); return ''; };
      
      // חיבור כפתור "הוסף לגלריה"
      function attachSaveButton() {
        var btns = document.querySelectorAll('button');
        btns.forEach(function(btn) {
          if (btn.textContent && btn.textContent.includes('גלריה') && !btn.__saveAttached) {
            btn.__saveAttached = true;
            btn.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              __bridge.postMessage(JSON.stringify({ type: 'save-to-gallery' }));
              return false;
            };
          }
        });
      }
      
      // ניסיון מיידי + retry כל 500ms עד 10 שניות
      attachSaveButton();
      var attempts = 0;
      var interval = setInterval(function() {
        attempts++;
        attachSaveButton();
        if (attempts >= 20) clearInterval(interval);
      }, 500);
    })();
  `;

  // CSS מוזרק להתאמת תצוגת השובר באפליקציה
  const VOUCHER_STYLE_JS = `
    (function() {
      var style = document.createElement('style');
      style.textContent = \`
        /* הקטנת השובר ב-10% */
        .voucher-card-display {
          transform: scale(0.75) !important;
          transform-origin: center center !important;
        }
        /* העלאת התוכן (לא הברקוד) ב-60px - כשמסובב 90° זה שמאלה */
        .voucher-card-display .voucher-content,
        .voucher-card-display .voucher-text,
        .voucher-card-display .voucher-title,
        .voucher-card-display .voucher-description,
        .voucher-card-display .voucher-details,
        .voucher-card-display .business-name,
        .voucher-card-display .business-logo {
          transform: translateX(-60px) !important;
        }
        /* הסתרת כפתור ה-X הלא פעיל באמצע השובר */
        .close-button,
        .voucher-display-content > button.close-button,
        button[aria-label="סגור"] {
          display: none !important;
          visibility: hidden !important;
        }
        /* הסתרת כפתור הדפסה */
        .print-button,
        button.print-button,
        button[class*="print"] {
          display: none !important;
          visibility: hidden !important;
        }
        /* עיצוב כפתור גלריה - מלבן שטוח לכל רוחב */
        .save-button,
        button.save-button,
        button[class*="save"] {
          width: 100% !important;
          max-width: 280px !important;
          height: 44px !important;
          border-radius: 8px !important;
          margin: 10px auto !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-direction: row !important;
          white-space: nowrap !important;
          font-size: 16px !important;
          font-weight: bold !important;
        }
      \`;
      document.head.appendChild(style);
    })();
  `;

  const showVoucherToast = (message: string, ms = 3000) => {
    setVoucherToast({ visible: true, message });
    setTimeout(() => setVoucherToast({ visible: false, message: '' }), ms);
  };

  // פונקציה לשמירת שובר לגלריה באמצעות ViewShot
  const saveVoucherToGallery = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    
    try {
      // בקשת הרשאות
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showVoucherToast('נדרשת הרשאה לגישה לגלריה');
        return;
      }
      
      // לכידת התמונה מ-ViewShot
      const uri = await captureRef(voucherViewShotRef, {
        format: 'png',
        quality: 1,
      });
      
      // שמירה לגלריה
      await MediaLibrary.createAssetAsync(uri);
      showVoucherToast('השובר נשמר לגלריה בהצלחה! 📸');
    } catch (error) {
      console.error('[SaveToGallery-INBOX] Error:', error);
      showVoucherToast('שגיאה בשמירת השובר');
    } finally {
      setTimeout(() => { isSavingRef.current = false; }, 500);
    }
  };

  const normalizePhone = (p?: string) => {
    if (!p) return '';
    // קודם ננקה את כל התווים שאינם ספרות
    const digitsOnly = p.replace(/[^0-9]/g, '');
    if (!digitsOnly) return '';
    // בדיקה אם זה טלפון ישראלי בפורמט 05xxxxxxxx
    if (/^05\d{8}$/.test(digitsOnly)) return `972${digitsOnly.slice(1)}`;
    return digitsOnly;
  };

  const toLocal05 = (p?: string) => {
    if (!p) return '';
    const onlyDigits = p.replace(/[^0-9]/g, '');
    // המרה לפורמט 05 אם זה טלפון בינלאומי ישראלי
    if (/^9725\d{8}$/.test(onlyDigits)) return `0${onlyDigits.slice(3)}`;
    // אם לא תואם pattern - מחזיר את הספרות בלבד, או המקורי אם אין ספרות
    if (!onlyDigits) return p;
    return onlyDigits;
  };

  const getPhoneVariants = (raw?: string) => {
    const a = (raw || '').trim();
    const b = normalizePhone(a);
    const c = toLocal05(b);
    const uniq = Array.from(new Set([a, b, c].filter(Boolean)));
    return uniq;
  };

  const mapActionToLabelAndAmount = (t?: string): { label: string; amount: number } => {
    switch ((t || '').toLowerCase()) {
      case 'punch_added':
        return { label: 'נוסף ניקוב', amount: 1 };
      case 'punch_removed':
        return { label: 'ביטול ניקוב', amount: -1 };
      case 'punch_used':
        return { label: 'מימוש ניקוב', amount: -1 };
      case 'punch_unuse':
        return { label: 'החזרת ניקוב', amount: 1 };
      case 'voucher_issued':
        return { label: 'שובר הונפק', amount: 1 };
      case 'voucher_used':
        return { label: 'שובר מומש', amount: -1 };
      case 'voucher_expired':
        return { label: 'שובר פג תוקף', amount: -1 };
      // סוגי פעולות מ-activity_logs (אדמין)
      case 'punch':
      case 'add_punch':
      case 'stamp':
      case 'add_stamp':
        return { label: 'ניקוב כרטיסייה', amount: 1 };
      case 'void_punch':
      case 'cancel_punch':
        return { label: 'ביטול ניקוב', amount: -1 };
      case 'card_renewal':
      case 'renew':
      case 'renew_card':
        return { label: 'חידוש כרטיסייה', amount: 1 };
      // שוברים
      case 'voucher_received':
        return { label: 'קבלת שובר', amount: 1 };
      case 'voucher_sent':
        return { label: 'שליחת שובר', amount: 1 };
      default:
        return { label: t || 'פעולה', amount: 1 };
    }
  };

  const fetchMyActivityFeed = async (pageSize = 100, cursor?: string) => {
    // cursor הוא timestamp בלבד
    const cursorTimestamp = cursor;
    const businessCode = business?.business_code || customer?.business_code;
    const raw = customer?.customer_phone || phoneStr || phoneIntl;
    if (!businessCode || !raw) {
      console.log('[ActivityFeed] Missing businessCode or phone', { businessCode, raw });
      return { rows: [], next: null as string | null };
    }

    const variants = getPhoneVariants(raw);
    console.log('[ActivityFeed] Starting fetch', { businessCode, raw, variants });
    const allRows: Array<{ dateStr: string; actionLabel: string; amount: number; timestamp: string }> = [];
    
    // 1. קריאה מ-customer_activity_feed (קיים)
    for (const custPhone of variants) {
      try {
        let q = supabase
          .from('customer_activity_feed')
          .select('*')
          .eq('business_code', businessCode)
          .eq('customer_phone', custPhone)
          .order('timestamp', { ascending: false })
          .limit(pageSize);

        if (cursorTimestamp) {
          q = q.lt('timestamp', cursorTimestamp);
        }

        const { data, error } = await q;
        if (error) {
          console.log('[ActivityFeed] customer_activity_feed query error', { businessCode, custPhone, message: String(error?.message || error), errorCode: error.code });
          continue;
        }
        const arr = Array.isArray(data) ? data : [];
        console.log('[ActivityFeed] fetched from customer_activity_feed', { businessCode, custPhone, count: arr.length, cursor: cursor || null });
        if (arr.length > 0) {
          console.log('[ActivityFeed] customer_activity_feed sample:', arr.slice(0, 2).map((r: any) => ({ action_type: r.action_type, timestamp: r.timestamp })));
        }
        const rows = arr.map((row: any) => {
          const ts = row?.timestamp ? new Date(row.timestamp) : new Date();
          const dateStr = ts.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          const { label, amount } = mapActionToLabelAndAmount(row?.action_type);
          const qty = typeof row?.amount === 'number' ? row.amount : amount;
          return { dateStr, actionLabel: label, amount: qty, timestamp: row?.timestamp || ts.toISOString() };
        });
        allRows.push(...rows);
      } catch (e: any) {
        console.log('[ActivityFeed] customer_activity_feed exception', { businessCode, raw, error: String(e?.message || e) });
      }
    }
    
    // 1.5. קריאה מ-user_activities (אם customer_activity_feed לא כולל הכל)
    for (const custPhone of variants) {
      try {
        let q = supabase
          .from('user_activities')
          .select('*')
          .eq('customer_id', custPhone)
          .order('action_time', { ascending: false })
          .limit(pageSize);

        if (cursorTimestamp) {
          q = q.lt('action_time', cursorTimestamp);
        }

        const { data, error } = await q;
        if (error) {
          console.log('[ActivityFeed] user_activities query error', { businessCode, custPhone, message: String(error?.message || error) });
          continue;
        }
        const arr = Array.isArray(data) ? data : [];
        console.log('[ActivityFeed] fetched from user_activities', { businessCode, custPhone, count: arr.length });
        if (arr.length > 0) {
          console.log('[ActivityFeed] user_activities sample:', arr.slice(0, 2).map((r: any) => ({ action_type: r.action_type, action_time: r.action_time })));
        }
        const rows = arr.map((row: any) => {
          const ts = row?.action_time ? new Date(row.action_time) : new Date();
          const dateStr = ts.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          const { label, amount } = mapActionToLabelAndAmount(row?.action_type);
          const qty = typeof row?.amount === 'number' ? row.amount : amount;
          return { dateStr, actionLabel: label, amount: qty, timestamp: row?.action_time || ts.toISOString() };
        });
        allRows.push(...rows);
      } catch (e: any) {
        console.log('[ActivityFeed] user_activities exception', { businessCode, raw, error: String(e?.message || e) });
      }
    }

    // 2. קריאה מ-activity_logs (פעילויות אדמין) - תיקון כירורגי משופר
    for (const custPhone of variants) {
      try {
        // חיפוש כל הכרטיסיות של הלקוח בעסק
        const { data: cardsData, error: cardsError } = await supabase
          .from('PunchCards')
          .select('card_number, customer_phone')
          .eq('business_code', businessCode)
          .eq('customer_phone', custPhone);

        const cardNumbers = cardsData && !cardsError ? cardsData.map(c => c.card_number) : [];
        
        // קריאת activity_logs - בדיקה בכל האפשרויות:
        // 1. target_entity = card_number
        // 2. target_entity = customer_phone
        // 3. action_details מכיל card_number או customer_phone
        let q = supabase
          .from('activity_logs')
          .select('*')
          .eq('business_code', businessCode)
          .eq('user_type', 'business_user')
          .order('timestamp', { ascending: false })
          .limit(pageSize * 2); // לוקח יותר כדי לסנן אחר כך

        if (cursorTimestamp) {
          q = q.lt('timestamp', cursorTimestamp);
        }

        const { data, error } = await q;
        if (error) {
          console.log('[ActivityFeed] activity_logs query error', { businessCode, custPhone, message: String(error?.message || error) });
          continue;
        }
        const arr = Array.isArray(data) ? data : [];
        console.log('[ActivityFeed] fetched from activity_logs (raw)', { businessCode, custPhone, count: arr.length, cursor: cursor || null });
        
        // לוג מפורט של כל הרשומות (רק אם יש רשומות)
        if (arr.length > 0) {
          console.log('[ActivityFeed] sample activity_logs entries:', arr.slice(0, 3).map((r: any) => ({
            id: r.id,
            action_type: r.action_type,
            target_entity: r.target_entity,
            action_details: r.action_details,
            user_type: r.user_type,
            timestamp: r.timestamp
          })));
        } else {
          console.log('[ActivityFeed] WARNING: No activity_logs found for business_user in business_code:', businessCode);
        }
        
        // סינון פעילויות ששייכות ללקוח הנוכחי
        const filteredRows = arr.filter((row: any) => {
          // בדיקה 1: target_entity = card_number
          if (row.target_entity && cardNumbers.includes(row.target_entity)) {
            console.log('[ActivityFeed] matched by target_entity=card_number', { target_entity: row.target_entity, action_type: row.action_type });
            return true;
          }
          
          // בדיקה 2: target_entity = customer_phone
          if (row.target_entity && variants.includes(row.target_entity)) {
            console.log('[ActivityFeed] matched by target_entity=customer_phone', { target_entity: row.target_entity, action_type: row.action_type });
            return true;
          }
          
          // בדיקה 3: action_details מכיל card_number או customer_phone
          if (row.action_details && typeof row.action_details === 'object') {
            const details = row.action_details;
            const detailsCardNumber = details.card_number || details.cardNumber;
            const detailsCustomerPhone = details.customer_phone || details.customerPhone || details.phone;
            
            if (detailsCardNumber && cardNumbers.includes(String(detailsCardNumber))) {
              console.log('[ActivityFeed] matched by action_details.card_number', { card_number: detailsCardNumber, action_type: row.action_type });
              return true;
            }
            
            if (detailsCustomerPhone && variants.includes(String(detailsCustomerPhone))) {
              console.log('[ActivityFeed] matched by action_details.customer_phone', { customer_phone: detailsCustomerPhone, action_type: row.action_type });
              return true;
            }
          }
          
          return false;
        });
        
        console.log('[ActivityFeed] filtered activity_logs', { businessCode, custPhone, rawCount: arr.length, filteredCount: filteredRows.length });
        
        const rows = filteredRows.map((row: any) => {
          const ts = row?.timestamp ? new Date(row.timestamp) : new Date();
          const dateStr = ts.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          const { label, amount } = mapActionToLabelAndAmount(row?.action_type);
          const qty = typeof row?.amount === 'number' ? row.amount : amount;
          return { dateStr, actionLabel: label, amount: qty, timestamp: row?.timestamp || ts.toISOString() };
        });
        allRows.push(...rows);
      } catch (e: any) {
        console.log('[ActivityFeed] activity_logs exception', { businessCode, raw, error: String(e?.message || e) });
      }
    }

    // מיון לפי timestamp וסינון כפילויות - עם ID ייחודי
    console.log('[ActivityFeed] Total rows before deduplication:', allRows.length);
    
    // הוספת ID ייחודי לכל שורה לפני מיון
    const rowsWithId = allRows.map((row, idx) => ({
      ...row,
      uniqueId: `${row.timestamp}_${row.actionLabel}_${idx}`
    }));
    
    const uniqueRows = Array.from(
      new Map(rowsWithId.map(row => [row.timestamp + row.actionLabel, row])).values()
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log('[ActivityFeed] Total rows after deduplication:', uniqueRows.length);
    const limitedRows = uniqueRows.slice(0, pageSize);
    
    // cursor פשוט: timestamp בלבד (dedup מטופל בצד קליינט)
    const lastRow = limitedRows[limitedRows.length - 1];
    // בדיקה אם יש עוד רשומות מעבר למה שהוצג
    const next = limitedRows.length > 0 && uniqueRows.length > limitedRows.length 
      ? lastRow.timestamp 
      : null;

    console.log('[ActivityFeed] Final result:', { rowsCount: limitedRows.length, hasNext: !!next });
    return { rows: limitedRows.map(({ timestamp, uniqueId, ...rest }) => rest), next };
  };

  const subscribeMyActivityRealtime = (businessCode: string, rawPhone: string) => {
    try {
      // ביטול subscription קודם אם קיים
      if (activityChannelRef.current) {
        activityChannelRef.current.unsubscribe();
        activityChannelRef.current = null;
      }
      
      const variants = getPhoneVariants(rawPhone);
      const phoneId = rawPhone.replace(/[^0-9]/g, '').slice(-4) || 'unknown';
      const channelName = `client_activity_rt_${businessCode}_${phoneId}`;
      const ch = supabase.channel(channelName);
      
      // 1. Realtime subscription ל-user_activities (קיים)
      ch.on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_activities' },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          // אם יש עמודת business_code ב-user_activities — לאכוף התאמה; אחרת מתבססים על טלפון בלבד
          if (row.business_code && row.business_code !== businessCode) return;
          if (!variants.includes(String(row.customer_id || '').trim())) return;
          const ts = row?.action_time ? new Date(row.action_time) : new Date();
          const dateStr = ts.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          const { label, amount } = mapActionToLabelAndAmount(row?.action_type);
          setActivityRows((prev) => [{ dateStr, actionLabel: label, amount: typeof amount === 'number' ? amount : 1 }, ...prev]);
        }
      );

      // 2. Realtime subscription ל-activity_logs (פעילויות אדמין) - תיקון כירורגי משופר
      ch.on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'activity_logs',
          filter: `business_code=eq.${businessCode}`
        },
        async (payload: any) => {
          const row = payload?.new;
          if (!row || row.user_type !== 'business_user') return;
          
          try {
            let isMatch = false;
            
            // בדיקה 1: target_entity = customer_phone
            if (row.target_entity && variants.includes(row.target_entity)) {
              console.log('[ActivityFeed] Realtime matched by target_entity=customer_phone', { target_entity: row.target_entity, action_type: row.action_type });
              isMatch = true;
            }
            
            // בדיקה 2: target_entity = card_number
            if (!isMatch && row.target_entity) {
              const { data: cardData } = await supabase
                .from('PunchCards')
                .select('customer_phone')
                .eq('card_number', row.target_entity)
                .eq('business_code', businessCode)
                .single();
              
              if (cardData && variants.includes(cardData.customer_phone)) {
                console.log('[ActivityFeed] Realtime matched by target_entity=card_number', { target_entity: row.target_entity, action_type: row.action_type });
                isMatch = true;
              }
            }
            
            // בדיקה 3: action_details מכיל customer_phone או card_number
            if (!isMatch && row.action_details && typeof row.action_details === 'object') {
              const details = row.action_details;
              const detailsCustomerPhone = details.customer_phone || details.customerPhone || details.phone;
              const detailsCardNumber = details.card_number || details.cardNumber;
              
              if (detailsCustomerPhone && variants.includes(String(detailsCustomerPhone))) {
                console.log('[ActivityFeed] Realtime matched by action_details.customer_phone', { customer_phone: detailsCustomerPhone, action_type: row.action_type });
                isMatch = true;
              } else if (detailsCardNumber) {
                const { data: cardData } = await supabase
                  .from('PunchCards')
                  .select('customer_phone')
                  .eq('card_number', String(detailsCardNumber))
                  .eq('business_code', businessCode)
                  .single();
                
                if (cardData && variants.includes(cardData.customer_phone)) {
                  console.log('[ActivityFeed] Realtime matched by action_details.card_number', { card_number: detailsCardNumber, action_type: row.action_type });
                  isMatch = true;
                }
              }
            }
            
            if (!isMatch) return;
            
            const ts = row?.timestamp ? new Date(row.timestamp) : new Date();
            const dateStr = ts.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
              + ' ' + ts.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const { label, amount } = mapActionToLabelAndAmount(row?.action_type);
            setActivityRows((prev) => [{ dateStr, actionLabel: label, amount: typeof amount === 'number' ? amount : 1 }, ...prev]);
          } catch (e) {
            console.log('[ActivityFeed] Realtime activity_logs error', e);
          }
        }
      );

      ch.subscribe();
      activityChannelRef.current = ch;
    } catch {}
  };

  const cleanupActivitySubscription = () => {
    try {
      if (activityChannelRef.current) {
        activityChannelRef.current.unsubscribe();
      }
    } catch {}
    activityChannelRef.current = null;
  };

  const openMyActivity = async () => {
    try {
      setMenuVisible(false);
      setActivityLoading(true);
      setActivityRows([]);
      setActivityNextCursor(null);

      const businessCode = business?.business_code || customer?.business_code;
      const { rows, next } = await fetchMyActivityFeed(100);
      setActivityRows(rows);
      setActivityNextCursor(next);
      setActivityVisible(true);

      const custPhone = customer?.customer_phone || phoneStr || phoneIntl;
      if (businessCode && custPhone) {
        cleanupActivitySubscription();
        subscribeMyActivityRealtime(businessCode, custPhone);
      }
    } finally {
      setActivityLoading(false);
    }
  };

  const loadMoreActivity = async () => {
    if (activityLoadingMore || !activityNextCursor) return;
    setActivityLoadingMore(true);
    try {
      const { rows, next } = await fetchMyActivityFeed(100, activityNextCursor);
      setActivityRows((prev) => [...prev, ...rows]);
      setActivityNextCursor(next);
    } finally {
      setActivityLoadingMore(false);
    }
  };

  const runVoucherDiagnostics = (source: string, targetUrl: string) => {
    console.log(`[VoucherDiag-${source}] Inline URL:`, targetUrl);
    try {
      const parsed = new URL(targetUrl);
      const pingUrl = `${parsed.origin}/__vite_ping`;
      fetch(pingUrl)
        .then(async (res) => {
          const text = await res.text();
          console.log(`[VoucherDiag-${source}] __vite_ping status:`, res.status, 'ok:', res.ok);
          console.log(`[VoucherDiag-${source}] __vite_ping body:`, text.slice(0, 120));
        })
        .catch((err) => console.error(`[VoucherDiag-${source}] __vite_ping failed:`, err));
    } catch (err) {
      console.error(`[VoucherDiag-${source}] diagnostics error:`, err);
    }
  };

  

  const handleVoucherMessage = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      // טיפול בכפתור שמירה לגלריה
      if (parsed.type === 'save-to-gallery') {
        console.log('[INBOX] Save to gallery requested');
        saveVoucherToGallery().catch(err => console.error('[INBOX] Save error:', err));
        return;
      }
      if (parsed.type === 'diagnostics') {
        console.log('[VoucherDiag-INBOX] Diagnostics payload:', parsed);
        if (parsed.viewport) {
          console.log('[VoucherDiag-INBOX] === VIEWPORT INFO ===');
          console.log('[VoucherDiag-INBOX] innerWidth:', parsed.viewport.innerWidth);
          console.log('[VoucherDiag-INBOX] innerHeight:', parsed.viewport.innerHeight);
          console.log('[VoucherDiag-INBOX] devicePixelRatio:', parsed.viewport.devicePixelRatio);
          console.log('[VoucherDiag-INBOX] screen:', parsed.viewport.screenWidth, 'x', parsed.viewport.screenHeight);
          console.log('[VoucherDiag-INBOX] document:', parsed.viewport.documentWidth, 'x', parsed.viewport.documentHeight);
          console.log('[VoucherDiag-INBOX] ======================');
        }
      }
    } catch {
      // התעלם משגיאות פרסינג
    }
  };

  const handleSelfDeleteConfirm = async () => {
    if (deletingSelf) return;
    try {
      setDeletingSelf(true);
      const businessCode = localBusiness?.business_code || customer?.business_code || business?.business_code || '';
      const custPhone = customer?.customer_phone || phoneStr || '';
      
      // לוגים לאבחון
      console.log('[SELF_DELETE] Starting deletion:', { businessCode, custPhone, customer: customer?.business_code, localBusiness: localBusiness?.business_code, business: business?.business_code });
      
      if (!businessCode || !custPhone) {
        console.error('[SELF_DELETE] Missing params:', { businessCode, custPhone });
        setDeletingSelf(false);
        setDisconnectVisible(false);
        return;
      }
      
      // בדיקה אם הלקוח קיים לפני המחיקה
      const { data: checkData, error: checkError } = await supabase
        .from('customers')
        .select('business_code, customer_phone, deleted_at, name')
        .eq('business_code', businessCode)
        .eq('customer_phone', custPhone)
        .maybeSingle();
      
      console.log('[SELF_DELETE] Customer check before delete:', { checkData, checkError, exists: !!checkData, alreadyDeleted: checkData?.deleted_at ? true : false });
      
      // קריאה לפונקציית RPC ב-SQL (לא Edge)
      const { data, error } = await supabase.rpc('customer_self_delete', {
        p_business_code: businessCode,
        p_customer_phone: custPhone,
      });
      
      console.log('[SELF_DELETE] RPC result:', { data, error, dataType: typeof data });
      
      // בדיקת שגיאה מהRPC
      if (error) {
        console.error('[SELF_DELETE] RPC error:', error);
        showVoucherToast('לא הצלחנו למחוק. אנא נסה שוב או פנה לתמיכה.', 3000);
        setDeletingSelf(false);
        setDisconnectVisible(false);
        return;
      }
      
      // בדיקת תוצאה - תומך בכמה פורמטים אפשריים
      const result = data as any;
      const isSuccess = result === true || 
                        result?.success === true || 
                        (typeof result?.updated === 'number' && result.updated > 0) ||
                        (typeof result === 'number' && result > 0);
      
      // אם לא הצליח - הצג שגיאה
      if (!isSuccess) {
        const errorMsg = result?.error || 'לא התקבל אישור למחיקה';
        console.error('[SELF_DELETE] Deletion failed:', { data, errorMsg, isSuccess });
        showVoucherToast('לא הצלחנו למחוק. אנא נסה שוב או פנה לתמיכה.', 3000);
        setDeletingSelf(false);
        setDisconnectVisible(false);
        return;
      }
      // ניקוי מצב מקומי בסיסי
      try {
        await AsyncStorage.removeItem('push_opt_in');
        await AsyncStorage.removeItem('sms_opt_in');
        if (businessCode) {
          await AsyncStorage.removeItem(`push_opt_in_${businessCode}`);
          await AsyncStorage.removeItem(`sms_opt_in_${businessCode}`);
        }
      } catch {}
      setDeletingSelf(false);
      setDisconnectVisible(false);
      setDeleteVisible(false);
      setMenuVisible(false);
      // הודעת אפליקציה לפני יציאה - ללא זמן אוטומטי (תישאר עד סגירה ידנית)
      setVoucherToast({ 
        visible: true, 
        message: 'אנו מצטערים שאתה עוזב ומקווים שאי פעם אולי תחזור. לידיעתך פרטיך ימחקו סופית מהמערכת לאחר 30 ימים. תשומת לבך שנותקת רק מעסק זה. אם יש לך בתי עסק אחרים שהינך רוצה להתנתק - בצע מחיקה בכל אחד מהם. כמו כן כדי להתנתק מכל בתי העסק באפליקציה במידה ולא חשוב לך מחיקת נתוניך בכל בית עסק עליך להסירה לחלוטין מחנות האפליקציות.'
      });
      // חזרה למסך הכניסה/מסך ראשי רק אחרי סגירת ההודעה
    } catch (_) {
      setDeletingSelf(false);
      setDisconnectVisible(false);
    }
  };

  return (
    <>
      {/* כפתור חזרה ל-iOS - בתחתית המסך */}
      {Platform.OS === 'ios' && (
        <View style={{ position: 'absolute', bottom: 40, left: 10, zIndex: 100 }}>
          <BackButton fallbackRoute="/(tabs)/customers-login" color={brandColor} />
        </View>
      )}
    <ScrollView contentContainerStyle={styles.container}>
      {/* תפריט המבורגר */}
      <TouchableOpacity 
        style={[styles.hamburgerContainer, styles.topIconOffsetClean]}
        onPress={() => setMenuVisible(true)}
        accessibilityLabel="אפשרויות נוספות"
        accessibilityRole="button"
        accessibilityHint="לחץ לפתיחת תפריט עם אפשרויות נוספות כמו העדפות, פעילות ומחיקת משתמש"
      >
        <View style={{ alignItems: 'center' }}>
          <View style={styles.hamburgerButton}>
            <View style={[styles.hamburgerLine, { backgroundColor: cardTextColor }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: cardTextColor }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: cardTextColor }]} />
          </View>
          <Text style={[styles.communityIconLabel, { color: cardTextColor, transform: [{ translateY: 2.5 }] }]}>אפשרויות נוספות</Text>
        </View>
      </TouchableOpacity>

      {/* אייקון הודעות דואר */}
      <TouchableOpacity 
        style={[styles.mailIconContainer, styles.topIconOffsetClean]}
        accessibilityLabel={`הדואר שלי${unreadMessages > 0 ? `, ${unreadMessages} הודעות שלא נקראו` : ''}`}
        accessibilityRole="button"
        accessibilityHint="לחץ לצפייה בהודעות שהתקבלו מהעסק"
        onPress={async () => {
          setMailVisible(true);
          
          // טעינה מיידית של ההודעות
          if (localBusiness && phoneStr) {
            setInboxLoading(true);
            
            try {
              const phoneVariants = [phoneStr, phoneIntl].filter(Boolean);
              // שאילתה מתוקנת - רק שדות שקיימים בטבלת inbox
              const { data, error } = await supabase
                .from('inbox')
                .select('id, message, status, created_at')
                .eq('business_code', localBusiness.business_code)
                .in('customer_phone', phoneVariants.length > 0 ? phoneVariants : ['__NO_MATCH__'])
                .order('created_at', { ascending: false });
              if (error) {
                if (__DEV__) {
                  console.error('[Inbox] Supabase error:', error);
                }
              } else if (data) {
                const mapped = data.map((row: any) => ({
                  id: String(row.id),
                  title: 'הודעה מהעסק',  // ברירת מחדל - אין שדה title בטבלה
                  body: row.message || '',
                  timestamp: new Date(row.created_at).getTime(),
                  read: row.status === 'read',
                  voucherUrl: undefined,  // אין שדה data בטבלה
                }));
                setNotifications(mapped);
                setUnreadMessages(mapped.filter(n => !n.read).length);
              }
              
              setInboxLoading(false);
            } catch (err) {
              if (__DEV__) {
                console.error('[Inbox] Exception:', err);
              }
              setInboxLoading(false);
            }
          } else {
            setInboxLoading(false);
          }
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={styles.mailIconWrap}>
            <Image 
              source={{ uri: 'https://noqfwkxzmvpkorcaymcb.supabase.co/storage/v1/object/public/icons//my_mail.png' }}
              style={[styles.mailIcon, { tintColor: cardTextColor }]}
              resizeMode="contain"
            />
            {unreadMessages > 0 && (
              <View style={styles.messageBadge}>
                <Text style={styles.badgeText}>{unreadMessages}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.communityIconLabel, { color: cardTextColor }]}>הדואר שלי</Text>
        </View>
      </TouchableOpacity>

      {/* אייקון קבוצה באמצע */}
      <TouchableOpacity 
        style={[styles.communityIconContainer, styles.topIconOffsetClean]}
        onPress={() => setReferralVisible(true)}
        accessibilityLabel="הזמן חבר"
        accessibilityRole="button"
        accessibilityHint="לחץ לשיתוף הכרטיסייה עם חבר בוואטסאפ"
      >
        <View style={{ alignItems: 'center' }}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/681/681443.png' }}
            style={[styles.communityIcon, { tintColor: cardTextColor }]}
            resizeMode="contain"
          />
          <Text style={[styles.communityIconLabel, { color: cardTextColor }]}>הזמן חבר</Text>
        </View>
      </TouchableOpacity>
      
      {/* עטיפה להגדלת כל התוכן ב-25% (חוץ מאייקוני תפריט עליון) */}
      <View style={{ transform: [{ scale: 1.25 }], width: '80%', alignSelf: 'center', marginTop: 80 }}>
      
      {/* מקשה אחת - לוגו, שם עסק ושם לקוח */}
      <View style={styles.topElementsGroup}>
        {/* לוגו ושם עסק - מוזחים ב-5% */}
        <View style={styles.logoBusinessOffset}>
          {/* לוגו העסק */}
          <View style={styles.logoContainer}>
            {business?.logo && (
              <View style={{ position: 'relative' }}>
                {logoLoading && (
                  <View style={{ 
                    position: 'absolute',
                    width: 170, 
                    height: 170,
                    backgroundColor: '#f0f0f0',
                    borderRadius: 85,
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: [{ scale: getCurrentLogoScale() }]
                  }}>
                    <Text style={{ color: '#999', fontSize: 12, fontFamily: 'Rubik' }}>טוען לוגו...</Text>
                  </View>
                )}
                <Image 
                  key={`logo-${business.business_code}-${business.logo}`}
                  source={{ uri: business.logo }} 
                  style={{ 
                    width: 170, 
                    height: 170,
                    transform: [{ scale: getCurrentLogoScale() }],
                    opacity: logoLoading ? 0 : 1
                  }} 
                  resizeMode="contain"
                  onLoad={() => setLogoLoading(false)}
                  onError={() => setLogoLoading(false)}
                />
              </View>
            )}
            {/* שם העסק מתחת ללוגו */}
            {business?.name && (
              <Text style={[styles.businessName, { color: cardTextColor }]} accessibilityRole="header">{business.name}</Text>
            )}
          </View>
        </View>
                 {/* שם הלקוח */}
         <Text style={[styles.customerName, { color: cardTextColor, marginTop: rows.length === 4 ? (Platform.OS === 'ios' ? 60 : 0) : (Platform.OS === 'ios' ? 120 : 60) }]} accessibilityRole="text" accessibilityLabel={`שלום ${customer?.name || 'לקוח'}`}>{customer?.name || ''}</Text>
      </View>
      {/* כל התוכן מתחת לשם הלקוח - מוזח 10% למטה, ב-4 שורות עולה 60px */}
      <View style={[styles.bottomContentOffset, rows.length === 4 ? { transform: [{ translateY: height * 0.095 + 67 - 60 }] } : {}]}>
        {/* אייקונים - מוזחים 5% למעלה */}
        <View style={styles.iconsUpOffset}>
        <View style={styles.iconsBoxTight}>
        {rows.map((row, idx) => (
          <View key={idx} style={styles.iconsRow}>
            {row.map((icon, j) => {
              const iconIndex = idx * iconsPerRow + j;
              const isIconLoading = iconsLoading[iconIndex] !== false;
              const isPunched = iconIndex < usedPunches;
              
              return (
                <View key={j} style={{ position: 'relative' }}>
                  {isIconLoading && (
                    <View style={{
                      position: 'absolute',
                      width: 55,
                      height: 55,
                      backgroundColor: '#f0f0f0',
                      borderRadius: 27.5,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 1
                    }}>
                      <Text style={{ color: '#999', fontSize: 7, fontFamily: 'Rubik' }}>טוען...</Text>
                    </View>
                  )}
                  {isPunched ? (
                    <>
                      {/* כוס קפה בתור בסיס */}
                      <Image
                        source={{ uri: unpunchedIcon }}
                        style={[styles.icon, { opacity: isIconLoading ? 0 : 1 }]}
                        resizeMode="contain"
                        onLoad={() => setIconsLoading(prev => ({ ...prev, [iconIndex]: false }))}
                        onError={() => setIconsLoading(prev => ({ ...prev, [iconIndex]: false }))}
                      />
                      {/* חור ניקוב מעל הכוס - מוקטן ל-80% מהגודל הקודם */}
                      <Image
                        source={{ uri: 'https://noqfwkxzmvpkorcaymcb.supabase.co/storage/v1/object/public/icons/punched_icones/punch_overlay.png' }}
                        style={[styles.icon, { 
                          position: 'absolute', 
                          top: -5.5, 
                          left: -5.5, 
                          width: 66, 
                          height: 66, 
                          opacity: isIconLoading ? 0 : 1 
                        }]}
                        resizeMode="contain"
                      />
                    </>
                  ) : (
                  <Image
                    source={{ uri: icon }}
                    style={[styles.icon, { opacity: isIconLoading ? 0 : 1 }]}
                    resizeMode="contain"
                    onLoad={() => setIconsLoading(prev => ({ ...prev, [iconIndex]: false }))}
                    onError={() => setIconsLoading(prev => ({ ...prev, [iconIndex]: false }))}
                  />
                  )}
                </View>
              );
            })}
          </View>
        ))}
        </View>
      </View>
      {/* 4 הטקסטים התחתונים - מוזחים דינמית לפי מספר שורות הגריד */}
      <View style={[styles.bottomTextsUpOffset, { 
        marginTop: rows.length <= 2 ? 0 : rows.length === 3 ? -60 : -90 
      }]}>
        {/* ניקובים */}
        <Text style={[styles.punchCount, { color: cardTextColor }]} accessibilityLabel={`יש לך ${usedPunches} ניקובים מתוך ${totalPunches}`}>{`ניקובים: ${usedPunches}/${totalPunches}`}</Text>
        {/* טקסט מתחת לאייקונים */}
        <Text style={[styles.benefitText, { color: cardTextColor }]} accessibilityLabel={`נותרו ${unpunched} ניקובים לקבלת ${benefit}`}>
          נותרו {unpunched} ניקובים לקבלת {benefit}
        </Text>
        {/* סטטוס תשלום מראש */}
        <Text style={[styles.prepaidText, { color: cardTextColor }]}>תשלום מראש: {prepaid}</Text>
        
        {/* תאריך תפוגה */}
        <Text style={[styles.expirationText, { color: cardTextColor }]}>
          בתוקף עד: {business?.expiration_date 
            ? new Date(business.expiration_date).toLocaleDateString('he-IL') 
            : 'ללא זמן תפוגה'}
        </Text>

        {/* כפתור NFC ל-iOS בלבד - באנדרואיד הסריקה אוטומטית */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={{
              marginTop: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={async () => {
              try {
                await initNFC();
                const tagData = await startReading();
                if (tagData) {
                  setNfcModalVisible(true);
                }
              } catch (err) {
                console.log('[iOS NFC] Scan error:', err);
              }
            }}
            accessibilityLabel="סרוק תג NFC לניקוב"
            accessibilityRole="button"
          >
            <Image 
              source={require('../../assets/icons/NFC_ISO_BOTTEN.png')}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      </View>
      
      </View>
      
      {/* ברקוד - מוסתר מתחת לקיפול, מתגלה בגלילה */}
      {cardCode && (
      <View style={{ marginTop: 200, alignItems: 'center', width: '100%', paddingBottom: 10 }}>
        <View style={{ maxWidth: 250, width: '70%' }}>
          <Barcode value={cardCode} format="CODE128" height={50} width={1.2} />
        </View>
        <Text style={styles.cardCode}>#{cardCode}</Text>
      </View>
      )}
      
      </View>{/* סגירת עטיפת הגדלה 25% */}
      
             {/* מודאל תפריט המבורגר */}
       <Modal 
         visible={menuVisible} 
         transparent 
         animationType="slide"
         onRequestClose={() => setMenuVisible(false)}
       >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                     <View style={styles.modalOverlay}>
             <View style={styles.menuContent}>
               <TouchableOpacity 
                 style={styles.menuCloseButton}
                 onPress={() => setMenuVisible(false)}
               >
                 <Text style={styles.menuCloseText}>×</Text>
               </TouchableOpacity>
               
              <Text style={[styles.menuTitle, { color: cardTextColor }]}>תפריט</Text>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setDetailsVisible(true); setNameEdit(customer?.name || ''); }} accessibilityLabel="הפרטים שלי" accessibilityRole="button" accessibilityHint="לחץ לצפייה ועריכת הפרטים האישיים">
                <Text style={styles.menuItemText}>הפרטים שלי</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPreferencesVisible(true); }} accessibilityLabel="ההעדפות שלי" accessibilityRole="button" accessibilityHint="לחץ לניהול העדפות קבלת הודעות">
                <Text style={styles.menuItemText}>ההעדפות שלי</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={openMyActivity} accessibilityLabel="הפעילות שלי" accessibilityRole="button" accessibilityHint="לחץ לצפייה בהיסטוריית הפעילות שלך">
                <Text style={styles.menuItemText}>הפעילות שלי</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); showVoucherToast('בקרוב'); }} accessibilityLabel="שלח שובר מתנה עם ברכה" accessibilityRole="button" accessibilityHint="לחץ לשליחת שובר מתנה לחבר">
                <Text style={[styles.menuItemText, { textAlign: 'center' }]}>שלח שובר מתנה עם{"\n"}ברכה</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setAboutVisible(true); }} accessibilityLabel="אודותנו" accessibilityRole="button" accessibilityHint="לחץ לצפייה במידע על החברה">
                <Text style={styles.menuItemText}>אודותנו</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPrivacyVisible(true); }} accessibilityLabel="מדיניות פרטיות" accessibilityRole="button" accessibilityHint="לחץ לצפייה במדיניות הפרטיות">
                <Text style={styles.menuItemText}>מדיניות פרטיות</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setDeleteVisible(true); }} accessibilityLabel="מחיקת משתמש" accessibilityRole="button" accessibilityHint="לחץ לבקשת מחיקת החשבון שלך">
                <Text style={styles.menuItemText}>מחיקת משתמש</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); Linking.openURL('https://wa.me/972552482442'); }} accessibilityLabel="צור קשר בוואטסאפ" accessibilityRole="button" accessibilityHint="לחץ לפתיחת שיחת וואטסאפ עם התמיכה">
                <Text style={styles.menuItemText}>צור קשר</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setAccessibilityVisible(true); }} accessibilityLabel="הצהרת נגישות" accessibilityRole="button" accessibilityHint="לחץ לצפייה בהצהרת הנגישות של האפליקציה">
                <Text style={styles.menuItemText}>הצהרת נגישות</Text>
              </TouchableOpacity>

            </View>
          </View>
                 </TouchableWithoutFeedback>
       </Modal>

      {/* מודאל מחיקת משתמש */}
      <Modal 
        visible={deleteVisible}
        transparent 
        animationType="slide"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDeleteVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, width: '85%' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, fontFamily: 'Rubik' }}>
                  מחיקת משתמש
                </Text>
                <Text style={{ fontSize: 14, textAlign: 'center', color: '#333', marginBottom: 16, fontFamily: 'Rubik' }}>
                  האם בטוח/ה שאת/ה רוצה למחוק עצמך מהשירות?
                </Text>
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setDeleteVisible(false);
                      setMenuVisible(false);
                    }}
                    style={{ 
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      borderWidth: 1,
                      borderColor: '#E0E0E0',
                      backgroundColor: '#f8f8f8',
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 14
                    }}
                  >
                    <Text style={{ flex: 1, textAlign: 'right', fontSize: 15, color: '#333', fontFamily: 'Rubik' }}>
                      לחצתי בטעות-חזור לכרטיסייה
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      // מעבר לאישור נוסף
                      setDeleteVisible(false);
                      setDisconnectVisible(true);
                    }}
                    style={{ 
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      borderWidth: 1,
                      borderColor: '#E0E0E0',
                      backgroundColor: '#f8f8f8',
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 14
                    }}
                  >
                    <Text style={{ flex: 1, textAlign: 'right', fontSize: 15, color: '#333', fontFamily: 'Rubik' }}>
                      מחקו אותי אני לא מעוניינ/ת להשתמש באפליקציה יותר
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, textAlign: 'center', color: '#777', marginTop: 12, fontFamily: 'Rubik' }}>
                  מחיקת המשתמש שלך אינה מסירה את האפליקציה עצמה - נדרשת הסרה בנפרד
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity 
                    onPress={() => setDeleteVisible(false)}
                    style={{ backgroundColor: '#E0E0E0', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  >
                    <Text style={{ fontFamily: 'Rubik' }}>סגור</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* מודאל אישור התנתקות סופי */}
      <Modal 
        visible={disconnectVisible}
        transparent 
        animationType="slide"
        onRequestClose={() => setDisconnectVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDisconnectVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, width: '85%' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, fontFamily: 'Rubik' }}>
                  אישור התנתקות
                </Text>
                <Text style={{ fontSize: 14, textAlign: 'center', color: '#333', marginBottom: 16, fontFamily: 'Rubik' }}>
                  האם בטוח שאתה רוצה להתנתק? יתכן ויש לך הטבות לא מנוצלות בבתי העסק שימחקו עם התנתקותך
                </Text>
                <View style={{ gap: 10, marginTop: 4, width: '100%', alignSelf: 'center' }}>
                  <TouchableOpacity 
                    onPress={() => {
                      // חזרה לכרטיסייה - סגירת מודאלים
                      setDisconnectVisible(false);
                      setDeleteVisible(false);
                      setMenuVisible(false);
                    }}
                    style={{ 
                      backgroundColor: '#216265', 
                      paddingVertical: 12, 
                      paddingHorizontal: 16, 
                      borderRadius: 20,
                      width: '100%',
                      alignSelf: 'center'
                    }}
                  >
                    <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Rubik' }}>התחרטתי, אשאר</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleSelfDeleteConfirm}
                    style={{ 
                      backgroundColor: '#8B0000', 
                      paddingVertical: 12, 
                      paddingHorizontal: 16, 
                      borderRadius: 20,
                      width: '100%',
                      alignSelf: 'center'
                    }}
                  >
                    <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Rubik' }}>
                      {deletingSelf ? 'מבצע…' : 'כן ולא לחפור לי יותר'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

       {/* מודאל "הפעילות שלי" */}
      <Modal 
        visible={activityVisible} 
        transparent={true}
        animationType="slide"
        onRequestClose={() => { cleanupActivitySubscription(); setActivityVisible(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableWithoutFeedback onPress={() => { cleanupActivitySubscription(); setActivityVisible(false); }}>
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          </TouchableWithoutFeedback>

          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '92%',
              maxWidth: 900,
              maxHeight: '82%',
              borderRadius: 12,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 8
            }}
          >
            <View style={{ backgroundColor: '#1e293b', paddingVertical: 18, paddingHorizontal: 20 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600', textAlign: 'center' }}>הפעילות שלי</Text>
              <TouchableOpacity
                onPress={() => { cleanupActivitySubscription(); setActivityVisible(false); }}
                style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#2d3748' }}>
              {/* כותרות טבלה */}
              <View style={{ flexDirection: 'row', backgroundColor: '#4a5568' }}>
                <Text style={{ flex: 2, paddingVertical: 14, textAlign: 'center', color: '#e2e8f0', fontWeight: '600' }}>תאריך</Text>
                <Text style={{ flex: 5, paddingVertical: 14, textAlign: 'center', color: '#e2e8f0', fontWeight: '600' }}>סוג פעולה</Text>
                <Text style={{ flex: 3, paddingVertical: 14, textAlign: 'center', color: '#e2e8f0', fontWeight: '600' }}>כמות</Text>
              </View>

              {/* שורות */}
              {activityLoading ? (
                <View style={{ paddingVertical: 24 }}>
                  <Text style={{ color: '#e2e8f0', textAlign: 'center' }}>טוען…</Text>
                </View>
              ) : (
                <FlatList
                  data={activityRows}
                  keyExtractor={(item, idx) => `act-${item.dateStr}-${item.actionLabel}-${idx}`}
                  contentContainerStyle={{ paddingBottom: 18 }}
                  style={{ maxHeight: '72%' }}
                  renderItem={({ item, index }) => (
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: index % 2 === 0 ? '#4a5568' : '#2d3748'
                    }}>
                      <Text style={{ flex: 2, paddingVertical: 12, textAlign: 'center', color: '#90cdf4', fontWeight: '500' }}>{item.dateStr}</Text>
                      <Text style={{ flex: 5, paddingVertical: 12, textAlign: 'right', paddingHorizontal: 12, color: '#e2e8f0', fontWeight: '500' }}>{item.actionLabel}</Text>
                      <Text style={{ flex: 3, paddingVertical: 12, textAlign: 'center', color: item.amount < 0 ? '#dc2626' : '#059669', fontWeight: '600' }}>{item.amount}</Text>
                    </View>
                  )}
                  ListEmptyComponent={<Text style={{ color: '#e2e8f0', textAlign: 'center', paddingVertical: 22 }}>אין פעולות להצגה</Text>}
                />
              )}
              {!!activityNextCursor && !activityLoading && (
                <View style={{ paddingVertical: 12 }}>
                  <TouchableOpacity
                    onPress={loadMoreActivity}
                    disabled={activityLoadingMore}
                    style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#4a5568', borderRadius: 8 }}
                  >
                    <Text style={{ color: '#e2e8f0', fontWeight: '600' }}>
                      {activityLoadingMore ? 'טוען…' : 'הצג עוד'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>
      </Modal>

       {/* מודאל תיבת דואר - גרסה מתוקנת */}
      <Modal 
        visible={mailVisible} 
        transparent={true}
        animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          {/* שכבת רקע לסגירה בלחיצה מחוץ לתוכן */}
          <TouchableWithoutFeedback onPress={() => setMailVisible(false)}>
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          </TouchableWithoutFeedback>
          {/* תוכן המודאל - ללא עוטף Touchable כדי לא להפריע לגלילה */}
          <LinearGradient
                colors={['#f1f1f1', '#d5d5d5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ 
            width: '90%',
            maxHeight: '80%',
            padding: 20, 
            borderRadius: 10 
          }}>
            {/* כפתור סגירה X בצד ימין למעלה */}
            <TouchableOpacity
              onPress={() => setMailVisible(false)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: '#f0f0f0',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#666' }}>×</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, textAlign: 'center', fontWeight: 'bold' }} numberOfLines={1}>
                תיבת דואר
              </Text>
              <Text style={{ fontSize: 13, textAlign: 'center', color: '#555', marginTop: 4 }} numberOfLines={1}>
                {notifications.filter(n => !n.read).length} הודעות שלא נקראו
              </Text>
            </View>
             
            <FlatList
              data={notifications}
              keyExtractor={(msg, index) => msg.id || `msg-${index}`}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              style={{ height: Math.floor(height * 0.6) }}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  אין הודעות חדשות
                </Text>
              }
              renderItem={({ item: msg }) => {
                const sanitizedBody = msg.body
                  .replace(/(https?:\/\/[^\s]+)/g, '')
                  .replace(/קישור לשובר/g, '')
                  .replace(/🎁/g, '')
                  .replace(/:/g, '')
                  .trim();
                const hasVoucher = Boolean(msg.voucherUrl) || msg.body.includes('http');

                return (
                  <View style={{
                    backgroundColor: 'transparent',
                    padding: 18,
                    marginBottom: 10,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: 'rgba(0,0,0,0.35)'
                  }}>
                    <Text style={{ fontSize: 11, color: '#000000', textAlign: 'center', marginBottom: 6 }}>
                      {new Date(msg.timestamp).toLocaleString('he-IL', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {!msg.read ? (
                          <TouchableOpacity
                            onPress={() => markAsRead(msg.id)}
                            style={{ marginRight: 12 }}
                          >
                            <Ionicons name="checkmark" size={20} color="#4CAF50" />
                          </TouchableOpacity>
                        ) : (
                          <View style={{ marginRight: 12 }}>
                            <Ionicons name="mail-open-outline" size={20} color="#9E9E9E" />
                          </View>
                        )}
                        <TouchableOpacity onPress={() => deleteNotification(msg.id)}>
                          <Ionicons name="trash" size={20} color="#e57373" />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6, textAlign: 'right', color: '#000000' }}>
                          {msg.title}
                        </Text>
                        <Text style={{ fontSize: 13, textAlign: 'right', color: '#222222', lineHeight: 20 }}>
                          {sanitizedBody}
                        </Text>
                        {hasVoucher && (
                          <View style={{ width: '100%', marginTop: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();

                                let finalUrl: string | null = null;

                                if (msg.voucherUrl) {
                                  finalUrl = msg.voucherUrl;
                                } else {
                                  // Regex משופר - חילוץ עד לתו מפריד או סוף מחרוזת
                                  const urlMatch = msg.body.match(/(https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](?:\/[^\s<>"')\]]*)?)/);
                                  if (urlMatch) {
                                    let rawUrl = urlMatch[0];
                                    // ניקוי תווי פיסוק מהסוף
                                    rawUrl = rawUrl.replace(/[)\],.;:!?'"]+$/, '');
                                    finalUrl = rawUrl;
                                  }
                                }

                                if (!finalUrl) {
                                  Alert.alert('שגיאה', 'לא נמצא קישור בהודעה');
                                  return;
                                }

                                // בדיקת URL תקין עם domain validation
                                let parsedUrl: URL | null = null;
                                try {
                                  parsedUrl = new URL(finalUrl);
                                } catch {
                                  Alert.alert('שגיאה', 'הקישור לשובר אינו תקין');
                                  return;
                                }

                                // בדיקת protocol
                                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                                  Alert.alert('שגיאה', 'הקישור לשובר אינו תקין');
                                  return;
                                }

                                // בדיקת domain תקין (לפחות תו אחד לפני נקודה)
                                if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.') || parsedUrl.hostname.length < 4) {
                                  Alert.alert('שגיאה', 'הקישור לשובר אינו תקין');
                                  return;
                                }

                                let safeUrl = finalUrl.includes('%') ? finalUrl : encodeURI(finalUrl);

                                // הוספת phone רק אם לא קיים כבר בכתובת
                                if (phoneStr && !safeUrl.includes('phone=')) {
                                  const separator = safeUrl.includes('?') ? '&' : '?';
                                  safeUrl = `${safeUrl}${separator}phone=${encodeURIComponent(phoneStr)}`;
                                }

                                // Cache busting - מוסיף timestamp למניעת cache
                                const cacheBustSeparator = safeUrl.includes('?') ? '&' : '?';
                                safeUrl = `${safeUrl}${cacheBustSeparator}t=${Date.now()}`;

                                setVoucherInlineUrl(safeUrl);
                              }}
                              style={{ alignSelf: 'center', transform: [{ translateX: -28 }] }}
                            >
                              <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: '#2196F3', fontSize: 14, textAlign: 'center' }}>
                                לצפייה בשובר
                              </Text>
                                <View style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 1, backgroundColor: '#2196F3' }} />
                                <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 1, backgroundColor: '#2196F3' }} />
                              </View>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
              </LinearGradient>
        </View>
       </Modal>

             {/* חלונית חבר מביא חבר */}
       <Modal 
         visible={referralVisible} 
         transparent 
         animationType="slide"
         onRequestClose={() => setReferralVisible(false)}
       >
        <TouchableWithoutFeedback onPress={() => setReferralVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.referralModal, { backgroundColor: 'white' }]}>
                
                                 {/* בר עליון עם כותרת וכפתור סגירה */}
                 <View style={[styles.referralHeader, { backgroundColor: cardTextColor }]}>
                  <Text style={styles.referralHeaderTitle}>
                    חבר מביא חבר
                  </Text>
                  <TouchableOpacity 
                    style={styles.referralCloseButton}
                    onPress={() => setReferralVisible(false)}
                  >
                    <Text style={styles.referralCloseButtonText}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* קוד ההפניה - מוסתר אם הפיצ'ר לא פעיל */}
                {referralData.isConfigured && (
                  <View style={styles.referralCodeContainer}>
                    <Text style={styles.referralCodeLabel}>קופון ההזמנה:</Text>
                    <TouchableOpacity 
                      style={styles.referralCodeBox}
                      onPress={async () => {
                                               try {
                           const referralCode = customer && localBusiness 
                             ? generateReferralCode(localBusiness.business_code, customer.customer_phone)
                             : punchCard?.card_number || '';
                           await Clipboard.setStringAsync(referralCode);
                           Alert.alert('הקופון הועתק!', `קופון ההזמנה ${referralCode} הועתק ללוח`);
                        } catch (error: unknown) {
                          // שגיאה בהעתקה - handled silently
                          Alert.alert('שגיאה', `לא ניתן להעתיק את הקופון: ${(error as Error).message || error}`);
                        }
                      }}
                    >
                      <Text style={[styles.referralCodeText, { color: cardTextColor }]}>
                        {customer && localBusiness 
                          ? generateReferralCode(localBusiness.business_code, customer.customer_phone)
                          : punchCard?.card_number || ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.copyButton, { backgroundColor: cardTextColor }]}
                      onPress={async () => {
                                               try {
                           const referralCode = customer && localBusiness 
                             ? generateReferralCode(localBusiness.business_code, customer.customer_phone)
                             : punchCard?.card_number || '';
                           await Clipboard.setStringAsync(referralCode);
                           Alert.alert('הקופון הועתק!', `קופון ההזמנה ${referralCode} הועתק ללוח`);
                        } catch (error: unknown) {
                          // שגיאה בהעתקה - handled silently
                          Alert.alert('שגיאה', `לא ניתן להעתיק את הקופון: ${(error as Error).message || error}`);
                        }
                      }}
                    >
                      <Text style={styles.copyButtonText}>העתק מספר קופון הזמנה</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* הודעה ראשית */}
                <Text style={[styles.referralMainText, !referralData.isConfigured && { fontSize: 16, fontWeight: 'bold', marginVertical: 20 }]}>
                  {referralData.isConfigured ? (
                    `באפשרותך להזמין חבר/ה לכרטיסיית ${business?.name}. על כל חבר שהזמנת ומימש הזמנתו אצלנו, תקבל ${referralData.inviterBenefit}. גם החבר/ה שהזמנת יקבל ${referralData.invitedBenefit}. ניתן לשנות את הטקסטים בהודעה (לאישי או אחר) אך לא את הקישור המכיל את קופון ההזמנה.`
                  ) : (
                    'העסק טרם הגדיר תוכנית - מציעים לפנות אליו ולשאול'
                  )}
                </Text>

                {/* אמצעי ההזמנה */}
                <View style={styles.inviteMethodsContainer}>
                  
                  {/* שורה ראשונה: WhatsApp + Email */}
                  <View style={styles.inviteMethodsRow}>
                    <TouchableOpacity 
                      style={styles.inviteMethodItem}
                      onPress={() => {
                        const referralCode = customer && localBusiness 
                          ? generateReferralCode(localBusiness.business_code, customer.customer_phone)
                          : punchCard?.card_number || '';
                        const message = `היי, חשבתי לפנק אותך בכרטיסיית ${business?.name}.\nמדובר בכרטיסיית הטבות מדליקה הכוללת הטבות, הגרלות ומתנות. הרבה יותר טוב ממועדון.\nברגע שתוריד את האפליקציה CARDS מהחנות ותירשם יסומן לך אוטומטית ניקוב ראשון חינם כבר (וגם לי).\nקישור להורדת האפליקציה באייפון ובאנדרואיד.\nקופון ההזמנה: ${referralCode}`;
                        const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
                        Linking.openURL(url).catch(() => {
                          Alert.alert('שגיאה', 'לא ניתן לפתוח את WhatsApp. ודא שהאפליקציה מותקנת.');
                        });
                      }}
                    >
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={[styles.inviteMethodText, { color: cardTextColor, textDecorationLine: 'none' }]}>
                        הזמן בווטסאפ
                      </Text>
                        <View style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                        <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                      </View>
                      <Image 
                        source={require('../../assets/icons/1.png')}
                        style={styles.inviteMethodIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.inviteMethodItem}
                      onPress={() => {
                        const referralCode = customer && localBusiness 
                          ? generateReferralCode(localBusiness.business_code, customer.customer_phone)
                          : punchCard?.card_number || '';
                        const subject = `הזמנה לכרטיסיית ${business?.name}`;
                        const body = `היי, חשבתי לפנק אותך בכרטיסיית ${business?.name}.\nמדובר בכרטיסיית הטבות מדליקה הכוללת הטבות, הגרלות ומתנות. הרבה יותר טוב ממועדון.\nברגע שתוריד את האפליקציה CARDS מהחנות ותירשם יסומן לך אוטומטית ניקוב ראשון חינם כבר (וגם לי).\nקישור להורדת האפליקציה באייפון ובאנדרואיד.\nקופון ההזמנה: ${referralCode}`;
                        const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        Linking.openURL(url).catch(() => {
                          Alert.alert('שגיאה', 'לא ניתן לפתוח את אפליקציית המייל.');
                        });
                      }}
                    >
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={[styles.inviteMethodText, { color: cardTextColor, textDecorationLine: 'none' }]}>
                        הזמן במייל
                      </Text>
                        <View style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                        <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                      </View>
                      <Image 
                        source={require('../../assets/icons/2.png')}
                        style={styles.inviteMethodIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* שורה שנייה: Facebook + Instagram */}
                  <View style={styles.inviteMethodsRow}>
                    <TouchableOpacity 
                      style={styles.inviteMethodItem}
                      onPress={() => {
                        const referralCode = customer && localBusiness 
                          ? generateReferralCode(localBusiness.business_code, customer.customer_phone)
                          : punchCard?.card_number || '';
                        const text = `היי חברים, חשבתי לשתף אתכם בכרטיסיית ${business?.name} המדהימה!\nמדובר בכרטיסיית הטבות מדליקה הכוללת הטבות, הגרלות ומתנות. הרבה יותר טוב ממועדון.\nתורידו את האפליקציה CARDS והירשמו עם קופון ההזמנה שלי: ${referralCode}\nכך נקבל שנינו ניקוב חינם!`;
                        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://cards-app.com')}&quote=${encodeURIComponent(text)}`;
                        Linking.openURL(url).catch(() => {
                          Alert.alert('שגיאה', 'לא ניתן לפתוח את Facebook.');
                        });
                      }}
                    >
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={[styles.inviteMethodText, { color: cardTextColor, textDecorationLine: 'none' }]}>
                        הזמן בפייסבוק
                      </Text>
                        <View style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                        <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                      </View>
                      <Image 
                        source={require('../../assets/icons/3.png')}
                        style={styles.inviteMethodIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.inviteMethodItem}
                                            onPress={() => {
                        const instagramUrl = 'instagram://camera';
                        Linking.openURL(instagramUrl).catch(() => {
                          const instagramWebUrl = 'https://www.instagram.com/';
                          Linking.openURL(instagramWebUrl).catch(() => {
                            Alert.alert('שגיאה', 'לא ניתן לפתוח את Instagram.');
                          });
                        });
                      }}
                    >
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={[styles.inviteMethodText, { color: cardTextColor, textDecorationLine: 'none' }]}>
                        הזמן{'\n'}באינסטגרם
                      </Text>
                        <View style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                        <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 1, backgroundColor: cardTextColor }} />
                      </View>
                      <Image 
                        source={require('../../assets/icons/4.png')}
                        style={styles.inviteMethodIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>

                </View>



              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* מודאל העדפות */}
      <Modal 
        visible={preferencesVisible}
        transparent 
        animationType="slide"
        onRequestClose={() => setPreferencesVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPreferencesVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, width: '85%' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, fontFamily: 'Rubik' }}>העדפות</Text>
                <TouchableOpacity
                  onPress={() => setPushOptIn(v => !v)}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 16, fontFamily: 'Rubik' }}>לקבל הודעות פוש</Text>
                  <Ionicons name={pushOptIn ? 'checkbox-outline' : 'square-outline'} size={22} color={pushOptIn ? '#1E51E9' : '#999'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSmsOptIn(v => !v)}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 16, fontFamily: 'Rubik' }}>לקבל הודעות SMS</Text>
                  <Ionicons name={smsOptIn ? 'checkbox-outline' : 'square-outline'} size={22} color={smsOptIn ? '#1E51E9' : '#999'} />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity 
                    onPress={() => setPreferencesVisible(false)}
                    style={{ backgroundColor: '#E0E0E0', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  >
                    <Text style={{ fontFamily: 'Rubik' }}>סגור</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={async () => {
                      await updateBlacklist('push', pushOptIn);
                      await updateBlacklist('sms', smsOptIn);
                      setPreferencesVisible(false);
                    }}
                    style={{ backgroundColor: '#1E51E9', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  >
                    <Text style={{ color: 'white', fontFamily: 'Rubik' }}>שמור</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* WebView פנימי לצפייה בשובר */}
      <Modal visible={!!voucherInlineUrl} transparent animationType="fade" onRequestClose={() => setVoucherInlineUrl(null)}>
        <View style={[styles.modalOverlay, { justifyContent: 'flex-start', alignItems: 'stretch' }]}>
          <View style={styles.webviewCardPunch}>
            <TouchableOpacity
              style={styles.webviewClosePunch}
              onPress={() => setVoucherInlineUrl(null)}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#666' }}>×</Text>
            </TouchableOpacity>
            {voucherInlineUrl ? (
              <ViewShot ref={voucherViewShotRef} style={{ flex: 1 }}>
              <WebView
                ref={voucherWebViewRef}
                source={{ uri: voucherInlineUrl }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                setSupportMultipleWindows={false}
                cacheEnabled={false}
                incognito={true}
                userAgent="Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36"
                injectedJavaScriptBeforeContentLoaded={ALERT_BRIDGE_JS}
                injectedJavaScript={ALERT_BRIDGE_JS + VOUCHER_STYLE_JS}
                onMessage={(event) => handleVoucherMessage(event.nativeEvent.data)}
                onLoadStart={(event) => console.log('[VoucherDiag-INBOX] WebView onLoadStart:', event.nativeEvent.url)}
                onLoadEnd={(event) => {
                  console.log('[VoucherDiag-INBOX] WebView onLoadEnd:', event.nativeEvent.url);
                  setTimeout(() => {
                    voucherWebViewRef.current?.injectJavaScript(`
                      (function(){
                        try {
                          const htmlPreview = document.body ? document.body.innerHTML.substring(0, 500) : '';
                          const payload = {
                            type: 'diagnostics',
                            location: window.location.href,
                            hash: window.location.hash,
                            title: document.title,
                            bodyLength: document.body ? document.body.innerHTML.length : 0,
                            htmlPreview: htmlPreview,
                            viewport: {
                              innerWidth: window.innerWidth,
                              innerHeight: window.innerHeight,
                              devicePixelRatio: window.devicePixelRatio,
                              screenWidth: screen.width,
                              screenHeight: screen.height,
                              documentWidth: document.documentElement.clientWidth,
                              documentHeight: document.documentElement.clientHeight
                            }
                          };
                          console.log('[VoucherDiag-INBOX] Viewport:', JSON.stringify(payload.viewport));
                          console.log('[VoucherDiag-INBOX] HTML Preview:', htmlPreview);
                          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
                        } catch(err) {
                          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'diagnostics-error', message: err.message }));
                        }
                      })();
                    `);
                  }, 500);
                }}
                onError={(event) => console.log('[VoucherDiag-INBOX] WebView onError:', event.nativeEvent)}
                onHttpError={(event) => console.log('[VoucherDiag-INBOX] WebView onHttpError:', event.nativeEvent)}
                onNavigationStateChange={(navState) =>
                  console.log('[VoucherDiag-INBOX] navigation:', navState.url, 'loading:', navState.loading)
                }
                onShouldStartLoadWithRequest={(req) => {
                  try {
                    const next = new URL(req.url);
                    const base = new URL(voucherInlineUrl);
                    if (next.origin === base.origin) return true;
                  } catch {}
                  return false;
                }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
              />
              </ViewShot>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Toast פנימי בהצגת שובר */}
      <Modal visible={voucherToast.visible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.toastCardPunch, { position: 'relative', paddingRight: 32, backgroundColor: '#FFFFFF' }]}>
              <TouchableOpacity 
                onPress={() => {
                  setVoucherToast({ visible: false, message: '' });
                  router.push('/customers-login');
                }}
                style={{ position: 'absolute', top: 40, right: 40, zIndex: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#000000', fontSize: 20, fontWeight: 'bold', lineHeight: 20 }}>×</Text>
              </TouchableOpacity>
              <Text style={[styles.toastTextPunch, { color: '#000000', fontWeight: voucherToast.message === 'בקרוב' ? 'bold' : 'normal' }]}>
                {voucherToast.message.includes('30 ימים') ? (
                  voucherToast.message.split('30 ימים. ').map((part, index) => {
                    if (index === 1) {
                      return (
                        <Text key={index} style={{ fontWeight: 'bold' }}>
                          {part}
                        </Text>
                      );
                    }
                    return <Text key={index}>{part}{index === 0 ? '30 ימים. ' : ''}</Text>;
                  })
                ) : (
                  voucherToast.message
                )}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* מודאל פרטים שלי */}
      <Modal 
        visible={detailsVisible}
        transparent 
        animationType="slide"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDetailsVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, width: '90%' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, fontFamily: 'Rubik' }}>הפרטים שלי</Text>
                <View style={{ gap: 12 }}>
                  <View>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, textAlign: 'right', fontFamily: 'Rubik' }}>שם מלא</Text>
                    <TextInput
                      value={nameEdit}
                      onChangeText={setNameEdit}
                      style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, textAlign: 'right', fontFamily: 'Rubik' }}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, textAlign: 'right', fontFamily: 'Rubik' }}>תאריך יום הולדת (YYYY-MM-DD)</Text>
                    <TextInput
                      value={birthdayEdit}
                      onChangeText={setBirthdayEdit}
                      placeholder="1990-01-31"
                      style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, textAlign: 'right', fontFamily: 'Rubik' }}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4, textAlign: 'right', fontFamily: 'Rubik' }}>מספר טלפון</Text>
                    <Text style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, textAlign: 'right', color: '#888', fontFamily: 'Rubik' }}>
                      {customer?.customer_phone || phoneStr}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity 
                    onPress={() => setDetailsVisible(false)}
                    style={{ backgroundColor: '#E0E0E0', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  >
                    <Text style={{ fontFamily: 'Rubik' }}>ביטול</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={async () => {
                      try {
                        const businessCode = customer?.business_code || localBusiness?.business_code;
                        const cphone = customer?.customer_phone || phoneStr;
                        if (businessCode && cphone) {
                          // ניסיון ראשון: עדכון name + birthday
                          let updatePayload: any = { name: nameEdit || '' };
                          if (birthdayEdit) updatePayload.birthday = birthdayEdit;
                          let { error } = await supabase
                            .from('customers')
                            .update(updatePayload)
                            .eq('business_code', businessCode)
                            .eq('customer_phone', cphone);
                          // אם עמודת birthday לא קיימת, ננסה בשם חלופי
                          if (error && birthdayEdit) {
                            const fallbackPayload: any = { name: nameEdit || '' };
                            fallbackPayload.date_of_birth = birthdayEdit;
                            const retry = await supabase
                              .from('customers')
                              .update(fallbackPayload)
                              .eq('business_code', businessCode)
                              .eq('customer_phone', cphone);
                            if (!retry.error) {
                              error = null as any;
                            }
                          }
                          if (!error) {
                            setCustomer(prev => prev ? { ...prev, name: nameEdit || '' } : prev);
                            setDetailsVisible(false);
                          }
                        }
                      } catch (_) {}
                    }}
                    style={{ backgroundColor: '#1E51E9', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }}
                  >
                    <Text style={{ color: 'white', fontFamily: 'Rubik' }}>שמירה</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* מודל בחירת כרטיסייה */}
      <Modal visible={cardSelectionVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.cardSelectionContent}>
            <View style={styles.cardSelectionHeader}>
              <Text style={styles.cardSelectionTitle}>בחר כרטיסייה</Text>
              <Text style={styles.cardSelectionSubtitle}>
                נמצאו {availableCards.length} כרטיסיות פעילות עבורך בעסק זה
              </Text>
            </View>
            
            <ScrollView style={styles.cardsScrollView}>
              {availableCards.map((card, index) => (
                <TouchableOpacity
                  key={card.card_number}
                  style={styles.cardOption}
                  onPress={() => handleCardSelection(card)}
                >
                  <View style={styles.cardOptionContent}>
                    <View style={styles.cardOptionInfo}>
                      <Text style={styles.cardOptionTitle} numberOfLines={1} ellipsizeMode="tail">
                        כרטיסיית {card.products?.[0]?.product_name || card.product_code || `מוצר ${index + 1}`}
                      </Text>
                      <Text style={styles.cardOptionProgress}>
                        {card.used_punches} / {card.total_punches} ניקובים
                      </Text>
                    </View>
                    <View style={styles.cardOptionSelectButton}>
                      <Text style={styles.cardOptionSelectText}>בחר</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.cardSelectionCancel}
              onPress={() => {
                setCardSelectionVisible(false);
                // חזרה למסך הראשי
                navigation.goBack();
              }}
            >
              <Text style={styles.cardSelectionCancelText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* פופאפ שיווקי - after_punch */}
      <MarketingPopup
        visible={showPunchPopup}
        popup={punchPopup}
        onClose={closePunchPopup}
      />

      {/* מודאל הצהרת נגישות */}
      <Modal
        visible={accessibilityVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccessibilityVisible(false)}
      >
        <View style={accessibilityStyles.overlay}>
          <View style={accessibilityStyles.container}>
            <TouchableOpacity 
              style={accessibilityStyles.closeButton}
              onPress={() => setAccessibilityVisible(false)}
              accessibilityLabel="סגור הצהרת נגישות"
              accessibilityRole="button"
            >
              <Text style={accessibilityStyles.closeText}>✕</Text>
            </TouchableOpacity>
            
            <ScrollView style={accessibilityStyles.scrollView} showsVerticalScrollIndicator={true}>
              <Text style={accessibilityStyles.mainTitle}>הצהרת נגישות</Text>
              <Text style={accessibilityStyles.subtitle}>אפליקציית כראדז לכרטיסיות דיגיטליות</Text>

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

              <Text style={accessibilityStyles.sectionTitle}>עקרונות יישום באפליקציה</Text>
              <Text style={accessibilityStyles.paragraph}>
                בהיעדר תקן נפרד לאפליקציות, האפליקציה פועלת בהתאם לעקרונות WCAG 2.0 AA, תוך התאמה ליכולות הנגישות שמספקות מערכות ההפעלה ולמגבלות הפלטפורמה.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                בדיקות נגישות מתבצעות באמצעות כלי הבדיקה של גוגל ואפל (כגון Accessibility Scanner באנדרואיד ו‑Accessibility Inspector ב‑Xcode), לצד בדיקות ידניות עם VoiceOver ו‑TalkBack, כדי לאתר חסמי נגישות ולשפרם בהדרגה.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>התאמה ליכולות הנגישות באנדרואיד ו‑iOS</Text>
              <Text style={accessibilityStyles.paragraph}>
                האפליקציה מותאמת לשימוש יחד עם כלי הנגישות המובנים במכשירים המבוססים על Android ו‑iOS, ככל שהמשתמש מפעילם במסגרת הגדרות הנגישות של המכשיר, ובכלל זה:
              </Text>
              <Text style={accessibilityStyles.bulletPoint}>• תמיכה בקוראי מסך VoiceOver (iOS) ו‑TalkBack (Android), כולל הגדרת שמות ותיאורים נגישים לרכיבים אינטראקטיביים.</Text>
              <Text style={accessibilityStyles.bulletPoint}>• התאמה לתכונות מערכת כלליות כגון הגדלת טקסט, הגדרות תצוגה וניגודיות, מצב כהה, הפחתת תנועה ומאפייני נגישות חזותית נוספים.</Text>
              <Text style={accessibilityStyles.paragraph}>
                בנוסף, נעשית השתדלות לאפשר שימוש באמצעי קלט ואביזרי עזר הנתמכים על ידי מערכת ההפעלה, בכפוף ליכולות הטכנולוגיות של הפלטפורמה.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>התאמות נגישות עיקריות שבוצעו</Text>
              <Text style={accessibilityStyles.bulletPoint}>• הגדרת תוויות ותיאורי גישה נגישים לרכיבי ממשק עיקריים.</Text>
              <Text style={accessibilityStyles.bulletPoint}>• סדר ניווט לוגי ועקבי במעבר פוקוס בין רכיבים שונים במסך.</Text>
              <Text style={accessibilityStyles.bulletPoint}>• הקפדה על ניגודיות מספקת בין טקסט לרקע.</Text>
              <Text style={accessibilityStyles.bulletPoint}>• תמיכה בהגדלת טקסט/תצוגה לפי הגדרות הנגישות במכשיר.</Text>
              <Text style={accessibilityStyles.paragraph}>
                מגבלות קיימות או חדשות שיתגלו בבדיקות נוספות יתועדו ויטופלו בגרסאות עתידיות של האפליקציה.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>היקף התאמה ומגבלות</Text>
              <Text style={accessibilityStyles.paragraph}>
                מאמצים רבים מושקעים כדי שהאפליקציה תעמוד ברוח התקן והחוק, אולם ייתכן שעדיין קיימים מסכים, תהליכים או רכיבים שאינם נגישים באופן מלא.
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                כמו כן, ייתכנו הגבלות בנגישות לגבי תכנים או שירותים של צדדים שלישיים, המשולבים באפליקציה ואשר אינם בשליטה מלאה של מפעילי האפליקציה.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>דרכי יצירת קשר לפניות נגישות</Text>
              <Text style={accessibilityStyles.paragraph}>במידה ונתקלת בקושי נגישות, ניתן לפנות אלינו:</Text>
              <TouchableOpacity 
                onPress={() => Linking.openURL('mailto:support@punchcards.digital')}
                accessibilityLabel="שלח דואר אלקטרוני לתמיכה"
                accessibilityRole="link"
                accessibilityHint="לחץ לפתיחת אפליקציית המייל ושליחת הודעה לתמיכה"
              >
                <Text style={accessibilityStyles.contactItemClickable}>📧 דואר אלקטרוני: support@punchcards.digital</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => Linking.openURL('https://wa.me/972552482442')}
                accessibilityLabel="שלח הודעת וואטסאפ לתמיכה"
                accessibilityRole="link"
                accessibilityHint="לחץ לפתיחת וואטסאפ ושליחת הודעה לתמיכה"
              >
                <Text style={accessibilityStyles.contactItemClickable}>💬 ווטסאפ (הודעות): ‎+972‑55‑248‑2442</Text>
              </TouchableOpacity>
              <Text style={accessibilityStyles.paragraph}>לצורך טיפול יעיל בפנייתך, חשוב שהפניה תכלול:</Text>
              <Text style={accessibilityStyles.bulletPoint}>• תיאור קצר של הבעיה.</Text>
              <Text style={accessibilityStyles.bulletPoint}>• מיקום המסך שבו נתקלת בקושי.</Text>
              <Text style={accessibilityStyles.bulletPoint}>• צילום מסך (אם ניתן).</Text>
              <Text style={accessibilityStyles.bulletPoint}>• פרטי המכשיר ומערכת ההפעלה וגרסת האפליקציה.</Text>
              <Text style={accessibilityStyles.paragraph}>פניות נגישות מקבלות עדיפות בטיפול.</Text>

              <Text style={accessibilityStyles.sectionTitle}>עדכון ההצהרה</Text>
              <Text style={accessibilityStyles.paragraph}>הצהרת נגישות זו עודכנה לאחרונה בתאריך: 4 בדצמבר 2025.</Text>
              <Text style={accessibilityStyles.paragraph}>
                האפליקציה והצהרה זו עשויות להתעדכן מעת לעת, בהתאם לשינויים טכנולוגיים, עדכוני מערכות הפעלה, שינויים בעמדת הרגולטור בישראל, או שיפורי נגישות שייושמו באפליקציה.
              </Text>
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* מודאל מדיניות פרטיות */}
      <Modal
        visible={privacyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <View style={accessibilityStyles.overlay}>
          <View style={accessibilityStyles.container}>
            <TouchableOpacity 
              style={accessibilityStyles.closeButton}
              onPress={() => setPrivacyVisible(false)}
              accessibilityLabel="סגור מדיניות פרטיות"
              accessibilityRole="button"
            >
              <Text style={accessibilityStyles.closeText}>✕</Text>
            </TouchableOpacity>
            
            <ScrollView style={accessibilityStyles.scrollView} showsVerticalScrollIndicator={true}>
              <Text style={accessibilityStyles.mainTitle}>מדיניות פרטיות</Text>
              <Text style={accessibilityStyles.subtitle}>Cardz - כרטיסיות ניקוב דיגיטליות</Text>

              <Text style={accessibilityStyles.paragraph}>
                אפליקציית Cardz היא מערכת לניהול כרטיסיות ניקוב דיגיטליות, המשמשת עסקים לצורך הפעלת מועדון לקוחות, מתן הטבות, ניהול ניקובים ושליחת התראות (פוש).
              </Text>
              <Text style={accessibilityStyles.paragraph}>
                השירות ניתן ללקוח על ידי העסק ממנו קיבלת את הכרטיסייה, ולא על ידי Cardz עצמה. Cardz מספקת פלטפורמה טכנולוגית בלבד.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>1. איזה מידע אנחנו אוספים?</Text>
              <Text style={accessibilityStyles.paragraph}>אנו אוספים אך ורק מידע בסיסי הדרוש לתפעול הכרטיסייה:</Text>
              <Text style={accessibilityStyles.bulletPoint}>• שם מלא</Text>
              <Text style={accessibilityStyles.bulletPoint}>• מספר טלפון</Text>
              <Text style={accessibilityStyles.bulletPoint}>• כתובת מייל (אם הוזנה)</Text>
              <Text style={accessibilityStyles.bulletPoint}>• יום הולדת (אופציונלי)</Text>
              
              <Text style={accessibilityStyles.paragraph}>מידע תפעולי:</Text>
              <Text style={accessibilityStyles.bulletPoint}>• תאריך ניקוב / ביטול ניקוב / חידוש כרטיסייה</Text>
              <Text style={accessibilityStyles.bulletPoint}>• תאריכי מימוש הטבות</Text>
              <Text style={accessibilityStyles.bulletPoint}>• שליחת/קבלת שוברי מתנה</Text>
              
              <Text style={accessibilityStyles.paragraph}>איננו אוספים: פרטי אשראי, פרטי תשלום, כתובות, היסטוריית גלישה.</Text>

              <Text style={accessibilityStyles.sectionTitle}>2. שימוש במידע</Text>
              <Text style={accessibilityStyles.paragraph}>המידע משמש אך ורק לצורך:</Text>
              <Text style={accessibilityStyles.bulletPoint}>✔ תפעול הכרטיסייה</Text>
              <Text style={accessibilityStyles.bulletPoint}>✔ הצגת כמות ניקובים והטבות</Text>
              <Text style={accessibilityStyles.bulletPoint}>✔ שליחת התראות פוש</Text>
              <Text style={accessibilityStyles.bulletPoint}>✔ תמיכה וניהול חשבון</Text>
              <Text style={accessibilityStyles.paragraph}>לא נעשה שימוש מסחרי, שיווקי חיצוני או מכירת מידע.</Text>

              <Text style={accessibilityStyles.sectionTitle}>3. גישה למידע</Text>
              <Text style={accessibilityStyles.paragraph}>לנתונים שלך יכולים לגשת:</Text>
              <Text style={accessibilityStyles.bulletPoint}>• בעל העסק (האדמין) – לניהול הכרטיסייה</Text>
              <Text style={accessibilityStyles.bulletPoint}>• Cardz – לתמיכה בתקלות בלבד</Text>
              <Text style={accessibilityStyles.bulletPoint}>• ספקי אחסון מאובטחים (Supabase, Firebase)</Text>
              <Text style={accessibilityStyles.paragraph}>אין העברת מידע לגורמי פרסום.</Text>

              <Text style={accessibilityStyles.sectionTitle}>4. אחסון ואבטחת מידע</Text>
              <Text style={accessibilityStyles.paragraph}>
                המידע נשמר ב־Supabase תחת הצפנה מלאה. גיבויים נשמרים ב־Google Drive של בעל העסק.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>5. משך שמירת המידע</Text>
              <Text style={accessibilityStyles.bulletPoint}>• מידע נשמר עד 6 חודשים בלבד</Text>
              <Text style={accessibilityStyles.bulletPoint}>• כרטיסיות לא פעילות נמחקות לחלוטין</Text>
              <Text style={accessibilityStyles.bulletPoint}>• בקשת מחיקה מבוצעת תוך 48 שעות</Text>

              <Text style={accessibilityStyles.sectionTitle}>6. זכויותיך</Text>
              <Text style={accessibilityStyles.paragraph}>עיון במידע: ניתן לצפות בפרטים בתפריט "פרטי משתמש".</Text>
              <Text style={accessibilityStyles.paragraph}>מחיקת מידע: ניתן להגיש בקשה דרך תפריט המשתמש. כל הנתונים יימחקו בתוך 48 שעות.</Text>

              <Text style={accessibilityStyles.sectionTitle}>7. קטינים</Text>
              <Text style={accessibilityStyles.paragraph}>
                השירות מאפשר שימוש לקטינים. האחריות על התאמת השירות לגיל הלקוח מוטלת על בעל העסק.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>8. קוקיז ומעקב</Text>
              <Text style={accessibilityStyles.paragraph}>
                האפליקציה אינה משתמשת בקוקיז, פיקסלים או מנגנוני מעקב. נעשה שימוש ב־Google Analytics אנונימי בלבד.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>9. הגבלת אחריות</Text>
              <Text style={accessibilityStyles.paragraph}>Cardz אינה אחראית ל:</Text>
              <Text style={accessibilityStyles.bulletPoint}>• טיב המוצרים או השירותים של העסק</Text>
              <Text style={accessibilityStyles.bulletPoint}>• תוכן ההודעות, השוברים וההטבות</Text>
              <Text style={accessibilityStyles.bulletPoint}>• טעויות ניקוב או זיכוי</Text>
              <Text style={accessibilityStyles.paragraph}>
                Cardz מספקת פלטפורמה טכנולוגית בלבד, וכל אחריות הקשורה ביחסי הלקוח–העסק חלה על העסק בלבד.
              </Text>

              <Text style={accessibilityStyles.sectionTitle}>10. פרטי קשר</Text>
              <Text style={accessibilityStyles.paragraph}>פניות בנושא פרטיות:</Text>
              <TouchableOpacity 
                onPress={() => Linking.openURL('mailto:support@punchcards.digital')}
                accessibilityLabel="שלח דואר אלקטרוני בנושא פרטיות"
                accessibilityRole="link"
              >
                <Text style={accessibilityStyles.contactItemClickable}>📧 support@punchcards.digital</Text>
              </TouchableOpacity>

              <Text style={[accessibilityStyles.paragraph, { marginTop: 20, opacity: 0.7 }]}>
                עדכון אחרון: דצמבר 2025 | גרסה ללקוחות לפי תיקון 13
              </Text>

              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* מודאל אודותינו */}
      <Modal
        visible={aboutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutVisible(false)}
      >
        <View style={accessibilityStyles.overlay}>
          <View style={accessibilityStyles.container}>
            <TouchableOpacity 
              style={accessibilityStyles.closeButton}
              onPress={() => setAboutVisible(false)}
              accessibilityLabel="סגור אודותינו"
              accessibilityRole="button"
            >
              <Text style={accessibilityStyles.closeText}>✕</Text>
            </TouchableOpacity>
            
            <ScrollView style={accessibilityStyles.scrollView} showsVerticalScrollIndicator={true}>
              <Text style={accessibilityStyles.mainTitle}>אודותינו</Text>
              <Text style={accessibilityStyles.subtitle}>יולה דיגיטל</Text>

              <Text style={[accessibilityStyles.paragraph, { fontSize: 18, lineHeight: 28, marginTop: 20 }]}>
                אנחנו חברה משפחתית אמיתית, אב ושתי בנותיו.
              </Text>
              <Text style={[accessibilityStyles.paragraph, { fontSize: 18, lineHeight: 28 }]}>
                אנו עוזרים לעסקים גם בהתייעלות וגם במכירות עד להכפלת הפעילות באמצעות קידום דיגיטלי מתקדם, אפליקציות, אוטומציות עסקיות חכמות בעזרת בינה מלאכותית ועם עשרות לקוחות מרוצים ותוצאות מוכחות.
              </Text>

              <Text style={[accessibilityStyles.sectionTitle, { marginTop: 30 }]}>ליצירת קשר</Text>
              <TouchableOpacity 
                onPress={() => Linking.openURL('https://wa.me/972552482442')}
                accessibilityLabel="שלח הודעת וואטסאפ"
                accessibilityRole="link"
              >
                <Text style={[accessibilityStyles.contactItemClickable, { fontSize: 20 }]}>💬 בוואטסאפ: 055-248-2442</Text>
              </TouchableOpacity>

              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>

      {/* מודאל ניקוב NFC */}
      {localBusiness && localBusiness.nfc_string && (
        <NFCPunchModal
          visible={nfcModalVisible}
          businessId={localBusiness.id || 0}
          businessName={localBusiness.business_name || localBusiness.name}
          nfcString={localBusiness.nfc_string}
          customerPhone={phoneStr || phoneIntl || ''} // הלקוח כבר מזוהה!
          selectedCardNumber={punchCard?.card_number} // אם המשתמש כבר בחר כרטיסייה - לא להציג בחירה שוב
          brandColor={localBusiness.login_brand_color}
          onClose={closeNfcModalWithCooldown}
          onCardRenewed={(newCardNumber) => {
            // עדכון מסך הכרטיסייה לכרטיסייה החדשה המאופסת
            (async () => {
              try {
                const businessCode = localBusiness?.business_code || customer?.business_code;
                if (!businessCode) return;

                const { data: newCardRow } = await supabase
                  .from('PunchCards')
                  .select('business_code, customer_phone, product_code, card_number, total_punches, used_punches, status, created_at, updated_at, benefit, prepaid')
                  .eq('card_number', newCardNumber)
                  .maybeSingle();

                if (!newCardRow) return;

                // שליפת שם המוצר (כמו ב-fetch הראשי)
                let productNameForCard = '';
                const pc = String((newCardRow as any)?.product_code || '').trim();
                if (pc) {
                  const { data: prodRow } = await supabase
                    .from('products')
                    .select('product_name')
                    .eq('business_code', businessCode)
                    .eq('product_code', pc)
                    .maybeSingle();
                  productNameForCard = String((prodRow as any)?.product_name || '').trim();
                }

                setPunchCard({
                  ...(newCardRow as any),
                  product_name: productNameForCard,
                } as any);
              } catch {}
            })();
          }}
          onSuccess={() => {
            // רענון הכרטיסייה אחרי ניקוב (מיידי, כדי למנוע ניקוב נוסף על נתונים ישנים)
            refreshBusiness();
            (async () => {
              try {
                const cardNumber = punchCard?.card_number;
                if (!cardNumber) return;
                const { data: cardRow } = await supabase
                  .from('PunchCards')
                  .select('used_punches, total_punches, status, updated_at')
                  .eq('card_number', cardNumber)
                  .maybeSingle();

                if (!cardRow) return;
                setPunchCard((prev) => ({
                  ...(prev || {}),
                  ...(cardRow as any),
                }) as any);
              } catch {}
            })();
          }}
        />
      )}
    </>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#FBF8F8',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 8,
  },
  topIconOffsetClean: {
    transform: [{ translateY: height * 0.05 }],
  },
  logoBusinessOffset: {
    transform: [{ translateY: height * 0.10 }],
  },
  iconsUpOffset: {
    transform: [{ translateY: height * -0.10 }],
  },
  bottomContentOffset: {
    transform: [{ translateY: height * 0.095 + 67 }],
  },
  bottomTextsUpOffset: {
    transform: [{ translateY: height * -0.07 }],
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF8F8',
  },
  topElementsGroup: {
    // transform: [{ translateY: 40 }], // NEUTRALIZED - conflicts with logoBusinessOffset
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    marginTop: -20,
  },
  logo: {
    // גודל יוגדר דינמית
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: -45,
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  customerName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: Platform.OS === 'ios' ? 120 : 60, // iOS: הורדת שם הלקוח וכל מה שמתחתיו (כ-1/3 מהגובה)
    textAlign: 'center',
    // transform: [{ translateY: -40 }], // NEUTRALIZED - conflicts with spacing adjustments
    fontFamily: 'Rubik',
  },
  iconsBoxTight: {
    marginTop: 0,
    marginBottom: 12,
    transform: [{ translateY: -50 }], // RESTORED - helps with fine-tuning when adding/removing elements
  },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: {
    width: 55,
    height: 55,
    marginHorizontal: 2,
  },
  punchCount: {
    fontSize: 18,
    marginBottom: 4,
    marginTop: -20,
    fontFamily: 'Rubik',
  },
  benefitText: {
    fontSize: 16,
    marginBottom: 6,
    fontFamily: 'Rubik',
  },
  prepaidText: {
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'Rubik',
  },
  expirationText: {
    fontSize: 10,
    marginBottom: 8,
    fontWeight: 'bold',
    fontFamily: 'Rubik',
  },
  barcodeBox: {
    marginVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    transform: [{ translateY: 20 }],
  },
  cardCode: {
    fontSize: 18,
    color: '#888',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Rubik',
    transform: [{ translateY: 20 }],
  },
  mailIconContainer: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 10,
  },
  mailIcon: {
    width: 41.75,
    height: 33.4,
  },
  mailIconWrap: {
    transform: [{ translateY: 2 }],
  },
  communityIconContainer: {
    position: 'absolute',
    top: 10,
    left: '52.5%',
    marginLeft: -20.875,
    zIndex: 10,
  },
  communityIcon: {
    width: 41.75,
    height: 33.4,
  },
  communityIconLabel: {
    fontSize: 10,
    marginTop: 0,
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  hamburgerContainer: {
    position: 'absolute',
    top: 19,
    left: 20,
    zIndex: 10,
  },
  hamburgerButton: {
    width: 30,
    height: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hamburgerLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'Rubik',
  },
  closeButton: {
    backgroundColor: '#1E51E9',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  messageBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Rubik',
  },
  mailContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  mailHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
    position: 'relative',
  },
  mailTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
    fontFamily: 'Rubik',
  },
  closeX: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    position: 'absolute',
    left: 0,
  },
  closeXText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  webviewCardPunch: {
    flex: 1,
    backgroundColor: 'white',
  },
  webviewClosePunch: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toastCardPunch: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    maxWidth: '90%',
  },
  toastTextPunch: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  voucherInsetWrapPunch: {
    flex: 1,
    padding: 2,
  },
  voucherInsetBorderPunch: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
  },
  webviewActionsPunch: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    gap: 12,
  },
  webviewExternalButtonPunch: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#4E4E4E',
    borderRadius: 999,
  },
  webviewExternalTextPunch: {
    color: '#fff',
    fontFamily: 'Heebo',
    fontSize: 12,
  },
  messagesScrollView: {
    flex: 1,
    maxHeight: 400,
    minHeight: 100,
    backgroundColor: '#f0f0f0', // נוסיף רקע כדי לראות אם הקונטיינר נראה
  },
  messageItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 15,
    marginBottom: 10,
  },
  messageHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 5,
    justifyContent: 'flex-start',
  },
  messageNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginLeft: 10,
    textAlign: 'right',
    fontFamily: 'Rubik',
  },
  messageFrom: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
    flex: 1,
    fontFamily: 'Rubik',
  },
  subjectRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  messageSubject: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Rubik',
  },
  openButton: {
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  unreadMessage: {
    backgroundColor: '#f0f8ff',
  },
  messageBody: {
    marginVertical: 8,
  },
  messageContent: {
    fontSize: 14,
    color: '#333',
    textAlign: 'right',
    fontFamily: 'Rubik',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Rubik',
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Rubik',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  voucherButton: {
    backgroundColor: '#0F9FB8',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  voucherButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Rubik',
  },
  emptyMessagesContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyMessagesText: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'Rubik',
  },
  noMessages: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 50,
    fontFamily: 'Rubik',
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Rubik',
  },
  referralModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginTop: -24,
    marginHorizontal: -24,
    marginBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  referralHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
  referralCloseButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralCloseButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  referralTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 5,
    fontFamily: 'Rubik',
  },
  referralMainText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
    fontFamily: 'Rubik',
  },
  shareButtonsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  shareButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Rubik',
  },
  inviteMethodsContainer: {
    marginBottom: 20,
    gap: 8,
  },
  inviteMethodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  inviteMethodItem: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    gap: 4,
    justifyContent: 'center',
  },
  inviteMethodIcon: {
    width: 20,
    height: 20,
  },
  inviteMethodText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Rubik',
    textAlign: 'center',
  },
  referralCodeContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  referralCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
    fontFamily: 'Rubik',
  },
  referralCodeBox: {
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  referralCodeText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Rubik',
    minWidth: 80,
    textAlign: 'center',
  },
  copyButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
     copyButtonText: {
     color: 'white',
     fontSize: 12,
     fontWeight: '600',
     fontFamily: 'Rubik',
     textAlign: 'center',
   },
       menuCloseButton: {
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
      marginBottom: 10,
    },
   menuCloseText: {
     fontSize: 24,
     fontWeight: 'bold',
     color: '#666',
   },
   // סגנונות למודל בחירת כרטיסייה
   cardSelectionContent: {
     backgroundColor: 'white',
     width: '90%',
     maxHeight: '70%',
     borderRadius: 20,
     padding: 20,
     elevation: 5,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.25,
     shadowRadius: 3.84,
   },
   cardSelectionHeader: {
     marginBottom: 20,
     alignItems: 'center',
   },
   cardSelectionTitle: {
     fontSize: 22,
     fontWeight: 'bold',
     color: '#333',
     fontFamily: 'Rubik',
     marginBottom: 8,
   },
   cardSelectionSubtitle: {
     fontSize: 16,
     color: '#666',
     fontFamily: 'Rubik',
     textAlign: 'center',
   },
   cardsScrollView: {
     maxHeight: 300,
   },
   cardOption: {
     borderWidth: 1,
     borderColor: '#E0E0E0',
     borderRadius: 15,
     padding: 15,
     marginBottom: 10,
     backgroundColor: '#216265',
   },
   cardOptionContent: {
     flexDirection: 'column',
     alignItems: 'center',
   },
   cardOptionInfo: {
     width: '100%',
     alignItems: 'center',
     paddingTop: 5,
   },
   cardOptionTitle: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#FFFFFF',
     fontFamily: 'Rubik',
     marginBottom: 4,
     marginTop: -5,
     textAlign: 'center',
   },
   cardOptionCode: {
     fontSize: 14,
     color: '#FFFFFF',
     fontFamily: 'Rubik',
     marginBottom: 4,
   },
   cardOptionProgress: {
     fontSize: 14,
     color: '#FFFFFF',
     fontFamily: 'Rubik',
   },
   cardOptionSelectButton: {
     paddingVertical: 6,
     paddingHorizontal: 16,
     backgroundColor: '#216265',
     borderWidth: 0.5,
     borderColor: '#FFFFFF',
     borderRadius: 8,
     marginTop: 8,
     alignSelf: 'center',
   },
   cardOptionSelectText: {
     fontSize: 14,
     color: '#FFFFFF',
     fontWeight: 'bold',
     fontFamily: 'Rubik',
   },
   cardSelectionCancel: {
     marginTop: 15,
     paddingVertical: 12,
     paddingHorizontal: 40,
     backgroundColor: '#E0E0E0',
     borderRadius: 20,
     alignSelf: 'center',
   },
   cardSelectionCancelText: {
     fontSize: 16,
     color: '#666',
     fontFamily: 'Rubik',
  },
});