/**
 * The +/− pill that sits on a map card.
 *
 * Shared by both map implementations on purpose. The interactive card and the
 * static one are meant to be indistinguishable — a phone that cannot load the
 * Yandex JS API falls back to the PNG map and the user should never be able to
 * tell — and two copies of this control would have drifted apart the first time
 * one of them was touched.
 *
 * Pinch already zooms the interactive map. The buttons are here anyway: pinching
 * inside a card that lives in a scrolling page is a fight between two gestures,
 * and one-handed, mid-order, on a bus, a button is the only one of the two that
 * reliably works.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Hairline, Radius, Shadow } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

interface MapZoomProps {
  /** Current level, so the buttons can go flat at the ends of the range. */
  zoom: number;
  min: number;
  max: number;
  onZoom: (delta: 1 | -1) => void;
}

export function MapZoom({ zoom, min, max, onZoom }: MapZoomProps) {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';

  return (
    <View
      style={[
        styles.zoom,
        dark ? null : Shadow.card,
        { backgroundColor: theme.surface, borderColor: theme.borderLight },
      ]}>
      <ZoomButton kind="in" disabled={zoom >= max} onPress={() => onZoom(1)} />
      <View style={[styles.divider, { backgroundColor: theme.separator }]} />
      <ZoomButton kind="out" disabled={zoom <= min} onPress={() => onZoom(-1)} />
    </View>
  );
}

/** Plus and minus. The icon set has no minus glyph, so that one is a bar. */
function ZoomButton({
  kind,
  onPress,
  disabled,
}: {
  kind: 'in' | 'out';
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={kind === 'in' ? '+' : '−'}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.pressed]}>
      {kind === 'in' ? (
        <Icon name="plus" size={15} color={theme.text} />
      ) : (
        <View style={[styles.minus, { backgroundColor: theme.text }]} />
      )}
    </Pressable>
  );
}

/** Yandex's watermark lives bottom-right, so the chrome keeps off that corner. */
export const MAP_INSET = 10;

const styles = StyleSheet.create({
  zoom: {
    position: 'absolute',
    top: MAP_INSET,
    right: MAP_INSET,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    overflow: 'hidden',
  },
  button: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center' },
  divider: { height: Hairline, marginHorizontal: 6 },
  minus: { width: 12, height: 1.5, borderRadius: 1 },
  pressed: { opacity: 0.55 },
});
