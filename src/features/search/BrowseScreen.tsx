import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import { categories } from '../../data/categories';
import { filterProducts } from '../catalog/products';
import { useShopping } from '../../state/AppStateProvider';
import { returnToShop } from '../../navigation/commerceNavigation';
import { colors, space, ui } from '../../theme/tokens';

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>();
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '');
  const { state, catalog, dispatch, itemCount, catalogStatus, catalogError } = useShopping();
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : undefined;
  const category = categories.find((item) => item.id === categoryId);
  const medicines = filterProducts(catalog, { query, categoryId });

  function goHome() {
    if (router.canGoBack()) router.back();
    else returnToShop();
  }

  function submit() {
    if (query.trim()) dispatch({ type: 'search', query });
    Keyboard.dismiss();
  }

  return <SafeAreaView style={ui.screen}>
    <View style={styles.header}>
      <View style={ui.between}>
        <Button label="← Home" accessibilityLabel="Back to Home" variant="quiet" onPress={goHome} />
        <Button label={`Cart (${itemCount})`} accessibilityLabel={`View cart, ${itemCount} items`}
          variant="quiet" onPress={() => returnToShop('cart')} />
      </View>
      <Text style={ui.label}>DEMO PRODUCT CATALOG</Text>
      <Text accessibilityRole="header" style={ui.title}>{category?.title ?? (categoryId ? 'Unknown category' : 'Browse medicines & essentials')}</Text>
      <Text accessibilityLiveRegion="polite" style={ui.body}>
        {query.trim() || categoryId ? `${medicines.length} of ${catalog.length} products match` : `${catalog.length} products in the demo catalog`}
      </Text>
      {categoryId && <Button label="Show all categories" variant="quiet" onPress={() => router.setParams({ categoryId: undefined })} />}
      <View style={styles.searchBox}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.primary} size={21} style={styles.searchIcon} />
        <TextInput accessibilityLabel="Filter medicines by name or salt" placeholder="Search products, medicines or ingredients"
          placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false}
          returnKeyType="search" onSubmitEditing={submit} style={ui.input} />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear medicine filter"
          onPress={() => setQuery('')} style={styles.clear}><Text style={styles.clearText}>×</Text></Pressable>}
      </View>
    </View>
    <FlatList data={medicines} keyExtractor={(medicine) => medicine.id} extraData={state.cart}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={ui.content}
      ListHeaderComponent={<NoticeBanner />}
      renderItem={({ item }) => <MedicineCard medicine={item}
        quantity={state.cart.find((entry) => entry.medicineId === item.id)?.quantity ?? 0} />}
      ListEmptyComponent={<View accessibilityLiveRegion="polite" style={ui.card}>
        {catalogStatus === 'loading' ? <><ActivityIndicator accessibilityLabel="Loading catalog" color={colors.primary} />
          <Text style={ui.body}>Loading the product catalog…</Text></> : <>
          <Text accessibilityRole="header" style={ui.heading}>{catalogError ? 'Medicines are unavailable' : 'No products found'}</Text>
          <Text style={ui.body}>{catalogError ?? 'Try a shorter name, an ingredient, or browse another category.'}</Text>
          {!catalogError && <Button label="Clear product filter" variant="secondary" onPress={() => setQuery('')} />}
        </>}
      </View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  searchIcon: { marginLeft: space.lg },
  clear: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 24, color: colors.muted },
});
