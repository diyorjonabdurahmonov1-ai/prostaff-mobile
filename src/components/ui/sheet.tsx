import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: ReactNode;
  /** Buttons pinned under the content. */
  footer?: ReactNode;
}

/**
 * iOS-style bottom sheet: a grabber, a title block and a keyboard-aware body
 * that slides up over a dimmed backdrop. Tapping the backdrop dismisses.
 */
export function Sheet({ visible, onClose, title, message, children, footer }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={onClose} />

        {/* `padding` on Android too — it measures its own frame, so a window
            that already resized settles at zero instead of double-counting. */}
        <KeyboardAvoidingView behavior="padding">
          <View
            style={[
              styles.sheet,
              Squircle,
              {
                backgroundColor: theme.background,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.fill }]} />

            <View style={styles.head}>
              <Text style={[Type.title3, { color: theme.text }]}>{title}</Text>
              {message ? (
                <Text style={[Type.footnote, { color: theme.textSecondary }]}>{message}</Text>
              ) : null}
            </View>

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}>
              {children}
            </KeyboardAwareScrollView>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: 8,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 12 },
  head: { paddingHorizontal: Layout.gutter + 4, gap: 4, paddingBottom: 16 },
  body: { paddingHorizontal: Layout.gutter, gap: 14, paddingBottom: 8 },
  footer: { paddingHorizontal: Layout.gutter, paddingTop: 12, gap: 8 },
});
