
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
        style={[styles.backgroundImage, isTablet && styles.tabletBackgroundImage, { transform: [{ translateY: -7 }] }]}
        resizeMode="cover"
      >
        {/* שטח מגע תפריט המבורגר - למעלה ימין */}
        <TouchableOpacity 
          style={[styles.hamburgerArea, isTablet && styles.tabletHamburgerArea]} 
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="פתח תפריט"
        >
        </TouchableOpacity>

        {/* שטח מגע כפתור "בחר עסק" - הכפתור הוורוד במרכז */}
        <TouchableOpacity 
          style={[styles.selectBusinessArea, isTablet && styles.tabletSelectBusinessArea]} 
          onPress={() => setModalVisible(true)}
        />

        {/* שטח מגע קישור קרדיט - הטקסט למטה */}
        <TouchableOpacity 
          style={[styles.creditsArea, isTablet && styles.tabletCreditsArea]} 
          onPress={() => Linking.openURL('https://yula-digital.com/')}
        />
      </ImageBackground>

      {/* דיאלוג תפריט המבורגר */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={[styles.modalOverlay, { transform: [{ translateY: -7 }] }]}>
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
          <View style={[styles.modalOverlay, { transform: [{ translateY: -7 }] }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    width: 28,
    height: 28,
    alignSelf: 'center',
    marginTop: 8,
    tintColor: '#ffffff',
  },
  selectBusinessArea: {
    position: 'absolute',
    bottom: 85,
    left: '50%',
    marginLeft: -94,
    width: 160,
    height: 50,
    backgroundColor: 'transparent',
    borderRadius: 25,
  },
  creditsArea: {
    position: 'absolute',
    bottom: 27,
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
    marginLeft: -100,
    width: 200,
    height: 60,
  },
  tabletCreditsArea: {
    bottom: 47,
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
  creditsText: {
    color: '#000',
    fontSize: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    position: 'absolute',
    bottom: -7,
    left: 0,
    right: 0,
  },
}); 