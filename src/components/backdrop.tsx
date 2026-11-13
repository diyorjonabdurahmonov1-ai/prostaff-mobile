/**
 * The living wash of colour behind the top of a screen.
 *
 * A flat grey page under white cards is correct and anonymous. Behind the top
 * of each main screen there are now four quiet layers:
 *
 *   1. three soft pools of the brand's colours, each drifting on its own slow
 *      loop so the page is never quite still;
 *   2. a fine dot grid that fades out downwards — texture, the way graph paper
 *      sits under a drawing;
 *   3. two dashed rings off the top-right corner, turning very slowly in
 *      opposite directions;
 *   4. a fade into the page colour, so that by a third of the way down the
 *      page is plain again and cards, text and contrast are exactly as before.
 *
 * Nothing here is touchable and nothing moves fast: the quickest loop takes
 * fourteen seconds. With "reduce motion" on, it all holds still.
 */

import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme, useThemeMode } from '@/hooks/use-theme';

/** How far down the wash reaches before the page is plain. */
const HEIGHT = 470;

type Tone = 'brand' | 'online' | 'busy';

/** The three pools, per tone: [left, right, low centre]. */
const TONES: Record<Tone, readonly [string, string, string]> = {
  brand: ['#3B84FF', '#14B8A6', '#8B5CF6'],
  online: ['#22C55E', '#14B8A6', '#3B84FF'],
  busy: ['#F79009', '#F43F5E', '#8B5CF6'],
};

/** One pool: where it sits, how big, and the loop it drifts on. */
interface Pool {
  /** Centre, as fractions of the window width and of HEIGHT. */
  x: number;
  y: number;
  /** Diameter, as a fraction of the window width. */
  size: number;
  opacity: number;
  /** How far it wanders, in points, and how long one way takes. */
  dx: number;
  dy: number;
  ms: number;
}

const POOLS: readonly [Pool, Pool, Pool] = [
  { x: 0.1, y: 0.1, size: 1.25, opacity: 0.34, dx: 36, dy: 22, ms: 17000 },
  { x: 0.98, y: 0.02, size: 1.1, opacity: 0.28, dx: -30, dy: 30, ms: 21000 },
  { x: 0.6, y: 0.62, size: 0.95, opacity: 0.17, dx: 26, dy: -24, ms: 14000 },
];

export function Backdrop({ tone = 'brand' }: { tone?: Tone }) {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const { width } = useWindowDimensions();
  const colors = TONES[tone];
  // Dark pages take far less colour before it reads as a glow on a screen.
  const k = dark ? 0.55 : 1;
  const ink = dark ? '#FFFFFF' : '#0B1B3A';

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {POOLS.map((pool, i) => (
        <DriftingPool key={i} pool={pool} color={colors[i]} width={width} strength={k} />
      ))}

      {/* The dot grid, and the fade that dissolves all of it into the page. */}
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="bd-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1.1" fill={ink} fillOpacity={dark ? 0.1 : 0.075} />
          </Pattern>
          <LinearGradient id="bd-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.background} stopOpacity={0} />
            <Stop offset="0.55" stopColor={theme.background} stopOpacity={0.35} />
            <Stop offset="1" stopColor={theme.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={HEIGHT} fill="url(#bd-dots)" />
        <Rect x="0" y="0" width={width} height={HEIGHT} fill="url(#bd-fade)" />
      </Svg>

      <Ring size={width * 0.78} right={-width * 0.3} top={-width * 0.36} color={colors[1]} ms={90000} strength={k} />
      <Ring size={width * 0.5} right={-width * 0.16} top={-width * 0.22} color={colors[0]} ms={70000} reverse strength={k} />
    </View>
  );
}

/** A soft disc of colour that wanders a little and breathes. */
function DriftingPool({
  pool,
  color,
  width,
  strength,
}: {
  pool: Pool;
  color: string;
  width: number;
  strength: number;
}) {
  const still = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    t.value = withRepeat(withTiming(1, { duration: pool.ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [still, pool.ms, t]);

  const drift = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * pool.dx },
      { translateY: t.value * pool.dy },
      { scale: 1 + t.value * 0.08 },
    ],
  }));

  const size = width * pool.size;
  return (
    <Animated.View
      style={[
        styles.pool,
        { width: size, height: size, left: width * pool.x - size / 2, top: HEIGHT * pool.y - size / 2 },
        drift,
      ]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={pool.opacity * strength} />
            <Stop offset="0.55" stopColor={color} stopOpacity={pool.opacity * strength * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#g)" />
      </Svg>
    </Animated.View>
  );
}

/** A dashed circle, mostly off the corner, turning once in a minute or more. */
function Ring({
  size,
  right,
  top,
  color,
  ms,
  reverse,
  strength,
}: {
  size: number;
  right: number;
  top: number;
  color: string;
  ms: number;
  reverse?: boolean;
  strength: number;
}) {
  const still = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    turn.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [still, ms, turn]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(reverse ? -1 : 1) * turn.value * 360}deg` }],
  }));

  return (
    <Animated.View style={[styles.pool, { width: size, height: size, right, top }, spin]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 2}
          fill="none"
          stroke={color}
          strokeOpacity={0.3 * strength}
          strokeWidth={1.5}
          strokeDasharray="2 12"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, height: HEIGHT, overflow: 'hidden' },
  pool: { position: 'absolute' },
});
