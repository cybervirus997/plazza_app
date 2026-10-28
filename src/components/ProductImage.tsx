import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ProductImageKey } from '../data/categories';
import { colors } from '../theme/tokens';

const images: Record<ProductImageKey, ImageSource> = {
  medicine: require('../../assets/products/medicine.svg'),
  bottle: require('../../assets/products/bottle.svg'),
  care: require('../../assets/products/care.svg'),
  tube: require('../../assets/products/tube.svg'),
  baby: require('../../assets/products/baby.svg'),
};

export function ProductImage({ imageKey }: { imageKey?: ProductImageKey }) {
  const [failedKey, setFailedKey] = useState<ProductImageKey | null>(null);
  const source = imageKey ? images[imageKey] : undefined;
  return <View style={styles.frame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Text style={styles.fallback}>+</Text>
    {source && failedKey !== imageKey && <Image source={source} contentFit="contain" transition={120}
      recyclingKey={imageKey} style={StyleSheet.absoluteFill} onError={() => setFailedKey(imageKey ?? null)} />}
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: 64, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fallback: { color: colors.primary, fontSize: 32 },
});
