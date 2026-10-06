/**
 * A highlight that sweeps across a surface once every few seconds.
 *
 * Used on the balance card, where it reads as "this number is live". It is
 * deliberately faint (15% at the crest) and slow — a fast or bright sweep
 * turns a card into a loading skeleton, which is the opposite of the message.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Ease } from '@/constants/motion';
import { Loop } from '@/constants/theme';

interface ShimmerProps {
  /** Stops the loop when false — e.g. while the card is off screen. */
  active?: boolean;
  duration?: number;
  /** Peak opacity of the highlight. */
  intensity?: number;
  color?: string;
  /** Match the parent's radius so the sweep clips to the card. */
  radius?: number;
}

export function Shimmer({
  active = true,
  duration = Loop.shimmer,
  intensity = 0.15,
  color = '#FFFFFF',
  radius = 0,
}: ShimmerProps) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active || width === 0) {
      cancelAnimation(progress);
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing: Ease.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [active, width, duration, progress]);

  // The band is half a card wide, so it travels from fully off the left edge
  // to fully off the right one.
  const band = width * 0.5;
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: -band + progress.value * (width + band) }],
  }));

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
      {width > 0 ? (
        <Animated.View style={[styles.band, { width: band }, animated]}>
          <LinearGradient
            colors={[`${color}00`, `${color}${alpha(intensity)}`, `${color}00`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** 0…1 opacity as the two hex digits a #RRGGBBAA colour needs. */
function alpha(value: number): string {
  return Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, '0');
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
