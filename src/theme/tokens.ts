import { StyleSheet, type TextStyle } from 'react-native';

export const colors = {
  background: '#F5F8F7', surface: '#FFFFFF', ink: '#172E2A', muted: '#647570',
  primary: '#087D66', primaryDark: '#075544', primarySoft: '#E5F3ED',
  border: '#DFE9E4', danger: '#A53636', dangerSoft: '#FFF0EE',
  amber: '#815A17', amberSoft: '#FBF3DF', white: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radii = { sm: 12, md: 14, lg: 16, xl: 20 };
export const controls = { minTouch: 48, icon: 24 };
export const layout = { contentWidth: 640 };
export const typography = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  action: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  input: { fontSize: 15 },
} satisfies Record<string, TextStyle>;
export const statusColors = {
  positive: { ink: colors.primaryDark, background: colors.primarySoft, border: colors.primary },
  warning: { ink: colors.amber, background: colors.amberSoft, border: colors.amber },
  negative: { ink: colors.danger, background: colors.dangerSoft, border: colors.danger },
  neutral: { ink: colors.muted, background: colors.background, border: colors.border },
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', padding: space.xl, gap: space.lg, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  title: { ...typography.title, color: colors.ink },
  heading: { ...typography.heading, color: colors.ink },
  body: { ...typography.body, color: colors.muted },
  small: { ...typography.small, color: colors.muted },
  label: { ...typography.label, color: colors.primary },
  input: { ...typography.input, flex: 1, minHeight: controls.minTouch, color: colors.ink, paddingHorizontal: space.lg, paddingVertical: space.md },
});

export const formatMoney = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
