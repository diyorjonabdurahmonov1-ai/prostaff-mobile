import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Row, Section } from '@/components/ui/list';
import { Stars } from '@/components/ui/stars';
import {
  Gradients,
  Hairline,
  Layout,
  MaxContentWidth,
  Radius,
  Shadow,
  Squircle,
  Type,
} from '@/constants/theme';
import { YandexMap } from '@/components/yandex-map';
import { useCategories } from '@/hooks/use-categories';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName } from '@/lib/format';
import { getCoordsWithFallback } from '@/lib/location';
import { switchRoot } from '@/lib/nav';
import type { LatLng } from '@/lib/maps';
import type { CompanyProfile, WorkerProfile } from '@/lib/types';
import { useAuth } from '@/store/auth';

import { Icon, type IconName } from '@/components/ui/icon';

type Panel = 'home' | 'companies' | 'workers';

/** Starting search radius, in km. Each list screen owns its own from here. */
const DEFAULT_RADIUS_KM = 15;

/**
 * How many workers may be called in one go — one order each, so this is also
 * how many people a customer can hire with a single pass through the form.
 *
 * Ten covers what the number is actually for: a lorry to unload, a hall to
 * clear after a wedding, a move that needs a crew rather than a person. Past
 * that it stops being a choice about individuals, which is the whole point of
 * picking them off a list of faces and reviews.
 */
const MAX_CHOSEN_WORKERS = 10;

export default function HomeScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user, activeMode } = useAuth();
  const [section, setSection] = useState<Panel>('home');

  /**
   * The customer home is not where a worker or a firm belongs.
   *
   * `activeMode` survives restarts, so somebody who switched into their worker
   * account stays there: opening the app, or coming back from the profile tab,
   * lands on their panel instead of quietly dropping them into customer mode.
   * Ordering as a customer is a deliberate switch from the profile screen —
   * the same gesture that got them into the worker account in the first place.
   */
  const panel =
    activeMode === 'worker' && user?.worker_profile
      ? '/worker'
      : activeMode === 'company' && user?.company_profile
        ? '/company'
        : null;

  // The pathname check is not redundant: this screen can focus for a frame
  // while navigation is on its way to another tab, and a redirect fired then
  // would bounce the user off the screen they actually asked for.
  const pathname = usePathname();

  useFocusEffect(
    useCallback(() => {
      /**
       * The panel *is* the stack, rather than sitting on top of it.
       *
       * Pushed, the customer home stayed underneath, and a worker's own home
       * screen answered the phone's Back button by dropping them into the
       * customer app — a mode they had not asked for, arrived at by the one
       * gesture that everywhere else means "up". The provider panel is the root
       * of the app for somebody signed in as a provider, and Back from a root is
       * how you leave an app.
       *
       * Nothing needs the tab stack kept alive behind it: a provider moves
       * between their four screens on their own bottom bar, and switching back
       * to the customer side replaces the root again from the profile.
       */
      if (panel && pathname === '/') switchRoot(panel);
    }, [panel, pathname])
  );

  /**
   * The phone's own Back gesture closes a search panel.
   *
   * These two panels are screens as far as anybody using them is concerned, but
   * they are state on the tab root rather than routes — so Android's back button
   * went past them to the navigator, which had nothing left to pop and dropped
   * the user out of the app entirely. Returning `true` claims the press; on the
   * home panel we do not, and the default (leave) stands.
   */
  useFocusEffect(
    useCallback(() => {
      if (section === 'home') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setSection('home');
        return true;
      });
      return () => sub.remove();
    }, [section])
  );

  const userName = user?.name || 'Foydalanuvchi';

  // Hold a blank frame while the push above runs. Painting the customer home
  // first and swapping it out a frame later is what made switching modes look
  // like the app had thrown the user back into the customer account.
  if (panel && pathname === '/') {
    return <View style={[styles.safe, { backgroundColor: theme.background }]} />;
  }

  if (section === 'companies') {
    return <CompaniesListScreen onBack={() => setSection('home')} />;
  }
  if (section === 'workers') {
    return <WorkersListScreen onBack={() => setSection('home')} />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {/* Greeting — caption over a large title, iOS style */}
        <View style={styles.greeting}>
          <View style={styles.greetingText}>
            <Text style={[Type.subhead, { color: theme.textSecondary }]}>Salom,</Text>
            <Text style={[Type.largeTitle, { color: theme.text }]} numberOfLines={1}>
              {userName}
            </Text>
          </View>
          {/* What happened while they were away. The worker panel has carried
              this since it was built; a customer waiting on somebody to accept
              their job has just as much reason to look. */}
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('push.title')}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
            <Icon name="notifications" size={24} color={theme.text} />
          </Pressable>
          <Avatar name={userName} imageUrl={user?.avatar_url} size={46} />
        </View>

        {/* The two ways into the platform, at the size of the decision.

            They spent a while as rows in a grouped list, on the argument that a
            list of destinations is a list. It is the wrong argument here: a
            Settings list is a place you go to change something you already know
            about, while this is the entire product asking a first-time customer
            which half of it they want. At row height, the single question the
            screen exists to ask was the smallest thing on it. */}
        <Text style={[Type.footnote, styles.sectionCaption, { color: theme.textSecondary }]}>
          {t('home.whatNext').toUpperCase()}
        </Text>

        <View style={styles.heroes}>
          <HeroCard
            icon="hammer"
            colors={Gradients.worker}
            title={t('customer.workers')}
            subtitle={t('home.dailyWorkers')}
            onPress={() => router.push('/categories')}
          />
          <HeroCard
            icon="business"
            colors={Gradients.company}
            title={t('customer.companies')}
            subtitle={t('home.serviceCompanies')}
            onPress={() => setSection('companies')}
          />
        </View>

        {/* Look at who is nearby — and the only way to hire more than one person
            at a time. The subtitle says so: without it this read as "browse",
            an idle thing to do next to two cards that place an order, and the
            customer who needed six people to unload a lorry had no reason to
            ever tap it. */}
        <Section separatorInset={Row.ICON_INSET} style={styles.browseSection}>
          <Row
            icon="people"
            iconColor="#5E7CFA"
            title={t('customer.browseWorkers')}
            subtitle={t('pick.homeHint')}
            chevron
            onPress={() => setSection('workers')}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===================== Home hero card ===================== */

