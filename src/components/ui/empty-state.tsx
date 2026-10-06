
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';

import { Icon, type IconName } from './icon';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** iOS "no content" placeholder: muted glyph, title2 headline, footnote copy. */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.glyph, { backgroundColor: theme.fillQuaternary }]}>
        <Icon name={icon} size={34} color={theme.textTertiary} />
      </View>
      <Text style={[Type.title3, styles.title, { color: theme.text }]}>{title}</Text>
      {message ? (
        <Text style={[Type.subhead, styles.message, { color: theme.textSecondary }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} size="sm" pill />
        </View>
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={theme.textMuted} size="large" />
      {label ? (
        <Text style={[Type.subhead, styles.message, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  glyph: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { textAlign: 'center' },
  message: { textAlign: 'center' },
  action: { marginTop: 8 },
});
