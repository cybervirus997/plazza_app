import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import { catalogData } from '../../data/catalog';
import { searchMedicines } from '../../domain/search';
import { useShopping } from '../../state/AppStateProvider';
import { colors, space, ui } from '../../theme/tokens';

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '');
  const { state, catalog, dispatch, itemCount } = useShopping();
  const medicines = query.trim() ? searchMedicines(catalog, query) : catalog;

  function goHome() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
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
          variant="quiet" onPress={() => router.navigate('/cart')} />
      </View>
      <Text style={ui.label}>YOUR MEDICINE CATALOG</Text>
      <Text accessibilityRole="header" style={ui.title}>Browse medicines</Text>
      <Text accessibilityLiveRegion="polite" style={ui.body}>
        {query.trim() ? `${medicines.length} of ${catalog.length} medicines match` : `${catalog.length} medicines available`}
      </Text>
      <View style={styles.searchBox}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.primary} size={21} style={styles.searchIcon} />
        <TextInput accessibilityLabel="Filter medicines by name or salt" placeholder="Search medicines or ingredients"
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
        <Text accessibilityRole="header" style={ui.heading}>{catalogData.error ? 'Medicines are unavailable' : 'No medicines found'}</Text>
        <Text style={ui.body}>{catalogData.error ?? 'Try a shorter medicine name, an ingredient, or clear the filter to browse all medicines.'}</Text>
        {!catalogData.error && <Button label="Show all medicines" variant="secondary" onPress={() => setQuery('')} />}
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
