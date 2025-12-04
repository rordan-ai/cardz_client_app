import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useRef, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { useBusiness } from '../../components/BusinessContext';

const { width, height } = Dimensions.get('window');

export default function ThankYou() {
  const { business } = useBusiness();
  const router = useRouter();
  const lottieRef = useRef<any>(null);
  const [playCount, setPlayCount] = useState(0);

  // גודל לוגו קבוע - 170px זהה לשאר הדפים
  const logoSize = 170;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { transform: [{ scale: 0.85 }] }]}>
        {/* לוגו */}
        <View style={styles.logoContainer}>
          {business?.logo ? (
            <Image 
              key={`logo-${business.business_code}-${business.logo}`}
              source={{ uri: business.logo }} 
              style={[styles.logo, { width: logoSize, height: logoSize, transform: [{ scale: 0.68 }] }]} 
              resizeMode="contain" 
            />
          ) : null}
        </View>
        {/* שם העסק */}
        {business?.name ? (
          <Text style={styles.businessName}>{business.name}</Text>
        ) : null}
        {/* כותרות */}
        <Text style={styles.title}>ברוכ/ה הבא/ה</Text>
        <Text style={styles.title}>יצרת כרטיסייה חדשה בתוכנית הכרטיסיות של כארדז</Text>
        {/* טקסט הסבר */}
        <Text style={styles.desc}>
          הצטרפותך נרשמה במערכת הדיגיטלית בהצלחה!{"\n"}
          לצפייה בכרטיסייה שלך הקש/י את מספר הנייד שלך במסך הכניסה.{"\n"}
          הכרטיסייה כוללת סימן ברקוד לניקוב דיגיטלי מהיר ועוד כמה הפתעות. מה שנשאר זה להינות.
        </Text>
        {/* קו */}
        <View style={styles.line} />
        {/* מקום ריק לאנימציה - הועבר לפני האנימציה כדי לא לכסות */}
        <View style={{ flex: 1 }} />
        {/* כפתור X לסגירה */}
        <View style={{ position: 'absolute', top: 2, left: 18, zIndex: 20 }}>
          <Text
            onPress={() => router.push('/customers-login')}
            style={{ fontSize: 28, fontWeight: 'bold', color: '#888', padding: 4 }}
          >
            ×
          </Text>
        </View>

        {/* כפתור שנה עסק */}
        <View style={{ position: 'absolute', top: 2, right: 18, zIndex: 20 }}>
          <Text
            onPress={() => router.push('/(tabs)/business_selector')}
            style={{ fontSize: 12, fontWeight: 'bold', color: '#1E51E9', padding: 4 }}
          >
            שנה עסק
          </Text>
        </View>
      </View>
      {/* אנימציה מחוץ ל-container עם scale כדי לא להיות מושפעת */}
      <View style={styles.lottieCenter}>
        <LottieView
          ref={lottieRef}
          source={require('../../assets/images/Animation_2.json')}
          autoPlay
          loop={false}
          style={styles.lottie}
          onAnimationFinish={() => {
            setPlayCount((prev) => {
              if (prev < 1 && lottieRef.current) {
                lottieRef.current.reset && lottieRef.current.reset();
                lottieRef.current.play && lottieRef.current.play();
              }
              return prev + 1;
            });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  container: {
    width: 402,
    height: 874,
    alignSelf: 'center',
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  logoContainer: {
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    borderRadius: 12,
    // גודל יוגדר דינמית
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#070707',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 0,
  },
  desc: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'center',
    lineHeight: 25,
    marginTop: 18,
    marginBottom: 18,
    width: 301,
    alignSelf: 'center',
  },
  line: {
    width: 120,
    height: 2,
    backgroundColor: '#000',
    borderRadius: 1,
    marginBottom: 10,
    alignSelf: 'center',
  },
  lottieCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -165 }, { translateY: -165 }],
    width: 330,
    height: 330,
    zIndex: 30,
    pointerEvents: 'none',
  },
  lottie: {
    width: 330,
    height: 330,
  },
}); 
