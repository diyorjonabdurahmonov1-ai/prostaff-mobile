import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Motion, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `md` for tab-style switches, `lg` for a form field the thumb has to fill. */
  size?: 'md' | 'lg';
}

const TRACK_PADDING = 4;
const HEIGHTS = { md: 40, lg: 52 } as const;

/**
 * Segmented control: a filled track with a thumb that springs between
 * segments.
 *
 * There are no dividers between inactive segments — the thumb travelling is
 * what communicates the choice, and hairlines under a moving object only add
 * noise. The thumb's spring is the same one the toggle knob uses, so the two
 * controls feel like the same mechanism.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedProps<T>) {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: withSpring(index * segmentWidth, Motion.toggle) }],
  }));

  const height = HEIGHTS[size];

  /**
   * Four segments on a 320pt-wide phone leave each label about 58pt — right at
   * the width of "Hammasi" at 15pt, so the admin filters truncated on small
   * screens. Past three segments the label steps down a size instead.
   */
  const dense = options.length > 3;
  const labelStyle = dense
    ? { active: Type.footnoteEmphasized, idle: Type.footnote }
    : { active: Type.subheadEmphasized, idle: Type.subhead };

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        Squircle,
        { height, backgroundColor: theme.fillTertiary },
      ]}>
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            Squircle,
            thumbStyle,
            { backgroundColor: dark ? theme.surfaceElevated : '#FFFFFF' },
            dark ? null : Shadow.thumb,
          ]}
        />
      ) : null}

      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.segment, pressed && styles.pressed]}>
            <Text
              numberOfLines={1}
              style={[
                active ? labelStyle.active : labelStyle.idle,
                styles.label,
                { color: active ? theme.text : theme.textSecondary },
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: TRACK_PADDING,
    borderRadius: Radius.lg - 2,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: Radius.md - 2,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  label: { textAlign: 'center' },
});
