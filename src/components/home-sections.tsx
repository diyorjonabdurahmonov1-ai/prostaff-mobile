/**
 * The customer home, in pieces.
 *
 * The home screen used to be a greeting, a carousel and two large buttons over
 * half a screen of nothing. A customer opens the app for one of three things —
 * to order a service, to check on an order they placed, or to see who is
 * around — and each of those now has its own block, in that order of urgency:
 * the order in progress first, then the services, then the people.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CategoryArt } from '@/components/category-art';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Layout, MaxContentWidth, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { groupOrders, progressOf } from '@/lib/batches';
import { categoryName } from '@/lib/format';
import { distanceKm, getCoordsWithFallback } from '@/lib/location';
import type { Category, Order, OrderStatus, WorkerProfile } from '@/lib/types';
import { useOrderFlow } from '@/store/order-flow';

const DONE: OrderStatus[] = ['completed', 'cancelled', 'rejected', 'expired'];
/** Tiles across the services row; the fraction is the one peeking at the edge. */
const SERVICES_VISIBLE = 4.35;
const SERVICE_GAP = 12;
/** How long each service stays put before the row steps on. */
const RAIL_STEP_MS = 2200;
/** A touch holds the row still for this long after the finger lifts. */
const RAIL_PAUSE_MS = 6000;
/** The nearby strip: who is within this far, best rated first. */
const NEARBY_KM = 15;
const NEARBY_SHOWN = 10;

/* ===================== Search ===================== */

/** Looks like a field, behaves like a door: the search itself is on the services screen. */
export function SearchPill() {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const router = useRouter();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/categories', params: { focus: '1' } })}
      scaleTo={0.985}
      accessibilityLabel={t('home.search')}
      style={[styles.searchWrap, dark ? null : Shadow.card]}>
      <View style={[styles.search, Squircle, { backgroundColor: theme.surface }]}>
        <Icon name="search" size={20} color={theme.primary} />
        <Text style={[Type.body, styles.flex, { color: theme.textTertiary }]} numberOfLines={1}>
          {t('home.search')}
        </Text>
      </View>
    </PressableScale>
  );
}

/* ===================== The order in progress ===================== */

/**
 * The customer's order that is still going, if there is one.
 *
 * Somebody who placed an order ten minutes ago opens the app to find out what
 * happened to it, and used to have to go to another tab to see. The newest
 * unfinished request sits here; a request for several workers shows how many
 * have been found.
 */
