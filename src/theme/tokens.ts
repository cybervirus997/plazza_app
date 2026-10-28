import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F5F8F7', surface: '#FFFFFF', ink: '#172E2A', muted: '#647570',
  primary: '#087D66', primaryDark: '#075544', primarySoft: '#E5F3ED',
  border: '#DFE9E4', danger: '#A53636', dangerSoft: '#FFF0EE',
  amber: '#815A17', amberSoft: '#FBF3DF', white: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: space.xl, gap: space.lg, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: colors.ink },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.muted },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.primary },
  input: { flex: 1, minHeight: 48, fontSize: 15, color: colors.ink, paddingHorizontal: space.lg, paddingVertical: space.md },
});

export const formatMoney = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
