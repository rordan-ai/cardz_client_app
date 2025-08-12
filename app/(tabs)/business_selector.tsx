import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useBusiness } from '../../components/BusinessContext';
import { supabase } from '../../components/supabaseClient';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 1024 && height >= 768;

export default function BusinessSelector() {
  const [businesses, setBusinesses] = useState<{ name: string, id: string, logo?: string }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchBusiness, setSearchBusiness] = useState('');
  const { setBusinessCode } = useBusiness();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('business_code, name, logo')
        .order('name', { ascending: true });
      if (data) setBusinesses(data.map((b: { name: string; business_code: string; logo?: string }) => ({ name: b.name, id: b.business_code, logo: b.logo })));
    })();
  }, []);

  const selectBusiness = async (businessItem: { id: string; name: string; logo?: string }) => {
    await setBusinessCode(businessItem.id);
    setModalVisible(false);
    setSearchBusiness('');
    router.push('/(tabs)/customers-login');
  };

  const handleMenuOption = (option: string) => {
    setMenuVisible(false);

  };

  return (
    <View style={styles.container}>
      {/* התמונה הסופית שלך עם שטחי מגע */}
      <ImageBackground
        source={require('../../assets/images/cardz_home_bg.jpg.png')}
        style={[styles.backgroundImage, isTablet && styles.tabletBackgroundImage]}
        resizeMode="cover"
      >
        {/* שטח מגע תפריט המבורגר - למעלה ימין */}
        <TouchableOpacity 
          style={[styles.hamburgerArea, isTablet && styles.tabletHamburgerArea]} 
          onPress={() => setMenuVisible(true)}
        />

        {/* כפתור "בחר עסק" - הכפתור הוורוד במרכז */}
        <TouchableOpacity 
          style={[styles.selectBusinessArea, isTablet && styles.tabletSelectBusinessArea]} 
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.svgButtonWrapper}>
            <Svg width={isTablet ? "192" : "161"} height={isTablet ? "58" : "48"} viewBox="0 0 201 60" fill="none">
              <Rect x="0.5" y="0.5" width="200" height="59" rx="29.5" fill="#D32771"/>
              <Rect x="0.5" y="0.5" width="200" height="59" rx="29.5" stroke="white"/>
              <Path d="M59.2607 28.9121C59.2607 30.2585 58.9886 31.5368 58.4443 32.7471C57.9001 33.9574 57.1302 35.0423 56.1348 36.002C55.1393 36.9544 53.9577 37.7171 52.5898 38.29V36.0234C54.0866 35.3503 55.236 34.4157 56.0381 33.2197C56.8473 32.0166 57.252 30.6702 57.252 29.1807C57.252 28.221 57.0407 27.5586 56.6182 27.1934C56.2028 26.8281 55.4831 26.6455 54.459 26.6455H48.8086V24.8193H54.373C56.1419 24.8193 57.3988 25.138 58.1436 25.7754C58.8883 26.4056 59.2607 27.4512 59.2607 28.9121ZM51.333 29.4385V42.1357H49.3564V29.4385H51.333ZM61.8926 31.0928C61.8926 30.5127 61.9391 29.929 62.0322 29.3418C62.1325 28.7474 62.2614 28.2103 62.4189 27.7305C62.5837 27.2507 62.7591 26.889 62.9453 26.6455H61.0117V24.8193H68.1445C70.1211 24.8193 71.5391 25.2419 72.3984 26.0869C73.2578 26.9248 73.6875 28.3213 73.6875 30.2764V31.2217C73.6875 33.5133 73.1719 35.2536 72.1406 36.4424C71.1165 37.624 69.6162 38.2148 67.6396 38.2148C65.6774 38.2148 64.2272 37.6634 63.2891 36.5605C62.3581 35.4505 61.8926 33.7533 61.8926 31.4688V31.0928ZM64.707 26.6455C64.2272 27.4906 63.9873 28.9443 63.9873 31.0068V31.5762C63.9873 33.1517 64.3024 34.3477 64.9326 35.1641C65.57 35.9805 66.4867 36.3887 67.6826 36.3887C69.0505 36.3887 70.0387 35.984 70.6475 35.1748C71.2633 34.3656 71.5713 33.0407 71.5713 31.2002V30.2549C71.5713 28.9229 71.3171 27.9883 70.8086 27.4512C70.3001 26.9141 69.4049 26.6455 68.123 26.6455H64.707ZM75.3418 36.2598C77.3255 36.2598 78.8796 36.0771 80.0039 35.7119L76.0186 24.8193H78.1992L81.7227 34.874C82.3958 34.3942 82.9365 33.7533 83.3447 32.9512C83.7601 32.1419 84.0609 31.082 84.2471 29.7715C84.4404 28.4609 84.5371 26.8102 84.5371 24.8193H86.6104C86.6104 28.1279 86.2594 30.7204 85.5576 32.5967C85.085 33.8428 84.4225 34.874 83.5703 35.6904C82.7181 36.4997 81.6188 37.1227 80.2725 37.5596C78.9333 37.9893 77.2897 38.2542 75.3418 38.3545V36.2598ZM97.6211 35.959C97.3776 36.6823 96.9909 37.2051 96.4609 37.5273C95.931 37.8424 95.0967 38 93.958 38H93.8398V36.1738H94.0225C94.5166 36.1738 94.9105 36.0807 95.2041 35.8945C95.4906 35.7083 95.6947 35.4255 95.8164 35.0459C95.9382 34.6592 95.999 34.0755 95.999 33.2949V26.6455H93.958V24.8193H101.08C103.057 24.8193 104.475 25.2419 105.334 26.0869C106.193 26.9248 106.623 28.3213 106.623 30.2764V38H104.646V30.2549C104.646 28.9372 104.378 28.0062 103.841 27.4619C103.311 26.9176 102.383 26.6455 101.059 26.6455H97.9756V32.8975C97.9756 34.2152 97.8574 35.2357 97.6211 35.959ZM117.72 30.2764V38H115.732V30.2549C115.732 28.9515 115.467 28.0241 114.938 27.4727C114.415 26.9212 113.494 26.6455 112.177 26.6455H108.148V24.8193H112.198C113.516 24.8193 114.579 25.0055 115.389 25.3779C116.198 25.7432 116.789 26.3268 117.161 27.1289C117.534 27.9238 117.72 28.973 117.72 30.2764ZM123.993 24.8193V31.748H122.017V24.8193H123.993ZM136.594 30.2549C136.594 28.9515 136.329 28.0241 135.799 27.4727C135.276 26.9212 134.356 26.6455 133.038 26.6455H129.708V38H127.731V24.8193H133.06C135.036 24.8193 136.451 25.2419 137.303 26.0869C138.155 26.932 138.581 28.3285 138.581 30.2764V38H136.594V30.2549ZM152.729 36.1738V38H141.224V36.1738H149.323V30.2549C149.323 28.9372 149.055 28.0062 148.518 27.4619C147.988 26.9176 147.067 26.6455 145.757 26.6455H141.729V24.8193H145.778C147.755 24.8193 149.169 25.2419 150.021 26.0869C150.874 26.932 151.3 28.3285 151.3 30.2764V36.1738H152.729Z" fill="white"/>
            </Svg>
          </View>
        </TouchableOpacity>

        {/* שטח מגע קישור קרדיט - הטקסט למטה */}
        <TouchableOpacity 
          style={[styles.creditsArea, isTablet && styles.tabletCreditsArea]} 
          onPress={() => Linking.openURL('https://yula-digital.com/')}
        />
      </ImageBackground>

      {/* דיאלוג תפריט המבורגר */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuContent, isTablet && styles.tabletMenuContent]}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('business_login')}
              >
                <Text style={styles.menuItemText}>כניסת בעלי עסקים</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('tutorial_video')}
              >
                <Text style={styles.menuItemText}>סרטון הסבר</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('contact')}
              >
                <Text style={styles.menuItemText}>צור קשר</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('privacy_policy')}
              >
                <Text style={styles.menuItemText}>מדיניות פרטיות</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setMenuVisible(false)}
              >
                <Text style={styles.closeButtonText}>סגור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* דיאלוג בחירת עסק */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && styles.tabletModalContent]}>
              <Text style={styles.modalTitle}>בחר עסק</Text>
              
              <TextInput
                style={styles.searchInput}
                placeholder="חפש עסק..."
                value={searchBusiness}
                onChangeText={setSearchBusiness}
                textAlign="right"
                autoFocus
              />
              
              <FlatList
                data={businesses.filter(b => b.name.includes(searchBusiness))}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.businessItem}
                    onPress={() => selectBusiness(item)}
                  >
                    <View style={styles.businessItemContent}>
                      <Text style={styles.businessName}>{item.name}</Text>
                      {item.logo && (
                        <Image
                          source={{ uri: item.logo }}
                          style={styles.businessLogo}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>לא נמצאו עסקים</Text>
                }
              />
              
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>סגור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletBackgroundImage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },

  // New touchable areas
  hamburgerArea: {
    position: 'absolute',
    top: 162,
    right: 155,
    width: 47,
    height: 47,
    backgroundColor: 'transparent',
    borderRadius: 5,
  },
  selectBusinessArea: {
    position: 'absolute',
    bottom: 85,
    left: '50%',
    marginLeft: -80.5, // Half of 161px width
    width: 161,
    height: 48,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsArea: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    marginLeft: -120,
    width: 240,
    height: 30,
    backgroundColor: 'transparent',
    borderRadius: 5,
  },

  // Tablet-specific styles
  tabletHamburgerArea: {
    top: 106,
    right: 100,
    width: 66,
    height: 66,
    backgroundColor: 'transparent',
  },
  tabletSelectBusinessArea: {
    bottom: 120,
    left: '50%',
    marginLeft: -96, // Half of 192px width
    width: 192,
    height: 58,
  },
  tabletCreditsArea: {
    bottom: 40,
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 40,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxHeight: '70%',
  },
  tabletModalContent: {
    width: '60%',
    maxHeight: '80%',
    padding: 30,
  },
  menuContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '70%',
  },
  tabletMenuContent: {
    width: '50%',
    padding: 30,
  },
  menuItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    textAlign: 'right',
  },
  businessItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  businessItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  businessLogo: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  businessName: {
    fontSize: 16,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
  },
  closeButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#267884',
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  svgButtonWrapper: {
    transform: [
      { translateX: -width * 0.02 }, // 2% של רוחב המסך שמאלה
      { translateY: -height * 0.02 }  // 2% של גובה המסך למעלה
    ],
  },
}); 