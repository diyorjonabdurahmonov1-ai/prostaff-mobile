/**
 * The brand's background texture: a 24pt dot grid at 4% blue.
 *
 * Drawn as an SVG pattern rather than a few hundred `<View>` dots — the whole
 * field is one node, so it costs nothing to lay a full screen of it down.
 * Pass a scroll offset to have it drift at 0.15× the content speed, which
 * gives depth without ever being noticeable as movement.
 */

import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

interface DotGridProps {
  color?: string;
  /** 0.04 in light mode, 0.06 in dark — dots need more alpha on black. */
  opacity?: number;
  /** Grid pitch. 24 is the system value. */
  spacing?: number;
  dotRadius?: number;
  /** Scroll position, in points. Drives the parallax drift. */
  offset?: SharedValue<number>;
  parallax?: number;
}

export function DotGrid({
  color = '#1B6EF3',
  opacity = 0.04,
  spacing = 24,
  dotRadius = 1.5,
  offset,
  parallax = 0.15,
}: DotGridProps) {
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateY: offset ? -offset.value * parallax : 0 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.field, { opacity }, drift]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="ishtopish-dots"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse">
            <Circle cx={dotRadius} cy={dotRadius} r={dotRadius} fill={color} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ishtopish-dots)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Over-extended vertically so the parallax drift never exposes an edge.
  field: { position: 'absolute', top: -120, left: 0, right: 0, bottom: -120 },
});
