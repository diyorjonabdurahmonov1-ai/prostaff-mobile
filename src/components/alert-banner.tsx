/**
 * The standing warning at the top of a provider's panel.
 *
 * Deliberately not a notification. A notification is a thing that happened —
 * read once, gone. This is the state the account is in: the three free jobs are
 * spent and the balance is under the minimum, or a firm's month runs out on
 * Friday. Both stay true until somebody acts on them, and both are the reason
 * the phone has stopped ringing, so they belong above the fold rather than in a
 * list the person has to think to open.
 *
 * The whole card is the button when there is somewhere to go: the one thing a
 * worker reading "hisobingizda mablag' yo'q" wants is the top-up screen.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppAlert } from '@/lib/types';

interface AlertBannerProps {
  alert: AppAlert;
  /** Opens the wallet / the subscription explainer. Omit for a banner that only informs. */
  onAction?: (action: AppAlert['action']) => void;
  actionLabel?: string;
}

export function AlertBanner({ alert, onAction, actionLabel }: AlertBannerProps) {
  const theme = useTheme();

  // Three levels, three readings: something to know, something to plan for,
  // something that is blocking work right now.
  const tone = {
    info: { fg: theme.primary, bg: theme.primarySoftSolid, icon: 'info' as IconName },
    warning: { fg: theme.warningText, bg: theme.warningSoftSolid, icon: 'time' as IconName },
    danger: {
      fg: theme.dangerText,
      bg: theme.dangerSoftSolid,
      icon: 'alert-circle-outline' as IconName,
    },
  }[alert.level];

  const pressable = !!alert.action && !!onAction;

  return (
    <PressableScale
      onPress={pressable ? () => onAction?.(alert.action) : undefined}
      scaleTo={pressable ? 0.985 : 1}
      accessibilityLabel={`${alert.title}. ${alert.body}`}
      style={[styles.card, Squircle, { backgroundColor: tone.bg }]}>
      <Icon name={tone.icon} size={22} color={tone.fg} />

      <View style={styles.text}>
        <Text style={[Type.subheadEmphasized, { color: tone.fg }]}>{alert.title}</Text>
        <Text style={[Type.footnote, { color: theme.textSecondary }]}>{alert.body}</Text>
        {pressable && actionLabel ? (
          <Text style={[Type.footnoteEmphasized, styles.action, { color: tone.fg }]}>
            {actionLabel}
          </Text>
        ) : null}
      </View>

      {pressable ? <Icon name="chevron-forward" size={17} color={tone.fg} /> : null}
    </PressableScale>
  );
}

/**
 * Every alert the caller should see, stacked. Renders nothing when the account
 * is in good standing — which is the normal case, so it must not leave a gap.
 */
export function AlertBannerList({
  alerts,
  onAction,
  actionLabel,
  style,
}: {
  alerts: AppAlert[];
  onAction?: (action: AppAlert['action']) => void;
  actionLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (alerts.length === 0) return null;
  return (
    <View style={[styles.list, style]}>
      {alerts.map((alert) => (
        <AlertBanner
          key={alert.type + alert.role}
          alert={alert}
          onAction={onAction}
          actionLabel={actionLabel}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: Radius.card,
    padding: 16,
  },
  text: { flex: 1, gap: 3 },
  action: { marginTop: 4 },
});
