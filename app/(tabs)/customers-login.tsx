import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBusiness } from '../../components/BusinessContext';
import MarketingPopup from '../../components/MarketingPopup';
import { useMarketingPopups } from '../../hooks/useMarketingPopups';
const LotteryIcon = require('../../assets/images/LOTTARY.png');
const ShareIcon = require('../../assets/images/SHARE.png');
const PhoneIcon = require('../../assets/images/PHONE.png');
const WhatsappIcon = require('../../assets/images/whatsapp.png');
const ClickIcon = require('../../assets/images/5.png');
const HamburgerIcon = require('../../assets/images/hamburger_menu.png');

const windowWidth = Dimensions.get('window').width;

export default function CustomersLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const [backgroundImageError, setBackgroundImageError] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const { business, loading, refresh: refreshBusiness } = useBusiness();
  const [menuVisible, setMenuVisible] = useState(false);
  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;

  const brandColor = business?.login_brand_color || '#9747FF';

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
    
    // שמירת מספר הטלפון לכניסה הבאה
    try {
      await AsyncStorage.setItem('saved_phone', phone);
    } catch (error) {
      console.error('שגיאה בשמירת מספר טלפון:', error);
    }
    
    router.push(`/(tabs)/PunchCard?phone=${encodeURIComponent(phone)}`);
  };

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF8F8' }}>
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
    <View style={styles(brandColor).container} accessible={false} importantForAccessibility="yes">
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
          </Animated.View>
        </Pressable>
      </Modal>
      {/* לוגו מבודד */}
      <Image
        key={`business-logo-${imageKey}`}
        source={{ uri: business?.logo || 'https://noqfwkxzmvpkorcaymcb.supabase.co/storage/v1/object/public/logos//caedz_last.png' }}
        style={{ 
          width: 170, 
          height: 170, 
          resizeMode: 'contain',
          transform: [{ scale: 0.68 }],
          zIndex: 1
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
        <View style={{ width: windowWidth * 0.8, alignSelf: 'center', marginTop: 48 }}>
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
              style={[styles(brandColor).clickBtn, { backgroundColor: brandColor }]}
              onPress={handleLogin}
              accessibilityLabel="כניסה לכרטיסייה"
              accessibilityRole="button"
              accessibilityHint="לחץ לצפייה בכרטיסייה שלך לאחר הזנת מספר טלפון"
            >
              <Image source={ClickIcon} style={[styles(brandColor).clickIcon, { tintColor: '#fff' }]} />
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles(brandColor).errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}
          {/* הרשמה */}
          <View style={styles(brandColor).registerRow}>
            <TouchableOpacity
              style={styles(brandColor).registerBtn}
              onPress={() => router.push('/(tabs)/newclient_form')}
              accessibilityLabel="הרשמה לכרטיסייה חדשה"
              accessibilityRole="button"
              accessibilityHint="לחץ להרשמה וקבלת כרטיסייה חדשה"
            >
              <Text style={[styles(brandColor).registerText, { color: brandColor }]}>הרשמ/י לקבלת כרטיסייה</Text>
            </TouchableOpacity>
            <View style={{width: 8}} />
            <Text style={styles(brandColor).registerQuestion}>אין לך עדיין כרטיסייה?</Text>
          </View>
          {/* תמונת נושא + קרדיט */}
          <View style={{ alignItems: 'center', marginTop: -28, width: '100%' }}>
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
            {/* קרדיט */}
            <TouchableOpacity
              style={styles(brandColor).credit}
              onPress={() => Linking.openURL('https://yula-digital.com/')}
            >
              <Text style={styles(brandColor).creditText}>כל הזכויות שמורות ליולה דיגיטל@</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* פופאפ שיווקי - entry */}
      <MarketingPopup
        visible={showPopup}
        popup={currentPopup}
        onClose={closePopup}
      />

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
    backgroundColor: '#FBF8F8',
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
  credit: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignSelf: 'center',
  },
  creditText: {
    color: '#000',
    fontSize: 7,
    textAlign: 'center',
    fontWeight: 'bold',
    backgroundColor: 'transparent',
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