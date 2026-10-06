/**
 * Wallet balance, as the one card on the screen that is allowed to be loud.
 *
 * The figure counts up on mount and a faint highlight sweeps across every few
 * seconds — both say "this is a live number", which matters because commission
 * comes out of it the moment a job is accepted. The top-up affordance rides
 * along inside the card instead of sitting under it as a separate row.
 */

import { LinearGradient } from 'expo-linear-gradient';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { CountUp, Shimmer } from '@/components/motion';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Gradients, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useThemeMode } from '@/hooks/use-theme';
import { formatSom } from '@/lib/format';

interface BalanceCardProps {
  balance: number;
  label: string;
  actionLabel: string;
  currency: string;
  onPress?: () => void;
  /** Pauses the sweep — pass false when the card is off screen. */
  live?: boolean;
}

export function BalanceCard({
  balance,
  label,
  actionLabel,
  currency,
  onPress,
  live = true,
}: BalanceCardProps) {
  const dark = useThemeMode() === 'dark';

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={`${label}: ${formatSom(balance)} ${currency}`}
      style={dark ? undefined : Shadow.float}>
      <LinearGradient
        colors={[Gradients.brand[0], Gradients.brand[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, Squircle]}>
        <Shimmer active={live} radius={Radius.card} />

        <View style={styles.top}>
          <Text style={[Type.footnote, styles.label]}>{label}</Text>
          <Icon name="wallet" size={22} color="rgba(255,255,255,0.9)" />
        </View>

        <View style={styles.amountRow}>
          <CountUp
            value={balance}
            format={(value) => formatSom(value)}
            style={[Type.largeTitle, styles.amount]}
          />
          <Text style={[Type.title3, styles.unit]}>{currency}</Text>
        </View>

        {onPress ? (
          <View style={styles.action}>
            <Text style={[Type.footnoteEmphasized, styles.actionText]}>{actionLabel}</Text>
            <Icon name="chevron-forward" size={14} color="rgba(255,255,255,0.92)" />
          </View>
        ) : null}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: 20, gap: 8, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: 'rgba(255,255,255,0.85)' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  amount: { color: '#FFFFFF' },
  unit: { color: 'rgba(255,255,255,0.85)' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  actionText: { color: 'rgba(255,255,255,0.92)' },
});
