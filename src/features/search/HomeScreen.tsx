import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { MedicineCard } from '../../components/MedicineCard';
import { Button } from '../../components/ui/Button';
import { NoticeBanner } from '../../components/ui/NoticeBanner';
import { catalogData } from '../../data/catalog';
import { useShopping } from '../../state/AppStateProvider';
import { colors, ui } from '../../theme/tokens';
import { DeliveryLocation, PermissionPanel } from '../permissions/PermissionPanel';
import { useMedicineSearch } from './useMedicineSearch';

export default function HomeScreen() {
  const { state, dispatch } = useShopping();
  const { query, search, updateQuery } = useMedicineSearch();

  function submit(value = query) {
    if (!value.trim()) return;
    dispatch({ type: 'search', query: value });
    updateQuery(value);
    Keyboard.dismiss();
  }

  const header = <View style={styles.header}>
    <View style={ui.between}>
      <View style={ui.row}><View style={styles.brandMark}><Text style={styles.brandPlus}>+</Text></View>
        <Text accessibilityRole="header" style={styles.brand}>Plazza</Text></View>
      <View style={styles.brandTag}><Text style={styles.brandTagText}>YOUR EVERYDAY CARE</Text></View>
    </View>
    <DeliveryLocation />
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>CARE, WITHIN REACH</Text>
      <Text style={styles.heroTitle}>A little care.{`\n`}A lot closer.</Text>
      <Text style={styles.heroBody}>Find your medicines.{`\n`}Keep your day moving.</Text>
      <View style={styles.heroArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.circle} />
        <View style={styles.pill}><View style={styles.pillTop} /><View style={styles.pillBottom} /></View>
        <View style={styles.smallCross}><Text style={styles.artCross}>+</Text></View>
      </View>
    </View>
    <View style={styles.searchBox}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={colors.primary} size={21} style={styles.searchIcon} />
      <TextInput accessibilityLabel="Search medicines by name or salt" placeholder="Search medicines or salt"
        placeholderTextColor={colors.muted} value={query} onChangeText={updateQuery}
        returnKeyType="search" onSubmitEditing={() => submit()} autoCorrect={false} style={ui.input} />
      {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search"
        onPress={() => updateQuery('')} style={styles.clear}><Text style={styles.clearText}>×</Text></Pressable>}
    </View>
    {query.trim().length > 0 && <Button label="Search" onPress={() => submit()} variant="secondary" />}
    {state.recentSearches.length > 0 && <View style={styles.recent}>
      <Text style={ui.label}>RECENT SEARCHES</Text>
      <View style={styles.chips}>{state.recentSearches.map((recent) =>
        <Pressable key={recent.toLowerCase()} accessibilityRole="button" accessibilityLabel={`Search again for ${recent}`}
          onPress={() => submit(recent)} style={styles.chip}><Text style={styles.chipText}>↺  {recent}</Text></Pressable>)}</View>
    </View>}
    <NoticeBanner />
    <View style={ui.between}><Text accessibilityRole="header" style={ui.heading}>{query.trim() ? 'Search results' : 'Your care starts here'}</Text>
      {search.status === 'results' && <Text style={ui.small}>{search.results.length} found</Text>}</View>
  </View>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <FlatList data={search.results} keyExtractor={(item) => item.id} extraData={state.cart}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={ui.content}
      ListHeaderComponent={header} renderItem={({ item }) => <MedicineCard medicine={item}
        quantity={state.cart.find((entry) => entry.medicineId === item.id)?.quantity ?? 0} />}
      ListEmptyComponent={<View style={[ui.card, styles.empty]}>
        {search.status === 'loading' ? <><ActivityIndicator color={colors.primary} /><Text accessibilityLiveRegion="polite" style={ui.body}>Searching your local medicine catalog…</Text></>
          : catalogData.error ? <><Text style={ui.heading}>Medicines are unavailable</Text><Text style={ui.body}>{catalogData.error}</Text></>
            : search.status === 'error' ? <><Text style={ui.heading}>Search is unavailable</Text><Text style={ui.body}>{search.message}</Text><Button label="Try again" variant="secondary" onPress={() => updateQuery(query)} /></>
              : search.status === 'results' ? <><Text style={ui.heading}>No medicines found</Text><Text style={ui.body}>Try a different name, a shorter spelling, or the medicine’s salt.</Text></>
                : <><SymbolView name={{ ios: 'cross.case', android: 'medication', web: 'medication' }} tintColor={colors.primary} size={32} />
                  <Text style={ui.heading}>What can we help you find?</Text><Text style={ui.body}>Search by medicine name or salt to find the care you need.</Text></>}
      </View>}
      ListFooterComponent={<View style={styles.footer}><Text style={styles.trust}>Thoughtful care. Clear pricing.</Text><PermissionPanel /></View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { gap: 22 }, brand: { color: colors.primaryDark, fontSize: 29, fontWeight: '800', letterSpacing: -1.1 },
  brandMark: { width: 32, height: 34, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandPlus: { color: colors.white, fontSize: 29, fontWeight: '500', lineHeight: 32 },
  brandTag: { flexShrink: 1, maxWidth: 115 }, brandTagText: { color: colors.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '600', textAlign: 'right' },
  hero: { padding: 24, paddingRight: 94, minHeight: 230, backgroundColor: colors.primaryDark, borderRadius: 24, overflow: 'hidden', justifyContent: 'center' },
  heroEyebrow: { color: '#9DD8BE', fontWeight: '700', fontSize: 9, letterSpacing: 1.8, marginBottom: 12 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.7, color: colors.white, zIndex: 1 },
  heroBody: { color: '#C5E5D6', fontSize: 12, lineHeight: 19, marginTop: 12, zIndex: 1 },
  heroArt: { position: 'absolute', right: -30, bottom: -20, width: 160, height: 210 },
  circle: { position: 'absolute', width: 165, height: 165, borderRadius: 90, backgroundColor: '#176751', top: 36 },
  pill: { position: 'absolute', right: 43, top: 40, transform: [{ rotate: '25deg' }], borderRadius: 40, overflow: 'hidden', width: 55, height: 128, borderWidth: 2, borderColor: '#A0C4AC' },
  pillTop: { flex: 1, backgroundColor: '#E3EDD0' }, pillBottom: { flex: 1, backgroundColor: '#83C7A8' },
  smallCross: { position: 'absolute', top: 5, left: 9, transform: [{ rotate: '12deg' }] }, artCross: { color: '#88B89F', fontSize: 42, fontWeight: '300' },
  searchBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  searchIcon: { marginLeft: 16 }, clear: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, clearText: { fontSize: 24, color: colors.muted },
  recent: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.muted, fontSize: 12 }, empty: { alignItems: 'center', paddingVertical: 28 },
  footer: { gap: 24, paddingTop: 16, paddingBottom: 8 }, trust: { color: '#87988F', textAlign: 'center', fontSize: 12, fontWeight: '500' },
});
