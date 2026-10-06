/**
 * The product's own map pin.
 *
 * Yandex's stock balloon is a different design language — red, glossy, and
 * nothing like anything else on screen. Every mark on a map here is this pin
 * instead: the brand teardrop with a white eye, a soft ground shadow, and a tip
 * that sits exactly on the point it names.
 *
 * `lifted` is used by the picker while the map is being dragged: the pin rises
 * and its shadow spreads, which is what makes it read as *hovering over* the
 * map rather than *stuck to* it.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type PinTone = 'primary' | 'success' | 'warning';

interface MapPinProps {
  tone?: PinTone;
  size?: number;
  lifted?: boolean;
  /** A pulse ring behind the pin — "this one is live". */
  halo?: boolean;
}

/** The pin's height is 1.24× its width, so a size gives the whole footprint. */
export function pinHeight(size: number): number {
  return size * 1.24;
}

export function MapPin({ tone = 'primary', size = 34, lifted = false, halo = false }: MapPinProps) {
  const theme = useTheme();
  const fill =
    tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.primary;
  const height = pinHeight(size);

  return (
    <View style={styles.wrap} pointerEvents="none">
      {halo ? (
        <View
          style={[
            styles.halo,
            { backgroundColor: `${fill}22`, borderColor: `${fill}55`, bottom: -6 },
          ]}
        />
      ) : null}

      <View style={[styles.shadow, { backgroundColor: theme.scrim }, lifted && styles.shadowWide]} />

      <View style={lifted ? styles.lifted : undefined}>
        <Svg width={size} height={height} viewBox="0 0 24 30">
          {/* Outline first so the pin stays legible on dark map areas. */}
          <Path
            d="M12 0.5C6.2 0.5 1.8 4.9 1.8 10.4 1.8 17.6 10.7 28 12 29.5c1.3-1.5 10.2-11.9 10.2-19.1C22.2 4.9 17.8 0.5 12 0.5z"
            fill="#FFFFFF"
            opacity={0.9}
          />
          <Path
            d="M12 2c-5 0-9 3.8-9 8.4C3 16.6 12 26.6 12 26.6S21 16.6 21 10.4C21 5.8 17 2 12 2z"
            fill={fill}
          />
          <Circle cx={12} cy={10.2} r={3.4} fill="#FFFFFF" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  lifted: { transform: [{ translateY: -6 }] },
  shadow: {
    position: 'absolute',
    bottom: 1,
    width: 12,
    height: 4,
    borderRadius: 6,
    opacity: 0.3,
  },
  shadowWide: { width: 20, opacity: 0.16 },
  halo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
});
