import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveJobCard } from '@/components/active-job-card';
import { AlertBannerList } from '@/components/alert-banner';
import { BalanceCard } from '@/components/balance-card';
import { IncomingOrderCard } from '@/components/incoming-order-card';
import { CountUp, FadeUp } from '@/components/motion';
import { OnlineToggle } from '@/components/online-toggle';
import { PROVIDER_NAV_HEIGHT, ProviderNav } from '@/components/provider-nav';
import { Avatar } from '@/components/ui/avatar';
import { LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, type IconName } from '@/components/ui/icon';
import { Layout, Radius, Squircle, Stagger, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { getPreciseFix, useLiveLocation, type LocationStatus } from '@/hooks/use-live-location';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';
import { api } from '@/lib/api';
import { switchRoot } from '@/lib/nav';
import { setWorkerIntent } from '@/lib/presence';
import type { WorkerProfile } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useAlerts, useWorkerOrders } from '@/store/realtime';
import { Backdrop } from '@/components/backdrop';
import { BackgroundAccessCard } from '@/components/background-access-card';

/**
 * The worker's home.
 *
 * Deliberately sparse: four blocks, a 24pt margin and nothing competing with
 * the availability toggle. A worker opens this screen to do one of two things
 * — go online, or check what they have been paid — so those two are the only
 * things above the fold.
 *
 * Under them sits the job feed. It is always on screen, empty or not: a worker
 * who is online is waiting for work, and a permanently visible slot is what
 * makes an arriving job read as *arriving* rather than as the layout jumping.
 */
