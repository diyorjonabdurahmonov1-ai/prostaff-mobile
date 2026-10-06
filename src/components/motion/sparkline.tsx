/**
 * An 80×32 trend line that draws itself in.
 *
 * No axes, no fill, no labels — it sits in the corner of a stat card and its
 * only job is the shape of the last few days. The draw-in animates
 * `strokeDashoffset` from "whole path hidden" to zero, so the line appears to
 * be written left to right.
 */

import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Ease } from '@/constants/motion';
import { Duration } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  delay?: number;
}

export function Sparkline({
  values,
  color,
  width = 80,
  height = 32,
  strokeWidth = 1.5,
  delay = 0,
}: SparklineProps) {
  const progress = useSharedValue(0);

  // Rough path length: the diagonal budget is close enough for a dash offset,
  // and overestimating only means the line starts fully hidden.
  const pathLength = width + height * values.length;

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: Duration.page + 180, easing: Ease.out }),
    );
  }, [progress, delay, values.length]);

  const animated = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - progress.value),
  }));

  const d = buildPath(values, width, height, strokeWidth);
  if (!d) return null;

  return (
    <Svg width={width} height={height}>
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={pathLength}
        animatedProps={animated}
      />
    </Svg>
  );
}

/** Maps the series into the box, keeping half a stroke of padding each side. */
function buildPath(values: number[], width: number, height: number, stroke: number): string | null {
  if (values.length < 2) return null;

  const pad = stroke / 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const usable = height - pad * 2;

  return values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width;
      // A flat series sits on the centre line rather than collapsing to zero.
      const ratio = span === 0 ? 0.5 : (value - min) / span;
      const y = pad + (1 - ratio) * usable;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
