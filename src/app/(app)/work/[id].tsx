/**
 * A job as the provider being offered it sees it.
 *
 * `/orders/[id]` is the customer's view of their own order — what it cost, who
 * took it, whether it is finished. This is the other side of the same job, and
 * the two ask different questions. A worker looking at an invite is deciding
 * whether to take it, and until now that decision was made from a card: a
 * price, a pin, and one line of description, with no way to see the rest of the
 * photos, read the whole description, or learn anything at all about who was
 * on the other end. Answering happened on a card too, so the only way to see
 * more was to accept and find out.
 *
 * So: everything the order carries, the person who placed it, and — pinned to
 * the bottom where the decision belongs — accept and reject.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { StatusPill } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon } from '@/components/ui/icon';
import { Row, Section } from '@/components/ui/list';
import { PhotoSlider } from '@/components/ui/photo-slider';
import { Screen } from '@/components/ui/screen';
import { Stars } from '@/components/ui/stars';
import { YandexMap } from '@/components/yandex-map';
import { Ease } from '@/constants/motion';
import { Layout, Radius, Squircle, Type, categoryTint } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { formatCountdown, useCountdown } from '@/hooks/use-countdown';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryIcon } from '@/lib/category-icon';
import { categoryName, formatSom, telUrl } from '@/lib/format';
import { distanceKm } from '@/lib/location';
import { hasCoords } from '@/lib/maps';
import type { Order, OrderCustomer } from '@/lib/types';
import { useAuth } from '@/store/auth';

/** Below this many seconds left the countdown goes rose. */
const URGENT_AT = 20;

/** Statuses where the provider still holds the job and needs the phone. */
const HOLDING: Order['status'][] = ['accepted', 'in_progress'];

