/**
 * "No location, no orders", where a provider cannot miss it: above the switch,
 * in the colour the app uses for things that are stopping work. Shared by the
 * worker's panel and the firm's — both are offline without a place to be found.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

import { Icon } from '@/components/ui/icon';
import { Radius, Squircle, Type } from '@/constants/theme';
import type { LocationStatus } from '@/hooks/use-live-location';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';

/** What to say, and what the fix button does, for each way location can fail. */
export const LOCATION_COPY = {
  denied: { toggle: 'loc.allow', body: 'loc.deniedBody', action: 'loc.allowAction' },
  blocked: { toggle: 'loc.allow', body: 'loc.blockedBody', action: 'loc.settingsAction' },
  off: { toggle: 'loc.turnOn', body: 'loc.offBody', action: 'loc.turnOnAction' },
  checking: { toggle: 'loc.allow', body: 'loc.deniedBody', action: 'loc.allowAction' },
  ok: { toggle: 'loc.allow', body: 'loc.deniedBody', action: 'loc.allowAction' },
} as const satisfies Record<
  LocationStatus,
  { toggle: TranslationKey; body: TranslationKey; action: TranslationKey }
>;

/**
 * "No location, no orders", where the worker cannot miss it: above the switch,
 * in the colour the app uses for things that are stopping work.
 */
export function LocationBanner({ status, onFix }: { status: LocationStatus; onFix: () => void }) {
  const t = useT();
  const theme = useTheme();
  const copy = LOCATION_COPY[status];
  return (
    <View style={[styles.locBanner, Squircle, { backgroundColor: theme.dangerSoft }]}>
      <View style={styles.locTop}>
        <View style={[styles.locGlyph, { backgroundColor: theme.surface }]}>
          <Icon name="location" size={22} color={theme.danger} />
        </View>
        <View style={styles.locText}>
          <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{t('loc.bannerTitle')}</Text>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{t(copy.body)}</Text>
        </View>
      </View>
      <Pressable
        onPress={onFix}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.locBtn,
          Squircle,
          { backgroundColor: theme.danger },
          pressed && styles.pressed,
        ]}>
        <Icon name="location" size={16} color="#FFFFFF" />
        <Text style={[Type.subheadEmphasized, { color: '#FFFFFF' }]}>{t(copy.action)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.5 },

  locBanner: { borderRadius: Radius.lg, padding: 14, gap: 12, marginBottom: 14 },
  locTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  locGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locText: { flex: 1, gap: 3 },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
  },
});
