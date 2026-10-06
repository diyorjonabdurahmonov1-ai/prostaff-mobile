/**
 * The system's entrance: rise 12pt while fading in.
 *
 * Opacity eases out (a fade that overshoots looks like a flicker) while the
 * translate rides the signature spring, so the element settles just past its
 * resting position and comes back. Pass `index` to stagger a group — the delay
 * is computed here so callers never hand-write `delay={i * 70}`.
 */

import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Ease, staggerDelay } from '@/constants/motion';
import { Duration, Stagger } from '@/constants/theme';

interface FadeUpProps {
  children: ReactNode;
  /** Position in a staggered group. Delay = index × step, capped at 8 items. */
  index?: number;
  /** Extra delay in ms, added on top of the stagger. */
  delay?: number;
  /** Per-item stagger step. Lists use 70ms, cards 100ms. */
  step?: number;
  /** How far it travels. Negative values drop in from above. */
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeUp({
  children,
  index = 0,
  delay = 0,
  step = Stagger.list,
  distance = 12,
  duration = Duration.base,
  style,
}: FadeUpProps) {
  const progress = useSharedValue(0);
  const total = delay + staggerDelay(index, step);

  useEffect(() => {
    progress.value = withDelay(total, withTiming(1, { duration, easing: Ease.spring }));
  }, [progress, total, duration]);

  const animated = useAnimatedStyle(() => ({
    // Clamped separately from the spring so the overshoot never flickers alpha.
    opacity: Math.min(1, Math.max(0, progress.value * 1.4)),
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Scale-in for things that *appear* rather than arrive — a logo, a thumbnail
 * dropped into an upload slot, a chip being added.
 */
export function PopIn({
  children,
  delay = 0,
  from = 0.6,
  duration = Duration.page,
  style,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Ease.spring }));
  }, [progress, delay, duration]);

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 2),
    transform: [{ scale: from + (1 - from) * progress.value }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
