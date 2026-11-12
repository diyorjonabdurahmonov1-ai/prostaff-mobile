/**
 * The firm's two places, and the switch for the second one.
 *
 * A firm that goes out to its customers — fuel to a car, a tow truck, a mobile
 * car wash — is not where its office is. With live location on it is found
 * near the office *and* near where its phone is now, and orders come from
 * around both.
 *
 * Two places is easy to misread ("did I just move my office?", "will orders
 * stop at the office?"), so the card always shows both side by side, each with
 * whether it is bringing in orders right now, and says in one line what the
 * switch does. It never hides the office row: that place does not change here.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Squircle, Type } from '@/constants/theme';
import { getPreciseFix, useLiveLocation } from '@/hooks/use-live-location';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { minutesSince, setLiveLocation } from '@/lib/company-live';
import { setFirmLiveIntent } from '@/lib/presence';
import type { CompanyProfile } from '@/lib/types';

export function LiveLocationCard({
  firm,
  onChanged,
}: {
  firm: CompanyProfile;
  onChanged: () => Promise<unknown> | void;
}) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const location = useLiveLocation({ tracking: false });
  const [busy, setBusy] = useState(false);

  const on = !!firm.live_location;
  const officeSet = !!firm.lat || !!firm.lng;
  const locationBlocked = location.status !== 'ok' && location.status !== 'checking';
  /** Live is switched on but the phone cannot report — say so, not "on". */
  const liveWorking = on && !locationBlocked && firm.online;

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    // Recorded first, so a position report already on its way cannot switch
    // live location back on behind this tap (see lib/presence).
    setFirmLiveIntent(next);
    try {
      if (next) {
        // Switching on needs a real position to start from. Without one the
        // tap asks for location, and carries on if the firm grants it.
        let fix = await getPreciseFix();
        if (!fix && (await location.fix()) === 'ok') fix = await getPreciseFix();
        if (!fix) {
          setFirmLiveIntent(null);
          return;
        }
        await setLiveLocation(true, fix);
      } else {
        await setLiveLocation(false);
      }
      await onChanged();
    } catch (err) {
      setFirmLiveIntent(null);
      Alert.alert(t('common.error'), err instanceof Error && err.message ? err.message : t('common.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const ago = minutesSince(firm.live_updated_at);

  return (
    <View style={[styles.card, Squircle, { backgroundColor: theme.surface }]}>
      <View style={styles.head}>
        <View style={[styles.glyph, { backgroundColor: on ? theme.successSoft : theme.fillQuaternary }]}>
          <Icon name="crosshair" size={20} color={on ? theme.success : theme.textSecondary} />
        </View>
        <View style={styles.flex}>
          <Text style={[Type.headline, { color: theme.text }]}>{t('live.title')}</Text>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{t('live.subtitle')}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={busy}
          trackColor={{ true: theme.success, false: theme.fill }}
          ios_backgroundColor={theme.fill}
        />
      </View>

      {/* The two places orders come from, each with its own state. */}
      <View style={[styles.places, { borderColor: theme.separator }]}>
        <Place
          icon="business"
          title={t('live.office')}
          detail={officeSet ? firm.address || t('live.officePinned') : t('live.officeMissing')}
          state={officeSet ? (firm.online ? 'active' : 'paused') : 'missing'}
          action={officeSet ? undefined : { label: t('live.setOffice'), onPress: () => router.push('/company/onboarding') }}
        />
        <View style={[styles.divider, { backgroundColor: theme.separator }]} />
        <Place
          icon="location"
          title={t('live.now')}
          detail={
            !on
              ? t('live.nowOff')
              : locationBlocked
                ? t('live.nowBlocked')
                : ago === null
                  ? t('live.nowOn')
                  : ago === 0
                    ? t('live.nowJust')
                    : t('live.nowUpdated', { n: ago })
          }
          state={liveWorking ? 'active' : on ? 'paused' : 'off'}
          action={
            on && locationBlocked ? { label: t('loc.allowAction'), onPress: () => void location.fix() } : undefined
          }
        />
      </View>

      <Text style={[Type.footnote, { color: theme.textSecondary }]}>
        {on ? t('live.explainOn') : t('live.explainOff')}
      </Text>
      {!firm.online ? (
        <Text style={[Type.footnote, { color: theme.warning }]}>{t('live.offlineNote')}</Text>
      ) : null}
    </View>
  );
}

type PlaceState = 'active' | 'paused' | 'off' | 'missing';

function Place({
  icon,
  title,
  detail,
  state,
  action,
}: {
  icon: IconName;
  title: string;
  detail: string;
  state: PlaceState;
  action?: { label: string; onPress: () => void };
}) {
  const t = useT();
  const theme = useTheme();
  const tone = {
    active: { color: theme.success, label: t('live.stateActive') },
    paused: { color: theme.warning, label: t('live.statePaused') },
    off: { color: theme.textTertiary, label: t('live.stateOff') },
    missing: { color: theme.danger, label: t('live.stateMissing') },
  }[state];

  return (
    <View style={styles.place}>
      <Icon name={icon} size={18} color={theme.textSecondary} />
      <View style={styles.flex}>
        <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{title}</Text>
        <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={2}>
          {detail}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} style={({ pressed }) => (pressed ? styles.pressed : null)}>
            <Text style={[Type.footnoteEmphasized, { color: theme.primary }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.state, { backgroundColor: `${tone.color}1F` }]}>
        <View style={[styles.stateDot, { backgroundColor: tone.color }]} />
        <Text style={[Type.caption2Emphasized, { color: tone.color }]}>{tone.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.5 },
  card: { borderRadius: Radius.lg, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glyph: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  places: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, overflow: 'hidden' },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 40 },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
});
