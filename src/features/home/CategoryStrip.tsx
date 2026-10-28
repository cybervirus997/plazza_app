import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '../../components/ProductImage';
import { categories } from '../../data/categories';
import { colors, ui } from '../../theme/tokens';

export function CategoryStrip() {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={ui.heading}>Shop by category</Text>
    <FlatList horizontal data={categories} keyExtractor={(category) => category.id}
      showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Browse ${item.title}`}
        onPress={() => router.navigate({ pathname: '/browse', params: { categoryId: item.id } })} style={styles.category}>
        <ProductImage imageKey={item.imageKey} /><Text style={styles.title}>{item.title}</Text>
      </Pressable>} />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12 }, strip: { gap: 12 },
  category: { width: 92, minHeight: 116, alignItems: 'center', gap: 8 },
  title: { color: colors.ink, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '600' },
});