export default function WorkerPanelScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  /**
   * The state the worker just asked for, shown before the server confirms it.
   *
   * The switch used to sit still until a GPS fix, the request and a full
   * `/me` refresh had all come back — seconds, on a weak connection — so a tap
   * looked like it had not registered, and the second tap that followed sent
   * the worker straight back to where they started.
   */
  const [pendingOnline, setPendingOnline] = useState<boolean | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const profile = user?.worker_profile ?? null;

  // Incoming jobs live here as cards, not as a takeover: they arrive in the
  // list, wait their two minutes, and the worker answers when they look.
  const {
    incoming,
    active: activeOrder,
    loading: ordersLoading,
    refresh,
  } = useWorkerOrders(!!profile, undefined, user?.id);

  // Why the phone may have gone quiet: the three free jobs are spent and the
  // balance is under the minimum. It sits above the availability toggle because
  // going online does nothing while it is showing.
  const { forRole: alertsFor, refresh: refreshAlerts } = useAlerts(!!profile);
  const alerts = alertsFor('worker');

  useFocusEffect(
    useCallback(() => {
      refreshMe();
      refresh();
      refreshAlerts();
    }, [refreshMe, refresh, refreshAlerts])
  );

  // The feed polls itself every few seconds, but a worker waiting on a job
  // pulls anyway — so give the gesture something real to do rather than let it
  // bounce off a screen that only updates on its own schedule.
  const { refreshControl } = useRefresh(async () => {
    await Promise.all([refreshMe(), refresh(), refreshAlerts()]);
  });

  const answer = async (orderId: string, action: 'accept' | 'reject') => {
    setAnsweringId(orderId);
    try {
      await api.post(`/worker/orders/${orderId}/${action}`);
      await refresh();
    } catch (err) {
      Alert.alert(t('common.genericError'), err instanceof Error ? err.message : '');
    } finally {
      setAnsweringId(null);
    }
  };

  /**
   * Whether the app can see the worker. Following them while online, and
   * taking them offline when location goes, happen in `(app)/_layout.tsx` so
   * they keep running on every worker screen; this one only reads the status
   * to draw the switch and the banner.
   */
  const location = useLiveLocation({ tracking: false });
  /** The app cannot place this worker, so it must not offer them work. */
  const locationBlocked = location.status !== 'ok' && location.status !== 'checking';

  const setOnline = async (next: boolean) => {
    if (busy) return;
    // No location, no online: the tap asks for it — and carries on if the
    // worker grants it, so one tap is enough.
    if (next && locationBlocked && (await location.fix()) !== 'ok') return;
    setBusy(true);
    setPendingOnline(next);
    // Recorded before the request, so a location report already on its way
    // cannot put the worker back online behind this tap (see lib/presence).
    setWorkerIntent(next);
    try {
      // A real fix or nothing. Going online at a guessed position would put the
      // worker in front of jobs across the city from where they stand.
      const coords = next ? await getPreciseFix() : null;
      if (next && !coords) {
        setWorkerIntent(null);
        await location.refresh();
        Alert.alert(t('loc.noFixTitle'), t('loc.noFixBody'));
        return;
      }
      await api.post<WorkerProfile>('/worker/status', {
        online: next,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      await refreshMe();
    } catch (err) {
      // The switch goes back to what the server still has, and says why.
      setWorkerIntent(null);
      Alert.alert(t('common.error'), err instanceof Error && err.message ? err.message : t('common.networkError'));
    } finally {
      setPendingOnline(null);
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {/* The panel is the root of the stack, so there is nothing behind it to
            go back to — the way out of a worker account is the customer side. */}
        <Header title={t('worker.panelTitle')} back onBack={() => switchRoot('/')} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Without a location the worker is offline in every way that matters to them
  // (no orders reach them), whatever the server last heard — so the whole
  // screen says so, not just the switch.
  const online = (pendingOnline ?? profile.online) && !locationBlocked;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Backdrop tone={activeOrder ? 'busy' : online ? 'online' : 'brand'} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: PROVIDER_NAV_HEIGHT + insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {/* ---- Who you are ---- */}
        <FadeUp style={styles.profileBar}>
          <View
            style={[
              styles.avatarWrap,
              // The glow ring is the passive twin of the toggle: from across a
              // room you can tell whether you are taking work.
              online ? { shadowColor: activeOrder ? theme.warning : theme.success, ...styles.glow } : null,
            ]}
          >
            <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size={48} />
            {online ? (
              <View
                style={[
                  styles.avatarRing,
                  { borderColor: `${activeOrder ? theme.warning : theme.success}40` },
                ]}
              />
            ) : null}
          </View>

          <View style={styles.identity}>
            <Text style={[Type.title3, { color: theme.text }]} numberOfLines={1}>
              {profile.full_name}
            </Text>
            <View style={[styles.tag, { backgroundColor: theme.successSoftSolid }]}>
              <Text style={[Type.caption1Emphasized, { color: theme.successDark }]}>
                {t('profile.mode.worker')}
              </Text>
            </View>
          </View>

          {/* A bell is the notification tray, not a shortcut to the job list.
              It used to open /worker/orders, which is the same place the "Hammasi"
              link and the orders tab already go — so the one control on the panel
              shaped like "what have I missed" was the only one that could not
              answer it, and everything the server had filed against the account
              sat on a screen nothing pointed at. */}
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('push.title')}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Icon name="notifications" size={24} color={theme.text} />
            {incoming.length > 0 || activeOrder ? (
              <View
                style={[
                  styles.bellDot,
                  {
                    backgroundColor: incoming.length > 0 ? theme.success : theme.warning,
                    borderColor: theme.background,
                  },
                ]}
              />
            ) : null}
          </Pressable>
        </FadeUp>

        {/* ---- Why work may not be arriving ---- */}
        {alerts.length > 0 ? (
          <FadeUp index={1} step={Stagger.card} style={styles.block}>
            <AlertBannerList
              alerts={alerts}
              actionLabel={t('wallet.topUp')}
              onAction={() => router.push('/wallet')}
            />
          </FadeUp>
        ) : null}

        {/* ---- Availability ---- */}
        <FadeUp index={1} step={Stagger.card} style={styles.block}>
          {locationBlocked ? (
            <LocationBanner status={location.status} onFix={location.fix} />
          ) : (
            <BackgroundAccessCard />
          )}
          <OnlineToggle
            online={online}
            disabled={busy}
            onChange={setOnline}
            onLabel={`${t('common.online')} · ${t('worker.searchingJobs')}`}
            offLabel={locationBlocked ? t(LOCATION_COPY[location.status].toggle) : t('common.offline')}
            offIcon={locationBlocked ? 'location' : undefined}
            onJob={!!activeOrder}
            onJobLabel={`${t('worker.onJob')} · ${t('worker.onJobDoing')}`}
          />
          <Text style={[Type.footnote, styles.hint, { color: theme.textSecondary }]}>
            {activeOrder
              ? t('order.busyWorker')
              : locationBlocked
                ? t('loc.toggleHint')
                : online
                ? t('worker.onlineHint')
                : t('worker.offlineHint')}
          </Text>
        </FadeUp>

        {/* ---- The job in hand ---- Everything for it in one place, above the
            feed: once a worker has a job, that job is what this screen is for. */}
        {activeOrder ? (
          <FadeUp index={2} step={Stagger.card} style={styles.block}>
            <ActiveJobCard
              order={activeOrder}
              onOpen={() =>
                router.push({ pathname: '/work/[id]', params: { id: activeOrder.id } })
              }
              onEnded={() => Promise.all([refresh(), refreshMe()])}
            />
          </FadeUp>
        ) : null}

        {/* ---- Jobs waiting for an answer ---- Not while on a job: no new work
            reaches a worker until the one in hand ends, and a "waiting for
            orders" card under it said the opposite. */}
        {activeOrder ? null : (
          <View style={styles.incoming}>
            <View style={styles.incomingHead}>
              <View
                style={[
                  styles.incomingDot,
                  { backgroundColor: incoming.length > 0 ? theme.success : theme.textTertiary },
                ]}
              />
              <Text
                style={[Type.footnoteEmphasized, styles.incomingTitle, { color: theme.textSecondary }]}
              >
                {incoming.length > 0
                  ? `${t('incoming.feedTitle')} · ${incoming.length}`
                  : t('incoming.feedTitle')}
              </Text>
              <Pressable
                onPress={() => router.push('/worker/orders')}
                hitSlop={8}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}
              >
                <Text style={[Type.footnoteEmphasized, { color: theme.primary }]}>
                  {t('incoming.seeAll')}
                </Text>
              </Pressable>
            </View>

            {incoming.length > 0 ? (
              incoming.map((order, index) => (
                <IncomingOrderCard
                  key={order.id}
                  order={order}
                  profile={profile}
                  busy={answeringId === order.id}
                  onAccept={() => answer(order.id, 'accept')}
                  onReject={() => answer(order.id, 'reject')}
                  onOpen={() => router.push({ pathname: '/work/[id]', params: { id: order.id } })}
                  // Only the newest job carries a map on the panel.
                  compact={index > 0}
                />
              ))
            ) : (
              // The poller runs every 4s, so an empty slot is the normal resting
              // state — it says "listening", not "something went wrong".
              <View style={[styles.waitCard, Squircle, { backgroundColor: theme.surface }]}>
                <View
                  style={[
                    styles.waitGlyph,
                    { backgroundColor: online ? theme.successSoftSolid : theme.fillQuaternary },
                  ]}
                >
                  <Icon
                    name={online ? 'search' : 'moon'}
                    size={22}
                    color={online ? theme.successDark : theme.textTertiary}
                  />
                </View>
                <View style={styles.waitText}>
                  <Text style={[Type.subheadEmphasized, { color: theme.text }]}>
                    {ordersLoading
                      ? t('common.loading')
                      : online
                        ? t('incoming.waiting')
                        : t('worker.offlineHint')}
                  </Text>
                  <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                    {online ? t('incoming.waitingHint') : t('incoming.offlineHint')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ---- Money ---- */}
        <FadeUp index={3} step={Stagger.card} style={styles.block}>
          <BalanceCard
            balance={user?.wallet?.balance ?? 0}
            label={t('wallet.balance')}
            actionLabel={t('wallet.topUp')}
            currency={t('common.som')}
            onPress={() => router.push('/wallet')}
          />
        </FadeUp>

        {/* ---- Standing ---- */}
        <View style={styles.stats}>
          <StatTile
            index={0}
            value={profile.ratings_count}
            label={t('status.completed')}
            icon="checkmark-circle"
            tint={theme.success}
          />
          <StatTile
            index={1}
            value={profile.rating}
            decimals={1}
            label={t('worker.rating')}
            icon="star"
            tint="#F79009"
          />
          <StatTile
            index={2}
            value={profile.category_ids.length}
            label={t('worker.myCategories')}
            icon="location"
            tint={theme.primary}
          />
        </View>

        {/* Categories used to be edited here, as a chip row. They moved back to
            the profile editor: they are set once and changed rarely, while the
            job feed above them changes every few seconds, and a settings
            control at the bottom of a live feed is the wrong shape.

            Prices, bio, photos and the rest of the record live on the profile
            tab. This screen answers one question — am I taking work now — and
            a page of paperwork under it only got in the way of that. */}
      </ScrollView>

      <ProviderNav mode="worker" active="home" />
    </SafeAreaView>
  );
}

/* ===================== Location ===================== */

/** What to say, and what the fix button does, for each way location can fail. */
const LOCATION_COPY = {
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
function LocationBanner({ status, onFix }: { status: LocationStatus; onFix: () => void }) {
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

/** One of the three standing figures. Counts up as the card lands. */
function StatTile({
  value,
  label,
  icon,
  tint,
  index,
  decimals = 0,
}: {
  value: number;
  label: string;
  icon: IconName;
  tint: string;
  index: number;
  decimals?: number;
}) {
  const theme = useTheme();
  return (
    <FadeUp index={index} step={Stagger.stat} delay={220} style={styles.statSlot}>
      <View style={[styles.statTile, Squircle, { backgroundColor: theme.surface }]}>
        <Icon name={icon} size={22} color={tint} />
        <CountUp value={value} decimals={decimals} style={[Type.title2, { color: theme.text }]} />
        <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 8 },
  block: { marginTop: 24, paddingHorizontal: Layout.gutterWide },
  pressed: { opacity: 0.5 },

  profileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.gutterWide,
    paddingTop: 8,
  },
  avatarWrap: { width: 48, height: 48 },
  glow: {
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 27,
    borderWidth: 3,
  },
  identity: { flex: 1, gap: 4 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  bell: { padding: 4 },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },

  hint: { marginTop: 10, paddingHorizontal: 4 },

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

  incoming: { marginTop: 24, gap: 12 },
  incomingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: Layout.gutterWide + 4,
  },
  incomingTitle: { flex: 1 },
  incomingDot: { width: 8, height: 8, borderRadius: 4 },

  waitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: Layout.gutter,
    borderRadius: Radius.card,
    padding: 18,
  },
  waitGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitText: { flex: 1, gap: 2 },


  stats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: Layout.gutterWide,
  },
  statSlot: { flex: 1 },
  statTile: {
    borderRadius: Radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },

});
