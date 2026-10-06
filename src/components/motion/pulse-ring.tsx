/**
 * A ring that expands out of a dot and fades — "this is live right now".
 *
 * Informational only: it runs while `active` is true and stops dead otherwise,
 * so a pulse on screen always means something is actually happening (worker
 * online, user connected, a new marker landing on the map).
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Ease } from '@/constants/motion';
import { Loop } from '@/constants/theme';

interface PulseRingProps {
  /** Diameter of the thing being pulsed — the ring starts at this size. */
  size: number;
  color: string;
  active?: boolean;
  /** How far the ring grows. The spec's toggle dot uses 1.6. */
  to?: number;
  duration?: number;
  /** Number of overlapping rings; each starts a fraction of a cycle later. */
  rings?: number;
  /** Solid disc instead of a stroked ring. */
  filled?: boolean;
}

export function PulseRing({
  size,
  color,
  active = true,
  to = 1.6,
  duration = Loop.pulse,
  rings = 1,
  filled = false,
}: PulseRingProps) {
  return (
    <>
      {Array.from({ length: rings }, (_, i) => (
        <Ring
          key={i}
          size={size}
          color={color}
          active={active}
          to={to}
          duration={duration}
          delay={(duration / rings) * i}
          filled={filled}
        />
      ))}
    </>
  );
}

function Ring({
  size,
  color,
  active,
  to,
  duration,
  delay,
  filled,
}: Required<Omit<PulseRingProps, 'rings'>> & { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Ease.out }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [active, progress, duration, delay]);

  const animated = useAnimatedStyle(() => ({
    opacity: (1 - progress.value) * 0.55,
    transform: [{ scale: 1 + (to - 1) * progress.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: filled ? 0 : 2,
          borderColor: color,
          backgroundColor: filled ? color : 'transparent',
        },
        animated,
      ]}
    />
  );
}
