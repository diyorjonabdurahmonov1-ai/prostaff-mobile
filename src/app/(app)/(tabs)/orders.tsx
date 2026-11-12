import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { Sheet } from '@/components/ui/sheet';
import { Segmented } from '@/components/ui/segmented';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { formatCountdown, useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import {
  groupOrders,
  progressOf,
  retryMissing,
  slotOf,
  startWithFound,
  type OrderEntry,
  type Slot,
} from '@/lib/batches';
import { categoryName, formatSom } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

import { Icon } from '@/components/ui/icon';
import { Backdrop } from '@/components/backdrop';

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

  /**
   * One entry per request, then split by tab.
   *
   * A request for several workers lives in "active" while any of its orders is
   * still going — so a request that found two of four sits there, with its
   * empty places, until the customer deals with them — and moves to "done"
   * once every order has ended.
   */
  const visible = useMemo(
    () =>
      groupOrders(orders).filter((e) => {
        const ended = e.orders.every((o) => DONE.includes(o.status));
        return filter === 'done' ? ended : !ended;
      }),
    [orders, filter],
  );

  /** Single orders run together in one grouped list; a request gets its own card. */
  const chunks = useMemo(() => {
    const out: (
      | { kind: 'batch'; entry: OrderEntry }
      | { kind: 'singles'; key: string; orders: Order[] }
    )[] = [];
    for (const entry of visible) {
      if (entry.orders.length > 1) {
        out.push({ kind: 'batch', entry });
        continue;
      }
      const last = out[out.length - 1];
      if (last?.kind === 'singles') last.orders.push(entry.orders[0]);
      else out.push({ kind: 'singles', key: entry.key, orders: [entry.orders[0]] });
    }
    return out;
  }, [visible]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Backdrop />
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
            <View style={styles.entries}>
              {chunks.map((chunk) =>
                chunk.kind === 'batch' ? (
                  <BatchCard
                    key={chunk.entry.key}
                    orders={chunk.entry.orders}
                    onOpen={(id) => router.push({ pathname: '/orders/[id]', params: { id } })}
                    onChanged={load}
                  />
                ) : (
                  <Section key={chunk.key} separatorInset={Layout.gutter}>
                    {chunk.orders.map((order) => (
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
                ),
              )}
            </View>
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

/* ===================== One request for several workers ===================== */

/**
 * A request for N workers as one card: how many came, which places are still
 * being searched, which came back empty — and one tap to look again for all
 * of the empty ones.
 */
function BatchCard({
  orders,
  onOpen,
  onChanged,
}: {
  orders: Order[];
  onOpen: (id: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const { byId } = useCategories();
  const [busy, setBusy] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);

  const first = orders[0];
  const { found, searching, missing, wanted } = progressOf(orders);
  /** Some came, some are still owed — the workers found are waiting on a decision. */
  const partial = found > 0 && found < wanted;

  const tint: Record<Slot, string> = {
    found: theme.success,
    searching: theme.warning,
    missing: theme.danger,
    withdrawn: theme.fill,
  };

  const retry = async () => {
    setBusy(true);
    try {
      const failed = await retryMissing(orders);
      if (failed > 0) {
        Alert.alert(t('common.error'), t('batch.retryFailed', { n: failed }));
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  /** Go ahead with the workers found; nobody else is searched for. */
  const start = async () => {
    setBusy(true);
    try {
      const failed = await startWithFound(orders);
      setConfirmStart(false);
      if (failed > 0) Alert.alert(t('common.error'), t('batch.retryFailed', { n: failed }));
      await onChanged();
    } catch (err) {
      setConfirmStart(false);
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.batch, Squircle, { backgroundColor: theme.surface }]}>
      <View style={styles.batchHead}>
        <Text style={[Type.headline, styles.title, { color: theme.text }]} numberOfLines={1}>
          {categoryName(byId(first.category_id), lang) || t('company.orderTitle')}
        </Text>
        <View style={[styles.countPill, { backgroundColor: theme.primarySoft }]}>
          <Icon name="people" size={13} color={theme.primary} />
          <Text style={[Type.caption1Emphasized, { color: theme.primary }]}>
            {t('batch.workers', { n: orders.length })}
          </Text>
        </View>
      </View>

      <Text style={[Type.title3, { color: theme.text }]}>
        {found === wanted && wanted > 0
          ? // Fewer than asked for, by the customer's own choice to start.
            wanted < orders.length
            ? t('batch.startedWith', { n: found })
            : t('batch.allFound', { n: found })
          : t('batch.progress', { found, total: wanted })}
      </Text>

      {/* One segment per place, in the same order as the rows under it. */}
      <View style={styles.segments}>
        {orders.map((o) => (
          <View key={o.id} style={[styles.segment, { backgroundColor: tint[slotOf(o)] }]} />
        ))}
      </View>

      <View style={styles.legend}>
        {searching > 0 ? (
          <Text style={[Type.footnote, { color: theme.warning }]}>
            {t('batch.searching', { n: searching })}
          </Text>
        ) : null}
        {missing > 0 ? (
          <Text style={[Type.footnote, { color: theme.danger }]}>
            {t('batch.missing', { n: missing })}
          </Text>
        ) : null}
        <Text style={[Type.footnote, { color: theme.textSecondary }]}>
          {`${formatSom(first.price)} ${t('common.som')} · ${t('batch.each')}`}
        </Text>
      </View>

      <View style={[styles.slots, { borderTopColor: theme.separator }]}>
        {orders.map((o, i) => (
          <Pressable
            key={o.id}
            onPress={() => onOpen(o.id)}
            style={({ pressed }) => [styles.slotRow, pressed && { backgroundColor: theme.highlight }]}>
            <View style={[styles.slotDot, { backgroundColor: tint[slotOf(o)] }]} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={[Type.subhead, styles.title, { color: theme.text }]}>
                  {t('batch.slot', { n: i + 1 })}
                </Text>
                <StatusPill status={o.status} />
              </View>
              {SEARCHING.includes(o.status) ? <SearchCountdown order={o} onExpired={onChanged} /> : null}
            </View>
            <Icon name="chevron-forward" size={15} color={theme.textTertiary} />
          </Pressable>
        ))}
      </View>

      {/* The workers who said yes are waiting: say so, and let the customer
          release them without waiting for the rest. */}
      {partial ? (
        <View style={[styles.note, Squircle, { backgroundColor: theme.primarySoft }]}>
          <Icon name="info" size={16} color={theme.primary} />
          <Text style={[Type.footnote, styles.title, { color: theme.text }]}>
            {t('batch.waitingNote', { n: found })}
          </Text>
        </View>
      ) : null}

      {missing > 0 ? (
        <Button
          label={t('batch.retryMissing', { n: missing })}
          icon="refresh"
          onPress={retry}
          loading={busy}
        />
      ) : null}
      {partial ? (
        <Button
          label={t('batch.startWithFound', { n: found })}
          icon="checkmark-done"
          variant="secondary"
          onPress={() => setConfirmStart(true)}
          disabled={busy}
        />
      ) : null}

      <Sheet
        visible={confirmStart}
        onClose={() => !busy && setConfirmStart(false)}
        title={t('batch.startTitle', { n: found })}
        message={t('batch.startBody', { n: wanted - found, found })}
        footer={
          <>
            <Button
              label={t('batch.startYes')}
              icon="checkmark-done"
              loading={busy}
              onPress={start}
            />
            <Button
              label={t('job.no')}
              variant="gray"
              disabled={busy}
              onPress={() => setConfirmStart(false)}
            />
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  entries: { gap: 16 },
  batch: {
    marginHorizontal: Layout.gutter,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  batchHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  segments: { flexDirection: 'row', gap: 4 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
  },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
  slots: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: -16, marginTop: 2 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  slotDot: { width: 8, height: 8, borderRadius: 4 },
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
