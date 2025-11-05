// AsyncStorage no longer used for inbox; messages loaded from Supabase inbox table
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Barcode } from 'react-native-svg-barcode';
import { useBusiness } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';
import { getCurrentLogoScale } from '../../components/LogoUtils';
import { supabase } from '../../components/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function PunchCard() {
  const router = useRouter();
  const navigation = useNavigation();
  const { business, refresh: refreshBusiness } = useBusiness();
  const { phone } = useLocalSearchParams();
  const phoneStr = typeof phone === 'string' ? phone.trim() : Array.isArray(phone) ? phone[0].trim() : '';
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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [referralVisible, setReferralVisible] = useState(false);
  const [cardSelectionVisible, setCardSelectionVisible] = useState(false);
  const [availableCards, setAvailableCards] = useState<Array<{
    product_code: string;
    card_number: string;
    used_punches: number;
    total_punches: number;
    products?: { product_name: string }[];
  }>>([]);
  const [localBusiness, setLocalBusiness] = useState<{
    business_code: string;
    name: string;
    logo?: string;
    max_punches: number;
    punched_icon?: string;
    unpunched_icon?: string;
    card_text_color?: string;
    expiration_date?: string;
  } | null>(null);

  // פונקציה ליצירת קוד הזמנה מספרי חדש
  const generateReferralCode = (businessCode: string, customerPhone: string): string => {
    // מספר עסק (4 ספרות) + 4 ספרות אחרונות של טלפון + 4 ספרות רנדומליות
    const businessNumber = businessCode.padStart(4, '0').slice(-4);
    const phoneLast4 = customerPhone.slice(-4);
    const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
    return businessNumber + phoneLast4 + randomDigits;
  };


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
              setPunchCard(punchCards[0] as typeof punchCard);
      setLoading(false);
    };
    if (phoneStr) {
      fetchData();
    }
  }, [phoneStr, business?.business_code]); // תלות רק בקוד העסק, לא בכל האובייקט

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
            setPunchCard(payload.new as typeof punchCard);
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
    };
  }, [phoneStr, customer?.business_code]);
  // --- REALTIME END ---

  // רישום העסק למכשיר (ללא תלות במספר טלפון)
  useEffect(() => {
    console.log('PunchCard: localBusiness changed:', localBusiness);
    const registerBusiness = async () => {
      if (!localBusiness) return;
      
      // רישום העסק למכשיר זה
      console.log('PunchCard: Registering business to device:', localBusiness.business_code);
      await FCMService.addBusinessCode(localBusiness.business_code);
    };
    
    registerBusiness();
  }, [localBusiness]);

  // עדכון פרטי משתמש עבור רישום טוקן מלא (טלפון + קוד עסק)
  useEffect(() => {
    const businessCode = localBusiness?.business_code;
    if (!businessCode || !phoneStr) return;

    console.log('[PunchCard] Setting user context:', { businessCode, phoneStr });
    FCMService.setUserContext(businessCode, phoneStr).catch(() => {});
  }, [localBusiness?.business_code, phoneStr]);

  // טעינת מספר הודעות לא נקראות בלבד (לBadge)
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (localBusiness && phoneStr) {
        try {
          const { count } = await supabase
            .from('inbox')
            .select('*', { count: 'exact', head: true })
            .eq('business_code', localBusiness.business_code)
            .eq('customer_phone', phoneStr)
            .eq('status', 'unread');
          
          if (count !== null) {
            setUnreadMessages(count);
            console.log('[Inbox] Unread count loaded:', count);
          }
        } catch (error) {
          console.error('[Inbox] Error loading unread count:', error);
        }
      }
    };
    
    loadUnreadCount();
  }, [localBusiness?.business_code, phoneStr]);

  // עדכון Badge באייקון האפליקציה באמצעות expo-notifications
  useEffect(() => {
    const updateBadge = async () => {
      try {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          await Notifications.setBadgeCountAsync(unreadMessages);
        }
      } catch (error) {
        console.log('[Inbox] Failed to update app badge:', error);
      }
    };
    updateBadge();
  }, [unreadMessages]);

  // האזנת Realtime ל-inbox לרענון מיידי של רשימה וחיווי
  useEffect(() => {
    const businessCode = localBusiness?.business_code;
    if (!phoneStr || !businessCode) return;

    const channel = supabase
      .channel(`inbox-${businessCode}-${phoneStr}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inbox',
        filter: `business_code=eq.${businessCode}`,
      }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (row.customer_phone !== phoneStr) return;
        // ריענון רשימה וספירה
        (async () => {
          try {
            const { data } = await supabase
              .from('inbox')
              .select('id, title, message, status, created_at')
              .eq('business_code', businessCode)
              .eq('customer_phone', phoneStr)
              .order('created_at', { ascending: false });
            const mapped = (data || []).map((r: any, idx: number) => ({
              id: String(r.id),
              title: r.title || business?.name || 'הודעה',
              body: r.message || '',
              timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now() - idx,
              read: r.status !== 'unread',
            }));
            setNotifications(mapped);
            setUnreadMessages(mapped.filter((n: any) => !n.read).length);
          } catch (_) {}
        })();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [localBusiness?.business_code, phoneStr]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={{ fontSize: 18, color: '#A39393', fontFamily: 'Rubik' }}>טוען נתונים...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.loadingContainer, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={{ fontSize: 18, color: '#D32F2F', marginBottom: 16, textAlign: 'center', fontFamily: 'Rubik' }}>{errorMessage}</Text>
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
  const benefit = punchCard?.benefit || '';
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
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      setNotifications(updatedNotifications);
      setUnreadMessages(updatedNotifications.filter(n => !n.read).length);
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

    setLocalBusiness(businessData);
    setPunchCard(punchCard);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* תפריט המבורגר */}
      <TouchableOpacity 
        style={[styles.hamburgerContainer, styles.topIconOffsetClean]}
        onPress={() => setMenuVisible(true)}
      >
        <View style={styles.hamburgerButton}>
          <View style={[styles.hamburgerLine, { backgroundColor: cardTextColor }]} />
          <View style={[styles.hamburgerLine, { backgroundColor: cardTextColor }]} />
          <View style={[styles.hamburgerLine, { backgroundColor: cardTextColor }]} />
        </View>
      </TouchableOpacity>

      {/* אייקון הודעות דואר */}
      <TouchableOpacity 
        style={[styles.mailIconContainer, styles.topIconOffsetClean]}
        onPress={async () => {
          console.log('[Inbox] Mail button clicked!');
          console.log('[Inbox] localBusiness:', localBusiness);
          console.log('[Inbox] phoneStr:', phoneStr);
          
          setMailVisible(true);
          
          // טעינה מיידית של ההודעות
          if (localBusiness && phoneStr) {
            console.log('[Inbox] Loading messages...');
            setInboxLoading(true);
            
            try {
              const { data, error } = await supabase
                .from('inbox')
                .select('id, title, message, status, created_at')
                .eq('business_code', localBusiness.business_code)
                .eq('customer_phone', phoneStr)
                .order('created_at', { ascending: false });
              
              console.log('[Inbox] Query result - data:', data?.length, 'error:', error);
              
              if (error) {
                console.error('[Inbox] Supabase error:', error);
              } else if (data) {
                const mapped = data.map((row: any) => ({
                  id: String(row.id),
                  title: row.title || 'הודעה',
                  body: row.message || '',
                  timestamp: new Date(row.created_at).getTime(),
                  read: row.status !== 'unread',
                }));
                console.log('[Inbox] Mapped messages:', mapped);
                console.log('[Inbox] Current notifications before set:', notifications);
                setNotifications(mapped);
                setUnreadMessages(mapped.filter(n => !n.read).length);
              }
              
              setInboxLoading(false);
              console.log('[Inbox] Loading completed, inboxLoading set to false');
            } catch (err) {
              console.error('[Inbox] Exception:', err);
              setInboxLoading(false);
            }
          } else {
            console.log('[Inbox] Missing data - not loading');
            setInboxLoading(false);
          }
        }}
      >
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
      </TouchableOpacity>

      {/* אייקון קבוצה באמצע */}
      <TouchableOpacity 
        style={[styles.communityIconContainer, styles.topIconOffsetClean]}
        onPress={() => setReferralVisible(true)}
      >
        <Image 
          source={{ uri: 'https://cdn-icons-png.flaticon.com/512/681/681443.png' }}
          style={[styles.communityIcon, { tintColor: cardTextColor }]}
          resizeMode="contain"
        />
      </TouchableOpacity>
      
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
              <Text style={[styles.businessName, { color: cardTextColor }]}>{business.name}</Text>
            )}
          </View>
        </View>
                 {/* שם הלקוח */}
         <Text style={[styles.customerName, { color: cardTextColor }]}>{customer?.name || ''}</Text>
      </View>
      {/* כל התוכן מתחת לשם הלקוח - מוזח 10% למטה */}
      <View style={styles.bottomContentOffset}>
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
                      {/* חור ניקוב מעל הכוס - גדול ב-50% */}
                      <Image
                        source={{ uri: 'https://noqfwkxzmvpkorcaymcb.supabase.co/storage/v1/object/public/icons/punched_icones/punch_overlay.png' }}
                        style={[styles.icon, { 
                          position: 'absolute', 
                          top: -13.75, 
                          left: -13.75, 
                          width: 82.5, 
                          height: 82.5, 
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
      {/* 4 הטקסטים התחתונים - מוזחים 7% למעלה */}
      <View style={styles.bottomTextsUpOffset}>
        {/* ניקובים */}
        <Text style={[styles.punchCount, { color: cardTextColor }]}>ניקובים: {usedPunches}/{totalPunches}</Text>
        {/* טקסט מתחת לאייקונים */}
        <Text style={[styles.benefitText, { color: cardTextColor }]}>
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
      </View>
      
      {/* ברקוד */}
      {cardCode && (
      <View style={styles.barcodeBox}>
        <Barcode value={cardCode} format="CODE128" height={60} />
      </View>
      )}
      {/* מספר סידורי */}
      {cardCode && <Text style={styles.cardCode}>#{cardCode}</Text>}
      </View>
      
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
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>הוראות שימוש</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>מדיניות פרטיות</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>הפעילות שלי</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>הפרופיל שלי</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>אודותינו</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>יציאה מהיישום</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuItemText}>צור קשר</Text>
              </TouchableOpacity>
              

            </View>
          </View>
                 </TouchableWithoutFeedback>
       </Modal>

       {/* מודאל תיבת דואר - גרסה מתוקנת */}
      <Modal 
        visible={mailVisible} 
        transparent={true}
        animationType="slide">
        <TouchableWithoutFeedback onPress={() => setMailVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback onPress={() => {}}>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 30 }} />
              <Text style={{ fontSize: 20, textAlign: 'center', fontWeight: 'bold', flex: 1 }}>
                תיבת דואר ({notifications.length} הודעות)
              </Text>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('X button pressed - closing mail modal');
                  try {
                    setMailVisible(false);
                    console.log('Mail modal should be closed now');
                  } catch (error) {
                    console.error('Error closing modal:', error);
                  }
                }}
                style={{ padding: 5 }}
              >
                <Text style={{ fontSize: 30, color: '#000000' }}>×</Text>
              </TouchableOpacity>
            </View>
             
            <ScrollView showsVerticalScrollIndicator={true} style={{ backgroundColor: 'transparent' }}>
              {/* הצגת דיבאג אם יש */}
              {debugInfo && (
                <View style={{ 
                  backgroundColor: '#FFE4B5', 
                  padding: 15, 
                  margin: 10, 
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#FFA500'
                }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>מידע דיבאג:</Text>
                  <Text style={{ fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                    {debugInfo}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setDebugInfo('')}
                    style={{ 
                      backgroundColor: '#FFA500', 
                      padding: 8, 
                      marginTop: 10, 
                      borderRadius: 5,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>סגור דיבאג</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {notifications.length === 0 ? (
                <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  אין הודעות חדשות
                </Text>
              ) : (
                notifications.map((msg, idx) => (
                  <View key={`msg-${idx}`} style={{
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
                        {!msg.read && (
                          <TouchableOpacity
                            onPress={() => markAsRead(msg.id)}
                            style={{ marginRight: 12 }}
                          >
                            <Ionicons name="checkmark" size={20} color="#4CAF50" />
                          </TouchableOpacity>
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
                           {msg.body
                             .replace(/(https?:\/\/[^\s]+)/g, '')
                             .replace(/קישור לשובר/g, '')
                             .replace(/🎁/g, '')
                             .replace(/:/g, '')
                             .trim()}
                         </Text>
                         {msg.body.includes('http') && (
                           <TouchableOpacity
                             onPress={(e) => {
                               e.stopPropagation();
                               
                               // איסוף מידע לדיבאג
                               let debug = 'דיבאג קישור שובר:\n\n';
                               debug += '1. תוכן ההודעה:\n' + msg.body + '\n\n';
                               
                               const urlMatch = msg.body.match(/(https?:\/\/[^\s]+)/);
                               if (urlMatch) {
                                 debug += '2. URL שנמצא:\n' + urlMatch[0] + '\n\n';
                                 
                                 // מנקה תווים מיותרים בסוף ה-URL
                                 let rawUrl = urlMatch[0];
                                 // מסיר תווי פיסוק וסוגריים מהסוף
                                 rawUrl = rawUrl.replace(/[)\],.;:!?]+$/,'');
                                 // מסיר מרכאות אם יש
                                 rawUrl = rawUrl.replace(/['"]+$/,'');
                                 debug += '3. URL אחרי ניקוי:\n' + rawUrl + '\n\n';
                                 
                                // לא מקודד את ה-URL אם הוא כבר מקודד
                                let safeUrl = rawUrl.includes('%') ? rawUrl : encodeURI(rawUrl);
                                
                                // הוספת פרמטר phone לפרסונליזציה
                                if (phoneStr) {
                                  const separator = safeUrl.includes('?') ? '&' : '?';
                                  safeUrl = `${safeUrl}${separator}phone=${phoneStr}`;
                                  debug += '3.5. הוספת פרמטר phone: ' + phoneStr + '\n\n';
                                }
                                
                                debug += '4. URL סופי:\n' + safeUrl + '\n\n';
                                 
                                 setDebugInfo(debug);
                                 
                                 // בדיקה שה-URL תקין
                                 if (!safeUrl || safeUrl.length < 10) {
                                   console.error('[Voucher Link] Invalid URL:', safeUrl);
                                   Alert.alert('שגיאה', 'הקישור לשובר אינו תקין');
                                   return;
                                 }
                                 
                                // פותח את השובר ישירות
                                console.log('[Voucher Link] Opening URL:', safeUrl);
                                // הוספת בדיקה אם ניתן לפתוח את ה-URL
                                Linking.canOpenURL(safeUrl).then((supported) => {
                                  if (supported) {
                                    Linking.openURL(safeUrl).catch(err => {
                                      console.error('[Voucher Link] Failed to open URL:', err);
                                      setDebugInfo(debug + '\n5. שגיאה בפתיחה:\n' + err.toString());
                                      Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור: ' + err.message);
                                    });
                                  } else {
                                    console.error('[Voucher Link] URL not supported:', safeUrl);
                                    setDebugInfo(debug + '\n5. URL לא נתמך על ידי המכשיר');
                                    Alert.alert('שגיאה', 'הקישור אינו נתמך במכשיר זה');
                                  }
                                }).catch(err => {
                                  console.error('[Voucher Link] Error checking URL:', err);
                                  setDebugInfo(debug + '\n5. שגיאה בבדיקת URL:\n' + err.toString());
                                  Alert.alert('שגיאה', 'שגיאה בבדיקת הקישור');
                                });
                               } else {
                                 const debug = 'דיבאג קישור שובר:\n\nלא נמצא URL בהודעה!\n\nתוכן ההודעה:\n' + msg.body;
                                 setDebugInfo(debug);
                                 Alert.alert('שגיאה', 'לא נמצא קישור בהודעה');
                               }
                             }}
                             style={{
                               flexDirection: 'row',
                               alignItems: 'center',
                               marginTop: 10,
                               alignSelf: 'flex-end'
                             }}
                           >
                             <Text style={{ color: '#2196F3', fontSize: 14, marginRight: 5 }}>
                               קישור לשובר
                             </Text>
                             <Text style={{ fontSize: 18 }}>🎁</Text>
                           </TouchableOpacity>
                         )}
                       </View>
                    </View>
                  </View>
                ))
              )}
             </ScrollView>
              </LinearGradient>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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

                {/* קוד ההפניה */}
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

                {/* הודעה ראשית */}
                <Text style={styles.referralMainText}>
                  באפשרותך להזמין חבר/ה לכרטיסיית {business?.name}. על כל חבר שהזמנת ומימש הזמנתו אצלנו, תקבל ניקוב אחד חינם כמו גם החבר/ה שהזמנת. ניתן לשנות את הטקסטים בהודעה (לאישי או אחר) אך לא את הקישור המכיל את קופון ההזמנה.
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
                      <Text style={[styles.inviteMethodText, { color: cardTextColor }]}>
                        הזמן בווטסאפ
                      </Text>
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
                      <Text style={[styles.inviteMethodText, { color: cardTextColor }]}>
                        הזמן במייל
                      </Text>
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
                      <Text style={[styles.inviteMethodText, { color: cardTextColor }]}>
                        הזמן בפייסבוק
                      </Text>
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
                      <Text style={[styles.inviteMethodText, { color: cardTextColor }]}>
                        הזמן{'\n'}באינסטגרם
                      </Text>
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#FBF8F8',
    paddingTop: 8,
    paddingBottom: 150,
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
    marginTop: 60,
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
  },
  cardCode: {
    fontSize: 18,
    color: '#888',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Rubik',
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
    textDecorationLine: 'underline',
    textAlign: 'center',
    flex: 1,
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