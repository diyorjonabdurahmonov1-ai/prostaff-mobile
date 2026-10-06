import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';
import { Text, TextInput } from '@/components/text';

import { BrandMark } from '@/components/brand-mark';
import { FadeUp, PopIn } from '@/components/motion';
import { Icon, type IconName } from '@/components/ui/icon';
import { Duration, Layout, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useScrollToFocused } from '@/hooks/use-keyboard-aware-scroll';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';

/**
 * Pieces shared by the welcome / sign-in / sign-up / reset screens so the four
 * of them stay pixel-identical.
 */

/** Derived from the prop so it tracks React Native's own focus event type. */
type FocusEventArg = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

/**
 * Brand tile, wordmark and one line of context.
 *
 * The mark springs up from 0.6 scale, the wordmark and tagline follow 180ms
 * behind — the sequence is the same one the native splash hands over to, so
 * launching the app reads as a single continuous move.
 */
export function AuthBrand({ subtitle, size = 72 }: { subtitle?: string; size?: number }) {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const t = useT();

  return (
    <View style={styles.brand}>
      <PopIn duration={Duration.page} style={dark ? undefined : Shadow.float}>
        <BrandMark size={size} />
      </PopIn>

      <FadeUp delay={180} style={styles.brandText}>
        <Text style={[Type.title1, styles.wordmark, { color: theme.text }]}>
          {t('common.appName')}
        </Text>
        {subtitle ? (
          <Text style={[Type.subhead, styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </FadeUp>
    </View>
  );
}

/**
 * One cell of a grouped form: optional static prefix, then the input.
 *
 * The auth screens use bare `TextInput`s rather than `TextField`, so they would
 * miss the "reveal me above the keyboard" hook that `TextField` carries. Rather
 * than repeat an `onFocus` on every field across four screens, the row wires it
 * onto the input it wraps — a new field added here gets the behaviour for free.
 */
export function FieldRow({
  prefix,
  icon,
  children,
}: {
  prefix?: string;
  icon?: IconName;
  children: ReactNode;
}) {
  const theme = useTheme();
  const scrollToFocused = useScrollToFocused();

  const inputs = Children.map(children, (child) => {
    if (!isValidElement(child) || child.type !== TextInput) return child;
    const props = child.props as TextInputProps;
    return cloneElement(child as ReactElement<TextInputProps>, {
      onFocus: (event: FocusEventArg) => {
        scrollToFocused();
        props.onFocus?.(event);
      },
    });
  });

  return (
    <View style={styles.fieldRow}>
      {icon ? <Icon name={icon} size={20} color={theme.textTertiary} /> : null}
      {prefix ? <Text style={[Type.body, { color: theme.text }]}>{prefix}</Text> : null}
      {inputs}
    </View>
  );
}

/**
 * Language switcher.
 *
 * A three-way pill rather than a cycling button: someone who opens the app in
 * the wrong language should not have to guess how many taps get them home.
 */
export function LanguagePill() {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const { lang, setLang, languages } = useI18n();

  return (
    <View style={[styles.pillTrack, Squircle, { backgroundColor: theme.fillTertiary }]}>
      {languages.map((code) => {
        const active = code === lang;
        return (
          <Pressable
            key={code}
            onPress={() => setLang(code)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.pillSegment,
              Squircle,
              active && { backgroundColor: theme.surface },
              active && !dark ? Shadow.thumb : null,
              pressed && !active && { opacity: 0.5 },
            ]}>
            <Text
              style={[
                active ? Type.caption1Emphasized : Type.caption1,
                { color: active ? theme.text : theme.textSecondary },
              ]}>
              {LANGUAGE_LABELS[code] ?? code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Endonyms — a language picker in a language you cannot read is useless. */
const LANGUAGE_LABELS: Record<string, string> = {
  uz: "O'zbek",
  ru: 'Рус',
  en: 'Eng',
};

const styles = StyleSheet.create({
  brand: { alignItems: 'center', paddingTop: 32, gap: 16 },
  brandText: { alignItems: 'center', gap: 6 },
  wordmark: { letterSpacing: -0.5 },
  subtitle: { textAlign: 'center', paddingHorizontal: 32 },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    minHeight: 56,
  },

  pillTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: Radius.xl,
    gap: 2,
  },
  pillSegment: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
