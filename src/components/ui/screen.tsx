import { type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Hairline, Layout, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  /** `background` = grouped background (default), `surface` = plain white/black. */
  background?: 'background' | 'surface';
  contentStyle?: ViewStyle;
  /**
   * Pinned navigation bar, rendered above the scroll view so the back button
   * stays reachable. Large titles belong in `children` instead — iOS scrolls
   * those away on purpose.
   */
  header?: ReactNode;
  /** Pinned bottom bar — separated by a hairline, respects the home indicator. */
  footer?: ReactNode;
  /** Passed straight to the ScrollView (pull to refresh). */
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
}

/**
 * Screen scaffold with iOS behaviours baked in: grouped background, automatic
 * content insets, interactive keyboard dismissal and a hairline-separated
 * footer bar.
 *
 * The keyboard is handled in two halves. `KeyboardAvoidingView` shrinks the
 * frame so the footer button stays reachable, and `useKeyboardAwareScroll`
 * scrolls the focused field above the keyboard — without the second half a
 * field halfway down a form simply stays hidden behind it.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'bottom'],
  background = 'background',
  contentStyle,
  header,
  footer,
  refreshControl,
  onScroll,
}: ScreenProps) {
  const theme = useTheme();
  const padding = padded
    ? { paddingHorizontal: Layout.gutter, paddingVertical: Layout.gutter }
    : undefined;

  const inner = <View style={[styles.inner, padding, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: theme[background] }]}>
      {/* `padding` on Android too: KeyboardAvoidingView measures its own frame,
          so when the window already resized it settles at zero rather than
          double-counting the keyboard. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {header}
        {scroll ? (
          <KeyboardAwareScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={refreshControl}
            onScroll={onScroll}
          >
            {inner}
          </KeyboardAwareScrollView>
        ) : (
          <View style={styles.flex}>{inner}</View>
        )}

        {footer ? (
          <View
            style={[
              styles.footer,
              { backgroundColor: theme.barBackground, borderTopColor: theme.separator },
            ]}
          >
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flex: 1 },
  footer: {
    borderTopWidth: Hairline,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerInner: { width: '100%', maxWidth: MaxContentWidth },
});
