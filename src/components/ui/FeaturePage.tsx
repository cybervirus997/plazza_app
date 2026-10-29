import { Stack, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { backTo } from '../../navigation/commerceNavigation';
import { headerContentEdges, headerOptions } from '../../navigation/headerOptions';
import { space, ui } from '../../theme/tokens';
export function FeaturePage({ title, fallback = '/', children }: PropsWithChildren<{ title: string; fallback?: Href }>) {
  const headerHeight = useHeaderHeight();
  return <SafeAreaView style={ui.screen} edges={headerContentEdges}>
    <Stack.Screen options={headerOptions(title, `Back from ${title}`, () => backTo(fallback))} />
    <KeyboardAvoidingView style={ui.flex} enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={[ui.content, { padding: space.lg }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
