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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PROVIDER_NAV_HEIGHT, ProviderNav } from '@/components/provider-nav';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom, telUrl } from '@/lib/format';
import { hasCoords } from '@/lib/maps';
import type { Order } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useCompanyOrders } from '@/store/realtime';

import { Icon } from '@/components/ui/icon';

/**
 * The firm's orders, all of them.
 *
 * A company used to have no orders screen at all — the panel home answered new
 * ones and listed whatever had been answered underneath, with no filter and no
 * end. So "what did we do last month?" and "which job is open right now?" had
 * the same answer: scroll. This is the worker's orders screen for a firm, minus
 * the invites a firm never gets.
 */

type Tab = 'new' | 'active' | 'done';

export default function CompanyOrdersScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('new');
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const { orders, pending, active, done, loading, refresh } = useCompanyOrders(
    !!user?.company_profile
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  /** A company answers directly — it takes the job or declines it. */
  const respond = async (order: Order, action: 'accept' | 'reject') => {
    setRespondingId(order.id);
    try {
      await api.post(`/company/orders/${order.id}/${action}`);
      // Accepting can spend one of the firm's free orders — no commission is
      // taken from a firm, it pays by the month — so the account is re-read
      // alongside the list to keep the remaining count honest.
      await Promise.all([refresh(), refreshMe()]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setRespondingId(null);
    }
  };

  // A firm is a team and may hold several jobs at once — see the panel.
  const list = tab === 'new' ? pending : tab === 'active' ? active : done;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title={t('tab.orders')}
        large
        back
        subtitle={t('company.ordersCount', { n: orders.length })}
      />

      <View style={styles.controls}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'new', label: `${t('orders.filterNew')}${pending.length ? ` (${pending.length})` : ''}` },
            { value: 'active', label: `${t('orders.filterActive')}${active.length ? ` (${active.length})` : ''}` },
            { value: 'done', label: t('orders.filterHistory') },
          ]}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'new' ? 'notifications-outline' : 'reader-outline'}
          title={t('orders.none')}
          message={tab === 'new' ? t('company.noOrdersHint') : undefined}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: PROVIDER_NAV_HEIGHT + insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {list.map((order) => (
            <CompanyOrderCard
              key={order.id}
              order={order}
              answerable={tab === 'new'}
              responding={respondingId === order.id}
              onAccept={() => respond(order, 'accept')}
              onReject={() => respond(order, 'reject')}
              onEnded={() => Promise.all([refresh(), refreshMe()])}
              // A firm reads its own jobs from the provider's side — the whole
              // brief and who placed it — not from the customer's order screen.
              onOpen={() => router.push({ pathname: '/work/[id]', params: { id: order.id } })}
            />
          ))}
        </ScrollView>
      )}

      <ProviderNav mode="company" active="orders" />
    </SafeAreaView>
  );
}

function CompanyOrderCard({
  order,
  answerable,
  responding,
  onAccept,
  onReject,
  onOpen,
  onEnded,
}: {
  order: Order;
  answerable: boolean;
  responding: boolean;
  onAccept: () => void;
  onReject: () => void;
  onOpen: () => void;
  onEnded: () => Promise<unknown>;
}) {
  const t = useT();
  const theme = useTheme();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /**
   * The firm's way out of a job it holds.
   *
   * Only the customer can mark a firm's job finished, so a customer who never
   * tapped "Ish tugadi" used to leave the job — and the firm — stuck on it for
   * good. The API has always let the provider cancel; this card now offers it.
   */
  const cancelJob = async () => {
    setCancelling(true);
    try {
      await api.post(`/orders/${order.id}/cancel`);
      setConfirmCancel(false);
      await onEnded();
    } catch (err) {
      setConfirmCancel(false);
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.genericError'));
    } finally {
      setCancelling(false);
    }
  };

  const holding = order.status === 'accepted' || order.status === 'in_progress';
  // The customer's number is the firm's to use while the job is theirs — and a
  // map is only worth its space for a job somebody still has to drive to.
  const showPhone = holding && !!order.customer_phone;
  // An unanswered job shows where it is too: whether the firm can get there is
  // half of whether it should accept.
  const showMap = (holding || answerable) && hasCoords(order);

  return (
    <Section inset={Layout.gutter} style={styles.card}>
      <Pressable
        onPress={answerable ? undefined : onOpen}
        style={({ pressed }) => [
          styles.cardBody,
          pressed && !answerable ? { backgroundColor: theme.highlight } : null,
        ]}>
        <View style={styles.cardTop}>
          <Text style={[Type.headline, styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
            {order.description || t('company.orderTitle')}
          </Text>
          <StatusPill status={order.status} />
          {/* An unanswered card does not open on a body tap — accept and reject
              sit right underneath it — so the way in is a control of its own. */}
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

        {/* The server withholds the number until the firm takes the job, so
            this is the name alone on an unanswered card. */}
        <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
          {[order.customer_name, order.customer_phone].filter(Boolean).join(' · ') || '—'}
        </Text>

        {showMap ? (
          <YandexMap
            point={{ lat: order.lat, lng: order.lng }}
            height={150}
            route={holding}
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
            onPress={() => Linking.openURL(telUrl(order.customer_phone))}
            style={({ pressed }) => [
              styles.phone,
              Squircle,
              { backgroundColor: theme.successSoft },
              pressed && { opacity: 0.6 },
            ]}>
            <Icon name="call" size={15} color={theme.success} />
            <Text style={[Type.footnoteEmphasized, { color: theme.success }]}>
              {order.customer_phone}
            </Text>
          </Pressable>
        ) : null}

        {answerable ? (
          <View style={styles.actions}>
            <Button
              label={t('company.acceptOrder')}
              icon="checkmark"
              loading={responding}
              onPress={onAccept}
            />
            <Button
              label={t('company.rejectOrder')}
              variant="ghost"
              disabled={responding}
              onPress={onReject}
            />
          </View>
        ) : null}

        {holding ? (
          <Button
            label={t('job.cancel')}
            icon="close"
            variant="gray"
            size="sm"
            onPress={() => setConfirmCancel(true)}
            disabled={cancelling}
          />
        ) : null}
      </Pressable>

      <Sheet
        visible={confirmCancel}
        onClose={() => !cancelling && setConfirmCancel(false)}
        title={t('job.areYouSure')}
        message={t('job.cancelConfirm')}
        footer={
          <>
            <Button
              label={t('job.yesCancel')}
              icon="close"
              variant="danger"
              loading={cancelling}
              onPress={cancelJob}
            />
            <Button
              label={t('job.no')}
              variant="gray"
              disabled={cancelling}
              onPress={() => setConfirmCancel(false)}
            />
          </>
        }
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  controls: { paddingHorizontal: Layout.gutter, paddingTop: 12, paddingBottom: 4 },
  notice: { paddingHorizontal: Layout.gutter + 4, paddingBottom: 4 },
  scroll: { paddingTop: 16, gap: 14 },
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
