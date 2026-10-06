import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountUp, FadeUp, Sparkline } from '@/components/motion';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, type IconName } from '@/components/ui/icon';
import { Row, Section } from '@/components/ui/list';
import { StatusDot } from '@/components/ui/status-dot';
import {
  Hairline,
  Layout,
  Radius,
  Squircle,
  Stagger,
  SystemLight,
  Type,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import type { AdminStats } from '@/lib/types';

/** Role tints, shared with the management rows so a colour always means one thing. */
const TINT = {
  users: SystemLight.blue,
  workers: SystemLight.violet,
  companies: SystemLight.teal,
  orders: SystemLight.amber,
} as const;

/**
 * Admin overview.
 *
 * Data-dense but not cramped: four counters, one revenue trend, one list of
 * places to go. Counters animate up on mount and online figures carry a live
 * pulse, which is the difference between "42 workers exist" and "42 workers
 * are logged in right now" — the second is what an operator is actually here
 * to see.
 */
export default function AdminHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await api.get<AdminStats>('/admin/stats'));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (failed && !stats) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Header title="Admin" large back />
        <EmptyState
          icon="cloud-offline-outline"
          title="Ma'lumot yuklanmadi"
          message="Serverga ulanib bo'lmadi. Qayta urinib ko'ring."
        />
      </SafeAreaView>
    );
  }

  const growth = stats?.revenue_growth ?? 0;
  const up = growth >= 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header title="Admin" large back />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {/* ---- Live counters ---- */}
        <View style={styles.grid}>
          <StatCard
            index={0}
            icon="people"
            tint={TINT.users}
            value={stats?.total_users}
            label="Foydalanuvchi"
            hint={stats ? `${stats.total_customers} buyurtmachi` : undefined}
          />
          <StatCard
            index={1}
            icon="hammer"
            tint={TINT.workers}
            value={stats?.total_workers}
            label="Ishchi"
            hint={stats ? `${stats.online_workers} onlayn` : undefined}
            online={!!stats && stats.online_workers > 0}
          />
          <StatCard
            index={2}
            icon="business"
            tint={TINT.companies}
            value={stats?.total_companies}
            label="Firma"
            hint={stats ? `${stats.online_companies} onlayn` : undefined}
            online={!!stats && stats.online_companies > 0}
          />
          <StatCard
            index={3}
            icon="reader"
            tint={TINT.orders}
            value={stats?.total_orders}
            label="Buyurtma"
            hint={stats ? `${stats.active_orders} faol` : undefined}
            online={!!stats && stats.active_orders > 0}
          />
        </View>

        {/* ---- Revenue — real commission per day, last 7 days ---- */}
        <FadeUp index={4} step={Stagger.stat} style={styles.revenueWrap}>
          <Text style={[Type.overline, styles.caption, { color: theme.textSecondary }]}>
            KOMISSIYA (OXIRGI 7 KUN)
          </Text>

          <View
            style={[
              styles.revenue,
              Squircle,
              { backgroundColor: theme.surface, borderColor: theme.borderLight },
            ]}>
            <View style={styles.revenueTop}>
              <View style={styles.revenueLeft}>
                <Text style={[Type.footnote, { color: theme.textSecondary }]}>Jami daromad</Text>
                <View style={styles.amountRow}>
                  <CountUp
                    value={stats?.total_revenue ?? 0}
                    format={(v) => formatSom(v)}
                    style={[Type.largeTitle, { color: theme.text }]}
                  />
                  <Text style={[Type.footnote, { color: theme.textSecondary }]}>so&apos;m</Text>
                </View>
              </View>

              {stats && growth !== 0 ? (
                <View
                  style={[
                    styles.growth,
                    { backgroundColor: up ? theme.successSoft : theme.dangerSoft },
                  ]}>
                  <Icon
                    name={up ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={up ? theme.success : theme.danger}
                  />
                  <Text
                    style={[
                      Type.footnoteEmphasized,
                      { color: up ? theme.success : theme.danger },
                    ]}>
                    {`${growth > 0 ? '+' : ''}${growth}%`}
                  </Text>
                </View>
              ) : null}
            </View>

            <RevenueTrend series={stats?.series ?? []} />
          </View>
        </FadeUp>

        {/* ---- Onboarding — the only door onto the platform ---- */}
        <Section
          header="Hisob ochish"
          separatorInset={Row.ICON_INSET}
          style={styles.section}
          footer="Ishchi va firma hisoblari faqat shu yerdan ochiladi. Foydalanuvchi keyin o'sha telefon raqami bilan kiradi.">
          <Row
            icon="hammer"
            iconColor={TINT.workers}
            title="Yangi ishchi qo'shish"
            onPress={() => router.push('/admin/worker-new' as any)}
          />
          <Row
            icon="storefront"
            iconColor={TINT.companies}
            title="Yangi firma qo'shish"
            onPress={() => router.push('/admin/company-new' as any)}
          />
        </Section>

        {/* ---- Management ---- */}
        <Section
          header="Boshqaruv"
          separatorInset={Row.ICON_INSET}
          style={styles.section}
          footer="Foydalanuvchilar, ishchilar, firmalar va barcha buyurtmalar.">
          <Row
            icon="people"
            iconColor={TINT.users}
            title="Foydalanuvchilar"
            value={stats ? String(stats.total_users) : undefined}
            onPress={() => router.push('/admin/users')}
          />
          <Row
            icon="hammer"
            iconColor={TINT.workers}
            title="Ishchilar"
            value={stats ? `${stats.online_workers}/${stats.total_workers}` : undefined}
            onPress={() => router.push('/admin/workers')}
          />
          <Row
            icon="business"
            iconColor={TINT.companies}
            title="Firmalar"
            value={stats ? `${stats.online_companies}/${stats.total_companies}` : undefined}
            onPress={() => router.push('/admin/companies')}
          />
          <Row
            icon="reader"
            iconColor={TINT.orders}
            title="Buyurtmalar"
            value={stats ? String(stats.total_orders) : undefined}
            onPress={() => router.push('/admin/orders')}
          />
          {/* The service list every order and every provider is filed under.
              It sits with the operational rows, not in Sozlamalar: editing it
              changes what a customer can order today. */}
          <Row
            icon="grid-outline"
            iconColor={SystemLight.teal}
            title="Kategoriyalar"
            onPress={() => router.push('/admin/categories' as any)}
          />
          {/* Tariffs earn their own row: they are what firms pay, and the
              history of who paid is the office's revenue ledger. */}
          <Row
            icon="pricetag"
            iconColor={SystemLight.rose}
            title="Tariflar, obuna va to'lovlar"
            onPress={() => router.push('/admin/plans' as any)}
          />
          <Row
            icon="settings"
            iconColor={theme.textMuted}
            title="Sozlamalar"
            onPress={() => router.push('/admin/settings')}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===================== Revenue trend ===================== */

const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** A line that writes itself in, with the weekday it belongs to underneath. */
function RevenueTrend({ series }: { series: AdminStats['series'] }) {
  const theme = useTheme();
  // The SVG needs a pixel width, so the card measures itself rather than
  // guessing — this card is full-bleed inside the gutter on every screen size.
  const [width, setWidth] = useState(0);

  if (series.length < 2) return <View style={styles.chart} />;

  return (
    <View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Sparkline
            values={series.map((b) => b.revenue)}
            color={theme.primary}
            width={width}
            height={56}
            strokeWidth={2}
            delay={220}
          />
        ) : null}
      </View>
      <View style={styles.chartLabels}>
        {series.map((bucket) => {
          const day = new Date(`${bucket.label}T00:00:00`).getDay();
          return (
            <Text
              key={bucket.label}
              style={[Type.caption2, styles.chartLabel, { color: theme.textTertiary }]}>
              {WEEKDAYS[Number.isNaN(day) ? 0 : day]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

/* ===================== Stat card ===================== */

function StatCard({
  icon,
  tint,
  value,
  label,
  hint,
  index,
  online = false,
}: {
  icon: IconName;
  tint: string;
  value?: number;
  label: string;
  hint?: string;
  index: number;
  online?: boolean;
}) {
  const theme = useTheme();

  return (
    <FadeUp index={index} step={Stagger.stat} style={styles.cardSlot}>
      <View
        style={[
          styles.card,
          Squircle,
          { backgroundColor: theme.surface, borderColor: theme.borderLight },
        ]}>
        <View style={styles.cardTop}>
          <View style={[styles.cardIcon, Squircle, { backgroundColor: `${tint}1A` }]}>
            <Icon name={icon} size={18} color={tint} />
          </View>
          {online ? <StatusDot online color={theme.success} /> : null}
        </View>

        {value === undefined ? (
          <Text style={[Type.largeTitle, { color: theme.textTertiary }]}>—</Text>
        ) : (
          <CountUp value={value} style={[Type.largeTitle, { color: theme.text }]} />
        )}

        <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[Type.caption2, { color: theme.textTertiary }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12, paddingBottom: 48 },
  caption: { paddingHorizontal: 4, marginBottom: 10 },
  section: { marginTop: 32 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: Layout.gutter,
  },
  cardSlot: { flexGrow: 1, flexBasis: '46%' },
  card: {
    borderRadius: Radius.lg,
    borderWidth: Hairline,
    padding: 16,
    gap: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  revenueWrap: { marginTop: 32, paddingHorizontal: Layout.gutter },
  revenue: {
    borderRadius: Radius.card,
    borderWidth: Hairline,
    padding: 20,
    gap: 18,
  },
  revenueTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  revenueLeft: { gap: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  growth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  chart: { height: 56, alignItems: 'stretch' },
  chartLabels: { flexDirection: 'row', marginTop: 8 },
  chartLabel: { flex: 1, textAlign: 'center' },
});
