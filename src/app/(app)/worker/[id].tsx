import { Text } from '@/components/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewsSection } from '@/components/reviews-section';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { Screen } from '@/components/ui/screen';
import { Stars } from '@/components/ui/stars';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryName, formatSom } from '@/lib/format';
import { hasCoords } from '@/lib/maps';
import type { Review, WorkerProfile } from '@/lib/types';
import { useOrderFlow } from '@/store/order-flow';

export default function WorkerDetailScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories } = useCategories();
  const { reset } = useOrderFlow();

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * The profile and the reviews go out together rather than in sequence: they
   * land on the same screen, and one round trip through the tunnel is already
   * long enough without waiting for the second to start.
   *
   * Reviews failing does not blank the profile. Somebody who can see the worker
   * but not the comments has still been shown the part they came for.
   */
  const load = useCallback(async () => {
    const [profile, list] = await Promise.all([
      api.get<WorkerProfile>(`/workers/${id}`).catch(() => null),
      api.get<Review[]>(`/workers/${id}/reviews`).catch(() => [] as Review[]),
    ]);
    if (profile) setWorker(profile);
    setReviews(list ?? []);
  }, [id]);

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const { refreshControl } = useRefresh(load);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <Header title={t('workerDetail.title')} back />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!worker) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <Header title={t('workerDetail.title')} back />
        <EmptyState icon="alert-circle-outline" title={t('common.error')} />
      </SafeAreaView>
    );
  }

  const genderLabel = worker.gender === 'male' ? t('workerDetail.male') : t('workerDetail.female');
  const workerCats = worker.category_ids
    .map((cid) => categories.find((c) => c.id === cid))
    .filter(Boolean);
  const createdDate = new Date(worker.created_at).toLocaleDateString(
    lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <Screen
      padded={false}
      header={<Header title={t('workerDetail.title')} back />}
      refreshControl={refreshControl}
      /* One action, and it is the right one: hire them. There is no call button
         and no number anywhere on this page — a customer who could ring the
         worker directly would, and the job would then happen off the platform
         with no order, no agreed price and no record behind it. The number
         arrives on the order itself, once the worker has accepted. */
      footer={
        <View style={styles.footer}>
          <Button
            label={t('workerDetail.hireWorker')}
            style={styles.hireBtn}
            onPress={() => {
              /**
               * "Chaqirish" on somebody's own page calls *them*.
               *
               * It used to pre-set the category off this profile and nothing
               * else, which made the order an ordinary broadcast: the customer
               * read one worker's reviews, pressed the button under their photo,
               * filled the job in — and it went out to every worker in the
               * district, any of whom could take it. The person they had
               * actually chosen was one phone among dozens, and nothing on the
               * way through said so.
               *
               * With no category on the profile the customer still has to pick
               * one, so the choice rides to step 1 as a parameter — the same
               * route the multi-select list uses, and for the same reason: step
               * 1 resets the draft, so a selection written into it here would be
               * the one thing that reset throws away.
               */
              const category = worker.category_ids[0];
              if (category) {
                reset({
                  categoryId: category,
                  targetWorkerIds: [worker.id],
                  targetWorkerNames: [worker.full_name],
                });
                router.push('/details');
              } else {
                router.push({
                  pathname: '/categories',
                  params: { worker: worker.id, workerName: worker.full_name },
                });
              }
            }}
          />
        </View>
      }
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Avatar name={worker.full_name} imageUrl={worker.avatar_url} size={92} />
        <Text style={[Type.title1, styles.centerText, { color: theme.text }]} numberOfLines={2}>
          {worker.full_name}
        </Text>
        <Stars value={worker.rating} showValue count={worker.ratings_count} size={16} />
        <Badge
          label={worker.online ? t('common.online') : t('common.offline')}
          tone={worker.online ? 'success' : 'neutral'}
          dot
        />
      </View>

      {/* Quick stats. Three columns at most — the rating already sits in the
          hero as stars, and a fourth tile on a 360dp screen leaves each label
          about 70pt, which truncates every word in every language. */}
      <View style={styles.stats}>
        <StatTile value={String(worker.age)} label={t('workerDetail.age')} />
        {worker.experience_years ? (
          <StatTile
            value={`${worker.experience_years} ${t('workerDetail.years')}`}
            label={t('workerDetail.experience')}
          />
        ) : null}
        {worker.distance_km != null ? (
          <StatTile value={`${worker.distance_km.toFixed(1)}`} label={t('customer.km')} />
        ) : null}
      </View>

      {/* In their own words — the first thing a customer actually reads. */}
      <Section header={t('workerDetail.about')} style={styles.section}>
        <Row stacked title={t('worker.about')} value={worker.about || t('workerDetail.noAbout')} />
      </Section>

      <Section header={t('companyDetail.contact')} style={styles.section}>
        <Row title={t('workerDetail.gender')} value={genderLabel} />
        {worker.address ? <Row title={t('workerDetail.address')} value={worker.address} /> : null}
        <Row
          title={t('workerDetail.priceRange')}
          value={`${formatSom(worker.price_min)}–${formatSom(worker.price_max)}`}
        />
        <Row title={t('workerDetail.memberSince')} value={createdDate} />
      </Section>

      {workerCats.length > 0 ? (
        <Section header={t('workerDetail.categories')} style={styles.section}>
          <View style={styles.chips}>
            {workerCats.map(
              (cat) => cat && <Chip key={cat.id} label={categoryName(cat, lang)} tone="tint" />
            )}
          </View>
        </Section>
      ) : null}

      {/* Previous jobs, in pictures. */}
      <PhotoGallery uris={worker.images} header={t('workerDetail.works')} />

      {/* And in words. The stars in the hero are the average of exactly these. */}
      <ReviewsSection reviews={reviews} style={styles.section} />

      {/* Where they work from — the 15 km ring is the area they can be called to. */}
      {hasCoords(worker) ? (
        <View style={styles.mapWrap}>
          <YandexMap
            point={{ lat: worker.lat, lng: worker.lng }}
            height={180}
            radiusKm={15}
            caption={t('customer.radius')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, Squircle, { backgroundColor: theme.surface }]}>
      <Text style={[Type.title2, { color: theme.text }]}>{value}</Text>
      <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centerText: { textAlign: 'center' },

  hero: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    paddingBottom: 24,
  },

  stats: { flexDirection: 'row', gap: 12, paddingHorizontal: Layout.gutter },
  statTile: {
    flex: 1,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 1,
  },

  section: { marginTop: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  mapWrap: { paddingHorizontal: Layout.gutter, marginTop: 28 },

  footer: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  hireBtn: { flex: 1 },
});
