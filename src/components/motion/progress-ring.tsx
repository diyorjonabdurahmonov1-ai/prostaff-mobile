/**
 * A stroked ring that depletes as time runs out, shifting hue as it goes.
 *
 * The colour is interpolated, not switched: a countdown that snaps from green
 * to red at a threshold reads as a glitch, while a continuous ramp reads as
 * pressure building. Green while there's time, amber around the halfway mark,
 * rose in the last quarter.
 */

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 1 = full ring, 0 = empty. Owned by the caller so it can drive the number too. */
  progress: SharedValue<number>;
  size?: number;
  stroke?: number;
  trackColor: string;
  /** Colours from empty → full, paired with `stops`. */
  colors: readonly string[];
  /** Progress values each colour is pinned to. Same length as `colors`. */
  stops?: readonly number[];
  /** Depletes anticlockwise — the direction a timer draining reads best in. */
  counterClockwise?: boolean;
  /** Centre content (the countdown figure). Never mirrored by the flip. */
  children?: ReactNode;
}

export function ProgressRing({
  progress,
  size = 88,
  stroke = 5,
  trackColor,
  colors,
  stops = colors.map((_, i) => i / (colors.length - 1)),
  counterClockwise = true,
  children,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const animated = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    stroke: interpolateColor(progress.value, stops as number[], colors as string[]),
  }));

  return (
    <View style={{ width: size, height: size }}>
      {/* The flip mirrors the arc only — content sits in a separate layer. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          counterClockwise ? styles.mirrored : null,
        ]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            // Start the arc at 12 o'clock instead of 3.
            originX={size / 2}
            originY={size / 2}
            rotation={-90}
            animatedProps={animated}
          />
        </Svg>
      </View>

      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mirrored: { transform: [{ scaleX: -1 }] },
  center: { alignItems: 'center', justifyContent: 'center' },
});
