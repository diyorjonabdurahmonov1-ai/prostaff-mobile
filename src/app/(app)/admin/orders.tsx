import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusPill } from '@/components/ui/badge';
import { SelectableChip } from '@/components/ui/chip';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { Layout, Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { resolveImageUrl } from '@/lib/image';
import type { AdminOrder, OrderStatus } from '@/lib/types';

import { Icon } from '@/components/ui/icon';

type Period = 'day' | 'month' | 'year';
type StatusFilter = 'all' | OrderStatus;

const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'pending',
  'invited',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
  'expired',
];

/** "2026-07-30" → "30-iyul, 2026"; "2026-07" → "Iyul 2026"; "2026" → "2026". */
const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

function bucketTitle(bucket: string, period: Period): string {
  const parts = bucket.split('-');
  if (period === 'year' || parts.length === 1) return bucket;
  const month = MONTHS[Number(parts[1]) - 1] ?? parts[1];
  if (period === 'month' || parts.length === 2) {
    return `${month[0].toUpperCase()}${month.slice(1)} ${parts[0]}`;
  }
  return `${Number(parts[2])}-${month}, ${parts[0]}`;
}

export default function AdminOrdersScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('day');
  const [status, setStatus] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    try {
      const data = await api.get<AdminOrder[]>('/admin/orders', { query: { period } });
      setOrders(data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(
    () => (status === 'all' ? orders : orders.filter((o) => o.status === status)),
    [orders, status],
  );

  /** Orders arrive newest-first, so buckets stay in order as we walk the list. */
  const groups = useMemo(() => {
    const out: { bucket: string; orders: AdminOrder[]; revenue: number }[] = [];
    for (const order of filtered) {
      const last = out[out.length - 1];
      if (last && last.bucket === order.bucket) {
        last.orders.push(order);
        last.revenue += order.commission;
      } else {
        out.push({ bucket: order.bucket, orders: [order], revenue: order.commission });
      }
    }
    return out;
  }, [filtered]);

  const totalRevenue = filtered.reduce((sum, o) => sum + o.commission, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header
        title={t('orders.title')}
        large
        back
        subtitle={`${filtered.length} ta · ${formatSom(totalRevenue)} ${t('common.som')}`}
      />

      <View style={styles.controls}>
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'day', label: 'Kun' },
            { value: 'month', label: 'Oy' },
            { value: 'year', label: 'Yil' },
          ]}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filtersScroll}>
        {STATUS_FILTERS.map((key) => (
          <SelectableChip
            key={key}
            label={key === 'all' ? 'Hammasi' : t(`status.${key}`)}
            selected={status === key}
            onToggle={() => setStatus(key)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <EmptyState icon="reader-outline" title={t('orders.none')} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          {groups.map((group) => (
            <Section
              key={group.bucket}
              header={`${bucketTitle(group.bucket, period)}  ·  ${group.orders.length} ta`}
              footer={
                group.revenue > 0
                  ? `Komissiya: ${formatSom(group.revenue)} ${t('common.som')}`
                  : undefined
              }
              separatorInset={Layout.gutter}
              style={styles.group}>
              {group.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onPress={() =>
                    router.push({ pathname: '/orders/[id]', params: { id: order.id } })
                  }
                />
              ))}
            </Section>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** One order line — who ordered it, who took it, and what it earned. */
function OrderRow({ order, onPress }: { order: AdminOrder; onPress: () => void }) {
  const theme = useTheme();
  const customer = order.customer_name || order.customer_phone || '—';
  const contact = order.customer_email || order.customer_phone;
  const taker = order.worker_name || order.company_name;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.highlight }]}>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[Type.body, styles.title, { color: theme.text }]} numberOfLines={1}>
            {order.category_name || order.description || '—'}
          </Text>
          <StatusPill status={order.status} />
        </View>

        <View style={styles.metaRow}>
          <Icon name="person-outline" size={13} color={theme.textSecondary} />
          <Text style={[Type.footnote, styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
            {customer}
            {contact ? ` · ${contact}` : ''}
          </Text>
        </View>

        {taker ? (
          <View style={styles.metaRow}>
            <Icon
              name={order.company_name ? 'business-outline' : 'hammer-outline'}
              size={13}
              color={theme.textSecondary}
            />
            <Text
              style={[Type.footnote, styles.meta, { color: theme.textSecondary }]}
              numberOfLines={1}>
              {taker}
              {order.worker_phone ? ` · ${order.worker_phone}` : ''}
            </Text>
          </View>
        ) : null}

        <Text style={[Type.caption1, { color: theme.textTertiary }]}>
          {new Date(order.created_at).toLocaleString()}
          {order.commission > 0 ? ` · +${formatSom(order.commission)}` : ''}
        </Text>
      </View>

      {/* The attached photo, so a scan down the list shows which jobs came with
          evidence — the full-size image is one tap away on the detail screen. */}
      {order.image_url ? (
        <View>
          <Image
            source={{ uri: resolveImageUrl(order.image_url) }}
            style={[styles.thumb, { backgroundColor: theme.surfaceMuted }]}
            contentFit="cover"
            transition={160}
          />
          {/* How many are behind it — an order with five photos and one with a
              single blurry frame look identical otherwise. */}
          {order.images?.length > 1 ? (
            <View style={[styles.thumbBadge, { backgroundColor: theme.text }]}>
              <Text style={[Type.caption2Emphasized, { color: theme.surface }]}>
                {order.images.length}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Icon name="chevron-forward" size={17} color={theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1 },
  controls: { paddingHorizontal: Layout.gutter, paddingTop: 12 },
  filtersScroll: { flexGrow: 0 },
  filters: { paddingHorizontal: Layout.gutter, paddingVertical: 12, gap: 8 },
  scroll: { paddingTop: 4, paddingBottom: 40 },
  group: { marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 12,
  },
  body: { flex: 1, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { flex: 1 },
  thumb: { width: 46, height: 46, borderRadius: Radius.sm },
});
