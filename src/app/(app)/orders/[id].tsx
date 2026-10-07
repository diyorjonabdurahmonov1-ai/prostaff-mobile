import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { PhotoSlider } from '@/components/ui/photo-slider';
import { Screen } from '@/components/ui/screen';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName, formatSom, telUrl } from '@/lib/format';
import { hasCoords } from '@/lib/maps';
import type { Order } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { usePollOrder } from '@/store/realtime';

import { Icon, type IconName } from '@/components/ui/icon';

export default function OrderDetailScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useCategories();
  const { user } = useAuth();

  /**
   * Live, not read once.
   *
   * The screen used to fetch the order on open and never again, so a customer
   * watching their search saw nothing happen when a worker took it, turned it
   * down or dropped it — the one moment they were waiting for. The poll hook
   * re-reads on every order event from the socket (and on a timer while the
   * socket is down).
   */
  const { order, refetch } = usePollOrder(id ?? null);
  const load = refetch;
  const [busy, setBusy] = useState(false);

  const { refreshControl } = useRefresh(load);

  if (!order) {
    return (
      <Screen scroll={false} padded={false}>
        <Header title={t('orders.detailTitle')} />
        <LoadingState />
      </Screen>
    );
  }

  const complete = async () => {
    setBusy(true);
    try {
      await api.post<Order>(`/orders/${order.id}/complete`);
      router.push({ pathname: '/rate', params: { orderId: order.id } });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.post<Order>(`/orders/${order.id}/cancel`);
      await load();
    } catch {
      // ignore — the row will catch up on the next read
    } finally {
      setBusy(false);
    }
  };

  /**
   * A fresh order to every nearby worker, carrying the same job.
   *
   * For an order that was aimed at one worker who said no, or one a worker
   * accepted and then dropped. `dispatch` re-opens the *same* order to the
   * same audience — for a hand-picked order that is the very person who just
   * declined — so the way to "anybody else" is a new broadcast with the same
   * details, and the closed one stays in the history as what happened.
   */
  const sendToAll = async () => {
    setBusy(true);
    try {
      const next = await api.post<Order>('/orders', {
        category_id: order.category_id,
        gender: order.gender,
        description: order.description,
        images: order.images,
        phone: order.customer_phone,
        price: order.price,
        lat: order.lat,
        lng: order.lng,
      });
      router.replace({ pathname: '/orders/[id]', params: { id: next.id } });
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setBusy(false);
    }
  };

  /** Back to the list of nearby workers, to choose somebody by hand. */
  const pickOther = () => router.navigate({ pathname: '/', params: { panel: 'workers' } });

  /** Re-open the broadcast: every nearby worker is rung again. */
  const searchAgain = async () => {
    setBusy(true);
    try {
      await api.post<Order>(`/orders/${order.id}/dispatch`);
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const genderLabel =
    order.gender === 'male'
      ? t('order.male')
      : order.gender === 'female'
        ? t('order.female')
        : t('order.any');

  // Only the customer who placed the order drives it: they call workers, and
  // only they can declare the work finished.
  const isCustomer = order.customer_id === user?.id;
  const isCompanyOrder = !!order.company_id;

  /**
   * A worker took the job and then let it go.
   *
   * The customer has no cancel button once a job is accepted (theirs is "Ish
   * tugadi"), so a cancelled order that still names a worker was dropped from
   * the worker's side. It used to read exactly like the customer's own
   * cancellation, and offered to ask the same audience again.
   */
  const droppedByWorker = order.status === 'cancelled' && !!order.worker_id;
  const notified = order.invited_worker_ids?.length ?? 0;

  /** Two ways forward once nobody is going to come: everyone, or somebody chosen. */
  const recover = (primary: 'all' | 'again') => (
    <View style={styles.footerStack}>
      <Button
        label={primary === 'all' ? t('outcome.sendToAll') : t('waiting.tryAgain')}
        icon={primary === 'all' ? 'paper-plane' : 'refresh'}
        onPress={primary === 'all' ? sendToAll : searchAgain}
        loading={busy}
      />
      <Button
        label={t('outcome.pickOther')}
        icon="people"
        variant="gray"
        onPress={pickOther}
        disabled={busy}
      />
    </View>
  );

  const action = (() => {
    if (!isCustomer) {
      if (order.status === 'completed') {
        return (
          <Button
            label={t('accepted.rate')}
            icon="star"
            variant="secondary"
            onPress={() => router.push({ pathname: '/rate', params: { orderId: order.id } })}
          />
        );
      }
      // The provider's way out of a job that is never going to finish.
      //
      // Only the customer can mark work complete, and a worker or firm counts
      // as busy for as long as an order of theirs sits accepted — so a customer
      // who walked away without tapping "Ish tugadi" left the provider unable
      // to take another order, ever, with no control on this screen to undo it.
      // The API always allowed the provider to cancel; nothing offered it.
      if (order.status === 'accepted' || order.status === 'in_progress') {
        return (
          <Button
            label={t('waiting.cancel')}
            icon="close"
            variant="danger"
            onPress={cancel}
            loading={busy}
          />
        );
      }
      return null;
    }
    switch (order.status) {
      case 'pending':
      case 'invited':
      case 'matching':
        // The search runs on the server; the only useful action is to stop it.
        return isCompanyOrder && order.status === 'pending' ? null : (
          <Button
            label={t('waiting.cancel')}
            icon="close"
            variant="danger"
            onPress={cancel}
            loading={busy}
          />
        );
      // Turned down, or taken and dropped: asking the same audience again
      // would ring the worker who just said no, so the way forward is everyone
      // else — or somebody the customer picks.
      case 'rejected':
        return isCompanyOrder ? null : recover('all');
      case 'cancelled':
        if (isCompanyOrder) return null;
        if (droppedByWorker) return recover('all');
        return (
          <Button
            label={t('waiting.tryAgain')}
            icon="refresh"
            onPress={searchAgain}
            loading={busy}
          />
        );
      // The window ran out. Re-opening it is the right first move — a worker
      // may simply have been busy — with choosing by hand beside it.
      case 'expired':
        return isCompanyOrder ? null : recover('again');
      case 'accepted':
      case 'in_progress':
        return (
          <Button
            label={t('order.markComplete')}
            icon="checkmark-done"
            onPress={complete}
            loading={busy}
          />
        );
      case 'completed':
        return (
          <Button
            label={t('accepted.rate')}
            icon="star"
            variant="secondary"
            onPress={() => router.push({ pathname: '/rate', params: { orderId: order.id } })}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <Screen
      padded={false}
      header={<Header title={t('orders.detailTitle')} />}
      refreshControl={refreshControl}
      footer={action}>
      <View style={styles.head}>
        <Text style={[Type.title1, styles.category, { color: theme.text }]}>
          {categoryName(byId(order.category_id), lang) || t('company.orderTitle')}
        </Text>
        <StatusPill status={order.status} />
      </View>

      {isCustomer && !isCompanyOrder ? (
        <OutcomeBanner order={order} droppedByWorker={droppedByWorker} notified={notified} />
      ) : null}

      <Section
        header={t('order.detailsTitle')}
        footer={
          order.status === 'accepted' || order.status === 'in_progress'
            ? t('order.completeHint')
            : undefined
        }>
        <Row
          title={t('order.price')}
          value={`${formatSom(order.price)} ${t('common.som')}`}
        />
        <Row stacked title={t('order.description')} value={order.description || '—'} />
        <Row title={t('order.gender')} value={genderLabel} />
        <Row title={t('order.phone')} value={order.customer_phone} />
      </Section>

      {/* The photos the customer attached. Often they explain the job better
          than the description does — and they are the first thing an admin
          looks for when a job is disputed, which is why they are shown at the
          width of the card and not as a row of thumbnails. */}
      <PhotoSlider uris={order.images} header={t('order.photo')} height={240} />

      {hasCoords(order) ? (
        <View style={styles.mapWrap}>
          {/* The worker gets directions; the customer just sees the address. */}
          <YandexMap
            point={{ lat: order.lat, lng: order.lng }}
            height={180}
            route={!isCustomer}
            caption={t('order.location')}
          />
        </View>
      ) : null}

      {order.worker_phone ? (
        <Section header={t('accepted.worker')} style={styles.section}>
          <Row
            title={order.worker_phone}
            onPress={() => Linking.openURL(telUrl(order.worker_phone!))}
            right={
              <Pressable
                onPress={() => Linking.openURL(telUrl(order.worker_phone!))}
                hitSlop={10}
                style={({ pressed }) => (pressed ? { opacity: 0.5 } : null)}>
                <Icon name="call" size={20} color={theme.primary} />
              </Pressable>
            }
          />
        </Section>
      ) : null}
    </Screen>
  );
}

/* ===================== What is happening, in words ===================== */

/**
 * The line a status pill cannot carry: what just happened to this order and
 * what the customer can do about it. Shown while the search runs and once it
 * has ended without a worker; nothing for the states that explain themselves.
 */
function OutcomeBanner({
  order,
  droppedByWorker,
  notified,
}: {
  order: Order;
  droppedByWorker: boolean;
  notified: number;
}) {
  const t = useT();
  const theme = useTheme();

  const content = ((): { icon: IconName; tone: 'danger' | 'warning' | 'primary'; title: string; body: string } | null => {
    switch (order.status) {
      case 'matching':
      case 'invited':
        // Nobody was in range when it went out. The search keeps running to the
        // end of its window, and a worker who comes online inside it is offered
        // the job — so this is "not yet", not "no".
        return notified === 0
          ? {
              icon: 'hourglass',
              tone: 'warning',
              title: t('outcome.noneYetTitle'),
              body: t('outcome.noneYetBody'),
            }
          : {
              icon: 'paper-plane',
              tone: 'primary',
              title: t('outcome.sentTitle', { n: notified }),
              body: t('outcome.sentBody'),
            };
      case 'rejected':
        return {
          icon: 'close-circle',
          tone: 'danger',
          title: t('outcome.rejectedTitle'),
          body: t('outcome.rejectedBody'),
        };
      case 'cancelled':
        return droppedByWorker
          ? {
              icon: 'warning',
              tone: 'danger',
              title: t('outcome.droppedTitle'),
              body: t('outcome.droppedBody'),
            }
          : null;
      case 'expired':
        return notified === 0
          ? {
              icon: 'location',
              tone: 'warning',
              title: t('outcome.noWorkersTitle'),
              body: t('outcome.noWorkersBody'),
            }
          : {
              icon: 'time',
              tone: 'warning',
              title: t('outcome.noAnswerTitle'),
              body: t('outcome.noAnswerBody', { n: notified }),
            };
      default:
        return null;
    }
  })();

  if (!content) return null;

  const tint =
    content.tone === 'danger' ? theme.danger : content.tone === 'warning' ? theme.warning : theme.primary;
  const wash =
    content.tone === 'danger'
      ? theme.dangerSoft
      : content.tone === 'warning'
        ? theme.warningSoft
        : theme.primarySoft;

  return (
    <View style={[styles.banner, Squircle, { backgroundColor: wash }]}>
      <View style={[styles.bannerGlyph, { backgroundColor: theme.surface }]}>
        <Icon name={content.icon} size={22} color={tint} />
      </View>
      <View style={styles.bannerText}>
        <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{content.title}</Text>
        <Text style={[Type.footnote, { color: theme.textSecondary }]}>{content.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerStack: { gap: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: Layout.gutter,
    marginBottom: 24,
    padding: 14,
    borderRadius: Radius.lg,
  },
  bannerGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, gap: 3 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    paddingBottom: 20,
  },
  category: { flex: 1 },
  section: { marginTop: 28 },
  mapWrap: { paddingHorizontal: Layout.gutter, marginTop: 20 },
});
