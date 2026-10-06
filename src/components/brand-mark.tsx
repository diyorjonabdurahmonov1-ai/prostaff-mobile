/**
 * The PROSTAFF mark: a P whose counter holds a figure mid-stride.
 *
 * It ships as a PNG rather than as SVG paths because the gradient is the mark
 * — flatten it to the one solid fill a path could carry and it stops being
 * recognisable. The tile is the same near-black the launcher icon sits on, so
 * the auth screen and the home screen show the one object, and the glyph is
 * scaled to the same 0.66 of the tile the launcher icon uses.
 */

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Radius, Squircle } from '@/constants/theme';

interface BrandMarkProps {
  /** Tile size. 72 on the splash, 48 in a nav bar, 32 in a list row. */
  size?: number;
  /** Tile fill. Pass `transparent` to drop the tile and keep the glyph — but
   *  only where nothing casts a shadow, since a shadow on a transparent tile
   *  draws the square the glyph was meant to hide. */
  background?: string;
}

export function BrandMark({ size = 72, background = '#0D0D0D' }: BrandMarkProps) {
  const glyph = Math.round(size * 0.66);

  return (
    <View
      style={[
        styles.tile,
        Squircle,
        {
          width: size,
          height: size,
          // Corner scales with the tile so the squircle keeps its proportion.
          borderRadius: Math.round(size * (Radius.xl / 72)),
          backgroundColor: background,
        },
      ]}>
      <Image
        source={require('@/assets/images/logo-mark.png')}
        style={{ width: glyph, height: glyph }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
