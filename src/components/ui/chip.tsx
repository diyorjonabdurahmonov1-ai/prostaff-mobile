import { type ReactNode, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Ease } from '@/constants/motion';
import { Duration, Motion, Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

interface ChipProps {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  tone?: 'neutral' | 'tint';
}

/** Read-only capsule — the metadata pills that sit under a title. */
export function Chip({ label, icon, onPress, tone = 'neutral' }: ChipProps) {
  const theme = useTheme();
  const bg = tone === 'tint' ? theme.primarySoft : theme.fillTertiary;
  const fg = tone === 'tint' ? theme.primary : theme.textSecondary;

  const body = (
    <>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={[Type.footnote, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, { backgroundColor: bg }]}>{body}</View>;
  }
  return (
    <PressableScale onPress={onPress} style={[styles.chip, { backgroundColor: bg }]} dim={0.6}>
      {body}
    </PressableScale>
  );
}

interface SelectableChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: IconName;
  /** Tints the icon and the selected fill — categories carry their own colour. */
  tint?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Filter capsule. Selecting one kicks a 1 → 1.05 → 1 bounce, so the tap is
 * confirmed by the chip itself rather than by a checkmark appearing — the fill
 * change already carries the state, and a glyph sliding in would reflow the row.
 */
export function SelectableChip({ label, selected, onToggle, icon, tint }: SelectableChipProps) {
  const theme = useTheme();
  const accent = tint ?? theme.primary;

  const bounce = useSharedValue(0);
  // Skip the bounce on mount — only a real toggle should animate.
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (selected) {
      bounce.value = withSequence(
        withTiming(1, { duration: Duration.micro, easing: Ease.out }),
        withSpring(0, Motion.bouncy),
      );
    }
  }, [selected, bounce]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + bounce.value * 0.05 }],
  }));

  return (
    <AnimatedPressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        styles.selectable,
        { backgroundColor: selected ? accent : theme.fillTertiary },
        animated,
      ]}>
      {icon ? (
        <Icon
          name={icon}
          size={16}
          color={selected ? '#FFFFFF' : accent}
          duotoneOpacity={selected ? 0.32 : 0.22}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          selected ? Type.subheadEmphasized : Type.subhead,
          { color: selected ? '#FFFFFF' : theme.textSecondary },
        ]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  selectable: { minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.xl },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