/**
 * One of the two full-width entry points. The tint is what tells them apart —
 * blue for people, teal for firms — the same pair used on their panels.
 */
function HeroCard({
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
    <PressableScale
      onPress={onPress}
      scaleTo={0.975}
      accessibilityLabel={title}
      style={dark ? undefined : Shadow.card}>
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, Squircle]}>
        <View style={styles.heroGlyph}>
          <Icon name={icon} size={26} color="#FFFFFF" />
        </View>
        <View style={styles.heroText}>
          <Text style={[Type.title2, styles.heroTitle]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[Type.subhead, styles.heroSubtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
      </LinearGradient>
    </PressableScale>
  );
}

/* ===================== Radius control ===================== */

/**
 * The search radius.
 *
 * It used to live on the home screen as well, where there was nothing to apply
 * it to: a customer set a distance on a screen with no results on it, and by the
 * time they were looking at a list they had forgotten what it was. It belongs on
 * the two screens whose contents it decides, and nowhere else.
 *
 * `onSlidingComplete` is what re-runs the search, not `onValueChange`. A drag
 * from 15 to 60 fires the latter on every step, which would be nine requests for
 * one decision; committing on release asks once, for the number the user meant.
 */
function RadiusSection({
  radiusKm,
  onCommit,
  open,
  toggle,
}: {
  radiusKm: number;
  onCommit: (v: number) => void;
  open: boolean;
  toggle: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  // What the thumb is under the finger, before it is committed. Kept local so
  // the label tracks the drag without the list refetching mid-gesture.
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? radiusKm;

  return (
    <Section header={t('customer.adjustRadius')} style={styles.radiusSection}>
      <Row
        icon="location"
        iconColor="#007AFF"
        title={t('customer.radius')}
        value={`${shown} ${t('customer.km')}`}
        onPress={toggle}
        right={
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} color={theme.textTertiary} />
        }
      />
      {open ? (
        <View style={styles.sliderRow}>
          <Text style={[Type.caption1, { color: theme.textSecondary }]}>5</Text>
          <Slider
            minimumValue={5}
            maximumValue={100}
            step={5}
            value={radiusKm}
            onValueChange={setDragging}
            onSlidingComplete={(v) => {
              setDragging(null);
              onCommit(v);
            }}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.fillTertiary}
            thumbTintColor={Platform.OS === 'ios' ? '#FFFFFF' : theme.primary}
            style={styles.slider}
          />
          <Text style={[Type.caption1, { color: theme.textSecondary }]}>100</Text>
        </View>
      ) : null}
    </Section>
  );
}

