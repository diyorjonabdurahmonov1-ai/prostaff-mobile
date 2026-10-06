import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertBannerList } from '@/components/alert-banner';
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
import { api } from '@/lib/api';
import { formatSom, telUrl } from '@/lib/format';
import { switchRoot } from '@/lib/nav';
import type { CompanyProfile, Order } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useAlerts, useCompanyOrders } from '@/store/realtime';

import { Icon, type IconName } from '@/components/ui/icon';

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

  /** Answered orders, most recent first — the panel shows a glimpse, the
   *  orders screen shows the rest. */
  const recent = useMemo(() => orders.filter((o) => o.status !== 'pending').slice(0, 3), [orders]);
  /** One job at a time: a company on an active order takes nothing new. */
  const busy = active.length > 0;

  const setOnline = async (online: boolean) => {
    setToggling(true);
    try {
      await api.post<CompanyProfile>('/company/status', { online });
      await refreshMe();
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

        {/* Availability */}
        <Section
          header={t('profile.activeMode')}
          footer={online ? t('worker.onlineHint') : t('worker.offlineHint')}
          separatorInset={Row.ICON_INSET}>
          <Row
            icon={online ? 'radio' : 'moon'}
            iconColor={online ? theme.success : theme.textMuted}
            title={online ? t('common.online') : t('common.offline')}
            right={
              <Switch
                value={online}
                onValueChange={setOnline}
                disabled={toggling}
                trackColor={{ true: theme.success, false: theme.fill }}
                ios_backgroundColor={theme.fill}
              />
            }
          />
        </Section>

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
          header="Hisob"
          style={styles.section}
          separatorInset={Row.ICON_INSET}
          footer="Firma har bir ishdan komissiya emas, oylik to'lov to'laydi. To'lov Atmos orqali amalga oshiriladi.">
          <Row
            icon={profile.subscription_active ? 'checkmark-circle' : 'warning'}
            iconColor={profile.subscription_active ? theme.success : theme.warning}
            title="Obuna"
            value={
              profile.subscription_active
                ? `${profile.subscription_days_left} kun qoldi`
                : profile.subscription_until
                  ? 'Muddati tugagan'
                  : 'Rasmiylashtirilmagan'
            }
          />
          {profile.subscription_until ? (
            <Row
              icon="calendar-outline"
              iconColor={theme.primary}
              title="Amal qilish muddati"
              value={new Date(profile.subscription_until).toLocaleDateString()}
            />
          ) : null}
          {!profile.subscription_active ? (
            <Row
              icon="sparkle"
              iconColor="#AF52DE"
              title="Bepul buyurtmalar"
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
              <Section
                header={t('company.newOrders')}
                style={styles.section}
                footer={busy ? t('order.busyWorker') : undefined}>
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
                    {order.lat !== 0 || order.lng !== 0 ? (
                      <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                        {order.lat.toFixed(4)}, {order.lng.toFixed(4)}
                      </Text>
                    ) : null}
                    <View style={styles.orderActions}>
                      <Button
                        label={t('company.acceptOrder')}
                        icon="checkmark"
                        loading={respondingId === order.id}
                        disabled={busy}
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
