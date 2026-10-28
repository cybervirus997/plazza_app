import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { IconButton } from '../../components/ui/IconButton';
import { colors, radii, space, ui } from '../../theme/tokens';

export function MedicineSearchBar({ query, onChange, onSubmit, onScan }: {
  query: string; onChange(value: string): void; onSubmit(): void; onScan(): void;
}) {
  return <View style={styles.search}>
    <Text accessibilityRole="header" style={ui.heading}>Find your medicines</Text>
    <View style={styles.row}>
      <View style={styles.field}>
        <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={colors.primary} />
        </View>
        <TextInput accessibilityLabel="Search medicines by name or salt" placeholder="Medicine name or salt"
          placeholderTextColor={colors.muted} value={query} onChangeText={onChange} autoCorrect={false}
          returnKeyType="search" onSubmitEditing={onSubmit} style={[ui.input, styles.input]} />
        {!!query.length && <IconButton icon="close" label="Clear search" onPress={() => onChange('')} />}
      </View>
      <View style={styles.scan}><IconButton icon="scan" label="Scan medicine" onPress={onScan} /></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  search: { gap: space.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface },
  icon: { marginLeft: space.md }, input: { minHeight: 54, minWidth: 0, paddingHorizontal: space.sm },
  scan: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.primarySoft },
});
