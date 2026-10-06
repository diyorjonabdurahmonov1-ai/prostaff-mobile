import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Radius, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n/dictionaries';
import type { OrderStatus } from '@/lib/types';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Small coloured dot before the label, iOS status style. */
  dot?: boolean;
}

/** Capsule status label — colour at low opacity behind the colour at full strength. */
export function Badge({ label, tone = 'neutral', dot = false }: BadgeProps) {
  const theme = useTheme();

  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.fillTertiary, fg: theme.textSecondary },
    primary: { bg: theme.primarySoft, fg: theme.primary },
    success: { bg: theme.successSoft, fg: theme.success },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
  };
  const c = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: c.fg }]} /> : null}
      <Text style={[Type.caption1Emphasized, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'warning',
  matching: 'warning',
  invited: 'warning',
  accepted: 'success',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'danger',
  // Somebody answered and the answer was no — a decision, not a timeout, so it
  // reads as one rather than fading out next to "Muddati tugadi".
  rejected: 'danger',
  expired: 'neutral',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const t = useT();
  const key = `status.${status}` as TranslationKey;
  return <Badge label={t(key)} tone={STATUS_TONE[status]} dot />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
