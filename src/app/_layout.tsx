import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PermissionProvider } from '../features/permissions/PermissionProvider';
import { AppStateProvider, useShopping } from '../state/AppStateProvider';
import { colors, ui } from '../theme/tokens';

export { ErrorBoundary } from 'expo-router';

function Routes() {
  const { state } = useShopping();
  if (!state.hydrated) return <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
    <ActivityIndicator accessibilityLabel="Restoring your shopping bag" color={colors.primary} size="large" />
  </View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <PermissionProvider>
            <StatusBar style="dark" />
            <Routes />
          </PermissionProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
