import { Stack, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { backTo } from '../../navigation/commerceNavigation';
import { headerContentEdges, headerOptions } from '../../navigation/headerOptions';
import { ui } from '../../theme/tokens';
export function FeaturePage({ title, fallback = '/', children }: PropsWithChildren<{ title: string; fallback?: Href }>) {
  return <SafeAreaView style={ui.screen} edges={headerContentEdges}>
    <Stack.Screen options={headerOptions(title, `Back from ${title}`, () => backTo(fallback))} />
    <ScrollView contentContainerStyle={[ui.content, { padding: 16 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
  </SafeAreaView>;
}
