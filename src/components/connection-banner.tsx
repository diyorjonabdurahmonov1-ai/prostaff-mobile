/**
 * "No connection" — a small pill under the status bar while the server cannot be
 * reached, gone the moment it can.
 *
 * Without it a dead line looked like a broken app: buttons that did nothing,
 * lists that stayed empty, an online switch that would not turn. Naming the real
 * reason, and saying the app is retrying, is most of the fix.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { API_BASE_URL } from '@/lib/api';
import { reportNetwork, useConnectionDown } from '@/lib/connection';

const PROBE_MS = 4000;

export function ConnectionBanner() {
  const down = useConnectionDown();
  const insets = useSafeAreaInsets();
  const t = useT();

  // While down, ask the server directly every few seconds so the banner clears
  // as soon as the line is back, not on whatever request happens next.
  useEffect(() => {
    if (!down) return;
    let live = true;
    const probe = async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 5000);
      try {
        await fetch(`${API_BASE_URL}/api/v1/healthz`, { signal: ctl.signal });
        if (live) reportNetwork(true);
      } catch {
        // still down
      } finally {
        clearTimeout(timer);
      }
    };
    const id = setInterval(probe, PROBE_MS);
    probe();
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [down]);

  if (!down) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={styles.pill}>
        <Icon name="cloud-offline-outline" size={16} color="#FFFFFF" />
        <Text style={[Type.footnoteEmphasized, styles.text]}>{t('net.down')}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#1F2937',
  },
  text: { color: '#FFFFFF' },
});
