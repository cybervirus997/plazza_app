import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import type { Medicine } from '../../domain/types';
import { CategoryStrip } from './CategoryStrip';
import { HomeSection } from './HomeSection';
import { resolveHomeSections } from './sections';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { DeliveryLocation, PermissionPanel } from '../permissions/PermissionPanel';
import { useMedicineSearch } from '../search/useMedicineSearch';
import { DeliveryAddressEntry } from '../addresses/DeliveryAddressEntry';
import { unresolvedPayment } from '../../domain/payments';
import { openOrders, openPayment } from '../../navigation/commerceNavigation';

const SUGGESTION_LIMIT = 6;
type HomeRow = ReturnType<typeof resolveHomeSections>[number] | { kind: 'result'; id: string; medicine: Medicine };

export default function HomeScreen() {
  const { state, dispatch, catalog, catalogStatus, catalogError, repository, payment } = useShopping();
  const searchProducts = useCallback((query: string) => repository.search({ query }), [repository]);
  const { query, search, updateQuery } = useMedicineSearch(searchProducts);
  const [mode, setMode] = useState<'suggestions' | 'results'>('suggestions');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasQuery = query.trim().length > 0;
  const demoCount = catalog.filter((product) => product.isDemo).length;
  const suggesting = hasQuery && mode === 'suggestions';
  const matches = selectedId ? search.results.filter((item) => item.id === selectedId) : search.results;
  const medicines = hasQuery
    ? suggesting ? matches.slice(0, SUGGESTION_LIMIT) : matches
    : [];
  const rows: readonly HomeRow[] = catalogStatus !== 'ready' ? [] : hasQuery
    ? medicines.map((medicine) => ({ kind: 'result', id: medicine.id, medicine }))
    : catalog.length ? resolveHomeSections(catalog) : [];

  function typeQuery(value: string) {
    setMode('suggestions');
    setSelectedId(null);
    updateQuery(value);
  }

  function commitSearch(value = query, options: { medicineId?: string; refresh?: boolean } = {}) {
    const trimmed = value.trim();
    if (!trimmed) return;
    dispatch({ type: 'search', query: trimmed });
    setMode('results');
    setSelectedId(options.medicineId ?? null);
    if (query !== trimmed || options.refresh || search.status === 'error') updateQuery(trimmed);
    Keyboard.dismiss();
  }

  function viewAllMatches() {
    commitSearch();
    router.push({ pathname: '/browse', params: { query: query.trim() } });
  }

  const header = <View style={styles.header}>
    <View style={ui.between}>
      <View style={ui.row}>
        <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={styles.brandPlus}>+</Text></View>
        <Text accessibilityRole="header" style={styles.brand}>Plazza</Text>
      </View>
      <View><Text style={styles.brandTag}>YOUR EVERYDAY CARE</Text><Button label="Orders" variant="quiet" onPress={openOrders} /></View>
    </View>
    <DeliveryAddressEntry />
    {unresolvedPayment(payment.attempt) && <View style={ui.card}>
      <Text style={ui.body}>A saved simulated payment needs your attention. No new checkout is needed.</Text>
      <Button label="Resume saved payment" variant="secondary" onPress={openPayment} />
    </View>}
    <DeliveryLocation />
    <PermissionPanel compact />
    <View style={styles.searchBox}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.primary} size={21} style={styles.searchIcon} />
      <TextInput accessibilityLabel="Search medicines by name or salt" placeholder="Search products, medicines or ingredients"
        placeholderTextColor={colors.muted} value={query} onChangeText={typeQuery}
        returnKeyType="search" onSubmitEditing={() => commitSearch()} autoCorrect={false} style={[ui.input, styles.searchInput]} />
      {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search"
        onPress={() => typeQuery('')} style={styles.clear}><Text style={styles.clearText}>×</Text></Pressable>}
    </View>
    <NoticeBanner />
    {!hasQuery && <>
      <View style={styles.discovery}>
        <View style={styles.discoveryHeading}>
          <View style={styles.discoveryIcon}><SymbolView name={{ ios: 'cross.case', android: 'medication', web: 'medication' }} size={28} tintColor={colors.primary} /></View>
          <View style={ui.flex}><Text style={ui.label}>CARE, WITHIN REACH</Text><Text style={styles.discoveryTitle}>Find your everyday essentials</Text></View>
        </View>
        <Text style={ui.body}>Medicines and everyday essentials, together in one demo catalog.</Text>
        <Button label="Browse all medicines" disabled={catalogStatus !== 'ready'} onPress={() => router.push('/browse')} />
        {catalogStatus === 'ready' && <Text style={ui.small}>{catalog.length} products · {catalog.length - demoCount} medicines + {demoCount} demo essentials</Text>}
      </View>
      <CategoryStrip />
      {state.recentSearches.length > 0 && <View style={styles.recent}>
        <Text accessibilityRole="header" style={ui.label}>RECENT SEARCHES</Text>
        <View style={styles.chips}>{state.recentSearches.map((recent) =>
          <Pressable key={recent.toLowerCase()} accessibilityRole="button" accessibilityLabel={`Search again for ${recent}`}
            onPress={() => commitSearch(recent, { refresh: true })} style={styles.chip}>
            <Text style={styles.chipText}>↺  {recent}</Text>
          </Pressable>)}</View>
      </View>}
    </>}
    {hasQuery && <View style={styles.resultsHeading}>
      <Text accessibilityRole="header" style={ui.heading}>
        {suggesting ? 'Suggested products' : selectedId ? 'Selected medicine' : 'Search results'}
      </Text>
      {search.status === 'results' && <Text accessibilityLiveRegion="polite" style={ui.small}>
          {suggesting ? `${medicines.length} suggestions · ${search.results.length} matching products` : `${matches.length} matching products`}
        </Text>}
    </View>}
    {hasQuery && search.status === 'results' && search.results.length > 0 &&
      <Button label="View all matching medicines" onPress={viewAllMatches} variant="secondary" />}
  </View>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <FlatList data={rows} keyExtractor={(item) => item.id} extraData={state.cart}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={ui.content}
      ListHeaderComponent={header} renderItem={({ item }) => item.kind === 'result'
        ? <MedicineCard medicine={item.medicine}
          quantity={state.cart.find((entry) => entry.medicineId === item.id)?.quantity ?? 0}
          onSelect={suggesting ? () => commitSearch(item.medicine.name, { medicineId: item.id }) : undefined} />
        : <HomeSection section={item} />}
      ListEmptyComponent={<View style={[ui.card, styles.empty]} accessibilityLiveRegion="polite">
        {catalogError ? <><Text style={ui.heading}>Medicines are unavailable</Text><Text style={ui.body}>{catalogError}</Text></>
          : catalogStatus === 'loading' ? <><ActivityIndicator accessibilityLabel="Loading catalog" color={colors.primary} /><Text style={ui.body}>Loading the product catalog…</Text></>
          : search.status === 'loading' ? <><ActivityIndicator accessibilityLabel="Searching medicines" color={colors.primary} /><Text style={ui.body}>Finding matching medicines…</Text></>
            : search.status === 'error' ? <><Text style={ui.heading}>Search is unavailable</Text><Text style={ui.body}>{search.message}</Text>
              <Button label="Try again" variant="secondary" onPress={() => updateQuery(query)} /></>
              : <><Text style={ui.heading}>No products found</Text><Text style={ui.body}>Try a shorter product name or ingredient, or browse another category.</Text>
                <Button label="Clear search" variant="secondary" onPress={() => typeQuery('')} /></>}
      </View>}
      ListFooterComponent={<View style={styles.footer}>
        {hasQuery && <Button label="Browse all medicines" variant="quiet" disabled={catalogStatus !== 'ready'} onPress={() => router.push('/browse')} />}
        <Text style={styles.trust}>Thoughtful care. Clear pricing.</Text>
      </View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { gap: 18 },
  brand: { color: colors.primaryDark, fontSize: 29, fontWeight: '800', letterSpacing: -1.1 },
  brandMark: { width: 32, height: 34, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandPlus: { color: colors.white, fontSize: 29, fontWeight: '500', lineHeight: 32 },
  brandTag: { flexShrink: 1, maxWidth: 115, color: colors.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '600', textAlign: 'right' },
  discovery: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, padding: 18, borderRadius: 20, gap: 14 },
  discoveryHeading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  discoveryIcon: { backgroundColor: colors.surface, width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  discoveryTitle: { color: colors.primaryDark, fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: 6, letterSpacing: -0.3 },
  searchBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  searchIcon: { marginLeft: 16 }, searchInput: { paddingHorizontal: 12, minWidth: 0 },
  clear: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, clearText: { fontSize: 24, color: colors.muted },
  recent: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.muted, fontSize: 12 },
  resultsHeading: { gap: 4, marginTop: 6 }, empty: { alignItems: 'center', paddingVertical: 28 },
  footer: { gap: 12, paddingTop: 8, paddingBottom: 8 }, trust: { color: colors.muted, textAlign: 'center', fontSize: 12 },
});
