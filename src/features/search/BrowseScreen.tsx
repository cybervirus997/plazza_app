import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import { categories } from '../../data/categories';
import { filterProducts } from '../catalog/products';
import { useShopping } from '../../state/AppStateProvider';
import { backTo, returnToShop } from '../../navigation/commerceNavigation';
import { headerContentEdges, headerOptions } from '../../navigation/headerOptions';
import { colors, layout, radii, space, ui } from '../../theme/tokens';

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>();
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '');
  const { state, catalog, dispatch, itemCount, catalogStatus, catalogError } = useShopping();
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : undefined;
  const category = categories.find((item) => item.id === categoryId);
  const medicines = filterProducts(catalog, { query, categoryId });

  function goHome() {
    backTo('/');
  }

  function submit() {
    if (query.trim()) dispatch({ type: 'search', query });
    Keyboard.dismiss();
  }

  return <SafeAreaView edges={headerContentEdges} style={ui.screen}>
    <Stack.Screen options={{ ...headerOptions(category?.title ?? (categoryId ? 'Unknown category' : 'Browse medicines & essentials'), 'Back to Home', goHome),
      headerRight: () => <Button label={`Cart (${itemCount})`} accessibilityLabel={`View cart, ${itemCount} items`}
        variant="quiet" onPress={() => returnToShop('cart')} /> }} />
    <View style={styles.header}>
      <Text style={ui.label}>DEMO PRODUCT CATALOG</Text>
      <Text accessibilityLiveRegion="polite" style={ui.body}>
        {query.trim() || categoryId ? `${medicines.length} of ${catalog.length} products match` : `${catalog.length} products in the demo catalog`}
      </Text>
      {categoryId && <Button label="Show all categories" variant="quiet" onPress={() => router.setParams({ categoryId: undefined })} />}
      <View style={styles.searchBox}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.primary} size={21} style={styles.searchIcon} />
        <TextInput accessibilityLabel="Filter medicines by name or salt" placeholder="Search products, medicines or ingredients"
          placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false}
          returnKeyType="search" onSubmitEditing={submit} style={ui.input} />
        {query.length > 0 && <IconButton icon="close" label="Clear medicine filter" onPress={() => setQuery('')} />}
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
  header: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg },
  searchIcon: { marginLeft: space.lg },
});
