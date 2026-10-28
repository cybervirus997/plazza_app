import type { NativeStackNavigationOptions } from 'expo-router';
import { IconButton } from '../components/ui/IconButton';

// The native stack owns the header, title, status-bar inset and transition.
// Its Back slot retains bounded direct-link returns and the form's disabled state.
export function headerOptions(title: string, backLabel: string, onBack: () => void, disabled = false): NativeStackNavigationOptions {
  return { title, headerBackVisible: false,
    headerLeft: () => <IconButton icon="back" label={backLabel} onPress={onBack} disabled={disabled} /> };
}
export const headerContentEdges = ['left', 'right', 'bottom'] as const;
