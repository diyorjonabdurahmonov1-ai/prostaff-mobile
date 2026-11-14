import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveJobCard } from '@/components/active-job-card';
import { AlertBannerList } from '@/components/alert-banner';
import { BackgroundAccessCard } from '@/components/background-access-card';
import { LiveLocationCard } from '@/components/live-location-card';
import { OnlineToggle } from '@/components/online-toggle';
import { PROVIDER_NAV_HEIGHT, ProviderNav } from '@/components/provider-nav';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { YandexMap } from '@/components/yandex-map';
import { hasCoords } from '@/lib/maps';
import { api } from '@/lib/api';
import { formatSom, telUrl } from '@/lib/format';
import { switchRoot } from '@/lib/nav';
import type { CompanyProfile, Order } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useAlerts, useCompanyOrders } from '@/store/realtime';

import { Icon, type IconName } from '@/components/ui/icon';
import { Backdrop } from '@/components/backdrop';

export default function CompanyPanelScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();
  const profile = user?.company_profile ?? null;

  const [toggling, setToggling] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // One feed for the panel and the orders screen, so answering a job on either
  // updates both — and so "active" means the same thing in both places.
  const {
    orders,
    pending,
    active,
    loading: loadingOrders,
    refresh: loadOrders,
  } = useCompanyOrders(!!profile);

  // The firm's standing: free jobs while they last, then the subscription — and
  // a week's warning before the month runs out, which is the whole point of
  // putting it on the panel rather than in a notification list.
  const { forRole: alertsFor, refresh: refreshAlerts } = useAlerts(!!profile);
  const alerts = alertsFor('company');

  useFocusEffect(
    useCallback(() => {
      refreshMe();
      refreshAlerts();
    }, [refreshMe, refreshAlerts]),
  );

  const { refreshControl } = useRefresh(async () => {
    await Promise.all([refreshMe(), loadOrders(), refreshAlerts()]);
  });

  /** A company answers directly — it takes the job or declines it. */
  const respond = async (order: Order, action: 'accept' | 'reject') => {
    setRespondingId(order.id);
    try {
      await api.post(`/company/orders/${order.id}/${action}`);
      await Promise.all([loadOrders(), refreshMe()]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setRespondingId(null);
    }
  };

  /**
   * Answered orders that are over, most recent first — the panel shows a
   * glimpse, the orders screen shows the rest. Jobs still in hand have their
   * own cards above.
   */
  const recent = useMemo(
    () => orders.filter((o) => o.status !== 'pending' && !active.includes(o)).slice(0, 3),
    [orders, active],
  );

  /*
   * No "one job at a time" here. That rule came over from the worker, who is
   * one person; a firm is a team, and greying out "Qabul qilish" the moment it
   * held one job turned away every other customer for the length of it.
   */

  const setOnline = async (online: boolean) => {
    setToggling(true);
    try {
      await api.post<CompanyProfile>('/company/status', { online });
      await refreshMe();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error && err.message ? err.message : t('common.networkError'));
    } finally {
      setToggling(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        {/* See the worker panel: nothing sits behind a root. */}
        <Header title={t('company.panelTitle')} back onBack={() => switchRoot('/')} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  const online = profile.online;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Backdrop tone={online ? 'online' : 'brand'} />
      {/* No back chevron: this screen is the root of the app for a firm, the
          same way the worker panel is for a worker. It used to draw one, which
          at the root either did nothing or walked out of the account. */}
      <Header title={profile.name} large subtitle={t('company.panelTitle')} back={false} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: PROVIDER_NAV_HEIGHT + insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        {/* Why work may not be arriving. A firm cannot buy its own months —
            that is the office's counter — so the banner informs rather than
            offering a button that would lead nowhere. */}
        {alerts.length > 0 ? (
          <AlertBannerList
            alerts={alerts}
            style={styles.alerts}
            actionLabel={t('subscription.renew')}
            onAction={() => router.push('/company/subscription')}
          />
        ) : null}

        {/* Availability — the same big switch the worker has: whether orders
            reach the firm is the most consequential setting on this screen. */}
        <View style={styles.toggle}>
          <OnlineToggle
            online={online}
            disabled={toggling}
            onChange={setOnline}
            onLabel={`${t('common.online')} · ${t('company.takingOrders')}`}
            offLabel={t('common.offline')}
          />
          <Text style={[Type.footnote, styles.toggleHint, { color: theme.textSecondary }]}>
            {online ? t('company.onlineHint') : t('company.offlineHint')}
          </Text>
        </View>

        {/* Where orders come from: the office, and — for a firm that goes out
            to its customers — where it is right now. */}
        <View style={styles.live}>
          {/* Only a firm that is followed on the road needs the phone to keep
              the app awake. */}
          {profile.live_location ? <BackgroundAccessCard /> : null}
          <LiveLocationCard firm={profile} onChanged={refreshMe} />
        </View>

        {/* Jobs in hand: who, where, and — so a job a customer walked away
            from can never block the firm for good — a way to call it off. */}
        {active.length > 0 ? (
          <View style={styles.activeJobs}>
            <Text style={[Type.footnote, styles.caption, { color: theme.textSecondary }]}>
              {t('company.activeJobs', { n: active.length }).toUpperCase()}
            </Text>
            {active.map((order) => (
              <ActiveJobCard
                key={order.id}
                order={order}
                canComplete={false}
                onOpen={() => router.push({ pathname: '/work/[id]', params: { id: order.id } })}
                onEnded={() => Promise.all([loadOrders(), refreshMe()])}
              />
            ))}
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.stats}>
          <StatTile value={profile.rating.toFixed(1)} label={t('worker.rating')} icon="star" tint="#FFB800" />
          <StatTile
            value={String(profile.ratings_count)}
            label={t('status.completed')}
            icon="checkmark-done"
            tint={theme.success}
          />
        </View>

        {/* What the firm's account actually is: months, not a balance. Shown
            plainly so "why am I not getting orders" has an answer on the same
            screen as the online toggle. */}
        <Section
          header={t('company.account')}
          style={styles.section}
          separatorInset={Row.ICON_INSET}
          footer={t('company.accountHint')}>
          <Row
            icon={profile.subscription_active ? 'checkmark-circle' : 'warning'}
            iconColor={profile.subscription_active ? theme.success : theme.warning}
            title={t('subscription.title')}
            value={
              profile.subscription_active
                ? `${profile.subscription_days_left} ${t('subscription.daysLeft')}`
                : profile.subscription_until
                  ? t('subscription.expired')
                  : t('subscription.none')
            }
          />
          {profile.subscription_until ? (
            <Row
              icon="calendar-outline"
              iconColor={theme.primary}
              title={t('subscription.until')}
              value={new Date(profile.subscription_until).toLocaleDateString()}
            />
          ) : null}
          {!profile.subscription_active ? (
            <Row
              icon="sparkle"
              iconColor="#AF52DE"
              title={t('subscription.freeLeft')}
              value={`${Math.max(profile.free_orders_limit - profile.free_orders_used, 0)} / ${profile.free_orders_limit}`}
            />
          ) : null}
          <Row
            icon="card"
            iconColor={theme.primary}
            title={t('subscription.renew')}
            onPress={() => router.push('/company/subscription')}
          />
        </Section>

        {/* Incoming orders */}
        {loadingOrders ? (
          <LoadingState />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="reader-outline"
            title={t('company.noOrders')}
            message={t('company.noOrdersHint')}
          />
        ) : (
          <>
            {/* Answer here — a company never searches for workers */}
            {pending.length > 0 ? (
              <Section header={t('company.newOrders')} style={styles.section}>
                {pending.map((order) => (
                  <View key={order.id} style={styles.pendingCard}>
                    <View style={styles.orderTop}>
                      <Text
                        style={[Type.headline, styles.orderTitle, { color: theme.text }]}
                        numberOfLines={2}>
                        {order.description || '—'}
                      </Text>
                      <StatusPill status={order.status} />
                      {/* Answering is the whole point of this card, so it does
                          not open on a body tap; reading the job first is a
                          control of its own. */}
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: '/work/[id]', params: { id: order.id } })
                        }
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('work.view')}
                        style={({ pressed }) => (pressed ? { opacity: 0.5 } : null)}>
                        <Icon name="eye-outline" size={20} color={theme.primary} />
                      </Pressable>
                    </View>
                    <Text style={[Type.title3, { color: theme.primary }]}>
                      {formatSom(order.price)} {t('common.som')}
                    </Text>
                    <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                      {[order.customer_name, order.customer_phone]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </Text>
                    {/* Where the job is, on the map — the firm is deciding
                        whether it can get there, and a pair of raw coordinates
                        answered nothing. */}
                    {hasCoords(order) ? (
                      <YandexMap
                        point={{ lat: order.lat, lng: order.lng }}
                        height={140}
                        caption={t('order.location')}
                      />
                    ) : null}
                    <View style={styles.orderActions}>
                      <Button
                        label={t('company.acceptOrder')}
                        icon="checkmark"
                        loading={respondingId === order.id}
                        onPress={() => respond(order, 'accept')}
                      />
                      <Button
                        label={t('company.rejectOrder')}
                        variant="ghost"
                        disabled={respondingId === order.id}
                        onPress={() => respond(order, 'reject')}
                      />
                    </View>
                  </View>
                ))}
              </Section>
            ) : null}

            {recent.length > 0 ? (
              <Section header={t('company.incomingOrders')} style={styles.section}>
                {recent.map((order) => (
                  <Pressable
                    key={order.id}
                    onPress={() =>
                      router.push({ pathname: '/work/[id]', params: { id: order.id } })
                    }
                    style={({ pressed }) => [
                      styles.orderRow,
                      pressed && { backgroundColor: theme.highlight },
                    ]}>
                    <View style={styles.orderBody}>
                      <View style={styles.orderTop}>
                        <Text
                          style={[Type.body, styles.orderTitle, { color: theme.text }]}
                          numberOfLines={1}>
                          {order.description || '—'}
                        </Text>
                        <StatusPill status={order.status} />
                      </View>
                      <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
                        {[`${formatSom(order.price)} ${t('common.som')}`, order.customer_phone]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    {order.status === 'accepted' || order.status === 'in_progress' ? (
                      <Pressable
                        onPress={() => Linking.openURL(telUrl(order.customer_phone))}
                        hitSlop={8}
                        style={({ pressed }) => (pressed ? { opacity: 0.5 } : undefined)}>
                        <Icon name="call" size={20} color={theme.success} />
                      </Pressable>
                    ) : (
                      <Icon name="chevron-forward" size={17} color={theme.textTertiary} />
                    )}
                  </Pressable>
                ))}

                {/* The panel is for answering, not for browsing. Three lines is
                    a glimpse of what happened; the rest lives on the orders
                    screen, where it can be filtered. */}
                <Row
                  icon="list-outline"
                  iconColor={theme.primary}
                  title={t('customer.viewAll')}
                  onPress={() => router.navigate('/company/orders')}
                />
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>

      <ProviderNav mode="company" active="home" />

    </SafeAreaView>
  );
}

function StatTile({
  value,
  label,
  icon,
  tint,
}: {
  value: string;
  label: string;
  icon: IconName;
  tint: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, Squircle, { backgroundColor: theme.surface }]}>
      <Icon name={icon} size={18} color={tint} />
      <Text style={[Type.title2, { color: theme.text }]}>{value}</Text>
      <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12 },
  toggle: { paddingHorizontal: Layout.gutterWide },
  toggleHint: { marginTop: 10, paddingHorizontal: 4 },
  live: { marginTop: 20, paddingHorizontal: Layout.gutter },
  activeJobs: { marginTop: 28, paddingHorizontal: Layout.gutter, gap: 12 },
  caption: { paddingHorizontal: 4 },
  section: { marginTop: 28 },
  alerts: { paddingHorizontal: Layout.gutter, marginBottom: 20 },

  stats: { flexDirection: 'row', gap: 12, marginTop: 28, paddingHorizontal: Layout.gutter },
  statTile: {
    flex: 1,
    borderRadius: Radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 2,
  },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 12,
  },
  orderBody: { flex: 1, gap: 4 },
  pendingCard: { paddingHorizontal: Layout.gutter, paddingVertical: 14, gap: 6 },
  orderActions: { gap: 6, marginTop: 8 },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderTitle: { flex: 1 },

});