export function ActiveOrderCard() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const router = useRouter();
  const { byId } = useCategories();
  const [entry, setEntry] = useState<Order[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api
        .get<Order[]>('/orders')
        .then((orders) => {
          if (!live) return;
          const open = groupOrders(orders ?? []).find((e) => e.orders.some((o) => !DONE.includes(o.status)));
          setEntry(open ? open.orders : null);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  if (!entry) return null;
  const head = entry[0];
  const category = byId(head.category_id);
  const many = entry.length > 1;
  const { found, wanted } = progressOf(entry);

  return (
    <View style={styles.block}>
      <PressableScale
        onPress={() =>
          many ? router.navigate('/orders') : router.push({ pathname: '/orders/[id]', params: { id: head.id } })
        }
        scaleTo={0.98}
        style={dark ? undefined : Shadow.card}>
        <View style={[styles.active, Squircle, { backgroundColor: theme.surface }]}>
          <CategoryArt category={category} width={52} height={52} radius={14} />
          <View style={styles.flex}>
            <Text style={[Type.caption1Emphasized, { color: theme.primary }]}>
              {t('home.activeOrder').toUpperCase()}
            </Text>
            <Text style={[Type.headline, { color: theme.text }]} numberOfLines={1}>
              {categoryName(category, lang) || head.description || t('company.orderTitle')}
            </Text>
            {many ? (
              <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
                {t('batch.progress', { found, total: wanted })}
              </Text>
            ) : (
              <View style={styles.pillRow}>
                <StatusPill status={head.status} />
              </View>
            )}
          </View>
          <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
        </View>
      </PressableScale>
    </View>
  );
}

/* ===================== Services ===================== */

/** A block's caption, with an optional link on the right. */
export function BlockHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.head}>
      <Text style={[Type.title3, styles.flex, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} style={({ pressed }) => (pressed ? styles.pressed : null)}>
          <Text style={[Type.subheadEmphasized, { color: theme.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The services, one tap from an order — as a single row that turns by itself.
 *
 * They used to be a screen away, behind a button that said "Ishchilar" — the
 * customer had to know that workers were where services lived. Here each one
 * is a picture and a name, and a tap starts the order for it.
 *
 * One row rather than a grid: every service is on it, however many the office
 * adds, at the cost of one line of screen. It steps along on its own so the
 * ones off the edge get seen, stops the moment a finger touches it, and can be
 * swiped either way. The list is laid out twice end to end, and the row slips
 * back by one list's width whenever it reaches the second copy — which is what
 * lets it go round for ever without a visible jump.
 */
export function ServicesGrid() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { activeCategories } = useCategories();
  const { reset } = useOrderFlow();
  const { width } = useWindowDimensions();

  const railRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const touchedAt = useRef(0);

  const content = Math.min(width, MaxContentWidth) - Layout.gutter * 2;
  // A third of a tile shows at the edge: the plainest hint that there is more.
  const tile = Math.floor((content - SERVICE_GAP * 3) / SERVICES_VISIBLE);
  const step = tile + SERVICE_GAP;
  const count = activeCategories.length;
  // Nothing to turn when everything already fits.
  const loops = count > Math.floor(SERVICES_VISIBLE);
  const lap = count * step;

  useEffect(() => {
    if (!loops) return;
    const id = setInterval(() => {
      if (Date.now() - touchedAt.current < RAIL_PAUSE_MS) return;
      let from = Math.round(offsetRef.current / step);
      // Into the second copy: slip back a whole lap first, unseen.
      if (from >= count) {
        from -= count;
        railRef.current?.scrollTo({ x: from * step, animated: false });
      }
      railRef.current?.scrollTo({ x: (from + 1) * step, animated: true });
    }, RAIL_STEP_MS);
    return () => clearInterval(id);
  }, [loops, count, step]);

  if (count === 0) return null;

  const choose = (category: Category) => {
    // A fresh draft per order — the same rule the services screen follows.
    reset({ categoryId: category.id, targetWorkerIds: [], targetWorkerNames: [] });
    router.push('/details');
  };

  const items = loops ? [...activeCategories, ...activeCategories] : activeCategories;

  return (
    <View style={styles.block}>
      <BlockHead title={t('home.services')} action={t('home.all')} onAction={() => router.push('/categories')} />
      <ScrollView
        ref={railRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(e) => {
          offsetRef.current = e.nativeEvent.contentOffset.x;
        }}
        onScrollBeginDrag={() => {
          touchedAt.current = Date.now();
        }}
        onScrollEndDrag={() => {
          touchedAt.current = Date.now();
        }}
        onMomentumScrollEnd={(e) => {
          // A swipe that carried into the second copy comes back the same way.
          const x = e.nativeEvent.contentOffset.x;
          if (loops && x >= lap) railRef.current?.scrollTo({ x: x - lap, animated: false });
        }}
        contentContainerStyle={styles.rail}
        style={styles.railScroll}>
        {items.map((category, i) => (
          <PressableScale
            key={`${category.id}-${i}`}
            onPress={() => choose(category)}
            scaleTo={0.94}
            accessibilityLabel={categoryName(category, lang)}
            style={{ width: tile }}>
            <CategoryArt category={category} width={tile} height={tile} radius={22} />
            <Text style={[Type.caption1, styles.serviceLabel, { color: theme.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
              {categoryName(category, lang)}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

/* ===================== The two other ways in ===================== */

function EntryCard({
  icon,
  colors,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  colors: readonly [string, string];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const dark = useThemeMode() === 'dark';
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} accessibilityLabel={title} style={[styles.flex, dark ? null : Shadow.card]}>
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.entry, Squircle]}>
        <View style={styles.entryDisc} />
        <View style={styles.entryGlyph}>
          <Icon name={icon} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.entryText}>
          <Text style={[Type.headline, styles.white]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[Type.caption1, styles.whiteDim]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

/** Firms, and choosing workers by hand — side by side, at equal weight. */
export function EntryCards({ onFirms, onWorkers }: { onFirms: () => void; onWorkers: () => void }) {
  const t = useT();
  return (
    <View style={[styles.block, styles.entries]}>
      <EntryCard
        icon="business"
        colors={['#14B8A6', '#0F766E']}
        title={t('customer.companies')}
        subtitle={t('home.serviceCompanies')}
        onPress={onFirms}
      />
      <EntryCard
        icon="people"
        colors={['#6366F1', '#4338CA']}
        title={t('home.pickWorkers')}
        subtitle={t('home.pickWorkersHint')}
        onPress={onWorkers}
      />
    </View>
  );
}

/* ===================== Who is nearby ===================== */

/**
 * The best-rated workers within reach, as faces.
 *
 * Only shown when the phone's own position is known: measured from a guessed
 * city centre, "nearby" would be a claim the screen could not stand behind.
 */
export function NearbyWorkers({ onSeeAll }: { onSeeAll: () => void }) {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const router = useRouter();
  const [workers, setWorkers] = useState<(WorkerProfile & { km: number })[]>([]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        try {
          const here = await getCoordsWithFallback();
          if (!here.resolved) return;
          const data = await api.get<WorkerProfile[]>(
            `/workers/nearby?lat=${here.lat}&lng=${here.lng}&radius_km=${NEARBY_KM}`,
          );
          if (!live) return;
          setWorkers(
            (data ?? [])
              .filter((w) => w.online && !w.banned)
              .map((w) => ({ ...w, km: distanceKm(here, w) }))
              .filter((w) => w.km <= NEARBY_KM)
              .sort((a, b) => b.rating - a.rating || a.km - b.km)
              .slice(0, NEARBY_SHOWN),
          );
        } catch {
          // The strip is a nicety; without it the home is still whole.
        }
      })();
      return () => {
        live = false;
      };
    }, []),
  );

  if (workers.length === 0) return null;

  return (
    <View style={styles.block}>
      <BlockHead title={t('home.nearbyWorkers')} action={t('home.all')} onAction={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.people}
        style={styles.peopleScroll}>
        {workers.map((w) => (
          <PressableScale
            key={w.id}
            onPress={() => router.push({ pathname: '/worker/[id]' as any, params: { id: w.id } })}
            scaleTo={0.96}
            accessibilityLabel={w.full_name}
            style={dark ? undefined : Shadow.card}>
            <View style={[styles.person, Squircle, { backgroundColor: theme.surface }]}>
              <Avatar name={w.full_name} imageUrl={w.avatar_url} size={58} online={w.online} />
              <Text style={[Type.footnoteEmphasized, styles.personName, { color: theme.text }]} numberOfLines={1}>
                {w.full_name.split(' ')[0]}
              </Text>
              <View style={styles.personMeta}>
                <Icon name="star" size={11} color="#F79009" weight="fill" />
                <Text style={[Type.caption2Emphasized, { color: theme.text }]}>
                  {w.ratings_count > 0 ? w.rating.toFixed(1) : '—'}
                </Text>
                <Text style={[Type.caption2, { color: theme.textSecondary }]}>· {w.km.toFixed(1)} km</Text>
              </View>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.5 },
  white: { color: '#FFFFFF' },
  whiteDim: { color: 'rgba(255,255,255,0.85)' },

  block: { marginTop: 24, paddingHorizontal: Layout.gutter },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },

  searchWrap: { marginHorizontal: Layout.gutter },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
  },

  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
  },
  pillRow: { flexDirection: 'row', marginTop: 3 },

  railScroll: { marginHorizontal: -Layout.gutter },
  rail: { paddingHorizontal: Layout.gutter, gap: SERVICE_GAP },
  serviceLabel: { textAlign: 'center', marginTop: 6 },

  entries: { flexDirection: 'row', gap: 12 },
  entry: { borderRadius: Radius.xl, padding: 16, gap: 14, minHeight: 132, overflow: 'hidden' },
  entryDisc: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    right: -40,
    top: -46,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  entryGlyph: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  entryText: { gap: 2 },

  peopleScroll: { marginHorizontal: -Layout.gutter },
  people: { paddingHorizontal: Layout.gutter, gap: 10, paddingBottom: 8 },
  person: { width: 104, alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 8, borderRadius: Radius.lg },
  personName: { maxWidth: '100%' },
  personMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
