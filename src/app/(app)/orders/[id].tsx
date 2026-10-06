import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { Layout, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName, formatSom, telUrl } from '@/lib/format';
import { hasCoords } from '@/lib/maps';
import type { Order } from '@/lib/types';
import { useAuth } from '@/store/auth';

import { Icon } from '@/components/ui/icon';

export default function OrderDetailScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useCategories();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const o = await api.get<Order>(`/orders/${id}`);
      setOrder(o);
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
      case 'expired':
      case 'cancelled':
      // Declined by everyone it was aimed at. Re-opening clears the record of
      // who said no, so "try again" genuinely asks them again — which is what
      // the customer means when the answer might have been "not right now".
      case 'rejected':
        // Nobody took it — one tap puts it back in front of every worker.
        return isCompanyOrder ? null : (
          <Button
            label={t('waiting.tryAgain')}
            icon="refresh"
            onPress={searchAgain}
            loading={busy}
          />
        );
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

const styles = StyleSheet.create({
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
