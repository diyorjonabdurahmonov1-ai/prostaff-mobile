import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Hairline, Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  /** Label next to the back chevron, iOS shows the previous screen's title. */
  backLabel?: string;
  right?: ReactNode;
  rightIcon?: IconName;
  onRightPress?: () => void;
  /** iOS large navigation title (Settings / Mail style). */
  large?: boolean;
  /** Hairline under the bar. Off by default for large titles, like UIKit. */
  border?: boolean;
}

/**
 * iOS navigation bar. Inline mode is the 44pt centred bar; `large` is the
 * 34pt bold title that sits under an optional back row.
 */
export function Header({
  title,
  subtitle,
  back,
  onBack,
  backLabel,
  right,
  rightIcon,
  onRightPress,
  large = false,
  border,
}: HeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  const showBack = back ?? router.canGoBack();

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  const rightNode =
    right ??
    (rightIcon ? (
      <Pressable onPress={onRightPress} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
        <Icon name={rightIcon} size={22} color={theme.primary} />
      </Pressable>
    ) : null);

  const backButton = (
    <Pressable
      onPress={handleBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={backLabel ?? 'Back'}
      style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
      <Icon name="chevron-back" size={28} color={theme.primary} style={styles.backChevron} />
      {backLabel ? (
        <Text style={[Type.body, { color: theme.primary }]} numberOfLines={1}>
          {backLabel}
        </Text>
      ) : null}
    </Pressable>
  );

  if (large) {
    return (
      <View style={[styles.largeWrap, border ? { borderBottomWidth: Hairline, borderBottomColor: theme.separator } : null]}>
        {showBack || rightNode ? (
          <View style={styles.largeTopRow}>
            <View style={styles.largeTopSide}>{showBack ? backButton : null}</View>
            <View style={[styles.largeTopSide, styles.alignEnd]}>{rightNode}</View>
          </View>
        ) : null}

        <View style={styles.largeTitleRow}>
          {title ? (
            // Two lines, like an iOS large title. A firm's own name lands here
            // and 32pt type runs out of a narrow screen after a dozen glyphs;
            // truncating somebody's business name is worse than wrapping it.
            <Text
              style={[Type.largeTitle, styles.largeTitle, { color: theme.text }]}
              numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </View>

        {subtitle ? (
          <Text style={[Type.subhead, styles.largeSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        (border ?? true) ? { borderBottomWidth: Hairline, borderBottomColor: theme.separator } : null,
      ]}>
      <View style={styles.side}>{showBack ? backButton : null}</View>

      <View style={styles.center}>
        {title ? (
          <Text style={[Type.headline, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.alignEnd]}>{rightNode}</View>
    </View>
  );
}

/**
 * Standalone large title for screens that compose their own header row —
 * keeps the 34pt/bold ramp consistent everywhere.
 */
export function LargeTitle({ children, style }: { children: string; style?: object }) {
  const theme = useTheme();
  return (
    <Text style={[Type.largeTitle, { color: theme.text, paddingHorizontal: Layout.gutter }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.navBarHeight,
    paddingHorizontal: 8,
  },
  side: { minWidth: 60, justifyContent: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 8 },
  backChevron: { marginLeft: -6, marginRight: -2 },
  pressed: { opacity: 0.4 },

  largeWrap: { paddingBottom: 6 },
  largeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.navBarHeight,
    paddingHorizontal: 8,
  },
  largeTopSide: { flex: 1, justifyContent: 'center' },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingTop: 2,
  },
  largeTitle: { flex: 1 },
  largeSubtitle: { paddingHorizontal: Layout.gutter, marginTop: 2 },
});
