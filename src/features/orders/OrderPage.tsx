import { backTo } from '../../navigation/commerceNavigation';
import { Stack } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, space, ui } from '../../theme/tokens';
import { headerContentEdges, headerOptions } from '../../navigation/headerOptions';

export function goBackToCart() { backTo('/cart'); }
export function OrderPage({ title, children, footer, onBack = goBackToCart }: PropsWithChildren<{
  title: string; footer?: ReactNode; onBack?(): void;
}>) {
  return <SafeAreaView edges={headerContentEdges} style={ui.screen}>
    <Stack.Screen options={headerOptions(title, `Back from ${title}`, onBack)} />
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={ui.label}>PLAZZA · OFFLINE DEMO</Text>
      {children}
    </ScrollView>
    {footer && <View style={styles.footer}><View style={styles.inner}>{footer}</View></View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  footer: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  inner: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', padding: space.lg, gap: space.sm },
});
