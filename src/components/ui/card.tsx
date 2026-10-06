import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Hairline, Radius, Shadow, Squircle } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  padded?: boolean;
  /** Lift the card off the grouped background with a soft iOS shadow. */
  elevated?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A grouped-content card: secondary grouped surface, continuous corners and —
 * when selected — a tinted wash with a hairline tint border, the way iOS marks
 * a chosen option.
 */
export function Card({
  children,
  onPress,
  selected = false,
  padded = true,
  elevated = false,
  radius = Radius.lg,
  style,
}: CardProps) {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';

  // A shadow can't escape an `overflow: hidden` box, so elevated cards don't clip.
  const cardStyle: StyleProp<ViewStyle> = [
    elevated ? null : styles.card,
    Squircle,
    {
      borderRadius: radius,
      backgroundColor: selected ? theme.surfaceSelected : theme.surface,
      borderWidth: selected ? Hairline * 3 : 0,
      borderColor: selected ? theme.primary : 'transparent',
    },
    elevated && !dark ? Shadow.card : null,
    padded ? styles.padded : null,
    style,
  ];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={cardStyle} dim={0.94}>
        {children}
      </PressableScale>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  padded: { padding: 16 },
});
