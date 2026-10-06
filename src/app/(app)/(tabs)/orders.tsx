import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { Layout, Radius, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { formatCountdown, useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName, formatSom } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

import { Icon } from '@/components/ui/icon';

type Filter = 'active' | 'done';

const DONE: OrderStatus[] = ['completed', 'cancelled', 'rejected', 'expired'];
/** Statuses that mean "still looking for a worker". */
const SEARCHING: OrderStatus[] = ['pending', 'matching', 'invited'];

/** While something is still searching, the list follows it in near-real time. */
const SEARCH_POLL_MS = 4000;

export default function OrdersScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { byId } = useCategories();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('active');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Order[]>('/orders');
      setOrders(data ?? []);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // An order placed a moment ago is being broadcast right now, so the screen
  // keeps polling while any of them is searching and stops once none is.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tick = async () => {
        const data = await api.get<Order[]>('/orders').catch(() => null);
        if (cancelled) return;
        if (data) setOrders(data);
        setLoading(false);
        const searching = (data ?? []).some((o) => SEARCHING.includes(o.status));
        timerRef.current = setTimeout(tick, searching ? SEARCH_POLL_MS : SEARCH_POLL_MS * 4);
      };
      tick();
      return () => {
        cancelled = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const visible = useMemo(
    () =>
      orders.filter((o) => (filter === 'done' ? DONE.includes(o.status) : !DONE.includes(o.status))),
    [orders, filter],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={t('orders.title')} large back={false} />

      <View style={styles.filter}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: t('orders.filterActive') },
            { value: 'done', label: t('orders.filterDone') },
          ]}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textMuted} />
          }>
          {visible.length === 0 ? (
            <EmptyState
              icon="reader-outline"
              title={t('orders.none')}
              message={t('orders.noneHint')}
            />
          ) : (
            <Section separatorInset={Layout.gutter}>
              {visible.map((order) => (
                <Pressable
                  key={order.id}
                  onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: theme.highlight },
                  ]}>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text style={[Type.body, styles.title, { color: theme.text }]} numberOfLines={1}>
                        {categoryName(byId(order.category_id), lang) || t('company.orderTitle')}
                      </Text>
                      <StatusPill status={order.status} />
                    </View>
                    <Text
                      style={[Type.footnote, { color: theme.textSecondary }]}
                      numberOfLines={2}>
                      {order.description || '—'}
                    </Text>
                    <Text style={[Type.footnoteEmphasized, { color: theme.text }]}>
                      {formatSom(order.price)} {t('common.som')}
                    </Text>

                    {/* Still looking for a worker: the clock runs right here. */}
                    {SEARCHING.includes(order.status) ? (
                      <SearchCountdown order={order} onExpired={load} />
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={17} color={theme.textTertiary} />
                </Pressable>
              ))}
            </Section>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * The live search line under an order: how long the broadcast has left.
 *
 * The server closes the order when the window runs out — this asks for the
 * fresh copy the moment the clock hits zero, so the row flips to "Muddati
 * tugadi" and drops into the finished tab on its own.
 */
function SearchCountdown({ order, onExpired }: { order: Order; onExpired: () => void }) {
  const t = useT();
  const theme = useTheme();
  const deadline = order.invite_expires_at ? new Date(order.invite_expires_at).getTime() : null;
  const { remaining, expired } = useCountdown({ deadline });
  const notified = order.invited_worker_ids?.length ?? 0;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!deadline || !expired || firedRef.current) return;
    firedRef.current = true;
    // Give the server's own expiry a moment to land, then re-read.
    const id = setTimeout(onExpired, 1200);
    return () => clearTimeout(id);
  }, [deadline, expired, onExpired]);

  if (!deadline || expired) {
    return (
      <View style={styles.searchRow}>
        <Icon name="hourglass" size={14} color={theme.textTertiary} />
        <Text style={[Type.footnote, { color: theme.textTertiary }]}>
          {t('waiting.searchingNearby')}
        </Text>
      </View>
    );
  }

  const urgent = remaining <= 20;
  const tint = urgent ? theme.danger : theme.warning;

  return (
    <View style={styles.searchRow}>
      <View style={[styles.clock, { backgroundColor: urgent ? theme.dangerSoft : theme.warningSoft }]}>
        <Icon name="time" size={13} color={tint} />
        <Text style={[Type.footnoteEmphasized, { color: tint }]}>{formatCountdown(remaining)}</Text>
      </View>
      <Text style={[Type.footnote, styles.searchText, { color: theme.textSecondary }]} numberOfLines={1}>
        {notified > 0
          ? `${notified} ${t('waiting.workersNotified')}`
          : t('waiting.searchingNearby')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  filter: { paddingHorizontal: Layout.gutter, paddingTop: 12, paddingBottom: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  searchText: { flex: 1 },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  list: { paddingTop: 16, paddingBottom: 40, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 12,
    minHeight: Layout.rowHeight,
  },
  rowBody: { flex: 1, gap: 4 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
});