/* ===================== Result card ===================== */

/** The gap between the two columns, and between the rows of the grid. */
const GRID_GAP = 12;

/**
 * How wide one of the two columns is, measured rather than expressed as `48%`.
 *
 * A percentage basis resolves against the container's full content box and knows
 * nothing about the `gap` between the columns, so two 50% tiles plus a 12pt gap
 * overflow the row and Yoga wraps them one per line — a grid that silently is
 * not one. Subtracting the gap first is the only version that holds at every
 * screen width, rotation included.
 */
function useColumnWidth(): number {
  const { width } = useWindowDimensions();
  const content = Math.min(width, MaxContentWidth) - Layout.gutter * 2;
  return (content - GRID_GAP) / 2;
}

/**
 * One provider, as a tile in a two-up grid.
 *
 * A full-width row spends most of its width on nothing — a name and a category
 * take a third of it — so a phone showed four or five providers and the rest of
 * the search was below the fold. Two columns put eight on the same screen, and a
 * photo big enough to be a face rather than a bullet point is what a customer
 * picking somebody to come to their home is actually reading.
 */
function ResultCard({
  name,
  meta,
  distanceKm,
  rating,
  count,
  online,
  imageUrl,
  selectable = false,
  selected = false,
  onPress,
  onToggle,
}: {
  name: string;
  meta?: string;
  distanceKm?: number | null;
  rating: number;
  count: number;
  online?: boolean;
  imageUrl?: string | null;
  /** Draws the tick and the "Profil ko'rish" button. */
  selectable?: boolean;
  selected?: boolean;
  /** Opening the worker — what a tap anywhere on the tile does. */
  onPress: () => void;
  /**
   * Choosing the worker, which only the circle does.
   *
   * Tapping the tile used to toggle the choice, and it read as a trap: the tile
   * is a photo, a name, a rating and a category line — everything you would
   * touch to *look closer* — and touching it silently added somebody to an
   * order instead. Selecting is a deliberate, small target; reading about them
   * is the whole card.
   */
  onToggle?: () => void;
}) {
  const theme = useTheme();
  const width = useColumnWidth();

  return (
    <PressableScale onPress={onPress} scaleTo={0.97} accessibilityLabel={name} style={{ width }}>
      <View
        style={[
          styles.card,
          Squircle,
          { backgroundColor: theme.surface },
          // A ring rather than a tint: the photo is the subject of this tile and
          // washing it in blue is the one change that would make the chosen
          // workers harder to tell apart than the unchosen ones.
          selected ? { borderColor: theme.primary, borderWidth: 2, paddingVertical: 14 } : null,
        ]}>
        {selectable ? (
          <Pressable
            onPress={onToggle}
            // Generous, because the target is 22pt in a corner and the cost of
            // missing it is opening a profile you did not want.
            hitSlop={14}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              styles.check,
              selected
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { borderColor: theme.textQuaternary },
              pressed ? styles.pressed : null,
            ]}>
            {selected ? <Icon name="checkmark" size={13} color={theme.onPrimary} /> : null}
          </Pressable>
        ) : null}

        <Avatar name={name} imageUrl={imageUrl} size={64} online={online} />

        <Text style={[Type.subheadEmphasized, styles.cardName, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>

        <Text style={[Type.caption1, styles.cardMeta, { color: theme.textSecondary }]} numberOfLines={2}>
          {meta || ' '}
        </Text>

        <Stars value={rating} showValue count={count} size={11} />

        {distanceKm != null ? (
          <View style={[styles.distance, { backgroundColor: theme.fillQuaternary }]}>
            <Icon name="location" size={10} color={theme.textSecondary} />
            <Text style={[Type.caption2, { color: theme.textSecondary }]}>
              {distanceKm.toFixed(1)} km
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/* ===================== Companies List ===================== */

function CompaniesListScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { categories } = useCategories();
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [center, setCenter] = useState<LatLng | null>(null);
  /** The point every search on this screen is measured from — see `load`. */
  const centreRef = useRef<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [showSlider, setShowSlider] = useState(false);

  const load = useCallback(async () => {
    try {
      /**
       * The point is resolved once per visit, not once per search.
       *
       * Re-reading the GPS on every radius change made a slider release depend
       * on a satellite fix: seconds of latency, and on a read that does not come
       * back the helper falls back to central Tashkent — so widening the radius
       * could quietly move the centre of the search out from under the user and
       * return a list that looked like nothing had happened. Changing the radius
       * is one request now, against the point already on screen.
       */
      let point = centreRef.current;
      if (!point) {
        const coords = await getCoordsWithFallback();
        point = { lat: coords.lat, lng: coords.lng };
        centreRef.current = point;
        setCenter(point);
      }
      const data = await api.get<CompanyProfile[]>(
        `/companies?lat=${point.lat}&lng=${point.lng}&radius_km=${radiusKm}`,
      );
      setCompanies(data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [radiusKm]);

  // Re-runs whenever the radius is committed — `load` is keyed to it.
  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh is the one gesture that means "I have moved" — it drops the
  // remembered point so the next read starts from wherever the phone is now.
  const { refreshControl } = useRefresh(
    useCallback(() => {
      centreRef.current = null;
      return load();
    }, [load])
  );

  // The firm's services, the same line a worker row carries. What the firm
  // typed wins; the categories are the legacy fallback for firms that ticked
  // them before the field existed, and the description is the last resort.
  const serviceLine = (c: CompanyProfile) =>
    c.services?.trim() ||
    (c.category_ids ?? [])
      .map((id) => categories.find((cat) => cat.id === id))
      .filter(Boolean)
      .map((cat) => categoryName(cat!, lang))
      .join(', ') ||
    c.description;

  const pinnedCompanies = companies.filter((c) => !!c.lat && !!c.lng);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={t('customer.companies')} large back onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.listScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        <RadiusSection
          radiusKm={radiusKm}
          onCommit={setRadiusKm}
          open={showSlider}
          toggle={() => setShowSlider(!showSlider)}
        />

        {/* The firms around you, on the map — same set as the list below, minus
            the ones that never dropped a pin (they would land at 0,0). */}
        {center && pinnedCompanies.length > 0 ? (
          <View style={styles.mapWrap}>
            <YandexMap
              point={center}
              height={200}
              radiusKm={radiusKm}
              markers={pinnedCompanies.map((c) => ({
                lat: c.lat,
                lng: c.lng,
                hint: c.name,
                color: 'success' as const,
              }))}
              caption={`${pinnedCompanies.length} ${t('customer.companies').toLowerCase()}`}
            />
          </View>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : companies.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title={t('customer.noNearby')}
            message={t('customer.noNearbyHint')}
          />
        ) : (
          <View style={styles.results}>
            <Text style={[Type.footnote, styles.sectionCaption, { color: theme.textSecondary }]}>
              {`${companies.length} ${t('customer.companies')}`.toUpperCase()}
            </Text>
            <View style={styles.grid}>
              {companies.map((c) => (
                <ResultCard
                  key={c.id}
                  name={c.name}
                  meta={[serviceLine(c), c.address].filter(Boolean).join(' · ')}
                  distanceKm={c.distance_km}
                  rating={c.rating}
                  count={c.ratings_count}
                  online={c.online}
                  imageUrl={c.avatar_url}
                  onPress={() => router.push({ pathname: '/company/[id]', params: { id: c.id } })}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===================== Workers List ===================== */

function WorkersListScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { categories } = useCategories();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [center, setCenter] = useState<LatLng | null>(null);
  /** The point every search on this screen is measured from — see `load`. */
  const centreRef = useRef<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [showSlider, setShowSlider] = useState(false);
  /**
   * The workers picked for a job, by profile id.
   *
   * Choosing is what this screen is *for*, so it is always on: every card
   * carries its tick, a tap is a choice, and the bar at the bottom is how the
   * order goes out. It used to hide behind a "Bir nechta ishchi chaqirish"
   * button — a mode switch in front of the screen's only real action, which
   * meant looking at a list of workers and having no way to call any of them
   * until you had found the button first.
   *
   * The profile is still one tap away, from the arrow on each card.
   */
  const [chosen, setChosen] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      /**
       * The point is resolved once per visit, not once per search.
       *
       * Re-reading the GPS on every radius change made a slider release depend
       * on a satellite fix: seconds of latency, and on a read that does not come
       * back the helper falls back to central Tashkent — so widening the radius
       * could quietly move the centre of the search out from under the user and
       * return a list that looked like nothing had happened. Changing the radius
       * is one request now, against the point already on screen.
       */
      let point = centreRef.current;
      if (!point) {
        const coords = await getCoordsWithFallback();
        point = { lat: coords.lat, lng: coords.lng };
        centreRef.current = point;
        setCenter(point);
      }
      const data = await api.get<WorkerProfile[]>(
        `/workers/nearby?lat=${point.lat}&lng=${point.lng}&radius_km=${radiusKm}`,
      );
      setWorkers(data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [radiusKm]);

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh is the one gesture that means "I have moved" — it drops the
  // remembered point so the next read starts from wherever the phone is now.
  const { refreshControl } = useRefresh(
    useCallback(() => {
      centreRef.current = null;
      return load();
    }, [load])
  );

  const getCatNames = (ids: string[]) =>
    ids
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => categoryName(c!, lang))
      .join(', ');

  const toggle = (id: string) =>
    setChosen((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_CHOSEN_WORKERS
          ? prev
          : [...prev, id]
    );

  /**
   * Hand the choice to the order flow.
   *
   * The ids travel as route parameters rather than being written into the
   * shared draft here: step 1 resets that draft, deliberately, so that an
   * abandoned order cannot leak into the next one — and a selection written
   * before the reset would be the one thing it silently threw away. A parameter
   * belongs to this navigation and to nothing else.
   */
  const orderFromChosen = () => {
    const picked = workers.filter((w) => chosen.includes(w.id));
    if (picked.length === 0) return;
    /**
     * One delimited string per list, not a repeated parameter.
     *
     * An array param is serialised as `?worker=a&worker=b`, and what comes back
     * out of `useLocalSearchParams` is a bare string when there was one value
     * and an array when there were several — except that the round trip does not
     * survive reliably, and picking two workers arrived as one id. One order
     * went out instead of two, which is the opposite of what choosing two people
     * means. A joined string has exactly one shape, whatever the count.
     *
     * `|` rather than a comma: it cannot occur in an id, and a worker's name is
     * far likelier to contain a comma than a pipe.
     */
    router.push({
      pathname: '/categories',
      params: {
        worker: picked.map((w) => w.id).join('|'),
        workerName: picked.map((w) => w.full_name).join('|'),
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header
        title={t('customer.workers')}
        large
        back
        onBack={onBack}
        subtitle={chosen.length > 1 ? t('pick.subtitleMany') : t('pick.subtitle')}
      />

      <ScrollView
        // The bar is always there, so the last row of the grid always needs
        // clearing under it.
        contentContainerStyle={styles.listScrollPicking}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        <RadiusSection
          radiusKm={radiusKm}
          onCommit={setRadiusKm}
          open={showSlider}
          toggle={() => setShowSlider(!showSlider)}
        />

        {/* Who is around, on the map — the same set as the list below it.
            Deliberately not pannable: it sits inside the scrolling list, and a
            map that takes the drag leaves the page scrollable only from the
            margins beside it. The list underneath is how you explore. */}
        {center && workers.length > 0 ? (
          <View style={styles.mapWrap}>
            <YandexMap
              point={center}
              height={200}
              radiusKm={radiusKm}
              markers={workers.map((w) => ({
                lat: w.lat,
                lng: w.lng,
                hint: w.full_name,
                color: 'success' as const,
              }))}
              caption={`${workers.length} ${t('customer.workers').toLowerCase()}`}
            />
          </View>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : workers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={t('customer.noNearby')}
            message={t('customer.noNearbyHint')}
          />
        ) : (
          <View style={styles.results}>
            <View style={styles.resultsHead}>
              <Text style={[Type.footnote, styles.resultsCount, { color: theme.textSecondary }]}>
                {t('pick.tapToChoose').toUpperCase()}
              </Text>
            </View>
            <View style={styles.grid}>
              {workers.map((w) => (
                <ResultCard
                  key={w.id}
                  name={w.full_name}
                  meta={getCatNames(w.category_ids)}
                  distanceKm={w.distance_km}
                  rating={w.rating}
                  count={w.ratings_count}
                  online={w.online}
                  imageUrl={w.avatar_url}
                  selectable
                  selected={chosen.includes(w.id)}
                  onPress={() =>
                    router.push({ pathname: '/worker/[id]' as any, params: { id: w.id } })
                  }
                  onToggle={() => toggle(w.id)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* The way an order leaves this screen. It states the count rather than
          making the customer keep it in their head, and stays disabled until
          there is somebody to send it to. */}
      {workers.length > 0 ? (
        <SafeAreaView edges={['bottom']} style={[styles.pickBar, { backgroundColor: theme.surface, borderTopColor: theme.separator }]}>
          <View style={styles.pickBarBody}>
            <View style={styles.pickBarText}>
              <Text style={[Type.subheadEmphasized, { color: theme.text }]} numberOfLines={1}>
                {t('pick.chosen', { n: chosen.length })}
              </Text>
              <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
                {t('pick.max', { n: MAX_CHOSEN_WORKERS })}
              </Text>
            </View>
            <Button
              label={t('home.startOrder')}
              icon="paper-plane"
              size="sm"
              fullWidth={false}
              disabled={chosen.length === 0}
              onPress={orderFromChosen}
            />
          </View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  listScroll: { paddingBottom: 40 },
  listScrollPicking: { paddingBottom: 132 },
  pressed: { opacity: 0.5 },

  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    paddingTop: 8,
    paddingBottom: 20,
  },
  greetingText: { flex: 1, gap: 1 },
  bell: { padding: 4 },

  sectionCaption: { paddingHorizontal: Layout.gutter + 4, paddingBottom: 8 },

  heroes: { paddingHorizontal: Layout.gutter, gap: 12 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  heroGlyph: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroText: { flex: 1, gap: 3 },
  heroTitle: { color: '#FFFFFF' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)' },

  browseSection: { marginTop: 24 },

  radiusSection: { marginTop: 12 },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 6,
  },
  slider: { flex: 1, height: 40 },

  mapWrap: { paddingHorizontal: Layout.gutter, marginTop: 20 },

  results: { marginTop: 28 },
  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Layout.gutter + 4,
    paddingBottom: 8,
  },
  resultsCount: { flex: 1 },

  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  pickBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: Hairline },
  pickBarBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 12,
  },
  pickBarText: { flex: 1, gap: 1 },

  // `flexWrap` rather than a FlatList with numColumns: the whole page scrolls as
  // one, map and all, and nesting a virtualised list inside that ScrollView is
  // the arrangement React Native warns about.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: Layout.gutter,
  },
  // `flex: 1` so the two tiles of a row share the taller one's height: a wrapped
  // flex line stretches its items, and without this the shorter card floats with
  // its surface stopping mid-row.
  card: {
    flex: 1,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  cardName: { textAlign: 'center' },
  cardMeta: { textAlign: 'center', minHeight: 32 },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: 2,
  },
});
