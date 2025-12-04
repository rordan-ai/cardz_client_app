import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// תמונות המצגת
const SLIDES = [
  require('../assets/images/tutorial/first_page.png'),
  require('../assets/images/tutorial/1.png'),
  require('../assets/images/tutorial/2.png'),
  require('../assets/images/tutorial/3.png'),
  require('../assets/images/tutorial/4.png'),
  require('../assets/images/tutorial/5.png'),
  require('../assets/images/tutorial/6.png'),
  require('../assets/images/tutorial/7.png'),
  require('../assets/images/tutorial/8.png'),
  require('../assets/images/tutorial/9.png'),
  require('../assets/images/tutorial/10.png'),
  require('../assets/images/tutorial/end pres.png'),
];

interface TutorialSlideshowProps {
  visible: boolean;
  onClose: () => void;
}

export default function TutorialSlideshow({ visible, onClose }: TutorialSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // בדף האחרון - סגירה
      handleClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleClose = () => {
    setCurrentIndex(0); // איפוס לדף הראשון
    onClose();
  };

  if (!visible) return null;

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const isFirstSlide = currentIndex === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* לחיצה בכל מקום מקדמת */}
      <TouchableWithoutFeedback onPress={goNext}>
        <View style={styles.container}>
          {/* תמונה */}
          <Image
            source={SLIDES[currentIndex]}
            style={styles.image}
            resizeMode="contain"
          />

          {/* כפתור יציאה - למעלה שמאל */}
          <TouchableOpacity 
            style={styles.exitButton} 
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.exitText}>✕ יציאה</Text>
          </TouchableOpacity>

          {/* ניווט תחתון */}
          <View style={styles.navigation}>
            {/* כפתור קודם */}
            <TouchableOpacity 
              style={[styles.navButton, isFirstSlide && styles.navButtonDisabled]} 
              onPress={goPrev}
              disabled={isFirstSlide}
            >
              <Text style={[styles.navText, isFirstSlide && styles.navTextDisabled]}>◀ קודם</Text>
            </TouchableOpacity>

            {/* מונה עמודים */}
            <Text style={styles.counter}>{currentIndex + 1} / {SLIDES.length}</Text>

            {/* כפתור הבא */}
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={goNext}
            >
              <Text style={styles.navText}>{isLastSlide ? 'סיום' : 'הבא'} ▶</Text>
            </TouchableOpacity>
          </View>

          {/* אינדיקטור נקודות */}
          <View style={styles.dots}>
            {SLIDES.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.dot, 
                  index === currentIndex && styles.dotActive
                ]} 
              />
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
    marginTop: -40,
  },
  exitButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  exitText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Rubik',
  },
  navigation: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH * 0.9,
    paddingHorizontal: 10,
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Rubik',
  },
  navTextDisabled: {
    color: '#888',
  },
  counter: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Rubik',
  },
  dots: {
    position: 'absolute',
    bottom: 45,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
});

