import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import type { Medicine } from '../../domain/types';
import { CategoryStrip } from './CategoryStrip';
import { HomeSection } from './HomeSection';
import { resolveHomeSections } from './sections';
import { useShopping } from '../../state/AppStateProvider';
import { colors, controls, radii, space, ui } from '../../theme/tokens';
import { useMedicineSearch } from '../search/useMedicineSearch';
import { MedicineSearchBar } from '../search/MedicineSearchBar';
import { HomeHeader } from './HomeHeader';
import { DeliveryAddressEntry } from '../addresses/DeliveryAddressEntry';
import { unresolvedPayment } from '../../domain/payments';
import { openPayment } from '../../navigation/commerceNavigation';

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
    router.navigate({ pathname: '/browse', params: { query: query.trim() } });
  }

  const header = <View style={styles.header}>
    <HomeHeader />
    <DeliveryAddressEntry compact />
    <MedicineSearchBar query={query} onChange={typeQuery} onSubmit={() => commitSearch()}
      onScan={() => { Keyboard.dismiss(); router.navigate('/scan-medicine'); }} />
    {unresolvedPayment(payment.attempt) && <View style={styles.pending}>
      <Text style={ui.body}>A saved simulated payment needs your attention. No new checkout is needed.</Text>
      <Button label="Resume saved payment" variant="secondary" onPress={openPayment} />
    </View>}
    <NoticeBanner />
    {!hasQuery && <>
      <CategoryStrip />
      <View style={styles.discovery}>
        <Text accessibilityRole="header" style={ui.heading}>Find your everyday essentials</Text>
        {catalogStatus === 'ready' && <Text style={ui.small}>{catalog.length} products · {catalog.length - demoCount} medicines + {demoCount} demo essentials</Text>}
        <Button label="Browse all medicines" variant="secondary" disabled={catalogStatus !== 'ready'} onPress={() => router.navigate('/browse')} />
      </View>
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
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[ui.content, styles.content]}
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
        {hasQuery && <Button label="Browse all medicines" variant="quiet" disabled={catalogStatus !== 'ready'} onPress={() => router.navigate('/browse')} />}
        <Text style={styles.trust}>Thoughtful care. Clear pricing.</Text>
      </View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm }, header: { gap: space.lg },
  discovery: { gap: space.sm }, pending: { gap: space.sm, borderLeftWidth: 2, borderLeftColor: colors.amber, paddingLeft: space.md },
  recent: { gap: space.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: controls.minTouch, maxWidth: '100%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.muted, fontSize: 12 },
  resultsHeading: { gap: 4, marginTop: 6 }, empty: { alignItems: 'center', paddingVertical: 28 },
  footer: { gap: 12, paddingTop: 8, paddingBottom: 8 }, trust: { color: colors.muted, textAlign: 'center', fontSize: 12 },
});
