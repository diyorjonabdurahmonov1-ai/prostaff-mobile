/**
 * The firms that are online right now, as a 3D carousel at the top of the
 * customer home.
 *
 * It is a shop window rather than a list: one firm at a time, front and centre,
 * with its own work photo as the backdrop, and its neighbours turned away on
 * either side the way a cover-flow shelf shows there is more to swipe through.
 * A tap on the front card opens that firm's profile.
 *
 * Only online firms make it in. A firm that is offline cannot take the job the
 * customer is about to place, and putting it in the most prominent spot on the
 * screen would be advertising something that is not for sale.
 *
 * The whole block disappears when there is nobody online, so the home screen
 * falls back to exactly what it was before this existed.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { PulseRing, Shimmer } from '@/components/motion';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Gradients, Layout, MaxContentWidth, Radius, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName } from '@/lib/format';
import { resolveImageUrl } from '@/lib/image';
import { getCoordsWithFallback } from '@/lib/location';
import type { CompanyProfile } from '@/lib/types';

/** Wide enough to fill a city: this is a showcase, not a "near me" search. */
const RADIUS_KM = 100;
/** Past this many the dots stop being countable, and the shelf stops being a showcase. */
const MAX_FIRMS = 10;
const CARD_HEIGHT = 200;
const CARD_GAP = 14;
/** How long the front card stays before the shelf turns on its own. */
const AUTOPLAY_MS = 4500;
/** A finger on the shelf holds autoplay off for this long after it lets go. */
const AUTOPLAY_PAUSE_MS = 8000;

