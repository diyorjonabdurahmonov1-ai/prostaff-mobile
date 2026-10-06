import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncomingOrderCard } from '@/components/incoming-order-card';
import { StatusPill } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName, formatSom, telUrl } from '@/lib/format';
import { hasCoords } from '@/lib/maps';
import type { Order } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useWorkerOrders } from '@/store/realtime';

import { Icon } from '@/components/ui/icon';

type Tab = 'incoming' | 'active' | 'done';

const ACTIVE: Order['status'][] = ['accepted', 'in_progress'];
const DONE: Order['status'][] = ['completed', 'cancelled', 'rejected', 'expired'];

export default function WorkerOrdersScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('incoming');

  // One poller for the whole worker side: new invites simply appear in the
  // list, which is why there is no takeover any more.
  const { orders, incoming, loading, refresh } = useWorkerOrders(
    !!user?.worker_profile,
    undefined,
    user?.id
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const act = async (order: Order, action: 'accept' | 'reject') => {
    setBusyId(order.id);
    try {
      await api.post(`/worker/orders/${order.id}/${action}`);
      await refresh();
    } catch (err) {
      Alert.alert(t('common.genericError'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const done = orders.filter((o) => DONE.includes(o.status));
  const list = tab === 'incoming' ? incoming : tab === 'active' ? active : done;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header title={t('tab.orders')} large back subtitle={`${orders.length} ta`} />

      <View style={styles.controls}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'incoming', label: `Yangi${incoming.length ? ` (${incoming.length})` : ''}` },
            { value: 'active', label: `Faol${active.length ? ` (${active.length})` : ''}` },
            { value: 'done', label: 'Tarix' },
          ]}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'incoming' ? 'notifications-outline' : 'reader-outline'}
          title={t('orders.none')}
          message={tab === 'incoming' ? t('worker.onlineHint') : undefined}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {list.map((order, index) =>
            tab === 'incoming' ? (
              <IncomingOrderCard
                key={order.id}
                order={order}
                profile={user?.worker_profile}
                busy={busyId === order.id}
                onAccept={() => act(order, 'accept')}
                onReject={() => act(order, 'reject')}
                onOpen={() => router.push({ pathname: '/work/[id]', params: { id: order.id } })}
                // One map is worth its weight; five stacked ones are not.
                compact={index > 0}
              />
            ) : (
              <OrderCard
                key={order.id}
                order={order}
                onOpen={() => router.push({ pathname: '/work/[id]', params: { id: order.id } })}
              />
            ),
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** An order the worker already holds (or has finished). */
function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const { byId } = useCategories();

  const phone = order.customer_phone;
  const showPhone = ACTIVE.includes(order.status) && !!phone;
  // Only a job still in hand deserves a map — history is just a record.
  const showMap = ACTIVE.includes(order.status) && hasCoords(order);

  return (
    <Section inset={Layout.gutter} style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[Type.headline, styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {categoryName(byId(order.category_id), lang) || t('company.orderTitle')}
          </Text>
          <StatusPill status={order.status} />
          <Pressable
            onPress={onOpen}
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

        {order.description ? (
          <Text style={[Type.subhead, { color: theme.textSecondary }]} numberOfLines={3}>
            {order.description}
          </Text>
        ) : null}

        {showMap ? (
          <YandexMap
            point={{ lat: order.lat, lng: order.lng }}
            height={150}
            route
            caption={t('order.location')}
          />
        ) : null}

        <View style={styles.metaRow}>
          <Icon name="time-outline" size={14} color={theme.textTertiary} />
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>
            {new Date(order.created_at).toLocaleString()}
          </Text>
        </View>

        {showPhone ? (
          <Pressable
            onPress={() => Linking.openURL(telUrl(phone))}
            style={({ pressed }) => [
              styles.phone,
              Squircle,
              { backgroundColor: theme.successSoft },
              pressed && { opacity: 0.6 },
            ]}>
            <Icon name="call" size={15} color={theme.success} />
            <Text style={[Type.footnoteEmphasized, { color: theme.success }]}>{phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  controls: { paddingHorizontal: Layout.gutter, paddingTop: 12, paddingBottom: 4 },
  scroll: { paddingTop: 16, paddingBottom: 40, gap: 14 },
  card: { marginBottom: 0 },
  cardBody: { padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    marginTop: 2,
  },
  actions: { gap: 6, marginTop: 6 },
});
