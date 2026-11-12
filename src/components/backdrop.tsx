/**
 * The soft wash of colour behind the top of a screen.
 *
 * A flat grey page under white cards is correct and anonymous. Three blurred
 * pools of the brand's own colours — blue, teal, violet — fading out by a
 * third of the way down give the app a face without getting in the way of
 * anything on top of it: by the time the content starts in earnest the page
 * is plain again, so cards, text and contrast are exactly as they were.
 *
 * Drawn as radial gradients in one SVG (a blur filter is not something React
 * Native has), sized to the window, and never touchable.
 */

import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useThemeMode } from '@/hooks/use-theme';

/** How far down the wash reaches before the page is plain. */
const HEIGHT = 440;

type Tone = 'brand' | 'online' | 'busy';

/** The three pools, per tone: [left, right, low centre]. */
const TONES: Record<Tone, readonly [string, string, string]> = {
  brand: ['#3B84FF', '#14B8A6', '#8B5CF6'],
  online: ['#22C55E', '#14B8A6', '#3B84FF'],
  busy: ['#F79009', '#F43F5E', '#8B5CF6'],
};

export function Backdrop({ tone = 'brand' }: { tone?: Tone }) {
  const dark = useThemeMode() === 'dark';
  const { width } = useWindowDimensions();
  const [a, b, c] = TONES[tone];
  // Dark pages take far less colour before it reads as a glow on a screen.
  const k = dark ? 0.55 : 1;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <RadialGradient id="bd-a" cx="12%" cy="8%" rx="62%" ry="58%" fx="12%" fy="8%">
            <Stop offset="0" stopColor={a} stopOpacity={0.30 * k} />
            <Stop offset="1" stopColor={a} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bd-b" cx="96%" cy="2%" rx="58%" ry="52%" fx="96%" fy="2%">
            <Stop offset="0" stopColor={b} stopOpacity={0.24 * k} />
            <Stop offset="1" stopColor={b} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bd-c" cx="62%" cy="46%" rx="50%" ry="44%" fx="62%" fy="46%">
            <Stop offset="0" stopColor={c} stopOpacity={0.14 * k} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={HEIGHT} fill="url(#bd-a)" />
        <Rect x="0" y="0" width={width} height={HEIGHT} fill="url(#bd-b)" />
        <Rect x="0" y="0" width={width} height={HEIGHT} fill="url(#bd-c)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, height: HEIGHT },
});
