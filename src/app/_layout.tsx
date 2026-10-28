import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PermissionProvider } from '../features/permissions/PermissionProvider';
import { AddressBookProvider } from '../features/addresses/AddressBookProvider';
import { AppStateProvider, useShopping } from '../state/AppStateProvider';
import { colors, ui } from '../theme/tokens';

export { ErrorBoundary } from 'expo-router';

function Routes() {
  const { state, checkoutState, retryRecovery } = useShopping();
  if (!state.hydrated) return <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
    {checkoutState.error ? <View style={ui.content}>
      <Text accessibilityRole="header" style={ui.heading}>Checkout needs recovery</Text>
      <Text accessibilityRole="alert" style={ui.body}>{checkoutState.error}</Text>
      <Text style={ui.small}>Saved data has not been reset. Retry to finish recovery before shopping.</Text>
      <Button label="Retry checkout recovery" onPress={retryRecovery} />
    </View> : <ActivityIndicator accessibilityLabel="Restoring your shopping bag" color={colors.primary} size="large" />}
  </View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <AddressBookProvider>
            <PermissionProvider>
              <StatusBar style="dark" />
              <Routes />
            </PermissionProvider>
          </AddressBookProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
