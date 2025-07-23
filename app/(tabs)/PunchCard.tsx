import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Barcode } from 'react-native-svg-barcode';
import { useBusiness } from '../../components/BusinessContext';
import { getCurrentLogoScale } from '../../components/LogoUtils';
import { supabase } from '../../components/supabaseClient';

const { width } = Dimensions.get('window');

export default function PunchCard() {
  const router = useRouter();
  const { business, refresh: refreshBusiness } = useBusiness();
  const { phone } = useLocalSearchParams();
  const phoneStr = typeof phone === 'string' ? phone.trim() : Array.isArray(phone) ? phone[0].trim() : '';
  const [customer, setCustomer] = useState<any>(null);
  const [punchCard, setPunchCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [iconsLoading, setIconsLoading] = useState<{ [key: number]: boolean }>({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [mailVisible, setMailVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(2);
  const [referralVisible, setReferralVisible] = useState(false);
  const [localBusiness, setLocalBusiness] = useState<any>(null);


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage(null);
      // שליפת לקוח לפי customer_phone
      const { data: customers, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_phone', phoneStr)
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
      // שליפת business_code מתוך הלקוח
      const businessCode = customers[0].business_code; // לדוג' '0001'
      const productCode = '12'; // קוד מוצר בן 2 ספרות בלבד
      const cardNumber = `${businessCode}${phoneStr}${productCode}`; // 16 ספרות בלבד
      
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
        if (businessInfo.Punched_Iicon) {
          Image.prefetch(businessInfo.Punched_Iicon).catch(() => {});
        }
        if (businessInfo.Unpunched_Iicon) {
          Image.prefetch(businessInfo.Unpunched_Iicon).catch(() => {});
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
              setPunchCard(punchCards[0]);
      setLoading(false);
    };
    if (phoneStr) {
      fetchData();
    }
  }, [phoneStr]);

  // --- REALTIME START ---
  // חיבור ל-Realtime לעדכונים מיידיים
  useEffect(() => {
    if (!phoneStr) return;

    const businessCode = customer?.business_code || '0001';
    const productCode = '12';
    const cardNumber = `${businessCode}${phoneStr}${productCode}`;

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
        (payload: any) => {
          console.log('🔄 עדכון Realtime לכרטיסייה:', payload);
          if (payload.new) {
            setPunchCard(payload.new);
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
        async (payload: any) => {
          console.log('🏢 עדכון Realtime לעסק:', payload);
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
  const cardCode = punchCard.card_number;

  // לוגיקת ניקובים - שימוש ב-max_punches מהעסק במקום total_punches מהכרטיסייה
  const totalPunches = business?.max_punches || 0;
  const usedPunches = punchCard.used_punches || 0;
  const unpunched = totalPunches - usedPunches;
  const punchedIcon = business?.Punched_Iicon;
  const unpunchedIcon = business?.Unpunched_Iicon;
  const benefit = punchCard.benefit || '';
  const prepaid = punchCard.prepaid === 'כן' ? 'כן' : 'לא';

  // בניית מערך אייקונים
  const iconsArr = [
    ...Array(usedPunches).fill(punchedIcon),
    ...Array(unpunched).fill(unpunchedIcon),
  ];

  // עיצוב גריד סימטרי (למשל 3x4, 2x5 וכו')
  const iconsPerRow = Math.ceil(Math.sqrt(totalPunches));
  const rows = [];
  for (let i = 0; i < iconsArr.length; i += iconsPerRow) {
    rows.push(iconsArr.slice(i, i + iconsPerRow));
  }

  // צבע הטקסט מהעסק או ברירת מחדל
  const cardTextColor = business?.card_text_color || '#6B3F1D';

  // הודעות דמי פשוטות - 2 הודעות לדמו
  const demoMessages = [
    {
      id: 1,
      from: business?.name || 'העסק',
      subject: 'הודעה ראשונה',
      content: 'זו הודעה ראשונה מהעסק. כאן יופיעו הודעות מהעסק ללקוחותיו.'
    },
    {
      id: 2,
      from: 'מערכת CARDZ',
      subject: 'הודעה שנייה',
      content: 'זו הודעה שנייה מהמערכת. כאן יופיעו הודעות מהמערכת ללקוחות.'
    }
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* תפריט המבורגר */}
      <TouchableOpacity 
        style={styles.hamburgerContainer}
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
        style={styles.mailIconContainer}
        onPress={() => setMailVisible(true)}
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
        style={styles.communityIconContainer}
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
        {/* שם הלקוח */}
        <Text style={[styles.customerName, { color: cardTextColor }]}>{customer.name}</Text>
      </View>
      {/* אייקונים */}
      <View style={styles.iconsBoxTight}>
        {rows.map((row, idx) => (
          <View key={idx} style={styles.iconsRow}>
            {row.map((icon, j) => {
              const iconIndex = idx * iconsPerRow + j;
              const isIconLoading = iconsLoading[iconIndex] !== false;
              
              return (
                <View key={j} style={{ position: 'relative' }}>
                  {isIconLoading && (
                    <View style={{
                      position: 'absolute',
                      width: 146,
                      height: 146,
                      backgroundColor: '#f0f0f0',
                      borderRadius: 73,
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 1
                    }}>
                      <Text style={{ color: '#999', fontSize: 10, fontFamily: 'Rubik' }}>טוען...</Text>
                    </View>
                  )}
                  <Image
                    source={{ uri: icon }}
                    style={[styles.icon, { opacity: isIconLoading ? 0 : 1 }]}
                    resizeMode="contain"
                    onLoad={() => setIconsLoading(prev => ({ ...prev, [iconIndex]: false }))}
                    onError={() => setIconsLoading(prev => ({ ...prev, [iconIndex]: false }))}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
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
      
      {/* ברקוד */}
      <View style={styles.barcodeBox}>
        <Barcode value={cardCode} format="CODE128" height={60} />
      </View>
      {/* מספר סידורי */}
      <Text style={styles.cardCode}>#{cardCode}</Text>
      
      {/* מודאל תפריט המבורגר */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuContent}>
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
              
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setMenuVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
                 </TouchableWithoutFeedback>
       </Modal>

       {/* מודאל הודעות דואר */}
       <Modal visible={mailVisible} transparent animationType="slide">
         <View style={styles.modalOverlay}>
           <View style={styles.mailContent}>
             <View style={styles.mailHeader}>
               <Text style={[styles.mailTitle, { color: cardTextColor }]}>הודעות</Text>
               <TouchableOpacity 
                 style={styles.closeX}
                 onPress={() => {
                   setMailVisible(false);
                   setUnreadMessages(0);
                 }}
               >
                 <Text style={styles.closeXText}>×</Text>
               </TouchableOpacity>
             </View>
             
             <ScrollView style={styles.messagesScrollView} showsVerticalScrollIndicator={true}>
               {demoMessages.map((message, index) => (
                 <View key={message.id} style={styles.messageItem}>
                   <View style={styles.messageHeader}>
                     <Text style={styles.messageFrom}>מאת: {message.from}</Text>
                     <Text style={styles.messageNumber}>{index + 1}</Text>
                   </View>
                   <View style={styles.subjectRow}>
                     <Text style={styles.messageSubject}>נושא: {message.subject}</Text>
                     <TouchableOpacity 
                       style={[styles.openButton, { backgroundColor: cardTextColor }]}
                       onPress={() => alert(message.content)}
                     >
                       <Text style={styles.openButtonText}>פתח</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               ))}
             </ScrollView>
             </View>
           </View>
         </Modal>

      {/* חלונית חבר מביא חבר */}
      <Modal visible={referralVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setReferralVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.referralModal, { backgroundColor: 'white' }]}>
                
                {/* כפתור סגירה */}
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setReferralVisible(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>

                {/* כותרת */}
                <Text style={[styles.referralTitle, { color: cardTextColor }]}>
                  חבר מביא חבר
                </Text>

                {/* קוד ההפניה */}
                <View style={styles.referralCodeContainer}>
                  <Text style={styles.referralCodeLabel}>קופון ההזמנה:</Text>
                  <TouchableOpacity 
                    style={styles.referralCodeBox}
                    onPress={async () => {
                      try {
                        const textToCopy = punchCard?.card_number || '';
                        console.log('מנסה להעתיק מספר קופון:', textToCopy);
                        await Clipboard.setStringAsync(textToCopy);
                        console.log('מספר הקופון הועתק בהצלחה');
                        Alert.alert('הקופון הועתק!', `קופון ההזמנה ${textToCopy} הועתק ללוח`);
                      } catch (error) {
                        console.error('שגיאה בהעתקת מספר הקופון:', error);
                        Alert.alert('שגיאה', `לא ניתן להעתיק את הקופון: ${error.message || error}`);
                      }
                    }}
                  >
                    <Text style={[styles.referralCodeText, { color: cardTextColor }]}>
                      {punchCard?.card_number}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.copyButton, { backgroundColor: cardTextColor }]}
                    onPress={async () => {
                      try {
                        const textToCopy = punchCard?.card_number || '';
                        console.log('מנסה להעתיק מכפתור:', textToCopy);
                        await Clipboard.setStringAsync(textToCopy);
                        console.log('הכפתור העתיק בהצלחה');
                        Alert.alert('הקופון הועתק!', `קופון ההזמנה ${textToCopy} הועתק ללוח`);
                      } catch (error) {
                        console.error('שגיאה בהעתקה מכפתור:', error);
                        Alert.alert('שגיאה', `לא ניתן להעתיק את הקופון: ${error.message || error}`);
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
                        const message = `היי, חשבתי לפנק אותך בכרטיסיית ${business?.name}.\nמדובר בכרטיסיית הטבות מדליקה הכוללת הטבות, הגרלות ומתנות. הרבה יותר טוב ממועדון.\nברגע שתוריד את האפליקציה CARDS מהחנות ותירשם יסומן לך אוטומטית ניקוב ראשון חינם כבר (וגם לי).\nקישור להורדת האפליקציה באייפון ובאנדרואיד.\nקופון ההזמנה: ${punchCard?.card_number}`;
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
                        const subject = `הזמנה לכרטיסיית ${business?.name}`;
                        const body = `היי, חשבתי לפנק אותך בכרטיסיית ${business?.name}.\nמדובר בכרטיסיית הטבות מדליקה הכוללת הטבות, הגרלות ומתנות. הרבה יותר טוב ממועדון.\nברגע שתוריד את האפליקציה CARDS מהחנות ותירשם יסומן לך אוטומטית ניקוב ראשון חינם כבר (וגם לי).\nקישור להורדת האפליקציה באייפון ובאנדרואיד.\nקופון ההזמנה: ${punchCard?.card_number}`;
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
                        const text = `היי חברים, חשבתי לשתף אתכם בכרטיסיית ${business?.name} המדהימה!\nמדובר בכרטיסיית הטבות מדליקה הכוללת הטבות, הגרלות ומתנות. הרבה יותר טוב ממועדון.\nתורידו את האפליקציה CARDS והירשמו עם קופון ההזמנה שלי: ${punchCard?.card_number}\nכך נקבל שנינו ניקוב חינם!`;
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#FBF8F8',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF8F8',
  },
  topElementsGroup: {
    transform: [{ translateY: 40 }],
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
    transform: [{ translateY: -40 }],
    fontFamily: 'Rubik',
  },
  iconsBoxTight: {
    marginTop: 0,
    marginBottom: 12,
    transform: [{ translateY: -50 }],
  },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: -64,
  },
  icon: {
    width: 146,
    height: 146,
    marginHorizontal: -40,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  mailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    fontFamily: 'Rubik',
  },
  closeX: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
  },
  closeXText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  messagesScrollView: {
    flex: 1,
    maxHeight: 400,
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
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
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
}); 