export default function WorkDetailScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useCategories();
  const { user, refreshMe } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<OrderCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      // The customer card is a nice-to-have; a job that loads without it is
      // still answerable, so it must never take the screen down with it.
      const [fresh, card] = await Promise.all([
        api.get<Order>(`/orders/${id}`),
        api.get<OrderCustomer>(`/orders/${id}/customer`).catch(() => null),
      ]);
      setOrder(fresh);
      setCustomer(card);
    } catch {
      // leave whatever is on screen; the pull-to-refresh retries
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const { refreshControl } = useRefresh(load);

  const deadline = order?.invite_expires_at
    ? new Date(order.invite_expires_at).getTime()
    : null;
  const { remaining, expired } = useCountdown({ deadline });

  if (loading && !order) {
    return (
      <Screen scroll={false} padded={false} header={<Header title={t('work.title')} back />}>
        <LoadingState />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen scroll={false} padded={false} header={<Header title={t('work.title')} back />}>
        <EmptyState icon="reader-outline" title={t('work.notFound')} />
      </Screen>
    );
  }

  // Which side of the app is looking. A firm answers through /company, a worker
  // through /worker, and the order itself says which one it was sent to.
  const asCompany = !!order.company_id && order.company_id === user?.company_profile?.id;
  const answerable = asCompany
    ? order.status === 'pending'
    : // Still on offer and nobody has taken it. `worker_id` is the race: the
      // list can be a few seconds stale, and a job someone else already accepted
      // must not show an accept button that is going to 409.
      (order.status === 'invited' || order.status === 'matching') && !order.worker_id;
  const holding = HOLDING.includes(order.status);
  // Somebody else was faster. Worth saying out loud: without it the screen just
  // shows a job with no buttons and no explanation of where they went.
  const taken = !answerable && !holding && !!order.worker_id && order.worker_id !== user?.id;

  const respond = async (action: 'accept' | 'reject') => {
    setBusy(true);
    try {
      const base = asCompany ? '/company/orders' : '/worker/orders';
      await api.post(`${base}/${order.id}/${action}`);
      if (action === 'reject') {
        router.back();
        return;
      }
      // Accepting spends a firm's free order or a worker's commission, so the
      // account is re-read alongside the job to keep both honest.
      await Promise.all([load(), refreshMe()]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const category = byId(order.category_id);
  const tint = categoryTint(order.category_id);
  const profile = user?.worker_profile;
  const away = !asCompany && profile && hasCoords(order) ? distanceKm(profile, order) : null;
  // The server decides who may see the number — an invited worker gets a masked
  // order, a firm the job was sent to does not. Re-deciding it here would only
  // create a second rule to keep in step with the first, so an empty field is
  // taken at face value.
  const phone = order.customer_phone || customer?.phone || '';

  const genderLabel =
    order.gender === 'male'
      ? t('order.male')
      : order.gender === 'female'
        ? t('order.female')
        : t('order.any');

  const footer = (() => {
    if (answerable) {
      return (
        <View style={styles.footerActions}>
          <Button
            label={t('incoming.accept')}
            icon="checkmark"
            onPress={() => respond('accept')}
            loading={busy}
            disabled={!!deadline && expired}
            style={{ backgroundColor: theme.success }}
          />
          <Button
            label={t('incoming.reject')}
            variant="ghost"
            onPress={() => respond('reject')}
            disabled={busy}
          />
        </View>
      );
    }
    if (holding && phone) {
      return (
        <Button
          label={t('incoming.callCustomer')}
          icon="call"
          onPress={() => Linking.openURL(telUrl(phone))}
        />
      );
    }
    return null;
  })();

  return (
    <Screen
      padded={false}
      header={<Header title={t('work.title')} back />}
      refreshControl={refreshControl}
      footer={footer}>
      {/* What the job is, at the size the decision deserves. */}
      <View style={styles.head}>
        <View style={[styles.tile, Squircle, { backgroundColor: `${tint}1A` }]}>
          <Icon name={categoryIcon(category)} size={28} color={tint} />
        </View>
        <View style={styles.headText}>
          <Text style={[Type.title2, { color: theme.text }]} numberOfLines={2}>
            {categoryName(category, lang) || t('company.orderTitle')}
          </Text>
          <Text style={[Type.title3, { color: theme.primary }]}>
            {`${formatSom(order.price)} ${t('common.som')}`}
          </Text>
        </View>
        <StatusPill status={order.status} />
      </View>

      {taken ? (
        <Text style={[Type.footnote, styles.notice, { color: theme.textSecondary }]}>
          {t('work.taken')}
        </Text>
      ) : null}

      {/* How long is left to answer — the one thing that changes while reading. */}
      {answerable && deadline ? (
        expired ? (
          <Text style={[Type.footnote, styles.notice, { color: theme.danger }]}>
            {t('work.expired')}
          </Text>
        ) : (
          <View style={styles.timer}>
            <View style={styles.timerTop}>
              <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                {t('work.timeLeft')}
              </Text>
              <Text
                style={[
                  Type.footnoteEmphasized,
                  { color: remaining <= URGENT_AT ? theme.danger : theme.text },
                ]}>
                {formatCountdown(remaining)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.fillTertiary }]}>
              <TimerBar
                remaining={remaining}
                color={
                  remaining <= URGENT_AT
                    ? theme.danger
                    : remaining <= 45
                      ? theme.warning
                      : theme.success
                }
              />
            </View>
          </View>
        )
      ) : null}

      <Section header={t('order.detailsTitle')} style={styles.section}>
        <Row stacked title={t('order.description')} value={order.description || '—'} />
        <Row title={t('order.category')} value={categoryName(category, lang) || '—'} />
        <Row title={t('order.gender')} value={genderLabel} />
        {away !== null ? <Row title={t('work.distance')} value={`${away.toFixed(1)} km`} /> : null}
        <Row title={t('work.created')} value={new Date(order.created_at).toLocaleString()} />
      </Section>

      {/* The photos, at card width. Often they say more than the words do. */}
      <PhotoSlider
        uris={order.images?.length ? order.images : order.image_url ? [order.image_url] : []}
        header={t('order.photo')}
        height={240}
      />

      {hasCoords(order) ? (
        <View style={styles.mapWrap}>
          <YandexMap
            point={{ lat: order.lat, lng: order.lng }}
            height={200}
            route
            caption={t('order.location')}
          />
        </View>
      ) : null}

      {/* Who is on the other end — the half of the decision that was missing. */}
      <Section
        header={t('work.customer')}
        style={styles.section}
        footer={!phone && answerable ? t('work.phoneHidden') : undefined}>
        <Row
          title={customer?.name || order.customer_name || t('work.customer')}
          subtitle={
            customer
              ? t('work.customerOrders', { n: customer.orders_count })
              : undefined
          }
          left={<Avatar name={customer?.name || order.customer_name} imageUrl={customer?.avatar_url} size={40} />}
          right={
            customer && customer.ratings_count > 0 ? (
              <Stars value={customer.rating} size={14} showValue count={customer.ratings_count} />
            ) : (
              <Text style={[Type.footnote, { color: theme.textTertiary }]}>
                {t('work.customerNoRating')}
              </Text>
            )
          }
        />
        {customer?.member_since ? (
          <Row
            title={t('work.customerSince', {
              date: new Date(customer.member_since).toLocaleDateString(),
            })}
          />
        ) : null}
        {phone ? (
          <Row
            title={phone}
            icon="call"
            iconColor={theme.success}
            onPress={() => Linking.openURL(telUrl(phone))}
            right={
              <Pressable
                onPress={() => Linking.openURL(telUrl(phone))}
                hitSlop={10}
                style={({ pressed }) => (pressed ? { opacity: 0.5 } : null)}>
                <Icon name="call" size={20} color={theme.success} />
              </Pressable>
            }
          />
        ) : null}
      </Section>

      {answerable ? (
        <Text style={[Type.footnote, styles.notice, { color: theme.textSecondary }]}>
          {t('work.acceptHint')}
        </Text>
      ) : null}
    </Screen>
  );
}

/** Drains left-to-right over the server's 120-second search window. */
function TimerBar({ remaining, color }: { remaining: number; color: string }) {
  const width = useSharedValue(1);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, remaining / 120)), {
      duration: 550,
      easing: Ease.linear,
    });
  }, [remaining, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    paddingBottom: 16,
  },
  tile: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 4 },

  timer: { paddingHorizontal: Layout.gutter, gap: 8, paddingBottom: 4 },
  timerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },

  section: { marginTop: 20 },
  mapWrap: { paddingHorizontal: Layout.gutter, marginTop: 20 },
  notice: { paddingHorizontal: Layout.gutter + 4, paddingTop: 12 },
  footerActions: { gap: 6 },
});
