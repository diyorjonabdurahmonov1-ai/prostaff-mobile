import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';

import { Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

export type ButtonVariant =
  | 'primary' // filled with the tint
  | 'secondary' // tinted — soft tint wash
  | 'outline' // 1.5px tint border on nothing
  | 'gray' // neutral system fill
  | 'ghost' // plain, label only
  | 'danger'; // filled destructive

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  /** Pill shape, like the "Get" buttons in the App Store. */
  pill?: boolean;
  /**
   * Show only the icon. `label` still carries the accessible name — use this
   * where a secondary action sits beside a primary one and the two would
   * otherwise fight over a row that cannot hold both labels.
   */
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<ButtonSize, { height: number; font: number; padH: number; icon: number }> = {
  sm: { height: 36, font: 14, padH: 16, icon: 16 },
  md: { height: 52, font: 16, padH: 20, icon: 20 },
  lg: { height: 56, font: 17, padH: 24, icon: 22 },
};

/**
 * The system button — 56pt tall at full size, 16pt corners, and a spring-loaded
 * press instead of a flat opacity flash. Filled variants carry a hairline of
 * white at low alpha along the edge, which reads as a soft inner glow and stops
 * the blue from looking like a flat sticker on a white page.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  fullWidth = true,
  pill = false,
  iconOnly = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const dims = SIZES[size];
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: theme.primary, fg: theme.onPrimaryText },
    secondary: { bg: theme.primarySoft, fg: theme.primary },
    outline: { bg: 'transparent', fg: theme.primary },
    gray: { bg: theme.fillTertiary, fg: theme.text },
    ghost: { bg: 'transparent', fg: theme.primary },
    danger: { bg: theme.danger, fg: '#FFFFFF' },
  };
  const colors = palette[variant];
  const filled = variant === 'primary' || variant === 'danger';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      scaleTo={variant === 'ghost' ? 1 : 0.975}
      dim={variant === 'ghost' ? 0.55 : 0.9}
      style={[
        styles.base,
        Squircle,
        {
          // `minHeight`, not `height`: a long label — and Uzbek labels are long
          // — wraps to a second line rather than being clipped inside a box
          // that cannot grow. This is what left buttons looking squashed.
          minHeight: dims.height,
          paddingHorizontal: iconOnly ? 0 : dims.padH,
          width: iconOnly ? dims.height : undefined,
          backgroundColor: colors.bg,
          borderRadius: pill ? Radius.pill : size === 'sm' ? Radius.md : Radius.button,
        },
        filled ? styles.glow : null,
        variant === 'outline' ? { borderWidth: 1.5, borderColor: theme.primary } : null,
        fullWidth ? styles.fullWidth : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : iconOnly ? (
        <Icon name={icon ?? 'chevron-forward'} size={dims.icon} color={colors.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={dims.icon} color={colors.fg} /> : null}
          {/* Two lines and a shrinkable box: the label gives way before the
              icon does, and wraps before it truncates. */}
          <Text
            numberOfLines={2}
            style={[
              Type.headline,
              styles.label,
              { color: colors.fg, fontSize: dims.font, lineHeight: dims.font + 4 },
            ]}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={dims.icon} color={colors.fg} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  glow: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 1,
  },
  label: { flexShrink: 1, textAlign: 'center' },
});
