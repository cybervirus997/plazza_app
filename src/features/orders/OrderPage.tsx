import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { colors, ui } from '../../theme/tokens';

export function goBackToCart() { if (router.canGoBack()) router.back(); else router.replace('/cart'); }
export function OrderPage({ title, children, footer, onBack = goBackToCart }: PropsWithChildren<{
  title: string; footer?: ReactNode; onBack?(): void;
}>) {
  return <SafeAreaView style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Button label="← Back" accessibilityLabel={`Back from ${title}`} onPress={onBack} variant="quiet" />
      <Text style={ui.label}>PLAZZA · OFFLINE DEMO</Text>
      <Text accessibilityRole="header" style={ui.title}>{title}</Text>
      {children}
    </ScrollView>
    {footer && <View style={styles.footer}><View style={styles.inner}>{footer}</View></View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  footer: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, gap: 8 },
});
