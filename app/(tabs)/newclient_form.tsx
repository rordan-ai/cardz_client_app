import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { supabase } from '../../components/supabaseClient';

function Check({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Text style={styles.checkmark}>✓</Text> : null}
    </View>
  );
}

const SCALE = 0.64;

export default function NewClientForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isPrivacy, setIsPrivacy] = useState(false);
  const [businesses, setBusinesses] = useState<{ name: string, id: string }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<{ name: string, id: string } | null>(null);
  const [errorModal, setErrorModal] = useState<{ visible: boolean, message: string }>(
    { visible: false, message: '' }
  );
  const [searchBusiness, setSearchBusiness] = useState('');
  const [businessRequestModal, setBusinessRequestModal] = useState(false);
  const [businessRequestName, setBusinessRequestName] = useState('');
  const [businessRequestCity, setBusinessRequestCity] = useState('');
  const [productSelectionModal, setProductSelectionModal] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<{ product_code: string, product_name: string }[]>([]);
  const [existingCards, setExistingCards] = useState<{ product_code: string, product_name: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ product_code: string, product_name: string } | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('business_code, name')
        .order('name', { ascending: true });
      if (data) setBusinesses(data.map((b: { name: string; business_code: string }) => ({ name: b.name, id: b.business_code })));
    })();
  }, []);

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



  const getBusinessSettings = async (businessCode: string) => {
    try {
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('max_punches, default_product')
        .eq('business_code', businessCode)
        .single();

      if (businessError) {
        return { maxPunches: 10, defaultProduct: '0001' }; // ברירת מחדל 4 ספרות
      }

      const result = {
        maxPunches: businessData?.max_punches || 10,
        defaultProduct: (businessData?.default_product || '0001').toString().padStart(4, '0')
      };
      
      return result;
    } catch (error) {
      return { maxPunches: 10, defaultProduct: '0001' }; // ברירת מחדל 4 ספרות
    }
  };

  const createCardWithProduct = async (productCode: string) => {
    try {
      const businessCode = selectedBusiness?.id;
      const customerPhone = phone;
      
      // בדיקות ערך
      if (!businessCode) {
        return { success: false, error: 'קוד עסק חסר. לא ניתן ליצור כרטיסיה.' };
      }
      if (!customerPhone) {
        return { success: false, error: 'מספר טלפון חסר. לא ניתן ליצור כרטיסיה.' };
      }
      if (!productCode) {
        return { success: false, error: 'קוד מוצר חסר. לא ניתן ליצור כרטיסיה.' };
      }
      
      // יצירת מוצר כללי אוטומטית אם צריך
      if (productCode === '00') {
        const { data: existingGeneral, error: generalError } = await supabase
          .from('products')
          .select('product_code')
          .eq('business_code', businessCode)
          .eq('product_code', '00')
          .single();
        
        if (generalError && generalError.code !== 'PGRST116') {
          // לוג פנימי בלבד
        }
        
        if (!existingGeneral) {
          const { error: insertError } = await supabase.from('products').insert({
            business_code: businessCode,
            product_code: '00',
            product_name: 'מוצר כללי',
            product_type: 'general',
            price: 0
          });
          
          if (insertError) {
            return { success: false, error: 'שגיאה ביצירת מוצר כללי' };
          }
        }
      }
      
      const cardNumber = `${businessCode}${customerPhone}${productCode}`;
      
      const { maxPunches, defaultProduct } = await getBusinessSettings(businessCode);
      
      // בדיקה אם הכרטיסיה כבר קיימת
      const { data: existingCard, error: cardCheckError } = await supabase
        .from('PunchCards')
        .select('*')
        .eq('card_number', cardNumber)
        .single();

      if (cardCheckError && cardCheckError.code !== 'PGRST116') {
        return { 
          success: false, 
          error: 'שגיאה בבדיקת כרטיסיה קיימת' 
        };
      }

      // אם הכרטיסיה לא קיימת, צור אותה
      if (!existingCard) {
        const cardData = {
          card_number: cardNumber,
          business_code: businessCode,
          customer_phone: customerPhone,
          product_code: productCode,
          total_punches: maxPunches,
          used_punches: 0,
          status: 'active'
        };
        
        const { error: cardError } = await supabase.from('PunchCards').insert(cardData);

        if (cardError) {
          return { 
            success: false, 
            error: 'שגיאה ביצירת כרטיסיה' 
          };
        }
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'שגיאה כללית ביצירת כרטיסיה' 
      };
    }
  };

  const checkExistingCardsAndProducts = async (customerPhone: string, businessCode: string) => {
    try {
      // בדיקת כרטיסיות קיימות של הלקוח באותו עסק
      const { data: existingCardsData, error: cardsError } = await supabase
        .from('PunchCards')
        .select('product_code')
        .eq('customer_phone', customerPhone)
        .eq('business_code', businessCode);

      if (cardsError) {
        return { existingCards: [], availableProducts: [] };
      }

      const existingProductCodes = existingCardsData?.map(card => card.product_code) || [];

      // בדיקת כל המוצרים הזמינים בעסק
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('product_code, product_name')
        .eq('business_code', businessCode);
      
      if (productsError) {
        // אם אין מוצרים בטבלה, נחזיר מוצר ברירת מחדל של העסק
        const { defaultProduct } = await getBusinessSettings(businessCode);
        return { 
          existingCards: [], 
          availableProducts: [{ product_code: defaultProduct, product_name: 'מוצר ברירת מחדל' }] 
        };
      }

      // אם אין מוצרים בעסק, נחזיר מוצר ברירת מחדל של העסק
      if (!allProducts || allProducts.length === 0) {
        const { defaultProduct } = await getBusinessSettings(businessCode);
        return { 
          existingCards: [], 
          availableProducts: [{ product_code: defaultProduct, product_name: 'מוצר ברירת מחדל' }] 
        };
      }

      // הפרדת מוצרים קיימים וזמינים
      const existingCards = allProducts?.filter(product => 
        existingProductCodes.includes(product.product_code)
      ) || [];

      const availableProducts = allProducts?.filter(product => 
        !existingProductCodes.includes(product.product_code)
      ) || [];

      return { existingCards, availableProducts };
    } catch (error) {
      try {
        const { defaultProduct } = await getBusinessSettings(businessCode);
        return { 
          existingCards: [], 
          availableProducts: [{ product_code: defaultProduct, product_name: 'מוצר ברירת מחדל' }] 
        };
      } catch {
        return { 
          existingCards: [], 
          availableProducts: [{ product_code: '12', product_name: 'מוצר ברירת מחדל' }] 
        };
      }
    }
  };

  const handleSubmit = async () => {
    
    if (!isPrivacy) {
      setErrorModal({ visible: true, message: 'יש לאשר את מדיניות הפרטיות לפני שליחה' });
      return;
    }
    if (!selectedBusiness) {
      setErrorModal({ visible: true, message: 'יש לבחור עסק לצירוף' });
      return;
    }
    if (!firstName || !lastName || !phone) {
      setErrorModal({ visible: true, message: 'יש למלא את כל השדות החובה' });
      return;
    }
    if (!selectedProduct) {
      setErrorModal({ visible: true, message: 'יש לבחור סוג מוצר לפני השליחה' });
      return;
    }

    try {
      
      // עדכון/יצירה של לקוח (upsert) עבור פרסונליזציה
      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      const { data: upsertedCustomer, error: upsertError } = await supabase
        .from('customers')
        .upsert(
          {
            name: firstName + ' ' + lastName,
            customer_phone: normalizedPhone,
            business_code: selectedBusiness.id
          },
          { onConflict: 'business_code,customer_phone' }
        )
        .select()
        .maybeSingle();
      
      if (upsertError) {
        setErrorModal({ visible: true, message: 'תקלה זמנית במערכת. נסו שוב מאוחר יותר.' });
        return;
      }

      // לאחר upsert, המשך תהליך רגיל
        // אם יש קוד הזמנה - שליחה לטבלת referrals גם עבור לקוח קיים
        if (referralCode && referralCode.trim()) {
          try {
            // פענוח קוד ההזמנה: מספר עסק (4) + טלפון (4) + רנדום (4)
            const businessCode4 = referralCode.slice(0, 4);
            const phoneLast4 = referralCode.slice(4, 8);
            
            // חיפוש המזמין לפי 4 ספרות אחרונות של טלפון ועסק
            const { data: potentialInviters, error: inviterError } = await supabase
              .from('customers')
              .select('customer_phone, business_code')
              .eq('business_code', businessCode4.replace(/^0+/, '') || businessCode4) // ללא אפסים מובילים
              .like('customer_phone', `%${phoneLast4}`);

            if (!inviterError && potentialInviters && potentialInviters.length > 0) {
              // בחירת המזמין הראשון שנמצא (אם יש כמה)
              const inviter = potentialInviters[0];
              
              // יצירת רשומת הזמנה
              const { error: referralError } = await supabase
                .from('referrals')
                .insert({
                  inviter_phone: inviter.customer_phone,
                  invited_phone: phone,
                  business_code: selectedBusiness.id,
                  status: 'pending',
                  referral_date: new Date().toISOString()
                });

              if (referralError) {
                console.error('שגיאה בשליחת קוד הזמנה:', referralError);
                // לא נעצור את התהליך בגלל שגיאה בהזמנה
              }
            }
          } catch (error) {
            console.error('שגיאה בפענוח קוד הזמנה:', error);
            // לא נעצור את התהליך בגלל שגיאה בהזמנה
          }
        }

      const result = await createCardWithProduct((selectedProduct.product_code || '').toString().padStart(4, '0'));
        
        if (result.success) {
          router.push('/(tabs)/thank_you');
        } else {
          setErrorModal({ visible: true, message: 'שגיאה ביצירת כרטיסיה. נסה שוב מאוחר יותר.' });
      }

      // אם יש קוד הזמנה - שליחה לטבלת referrals
      if (referralCode && referralCode.trim()) {
        try {
          // פענוח קוד ההזמנה: מספר עסק (4) + טלפון (4) + רנדום (4)
          const businessCode4 = referralCode.slice(0, 4);
          const phoneLast4 = referralCode.slice(4, 8);
          
          // חיפוש המזמין לפי 4 ספרות אחרונות של טלפון ועסק
          const { data: potentialInviters, error: inviterError } = await supabase
            .from('customers')
            .select('customer_phone, business_code')
            .eq('business_code', businessCode4.replace(/^0+/, '') || businessCode4) // ללא אפסים מובילים
            .like('customer_phone', `%${phoneLast4}`);

          if (!inviterError && potentialInviters && potentialInviters.length > 0) {
            // בחירת המזמין הראשון שנמצא (אם יש כמה)
            const inviter = potentialInviters[0];
            
            // יצירת רשומת הזמנה
            const { error: referralError } = await supabase
              .from('referrals')
              .insert({
                inviter_phone: inviter.customer_phone,
                invited_phone: phone,
                business_code: selectedBusiness.id,
                status: 'pending',
                referral_date: new Date().toISOString()
              });

            if (referralError) {
              console.error('שגיאה בשליחת קוד הזמנה:', referralError);
              // לא נעצור את התהליך בגלל שגיאה בהזמנה
            }
          }
        } catch (error) {
          console.error('שגיאה בפענוח קוד הזמנה:', error);
          // לא נעצור את התהליך בגלל שגיאה בהזמנה
        }
      }

      // (בוטל) יצירת כרטיסיה לאחר הוספת לקוח בוצעה כבר לעיל
    } catch (error) {
      setErrorModal({ visible: true, message: 'תקלה זמנית במערכת- אנו מתנצלים על התקלה ועושים כמיטב יכולתנו לתקנה מהר ככל הניתן. נסו שוב מאוחר יותר . אתכם הסליחה' });
    }
  };

  // פונקציה לעדכון קוד עסק ל-4 ספרות (אם צריך) והוספת מוצר כללי
  const fixBusinessCodeAndAddDefaultProduct = async (businessCode: string) => {
    let fixedCode = businessCode;
    if (businessCode.length === 3) {
      fixedCode = '0' + businessCode;
      // עדכון קוד עסק בכל הטבלאות הרלוונטיות
      await supabase.from('businesses').update({ business_code: fixedCode }).eq('business_code', businessCode);
      await supabase.from('products').update({ business_code: fixedCode }).eq('business_code', businessCode);
      await supabase.from('PunchCards').update({ business_code: fixedCode }).eq('business_code', businessCode);
      await supabase.from('customers').update({ business_code: fixedCode }).eq('business_code', businessCode);
    }
    // הוספת מוצר כללי אם לא קיים
    const { data: existing, error } = await supabase
      .from('products')
      .select('product_code')
      .eq('business_code', fixedCode)
      .eq('product_code', '00')
      .single();
    if (!existing) {
      const { error: insertError } = await supabase.from('products').insert({
        business_code: fixedCode,
        product_code: '00',
        product_name: 'מוצר כללי',
        product_type: 'general',
        price: 0
      });
      if (insertError) {
        // לוג פנימי בלבד
      }
    }
    return fixedCode;
  };

  return (
    <View style={{ flex: 1 }}>
      {/* כפתור חזרה לבחירת עסק */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/business_selector')}
        >
          <Text style={styles.backButtonText}>← שנה עסק</Text>
        </TouchableOpacity>
        {selectedBusiness && (
          <Text style={styles.selectedBusinessText}>
            עסק נבחר: {selectedBusiness.name}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.container, { marginTop: '25%' }]}
        keyboardShouldPersistTaps="handled">
        <View style={{ width: 288, alignSelf: 'center' }}>
          <Text style={styles.title}>ברוכים הבאים לכרטיסיית ההטבות שלכם!</Text>
          <Text style={styles.subtitle}>נא מלאו את הפרטים ולחצו "שלח"</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם פרטי*</Text>
            <TextInput 
              ref={firstNameInputRef}
              style={styles.input} 
              value={firstName} 
              onChangeText={setFirstName} 
              textAlign="right"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                // מעבר לשדה שם משפחה
                lastNameInputRef.current?.focus();
              }}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם משפחה*</Text>
            <TextInput 
              ref={lastNameInputRef}
              style={styles.input} 
              value={lastName} 
              onChangeText={setLastName} 
              textAlign="right"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                // מעבר לשדה הטלפון
                phoneInputRef.current?.focus();
              }}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>מספר טלפון נייד*</Text>
            <TextInput 
              ref={phoneInputRef}
              style={styles.input} 
              value={phone} 
              onChangeText={(text) => {
                setPhone(text);
                // סגור את המקלדת אחרי מספר טלפון מלא (10 ספרות)
                if (text.length === 10) {
                  Keyboard.dismiss();
                  phoneInputRef.current?.blur();
                }
              }} 
              keyboardType="phone-pad" 
              textAlign="right"
              returnKeyType="done"
              blurOnSubmit={true}
              maxLength={10}
              onSubmitEditing={() => {
                // סגור את המקלדת כשלוחצים Done
                Keyboard.dismiss();
                phoneInputRef.current?.blur();
              }}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם העסק לצירוף*</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <TextInput
                style={styles.input}
                value={selectedBusiness ? selectedBusiness.name : ''}
                placeholder="בחר/י עסק"
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>סוג המוצר*</Text>
            <TouchableOpacity onPress={() => {
              if (!selectedBusiness) {
                setErrorModal({ visible: true, message: 'יש לבחור עסק תחילה' });
                return;
              }
              // סגור את המקלדת לפני פתיחת הדיאלוג
              Keyboard.dismiss();
              phoneInputRef.current?.blur();
              
              // אם עדיין אין מוצרים זמינים, טען אותם עכשיו
              if (availableProducts.length === 0) {
                // טעינת מוצרים עבור העסק הנבחר
                const fetchProducts = async () => {
                  const { data: allProducts, error } = await supabase
                    .from('products')
                    .select('product_code, product_name')
                    .eq('business_code', selectedBusiness.id);
                  
                  if (error) {
                    setAvailableProducts([{ product_code: '00', product_name: 'מוצר כללי' }]);
                  } else if (allProducts && allProducts.length > 0) {
                    setAvailableProducts(allProducts);
                  } else {
                    setAvailableProducts([{ product_code: '00', product_name: 'מוצר כללי' }]);
                  }
                  setProductSelectionModal(true);
                };
                fetchProducts();
              } else {
                setProductSelectionModal(true);
              }
            }}>
              <View style={styles.input}>
                <Text style={[styles.inputText, { color: selectedProduct ? '#000' : '#999' }]}>
                  {selectedProduct ? selectedProduct.product_name : 'בחר/י סוג מוצר'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* שדות אופציונליים - שורה של שני עמודים */}
          <View style={styles.rowInputGroup}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>ת. יום הולדת</Text>
              <TextInput 
                style={styles.input} 
                value={birthDate} 
                onChangeText={(text) => {
                  // הסרת כל מה שאינו מספר
                  const numbersOnly = text.replace(/[^0-9]/g, '');
                  
                  // פורמט אוטומטי עם סלשים
                  let formatted = numbersOnly;
                  if (numbersOnly.length >= 3) {
                    formatted = numbersOnly.slice(0, 2) + '/' + numbersOnly.slice(2);
                  }
                  if (numbersOnly.length >= 5) {
                    formatted = numbersOnly.slice(0, 2) + '/' + numbersOnly.slice(2, 4) + '/' + numbersOnly.slice(4, 8);
                  }
                  
                  setBirthDate(formatted);
                }} 
                placeholder="DD/MM/YYYY"
                textAlign="right"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>קוד חבר שהזמין</Text>
              <TextInput 
                style={styles.input} 
                value={referralCode} 
                onChangeText={setReferralCode} 
                placeholder="קוד כרטיסיית חבר"
                textAlign="right"
              />
            </View>
          </View>
          
          <Modal visible={modalVisible} transparent animationType="fade">
            <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 8, maxHeight: 350, width: 260, padding: 8 }}>
                          <TextInput
          style={{
            height: 36,
            borderColor: '#E0E0E0',
            borderWidth: 1,
            borderRadius: 6,
            marginBottom: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            fontSize: 14,
            textAlign: 'right',
            textAlignVertical: 'center',
          }}
          placeholder="התחל/י להקליד את שם העסק"
          value={searchBusiness}
          onChangeText={setSearchBusiness}
          autoFocus
        />
                  <FlatList
                    data={businesses.filter(b => b.name.includes(searchBusiness))}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity onPress={() => { 
                        setSelectedBusiness(item); 
                        setSelectedProduct(null); // איפוס המוצר שנבחר כי העסק השתנה
                        setAvailableProducts([]); // איפוס רשימת המוצרים כדי שיטענו מחדש
                        setModalVisible(false); 
                        setSearchBusiness(''); 
                      }}>
                        <Text style={{ padding: 16, fontSize: 15, textAlign: 'right' }}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                                         ListEmptyComponent={
                       searchBusiness.length >= 3 ? (
                         <View style={{ padding: 16, alignItems: 'center' }}>
                           <Text style={{ textAlign: 'center', color: '#888', marginBottom: 12 }}>
                             לא מצאת את בית העסק? מעונינ/ת לשלוח לו בקשת הצטרפות לתוכנית?
                           </Text>
                           <TouchableOpacity
                             style={{
                               backgroundColor: '#1E51E9',
                               paddingHorizontal: 16,
                               paddingVertical: 8,
                               borderRadius: 6,
                             }}
                             onPress={() => {
                               setModalVisible(false);
                               setBusinessRequestModal(true);
                             }}
                           >
                             <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                               שלח בקשה
                             </Text>
                           </TouchableOpacity>
                         </View>
                       ) : (
                         <Text style={{ textAlign: 'center', color: '#888', padding: 16 }}>
                           לא נמצאו עסקים
                         </Text>
                       )
                     }
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>


          <View style={styles.checkRow}>
            <TouchableOpacity onPress={() => setIsPrivacy(v => !v)}>
              <Check checked={isPrivacy} />
            </TouchableOpacity>
            <Text style={styles.checkLabel}>
              קראתי ומאשר את <Text style={styles.privacyLink} onPress={() => Linking.openURL('https://yula-digital.com/')}>מדיניות הפרטיות</Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>שלח</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.creditAbsolute} onPress={() => Linking.openURL('https://yula-digital.com/')}>
        <Text style={styles.credit}>כל הזכויות שמורות ליולה דיגיטל@</Text>
      </TouchableOpacity>
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal({ visible: false, message: '' })}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 28, minWidth: 240, alignItems: 'center', position: 'relative' }}>
            <TouchableOpacity 
              onPress={() => {
                setErrorModal({ visible: false, message: '' });
              }} 
              style={{ 
                position: 'absolute', 
                top: 8, 
                right: 8, 
                width: 24, 
                height: 24, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Text style={{ color: '#666', fontSize: 20, fontWeight: 'bold' }}>×</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FF6600', fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginBottom: 12, marginTop: 20 }}>{errorModal.message}</Text>
          </View>
        </View>
      </Modal>

      {/* דיאלוג בקשת הצטרפות עסק */}
      <Modal visible={businessRequestModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setBusinessRequestModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 300 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
                שלח בקשת הצטרפות העסק לכרטיסייה שלך
              </Text>
              
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, textAlign: 'right' }}>
                  שם העסק*
                </Text>
                <TextInput
                  style={{
                    height: 40,
                    borderColor: '#E0E0E0',
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    fontSize: 14,
                    textAlign: 'right',
                  }}
                  value={businessRequestName}
                  onChangeText={setBusinessRequestName}
                  placeholder="שם העסק"
                />
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, textAlign: 'right' }}>
                  עיר*
                </Text>
                <TextInput
                  style={{
                    height: 40,
                    borderColor: '#E0E0E0',
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    fontSize: 14,
                    textAlign: 'right',
                  }}
                  value={businessRequestCity}
                  onChangeText={setBusinessRequestCity}
                  placeholder="עיר"
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#E0E0E0',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 6,
                    flex: 1,
                    marginRight: 8,
                  }}
                  onPress={() => {
                    setBusinessRequestModal(false);
                    setBusinessRequestName('');
                    setBusinessRequestCity('');
                  }}
                >
                  <Text style={{ color: '#666', fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
                    ביטול
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#1E51E9',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 6,
                    flex: 1,
                    marginLeft: 8,
                  }}
                  onPress={async () => {
                    if (!businessRequestName || !businessRequestCity) {
                      setErrorModal({ visible: true, message: 'יש למלא את כל השדות' });
                      return;
                    }

                    try {
                      const { error } = await supabase.from('business_requests').insert({
                        customer_name: firstName + ' ' + lastName,
                        customer_phone: phone,
                        business_name: businessRequestName,
                        business_city: businessRequestCity,
                        status: 'pending'
                      });

                      if (error) {
                        setErrorModal({ visible: true, message: 'תקלה זמנית במערכת- אנו מתנצלים על התקלה ועושים כמיטב יכולתנו לתקנה מהר ככל הניתן. נסו שוב מאוחר יותר . אתכם הסליחה' });
                        return;
                      }

                      setBusinessRequestModal(false);
                      setBusinessRequestName('');
                      setBusinessRequestCity('');
                      setErrorModal({ visible: true, message: 'הבקשה נשלחה בהצלחה- במידה ובית העסק יצטרף לתוכנית תקבל על כך הודעה ותתווסף לך כרטיסייה חדשה בבית עסק זה באופן אוטמטי. תודה.' });
                    } catch (error) {
                      setErrorModal({ visible: true, message: 'תקלה זמנית במערכת- אנו מתנצלים על התקלה ועושים כמיטב יכולתנו לתקנה מהר ככל הניתן. נסו שוב מאוחר יותר . אתכם הסליחה' });
                    }
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
                    שלח בקשה
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* דיאלוג בחירת מוצר */}
      <Modal visible={productSelectionModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setProductSelectionModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 8, maxHeight: 400, width: 280, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'right', flex: 1 }}>
                  בחר/י סוג מוצר
                </Text>
                <TouchableOpacity onPress={() => setProductSelectionModal(false)}>
                  <Text style={{ fontSize: 20, color: '#666' }}>×</Text>
                </TouchableOpacity>
              </View>

              {availableProducts.length > 0 ? (
                <View>
                  <FlatList
                    data={availableProducts}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={{
                          padding: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: '#eee',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onPress={() => {
                          setSelectedProduct(item);
                          setProductSelectionModal(false);
                          // וודא שהמקלדת לא תעלה מחדש
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={{ fontSize: 14, color: '#333', textAlign: 'right', flex: 1 }}>{item.product_name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              ) : (
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
                    אין מוצרים זמינים עבור העסק שנבחר
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 31 : 15,
    paddingBottom: 15,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'right',
    marginBottom: 5,
    width: '100%',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'right',
    marginBottom: 15,
    width: '100%',
  },
  inputGroup: {
    marginBottom: 10,
    alignItems: 'flex-end',
    width: '100%',
  },
  rowInputGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    width: '100%',
  },
  halfInput: {
    width: '48%',
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'right',
    marginBottom: 2,
    width: '100%',
  },
  input: {
    height: 35,
    backgroundColor: '#F1F1F1',
    borderRadius: 4,
    fontSize: 11,
    paddingHorizontal: 10,
    textAlign: 'right',
    width: '100%',
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 11,
    textAlign: 'right',
    paddingHorizontal: 10,
  },
  checkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 5,
    justifyContent: 'flex-end',
    width: '100%',
    paddingRight: 14,
  },
  checkbox: {
    width: 13,
    height: 14,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#060606',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  checkboxChecked: {
    backgroundColor: '#E6E6E6',
  },
  checkmark: {
    color: '#060606',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 13,
  },
  checkLabel: {
    fontSize: 9,
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'right',
    width: '100%',
  },
  privacyLink: {
    color: '#1E51E9',
    textDecorationLine: 'underline',
    fontSize: 9,
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 4,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Rubik',
    width: '100%',
    textAlign: 'center',
  },
  credit: {
    fontSize: 8,
    color: '#0A0000',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 10,
    fontFamily: 'Rubik',
    width: '100%',
  },
  creditAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 31 : 15,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 10,
    paddingBottom: 5,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
  },
  backButtonText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#000',
  },
  selectedBusinessText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Rubik',
    color: '#000',
    textAlign: 'right',
  },
}); 