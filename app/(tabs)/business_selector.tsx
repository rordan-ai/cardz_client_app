
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useBusiness } from '../../components/BusinessContext';
import { supabase } from '../../components/supabaseClient';
import TutorialSlideshow from '../../components/TutorialSlideshow';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 1024 && height >= 768;

export default function BusinessSelector() {
  const [businesses, setBusinesses] = useState<{ name: string, id: string, logo?: string }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [accessibilityVisible, setAccessibilityVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
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
    
    switch (option) {
      case 'contact':
        Linking.openURL('https://wa.me/972552482442');
        break;
      case 'accessibility':
        setAccessibilityVisible(true);
        break;
      case 'privacy_policy':
        setPrivacyVisible(true);
        break;
      case 'tutorial_video':
        setTutorialVisible(true);
        break;
    }
  };

  return (
    <View style={styles.container}>
      {/* התמונה הסופית שלך עם שטחי מגע */}
      <ImageBackground
        source={require('../../assets/images/new_entry.png')}
        style={[styles.backgroundImage, isTablet && styles.tabletBackgroundImage]}
        resizeMode="cover"
      >
        {/* שטח מגע תפריט המבורגר - למעלה ימין */}
        <TouchableOpacity 
          style={[styles.hamburgerArea, isTablet && styles.tabletHamburgerArea]} 
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="פתח תפריט ראשי"
          accessibilityRole="button"
          accessibilityHint="לחץ לפתיחת תפריט עם אפשרויות נוספות"
        >
        </TouchableOpacity>

        {/* שטח מגע כפתור "בחר עסק" - הכפתור הוורוד במרכז */}
        <TouchableOpacity 
          style={[styles.selectBusinessArea, isTablet && styles.tabletSelectBusinessArea]} 
          onPress={() => setModalVisible(true)}
          accessibilityLabel="בחר עסק"
          accessibilityRole="button"
          accessibilityHint="לחץ לבחירת העסק שברצונך לצפות בכרטיסייה שלו"
        />

        {/* שטח מגע קישור קרדיט - הטקסט למטה */}
        <TouchableOpacity 
          style={[styles.creditsArea, isTablet && styles.tabletCreditsArea]} 
          onPress={() => Linking.openURL('https://yula-digital.com/')}
          accessibilityLabel="אתר יולה דיגיטל"
          accessibilityRole="link"
          accessibilityHint="לחץ לפתיחת אתר החברה המפתחת"
        />
      </ImageBackground>

      {/* דיאלוג תפריט המבורגר */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuContent, isTablet && styles.tabletMenuContent]}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('tutorial_video')}
                accessibilityLabel="הדגמה והסבר"
                accessibilityRole="button"
                accessibilityHint="לחץ לצפייה במצגת הסבר על האפליקציה"
              >
                <Text style={styles.menuItemText}>הדגמה והסבר</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('privacy_policy')}
                accessibilityLabel="מדיניות פרטיות"
                accessibilityRole="button"
                accessibilityHint="לחץ לצפייה במדיניות הפרטיות"
              >
                <Text style={styles.menuItemText}>מדיניות פרטיות</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('accessibility')}
                accessibilityLabel="הצהרת נגישות"
                accessibilityRole="button"
                accessibilityHint="לחץ לצפייה בהצהרת הנגישות של האפליקציה"
              >
                <Text style={styles.menuItemText}>הצהרת נגישות</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuOption('contact')}
                accessibilityLabel="צור קשר בוואטסאפ"
                accessibilityRole="button"
                accessibilityHint="לחץ לפתיחת שיחת וואטסאפ עם התמיכה"
              >
                <Text style={styles.menuItemText}>צור קשר</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setMenuVisible(false)}
                accessibilityLabel="סגור תפריט"
                accessibilityRole="button"
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
              <Text style={styles.modalTitle} accessibilityRole="header">בחר עסק</Text>
              
              <TextInput
                style={styles.searchInput}
                placeholder="חפש עסק..."
                value={searchBusiness}
                onChangeText={setSearchBusiness}
                textAlign="right"
                autoFocus
                accessibilityLabel="חיפוש עסק"
                accessibilityHint="הקלד שם עסק לחיפוש ברשימה"
              />
              
              <FlatList
                data={businesses.filter(b => b.name.includes(searchBusiness))}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.businessItem}
                    onPress={() => selectBusiness(item)}
                    accessibilityLabel={`בחר עסק ${item.name}`}
                    accessibilityRole="button"
                    accessibilityHint="לחץ לבחירת עסק זה וצפייה בכרטיסייה"
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

      {/* מצגת הדגמה */}
      <TutorialSlideshow 
        visible={tutorialVisible} 
        onClose={() => setTutorialVisible(false)} 
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
    </View>
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
    top: 171,
    right: 138,
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
    marginLeft: -82.5,
    width: 160,
    height: 50,
    backgroundColor: 'transparent',
    borderRadius: 25,
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
    marginLeft: -100,
    width: 200,
    height: 60,
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
}); 