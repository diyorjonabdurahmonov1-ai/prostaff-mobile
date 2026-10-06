/**
 * An 8pt status dot that pulses while something is genuinely live.
 *
 * The pulse is load-bearing: a static dot next to "12 online" could be a stale
 * number from a cached response, a pulsing one says the count is being kept
 * up to date. Offline dots do not animate at all, which is the point.
 */

import { StyleSheet, View } from 'react-native';

import { PulseRing } from '@/components/motion';
import { Loop } from '@/constants/theme';

interface StatusDotProps {
  online: boolean;
  color: string;
  /** Dot diameter. The ring grows out of it. */
  size?: number;
}

export function StatusDot({ online, color, size = 8 }: StatusDotProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <PulseRing size={size} color={color} active={online} to={2.6} duration={Loop.status} filled />
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
