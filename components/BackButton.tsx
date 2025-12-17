import React from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface BackButtonProps {
  fallbackRoute?: string;
  color?: string;
}

/**
 * כפתור חזרה ל-iOS (באנדרואיד יש כפתור חזרה פיזי)
 */
export const BackButton: React.FC<BackButtonProps> = ({ 
  fallbackRoute = '/(tabs)/business_selector',
  color = '#1E51E9' 
}) => {
  const router = useRouter();

  // רק ב-iOS
  if (Platform.OS !== 'ios') {
    return null;
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={handleBack}
      accessibilityLabel="חזרה"
      accessibilityRole="button"
    >
      <Text style={[styles.arrow, { color }]}>‹</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  arrow: {
    fontSize: 47, // 36 * 1.3 = 46.8 ≈ 47
    fontWeight: '300',
    marginRight: 0,
  },
  text: {
    fontSize: 17,
    fontWeight: '400',
  },
});

export default BackButton;

