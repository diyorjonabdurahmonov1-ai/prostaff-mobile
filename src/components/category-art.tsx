/**
 * A category's picture: its glyph on its own gradient, with two soft discs
 * behind it so the tile reads as a small illustration rather than an icon on a
 * flat square. What goes on it is decided in `lib/category-art.ts`.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Squircle } from '@/constants/theme';
import { categoryArt } from '@/lib/category-art';
import type { Category } from '@/lib/types';

export function CategoryArt({
  category,
  width,
  height,
  radius = 18,
  iconSize,
  style,
}: {
  category: Category | undefined;
  width: number;
  height: number;
  radius?: number;
  /** Defaults to a little under half the shorter side. */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const art = categoryArt(category);
  const short = Math.min(width, height);
  const size = iconSize ?? Math.round(short * 0.46);

  return (
    <LinearGradient
      colors={[art.colors[0], art.colors[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.art, Squircle, { width, height, borderRadius: radius }, style]}>
      {/* Two discs off opposite corners: depth, at no cost to legibility. */}
      <View
        style={[
          styles.disc,
          { width: short * 0.9, height: short * 0.9, borderRadius: short, top: -short * 0.35, right: -short * 0.3 },
        ]}
      />
      <View
        style={[
          styles.disc,
          styles.discFaint,
          { width: short * 0.7, height: short * 0.7, borderRadius: short, bottom: -short * 0.3, left: -short * 0.25 },
        ]}
      />
      <Icon name={art.icon} size={size} color="#FFFFFF" duotoneOpacity={0.35} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  disc: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.18)' },
  discFaint: { backgroundColor: 'rgba(255,255,255,0.10)' },
});