export function OnlineCompaniesCarousel() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { lang } = useI18n();
  const { categories } = useCategories();
  const { width: screenWidth } = useWindowDimensions();

  const [firms, setFirms] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  const pageWidth = Math.min(screenWidth, MaxContentWidth);
  const cardWidth = Math.round(pageWidth * 0.78);
  const interval = cardWidth + CARD_GAP;
  const sideInset = (pageWidth - cardWidth) / 2;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const touchedAt = useRef(0);

  const load = useCallback(async () => {
    try {
      const { lat, lng } = await getCoordsWithFallback();
      const data = await api.get<CompanyProfile[]>(
        `/companies?lat=${lat}&lng=${lng}&radius_km=${RADIUS_KM}`,
      );
      const next = (data ?? [])
        .filter((c) => c.online && !c.banned)
        // Best-rated first; a firm with no reviews yet is not punished for
        // being new, it just waits behind the ones customers vouched for.
        .sort((a, b) => b.rating - a.rating || b.ratings_count - a.ratings_count)
        .slice(0, MAX_FIRMS);
      setFirms(next);
      // Firms go offline between visits: keep the front card inside the list,
      // or no card is "front" and a tap on any of them only scrolls.
      setActive((prev) => Math.min(prev, Math.max(0, next.length - 1)));
    } catch {
      // A showcase that fails to load is simply not shown.
    } finally {
      setLoading(false);
    }
  }, []);

  // Who is online changes by the minute, so every return to the home screen asks again.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Turns the shelf by itself, but never out from under a finger.
  useEffect(() => {
    if (firms.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() - touchedAt.current < AUTOPLAY_PAUSE_MS) return;
      const next = (active + 1) % firms.length;
      scrollRef.current?.scrollTo({ x: next * interval, animated: true });
      setActive(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [active, firms.length, interval, scrollRef]);

  const serviceLine = (c: CompanyProfile) =>
    c.services?.trim() ||
    (c.category_ids ?? [])
      .map((id) => categories.find((cat) => cat.id === id))
      .filter(Boolean)
      .map((cat) => categoryName(cat!, lang))
      .join(', ') ||
    c.description;

  if (!loading && firms.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.liveDot}>
          <PulseRing size={8} color="#12B76A" filled />
          <View style={styles.liveCore} />
        </View>
        <Text style={[Type.footnote, styles.headText, { color: theme.textSecondary }]}>
          {t('home.onlineFirms').toUpperCase()}
        </Text>
        <View style={[styles.adTag, { backgroundColor: theme.fillQuaternary }]}>
          <Icon name="sparkle" size={11} color={theme.textSecondary} />
          <Text style={[Type.caption2, { color: theme.textSecondary }]}>{t('home.featured')}</Text>
        </View>
      </View>

      {loading ? (
        <View
          style={[
            styles.skeleton,
            Squircle,
            { width: cardWidth, marginLeft: sideInset, backgroundColor: theme.surfaceMuted },
          ]}>
          <Shimmer radius={Radius.xl} intensity={0.25} />
        </View>
      ) : (
        <>
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={interval}
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEventThrottle={16}
            onScroll={onScroll}
            onScrollBeginDrag={() => {
              touchedAt.current = Date.now();
            }}
            // Settling is not a touch: this also fires when the shelf turns by
            // itself, and counting it as one made autoplay wait out the pause
            // after every turn it made.
            onMomentumScrollEnd={(e) => {
              setActive(Math.round(e.nativeEvent.contentOffset.x / interval));
            }}
            contentContainerStyle={{ paddingHorizontal: sideInset, gap: CARD_GAP }}
            style={styles.shelf}>
            {firms.map((c, i) => (
              <FirmCard
                key={c.id}
                firm={c}
                index={i}
                width={cardWidth}
                interval={interval}
                scrollX={scrollX}
                services={serviceLine(c)}
                front={i === active}
                onPress={() => {
                  // A tap on a side card brings it forward first; only the
                  // front card is a door into the profile.
                  if (i !== active) {
                    touchedAt.current = Date.now();
                    setActive(i);
                    scrollRef.current?.scrollTo({ x: i * interval, animated: true });
                    return;
                  }
                  router.push({ pathname: '/company/[id]', params: { id: c.id } });
                }}
              />
            ))}
          </Animated.ScrollView>

          {firms.length > 1 ? (
            <View style={styles.dots}>
              {firms.map((c, i) => (
                <Dot key={c.id} index={i} interval={interval} scrollX={scrollX} color={theme.primary} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/* ===================== One card on the shelf ===================== */

function FirmCard({
  firm,
  index,
  width,
  interval,
  scrollX,
  services,
  front,
  onPress,
}: {
  firm: CompanyProfile;
  index: number;
  width: number;
  interval: number;
  scrollX: SharedValue<number>;
  services: string;
  front: boolean;
  onPress: () => void;
}) {
  const t = useT();
  // The work photo is the advert; the logo is the signature on it. A firm with
  // no gallery yet still gets its logo as the backdrop rather than a blank card.
  const cover = resolveImageUrl(firm.images?.[0]) ?? resolveImageUrl(firm.avatar_url);

  /**
   * Where this card is relative to the centre, in cards: 0 in front, +1 one
   * place to the right, -1 one to the left. Everything 3D is read off it.
   */
  const card = useAnimatedStyle(() => {
    const p = interpolate(
      scrollX.value,
      [(index - 1) * interval, index * interval, (index + 1) * interval],
      [1, 0, -1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: interpolate(Math.abs(p), [0, 1], [1, 0.7]),
      // The front card sits on top of the two it overlaps.
      zIndex: Math.round(10 - Math.abs(p) * 10),
      transform: [
        { perspective: 900 },
        // Pulled in towards the centre: scaled and turned, a neighbour would
        // otherwise shrink clean off the edge of the screen and the shelf would
        // look like a single card with nothing to swipe to.
        { translateX: -p * width * 0.2 },
        { translateY: interpolate(Math.abs(p), [0, 1], [0, 16]) },
        { rotateY: `${p * -38}deg` },
        { scale: interpolate(Math.abs(p), [0, 1], [1, 0.84]) },
      ],
    };
  });

  // The photo drifts against the card as it turns — the depth cue that makes
  // the card read as a window onto the work rather than a sticker of it.
  const parallax = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [(index - 1) * interval, index * interval, (index + 1) * interval],
          [-40, 0, 40],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[{ width, height: CARD_HEIGHT }, card]}>
      <PressableScale onPress={onPress} scaleTo={0.97} accessibilityLabel={firm.name}>
        <View style={[styles.card, Squircle, front ? styles.cardFront : null]}>
          {cover ? (
            <Animated.View style={[styles.coverWrap, parallax]}>
              <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={220} />
            </Animated.View>
          ) : (
            <LinearGradient
              colors={[Gradients.company[0], Gradients.brand[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}>
              <View style={styles.watermark}>
                <Icon name="business" size={120} color="rgba(255,255,255,0.12)" />
              </View>
            </LinearGradient>
          )}

          {/* Legibility: dark at the foot where the text sits, clear at the top
              so the photo is still the first thing seen. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          {front ? <Shimmer radius={Radius.xl} intensity={0.12} /> : null}

          <View style={styles.topRow}>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={[Type.caption2Emphasized, styles.white]}>{t('common.online')}</Text>
            </View>
            {firm.ratings_count > 0 ? (
              <View style={styles.glassPill}>
                <Icon name="star" size={11} color="#FDB022" />
                <Text style={[Type.caption2Emphasized, styles.white]}>{firm.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottom}>
            <View style={styles.logoRing}>
              <Avatar name={firm.name} imageUrl={firm.avatar_url} size={44} />
            </View>
            <View style={styles.bottomText}>
              <Text style={[Type.headline, styles.white]} numberOfLines={1}>
                {firm.name}
              </Text>
              {services ? (
                <Text style={[Type.caption1, styles.dim]} numberOfLines={2}>
                  {services}
                </Text>
              ) : null}
            </View>
            <View style={styles.go}>
              <Icon name="arrow-forward" size={16} color="#0A0A0A" />
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/* ===================== Page dot ===================== */

/** Stretches into a bar as its card comes to the front, following the finger. */
function Dot({
  index,
  interval,
  scrollX,
  color,
}: {
  index: number;
  interval: number;
  scrollX: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value / interval - index);
    return {
      width: interpolate(d, [0, 1], [20, 6], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.3], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.gutter + 4,
    paddingBottom: 10,
  },
  headText: { flex: 1 },
  liveDot: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveCore: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#12B76A' },
  adTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },

  shelf: { overflow: 'visible' },
  skeleton: { height: CARD_HEIGHT, borderRadius: Radius.xl, overflow: 'hidden' },

  card: {
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
  },
  cardFront: {
    shadowColor: '#1B6EF3',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  // Wider than the card so the parallax drift never shows an edge.
  coverWrap: { position: 'absolute', top: 0, bottom: 0, left: -44, right: -44 },
  cover: { width: '100%', height: '100%' },
  watermark: { position: 'absolute', right: -18, bottom: -22 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(18,183,106,0.92)',
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  logoRing: { padding: 2, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)' },
  bottomText: { flex: 1, gap: 2 },
  white: { color: '#FFFFFF' },
  dim: { color: 'rgba(255,255,255,0.82)' },
  go: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 14 },
  dot: { height: 6, borderRadius: 3 },
});
