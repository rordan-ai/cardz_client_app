import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface PopupData {
  id: number;
  business_code: string;
  title?: string;
  content: string;
  image_url?: string;
  display_duration: number; // השהייה לפני הצגה (בשניות)
  duration_seconds?: number | null; // זמן הצגה (בשניות), null = עד סגירה ידנית
  trigger_location: 'entry' | 'after_punch' | 'after_phone';
  target_audience: 'all' | 'specific' | 'segment';
  target_criteria?: Record<string, any>;
  is_active: boolean;
  show_count_per_user: number;
}

interface MarketingPopupProps {
  visible: boolean;
  popup: PopupData | null;
  onClose: () => void;
}

export default function MarketingPopup({ visible, popup, onClose }: MarketingPopupProps) {
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // סגירה אוטומטית אחרי duration_seconds
  useEffect(() => {
    if (!visible || !popup) return;

    // ניקוי timeout קודם
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }

    // זמן הצגה: duration_seconds או display_duration (fallback)
    const displayTime = popup.duration_seconds ?? popup.display_duration;
    
    if (__DEV__) {
      console.log('[MarketingPopup] Popup data:', { 
        id: popup.id, 
        duration_seconds: popup.duration_seconds,
        display_duration: popup.display_duration,
        displayTime
      });
    }

    // אם יש זמן הצגה תקין (לא null ולא 0) - סגירה אוטומטית
    if (displayTime && displayTime > 0) {
      if (__DEV__) {
        console.log('[MarketingPopup] Auto-close in', displayTime, 'seconds');
      }
      autoCloseRef.current = setTimeout(() => {
        if (__DEV__) console.log('[MarketingPopup] Auto-closing popup');
        onClose();
      }, displayTime * 1000);
    }

    return () => {
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    };
  }, [visible, popup, onClose]);

  if (!popup) return null;

  // האם יש תמונה להציג
  const hasImage = !!popup.image_url;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, hasImage && styles.cardImageOnly]}>
          {/* כפתור סגירה */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>

          {/* תמונה בלבד */}
          {hasImage && (
            <Image
              source={{ uri: popup.image_url }}
              style={styles.image}
              resizeMode="contain"
            />
          )}

          {/* אם אין תמונה - הצג title/content כ-fallback */}
          {!hasImage && (
            <>
              {popup.title && (
                <Text style={styles.title}>{popup.title}</Text>
              )}
              <Text style={styles.content}>{popup.content}</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.8,
    alignItems: 'center',
    position: 'relative',
  },
  cardImageOnly: {
    padding: 8,
    paddingTop: 36, // מקום לכפתור X
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
  },
  closeText: {
    fontSize: 28,
    color: '#666',
    fontWeight: 'bold',
    lineHeight: 28,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 20,
    fontFamily: 'Rubik',
  },
  content: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: 'Rubik',
  },
});
