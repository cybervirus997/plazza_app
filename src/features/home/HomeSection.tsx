import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import type { resolveHomeSections } from './sections';

type ResolvedSection = ReturnType<typeof resolveHomeSections>[number];

export function HomeSection({ section }: { section: ResolvedSection }) {
  const { state } = useShopping();
  const { width } = useWindowDimensions();
  const openCategory = () => router.navigate({ pathname: '/browse',
    params: section.categoryId ? { categoryId: section.categoryId } : {} });

  if (section.kind === 'offer') return <View style={styles.offer}>
    <Text style={ui.label}>DEMO COLLECTION</Text>
    <Text accessibilityRole="header" style={ui.title}>{section.title}</Text>
    <Text style={ui.body}>{section.subtitle}</Text>
    <Button label={section.cta} variant="secondary" onPress={openCategory} />
  </View>;

  return <View style={styles.section}>
    <View style={ui.between}>
      <Text accessibilityRole="header" style={[ui.heading, ui.flex]}>{section.title}</Text>
      <Button label="See all" accessibilityLabel={`See all ${section.title}`} variant="quiet" onPress={openCategory} />
    </View>
    <FlatList horizontal data={section.products} keyExtractor={(product) => product.id} extraData={state.cart}
      showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.strip}
      renderItem={({ item }) => <View style={{ width: Math.min(300, Math.max(220, width - 80)) }}>
        <MedicineCard medicine={item} quantity={state.cart.find((entry) => entry.medicineId === item.id)?.quantity ?? 0} />
      </View>}
      ListEmptyComponent={<Text style={ui.body}>No products in this collection yet. Browse another category.</Text>} />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 8 }, strip: { gap: 12 },
  offer: { padding: 20, borderRadius: 24, backgroundColor: colors.primarySoft, borderColor: colors.border, borderWidth: 1, gap: 12 },
});
