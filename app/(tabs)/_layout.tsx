import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { BusinessProvider } from '../../components/BusinessContext';
import FCMService from '../../components/FCMService';

export default function Layout() {
  // אתחול FCM Service - רץ פעם אחת בלבד
  useEffect(() => {
    FCMService.initialize();
  }, []);

  return (
    <BusinessProvider>
      <Slot />
    </BusinessProvider>
  );
}
