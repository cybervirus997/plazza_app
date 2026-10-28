import { DefaultTheme, Stack, ThemeProvider, type NativeStackNavigationOptions } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PermissionProvider } from '../features/permissions/PermissionProvider';
import { AddressBookProvider } from '../features/addresses/AddressBookProvider';
import { AppStateProvider, useShopping } from '../state/AppStateProvider';
import { colors, ui } from '../theme/tokens';
import { stackOptions, quietStackOptions, returningScreenOptions } from '../navigation/commerceNavigation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { CheckoutPreferencesProvider } from '../features/orders/CheckoutPreferences';

export { ErrorBoundary } from 'expo-router';
export const unstable_settings = { anchor: '(tabs)' };
const tabOptions = { ...returningScreenOptions, headerShown: false };
const scanOptions: NativeStackNavigationOptions = { presentation: 'modal', animation: 'slide_from_bottom', title: 'Scan medicine' };
const quietScanOptions: NativeStackNavigationOptions = { ...scanOptions, animation: 'none' };

function Routes() {
  const reducedMotion = useReducedMotion();
  const { state, checkoutState, retryRecovery } = useShopping();
  if (!state.hydrated) return <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
    {checkoutState.error ? <View style={ui.content}>
      <Text accessibilityRole="header" style={ui.heading}>Checkout needs recovery</Text>
      <Text accessibilityRole="alert" style={ui.body}>{checkoutState.error}</Text>
      <Text style={ui.small}>Saved data has not been reset. Retry to finish recovery before shopping.</Text>
      <Button label="Retry checkout recovery" onPress={retryRecovery} />
    </View> : <ActivityIndicator accessibilityLabel="Restoring your shopping bag" color={colors.primary} size="large" />}
  </View>;
  return <Stack screenOptions={reducedMotion ? quietStackOptions : stackOptions}>
    <Stack.Screen name="(tabs)" options={tabOptions} />
    <Stack.Screen name="checkout" options={returningScreenOptions} />
    <Stack.Screen name="addresses" options={returningScreenOptions} />
    <Stack.Screen name="orders/index" options={returningScreenOptions} />
    <Stack.Screen name="scan-medicine" options={reducedMotion ? quietScanOptions : scanOptions} />
  </Stack>;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <AddressBookProvider>
            <PermissionProvider>
              <StatusBar style="dark" />
              <CheckoutPreferencesProvider><Routes /></CheckoutPreferencesProvider>
            </PermissionProvider>
          </AddressBookProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
