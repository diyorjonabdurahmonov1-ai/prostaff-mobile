import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PROVIDER_NAV_HEIGHT, ProviderNav } from '@/components/provider-nav';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Icon } from '@/components/ui/icon';
import { Hairline, Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { checkout } from '@/lib/payments';
import type { SubscriptionPlan } from '@/lib/types';
import { useAuth } from '@/store/auth';

interface PlansResponse {
  plans: SubscriptionPlan[];
  payments_enabled: boolean;
}

/**
 * The firm's tariff cards.
 *
 * This is the firm's answer to the worker's wallet, and it replaces it: a firm
 * pays no commission per job, so a balance says nothing about whether work will
 * arrive. A date does, and this is where the date is bought.
 *
 * The plans differ in *length only* — every subscribed firm gets the same
 * platform — so the cards do not carry competing feature lists. What they carry
 * is the one thing that actually differs: a longer term costs less per month.
 * The shared list of what a subscription includes sits once, at the bottom,
 * where it belongs when it is the same for everybody.
 *
 * Prices come from the server on every open rather than being remembered. They
 * are the office's to change, and a stale card would mean a firm agreeing to
 * one number and being charged another.
 */
export default function CompanySubscriptionScreen() {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const { user, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();
  const profile = user?.company_profile ?? null;

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'warning' | 'danger'>('success');

  const load = useCallback(async () => {
    try {
      const res = await api.get<PlansResponse>('/company/subscription/plans');
      setPlans(res?.plans ?? []);
    } catch {
      // keep whatever is on screen; the pull-to-refresh is right there
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshMe();
      load();
    }, [refreshMe, load]),
  );

  const { refreshControl } = useRefresh(async () => {
    await Promise.all([refreshMe(), load()]);
  });

  /** The card that saves the most per month — the one worth pointing at. */
  const bestId = plans.reduce<{ id: string; perMonth: number } | null>((best, plan) => {
    if (!best || plan.per_month < best.perMonth) return { id: plan.id, perMonth: plan.per_month };
    return best;
  }, null)?.id;

  const pay = async (plan: SubscriptionPlan) => {
    setPayingId(plan.id);
    setNotice(null);
    try {
      const result = await checkout('/company/subscription/checkout', { plan_id: plan.id });
      // Closing the card form is a choice, not a failure — say nothing.
      if (result.status === 'canceled') return;
      if (result.status === 'success') {
        setNoticeTone('success');
        setNotice(t('subscription.success'));
      } else if (result.status === 'pending') {
        // Late, not lost — the one message that would be actively untrue for
        // somebody whose card has already been charged.
        setNoticeTone('warning');
        setNotice(t('wallet.pending'));
      } else {
        setNoticeTone('danger');
        setNotice(t('wallet.failed'));
      }
      await Promise.all([refreshMe(), load()]);
    } catch {
      setNoticeTone('danger');
      setNotice(t('common.genericError'));
    } finally {
      setPayingId(null);
    }
  };

  const noticeColor =
    noticeTone === 'success'
      ? theme.success
      : noticeTone === 'warning'
        ? theme.warningText
        : theme.danger;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={t('subscription.title')} large />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: PROVIDER_NAV_HEIGHT + insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        {/* Where the firm stands today — the figure that decides whether orders
            reach it at all. */}
        <View style={styles.statusWrap}>
          <View style={[styles.status, Squircle, { backgroundColor: theme.surface }]}>
            <Icon
              name={profile?.subscription_active ? 'checkmark-circle' : 'warning'}
              size={26}
              color={profile?.subscription_active ? theme.success : theme.warning}
            />
            <View style={styles.statusText}>
              <Text style={[Type.headline, { color: theme.text }]}>
                {profile?.subscription_active
                  ? `${profile.subscription_days_left} ${t('subscription.daysLeft')}`
                  : profile?.subscription_until
                    ? t('subscription.expired')
                    : t('subscription.none')}
              </Text>
              {profile?.subscription_until ? (
                <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                  {t('subscription.until')}:{' '}
                  {new Date(profile.subscription_until).toLocaleDateString()}
                </Text>
              ) : profile ? (
                <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                  {t('subscription.freeLeft')}:{' '}
                  {Math.max(profile.free_orders_limit - profile.free_orders_used, 0)} /{' '}
                  {profile.free_orders_limit}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Tariffs */}
        <Text style={[Type.title3, styles.sectionTitle, { color: theme.text }]}>
          {t('subscription.plansTitle')}
        </Text>
        <Text style={[Type.footnote, styles.sectionHint, { color: theme.textSecondary }]}>
          {t('subscription.plansHint')}
        </Text>

        {plans.length === 0 ? (
          <Text style={[Type.footnote, styles.empty, { color: theme.textSecondary }]}>
            {loading ? t('common.loading') : t('subscription.noPlans')}
          </Text>
        ) : (
          <View style={styles.plans}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                highlighted={plan.id === bestId && plans.length > 1}
                busy={payingId === plan.id}
                disabled={payingId !== null && payingId !== plan.id}
                onChoose={() => pay(plan)}
              />
            ))}
          </View>
        )}

        {/* Said once, because it is the same on every card. */}
        <View style={[styles.included, Squircle, { backgroundColor: theme.surface }]}>
          <Text style={[Type.footnoteEmphasized, { color: theme.textSecondary }]}>
            {t('subscription.included').toUpperCase()}
          </Text>
          {(
            [
              'subscription.perk.orders',
              'subscription.perk.noCommission',
              'subscription.perk.visible',
              'subscription.perk.warn',
            ] as const
          ).map((key) => (
            <View key={key} style={styles.perk}>
              <Icon name="checkmark" size={16} color={theme.success} />
              <Text style={[Type.subhead, styles.perkText, { color: theme.text }]}>{t(key)}</Text>
            </View>
          ))}
        </View>

        {notice ? (
          <Text style={[Type.footnote, styles.notice, { color: noticeColor }]}>{notice}</Text>
        ) : null}
      </ScrollView>

      <ProviderNav mode="company" active="subscription" />

    </SafeAreaView>
  );

  /** One tariff card: a term, what it costs, and what that works out to a month. */
  function PlanCard({
    plan,
    highlighted,
    busy,
    disabled,
    onChoose,
  }: {
    plan: SubscriptionPlan;
    highlighted: boolean;
    busy: boolean;
    disabled: boolean;
    onChoose: () => void;
  }) {
    // The highlighted card inverts, the way the middle card does on a pricing
    // page: it is the recommendation, and a recommendation that looks like
    // every other option is not one.
    const bg = highlighted ? (dark ? theme.surfaceElevated : '#111827') : theme.surface;
    const fg = highlighted ? '#FFFFFF' : theme.text;
    const muted = highlighted ? 'rgba(255,255,255,0.7)' : theme.textSecondary;

    const title = plan.title || `${plan.months} ${t('subscription.month')}`;

    return (
      <View style={[styles.plan, Squircle, { backgroundColor: bg }]}>
        <View style={styles.planTop}>
          <Text style={[Type.headline, styles.planTitle, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
          {plan.discount_percent > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.danger }]}>
              <Text style={[Type.footnoteEmphasized, styles.badgeText]}>
                -{plan.discount_percent}%
              </Text>
            </View>
          ) : highlighted ? (
            <View style={[styles.badge, { backgroundColor: theme.success }]}>
              <Text style={[Type.footnoteEmphasized, styles.badgeText]}>
                {t('subscription.best')}
              </Text>
            </View>
          ) : null}
        </View>

        {plan.old_price ? (
          <Text style={[Type.subhead, styles.oldPrice, { color: muted }]}>
            {formatSom(plan.old_price)} {t('common.som')}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={[Type.largeTitle, { color: fg }]}>{formatSom(plan.price)}</Text>
          <Text style={[Type.subhead, { color: muted }]}>{t('common.som')}</Text>
        </View>

        {/* The number that makes the comparison: what a month costs on this
            term. It is the only thing that differs between the cards. */}
        <Text style={[Type.footnote, { color: muted }]}>
          {t('subscription.perMonth')} {formatSom(plan.per_month)} {t('common.som')}
        </Text>

        <View style={[styles.planRule, { backgroundColor: highlighted ? 'rgba(255,255,255,0.18)' : theme.separator }]} />

        <Button
          label={t('subscription.choose')}
          onPress={onChoose}
          loading={busy}
          disabled={disabled}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12 },

  statusWrap: { paddingHorizontal: Layout.gutter },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: Radius.card,
    padding: 18,
  },
  statusText: { flex: 1, gap: 2 },

  sectionTitle: { paddingHorizontal: Layout.gutter, marginTop: 32 },
  sectionHint: { paddingHorizontal: Layout.gutter, marginTop: 4 },
  empty: { paddingHorizontal: Layout.gutter, marginTop: 20, textAlign: 'center' },

  plans: { paddingHorizontal: Layout.gutter, marginTop: 16, gap: 14 },
  plan: { borderRadius: Radius.card, padding: 20, gap: 6 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planTitle: { flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  badgeText: { color: '#FFFFFF' },
  oldPrice: { textDecorationLine: 'line-through' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  planRule: { height: Hairline, marginVertical: 14 },

  included: {
    marginHorizontal: Layout.gutter,
    marginTop: 28,
    borderRadius: Radius.card,
    padding: 18,
    gap: 12,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { flex: 1 },

  notice: { textAlign: 'center', marginTop: 20, paddingHorizontal: Layout.gutter },
});
