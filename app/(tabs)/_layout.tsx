import { Slot } from 'expo-router';
import { BusinessProvider } from '../../components/BusinessContext';

export default function Layout() {
  return (
    <BusinessProvider>
      <Slot />
    </BusinessProvider>
  );
}
