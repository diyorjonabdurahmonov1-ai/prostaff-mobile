import { type TextProps, type TextStyle } from 'react-native';

// The app's Text, not React Native's — so this inherits the opt-out from the
// OS font-size setting along with everything else.
import { Text } from '@/components/text';
import { Type, type ThemeColor, type TypeVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface AppTextProps extends TextProps {
  /** An iOS text style from the SF Pro ramp. Defaults to `body`. */
  variant?: TypeVariant;
  /** Semantic colour key. Defaults to the primary label. */
  color?: ThemeColor;
  /** Literal colour, wins over `color`. */
  tint?: string;
  align?: TextStyle['textAlign'];
  /** Overrides the weight of the chosen variant. */
  weight?: TextStyle['fontWeight'];
}

/**
 * Every piece of text in the app should go through here so sizes, leading and
 * tracking stay on the iOS ramp instead of drifting to arbitrary values.
 */
export function AppText({
  variant = 'body',
  color = 'text',
  tint,
  align,
  weight,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        Type[variant],
        { color: tint ?? theme[color] },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
      {...rest}
    />
  );
}
