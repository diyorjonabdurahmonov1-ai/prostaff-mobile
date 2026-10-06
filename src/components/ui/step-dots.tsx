/**
 * Progress through a multi-step flow, as dots where the current one stretches
 * into a pill.
 *
 * Width carries the state instead of colour alone, so it survives both colour
 * blindness and a glance. Completed steps stay tinted — going back a step
 * should not look like losing progress.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import { Ease } from '@/constants/motion';
import { Duration, Motion, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DOT = 8;
const PILL = 28;

interface StepDotsProps {
  /** Zero-based index of the current step. */
  step: number;
  total: number;
}

export function StepDots({ step, total }: StepDotsProps) {
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} active={i === step} done={i < step} />
      ))}
    </View>
  );
}

function Dot({ active, done }: { active: boolean; done: boolean }) {
  const theme = useTheme();

  const animated = useAnimatedStyle(() => ({
    width: withSpring(active ? PILL : DOT, Motion.snappy),
    backgroundColor: withTiming(
      active || done ? theme.primary : theme.fill,
      { duration: Duration.base, easing: Ease.out },
    ),
  }));

  return <Animated.View style={[styles.dot, animated]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { height: DOT, borderRadius: Radius.pill },
});
