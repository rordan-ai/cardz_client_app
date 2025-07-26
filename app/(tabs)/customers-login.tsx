import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBusiness } from '../../components/BusinessContext';
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
  const slideAnim = useState(new Animated.Value(-200))[0];

  const brandColor = business?.login_brand_color || '#9747FF';

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
    loadSavedPhone();
  }, []);

  // הסרת כל הקוד המסובך - חזרה לפשטות
  useEffect(() => {
    // איפוס שגיאות תמונה כשהעסק משתנה
    if (business) {
      setBackgroundImageError(false);
      
      // Preload תמונות לשיפור הביצועים
      if (business.login_background_image) {
        const cleanUrl = business.login_background_image.trim().replace(/[\r\n\t]/g, '');
        if (cleanUrl) {
          Image.prefetch(cleanUrl).catch(() => {});
        }
      }
    }
  }, [business?.business_code, business?.login_background_image]);

  // איפוס שגיאת תמונה כשהכתובת משתנה
  useEffect(() => {
    setBackgroundImageError(false);
    setImageKey(prev => prev + 1); // כפיית רענון התמונה
  }, [business?.login_background_image]);



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
    }
  };

  const handlePhoneCall = () => {
    if (business?.business_phone) {
      const phone = business.business_phone.replace(/[^0-9]/g, '');
      const url = `tel:${phone}`;
      Linking.openURL(url);
    }
  };

  const handleShareWhatsapp = () => {
    if (business?.name) {
      const message = `היי, שמעת על הכרטיסייה האלקטרונית של ${business.name}? מעבר להטבה על מספר ניקובים יש שם הגרלות והפתעות, משקיעים בנו 😉.`;
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF8F8' }}>
        <LottieView
          source={{ uri: 'https://cdn.lottielab.com/l/CeHEQyB7hKAF1h.json' }}
          autoPlay
          loop
          style={{ width: 120, height: 120 }}
        />
        <Text style={{ color: '#A39393', fontSize: 16, marginTop: 16, fontFamily: 'Rubik' }}>טוען נתוני עסק...</Text>
      </View>
    );
  }

  return (
    <View style={styles(brandColor).container}>
      {/* אייקון המבורגר ממורכז בראש הדף */}
      <TouchableOpacity onPress={openMenu} style={{ alignSelf: 'center', marginTop: 0, marginBottom: 4 }}>
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
            {/* אייקון וואטסאפ */}
            <TouchableOpacity onPress={handleWhatsappChat}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 18 }}>
                <Image source={WhatsappIcon} style={{ width: 28, height: 28, marginLeft: 12, tintColor: brandColor }} />
                <Text style={{ fontSize: 16, color: brandColor, fontWeight: 'bold', fontFamily: 'Rubik' }}>צ'וטט איתנו</Text>
              </View>
            </TouchableOpacity>
            {/* אייקון טלפון */}
            <TouchableOpacity onPress={handlePhoneCall}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 18 }}>
                <Image source={PhoneIcon} style={{ width: 28, height: 28, marginLeft: 12, tintColor: brandColor }} />
                <Text style={{ fontSize: 16, color: brandColor, fontWeight: 'bold', fontFamily: 'Rubik' }}>צלצל אלינו</Text>
              </View>
            </TouchableOpacity>
            {/* אייקון חץ */}
            <TouchableOpacity onPress={handleShareWhatsapp}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 18 }}>
                <Image source={ShareIcon} style={{ width: 28, height: 28, marginLeft: 12, tintColor: brandColor }} />
                <Text style={{ fontSize: 16, color: brandColor, fontWeight: 'bold', fontFamily: 'Rubik' }}>שתפ/י חבר/ה</Text>
              </View>
            </TouchableOpacity>
            {/* אייקון הגרלות */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Image source={LotteryIcon} style={{ width: 28, height: 28, marginLeft: 12, tintColor: brandColor }} />
              <Text style={{ fontSize: 16, color: brandColor, fontWeight: 'bold', fontFamily: 'Rubik' }}>הגרלות והפתעות</Text>
            </View>
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
          transform: [{ scale: 0.68 }]
        }}
      />
              {/* שאר התוכן יורד למטה */}
      <View style={{ width: '100%', marginTop: 4, alignItems: 'center' }}>
        {/* שם העסק */}
        <Text style={styles(brandColor).businessName}>{business?.name || ''}</Text>
        {/* טקסט כותרת */}
        <Text style={styles(brandColor).mainTitle}>הכרטיסייה שלי</Text>
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
              />
            </View>
            <TouchableOpacity
              style={[styles(brandColor).clickBtn, { backgroundColor: brandColor }]}
              onPress={handleLogin}
              accessibilityLabel="הקלק לכניסה"
            >
              <Image source={ClickIcon} style={[styles(brandColor).clickIcon, { tintColor: '#fff' }]} />
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles(brandColor).errorText}>{error}</Text> : null}
          {/* הרשמה */}
          <View style={styles(brandColor).registerRow}>
            <TouchableOpacity
              style={styles(brandColor).registerBtn}
              onPress={() => router.push('/(tabs)/newclient_form')}
            >
              <Text style={[styles(brandColor).registerText, { color: brandColor }]}>הרשמ/י לקבלת כרטיסייה</Text>
            </TouchableOpacity>
            <View style={{width: 8}} />
            <Text style={styles(brandColor).registerQuestion}>אין לך עדיין כרטיסייה?</Text>
          </View>
          {/* תמונת נושא + קרדיט */}
          <View style={{ alignItems: 'center', marginTop: -28, width: '100%' }}>
            {/* שטח מגע נסתר לבדיקה - ממורכז על פולי הקפה */}
            <TouchableOpacity
              style={{ position: 'absolute', top: '50%', left: '50%', width: 60, height: 60, marginLeft: -30, marginTop: -30, opacity: 0, zIndex: 1 }}
              onPress={() => router.push('/(tabs)/thank_you')}
              accessible={false}
            />
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