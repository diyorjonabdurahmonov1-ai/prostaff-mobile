import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { PROVIDER_NAV_HEIGHT, ProviderNav } from '@/components/provider-nav';
import { Avatar } from '@/components/ui/avatar';
import { Header } from '@/components/ui/header';
import { Chip } from '@/components/ui/chip';
import { Row, Section } from '@/components/ui/list';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { Layout, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { categoryName, formatSom } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * The worker's profile.
 *
 * Their record used to sit on the panel home, which turned a screen meant for
 * one decision — am I taking work right now — into a page of paperwork. It
 * lives here instead, under the same account rows every mode shows, and the bar
 * at the bottom is the worker's own rather than the customer tabs.
 */
export default function WorkerProfileScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();
  const { categories } = useCategories();
  const [refreshing, setRefreshing] = useState(false);

  const profile = user?.worker_profile ?? null;

  useFocusEffect(
    useCallback(() => {
      refreshMe();
    }, [refreshMe])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshMe();
    } finally {
      setRefreshing(false);
    }
  };

  const workerCats = (profile?.category_ids ?? [])
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={t('profile.title')} large back={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: PROVIDER_NAV_HEIGHT + insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }>
        <ProfileView>
          {profile ? (
            <>
              {/* What a customer sees before calling this worker. */}
              <Section
                header={t('worker.publicProfile')}
                footer={t('worker.publicProfileHint')}
                style={styles.section}>
                <Row
                  title={t('worker.photo')}
                  value={profile.avatar_url ? undefined : t('photo.add')}
                  right={
                    profile.avatar_url ? (
                      <Avatar name={profile.full_name} imageUrl={profile.avatar_url} size={28} />
                    ) : null
                  }
                  onPress={() => router.push('/worker/edit')}
                  chevron
                />
                <Row stacked title={t('worker.about')} value={profile.about || '—'} />
                <Row
                  title={t('workerDetail.experience')}
                  value={
                    profile.experience_years
                      ? `${profile.experience_years} ${t('workerDetail.years')}`
                      : '—'
                  }
                />
                <Row title={t('workerDetail.address')} value={profile.address || '—'} />
                <Row
                  title={t('worker.works')}
                  value={String(profile.images?.length ?? 0)}
                  onPress={() => router.push('/worker/edit')}
                  chevron
                />
              </Section>

              <PhotoGallery uris={profile.images} header={t('worker.works')} />

              {/* Terms — read-only here, edited on one screen below. */}
              <Section header={t('worker.myPrices')} style={styles.section}>
                <Row
                  title={t('worker.priceMin')}
                  value={`${formatSom(profile.price_min)} ${t('common.som')}`}
                />
                <Row
                  title={t('worker.priceMax')}
                  value={`${formatSom(profile.price_max)} ${t('common.som')}`}
                />
                <Row
                  title={t('order.gender')}
                  value={profile.gender === 'female' ? t('order.female') : t('order.male')}
                />
                <Row title={t('worker.age')} value={String(profile.age)} />
                <Row title={t('order.phone')} value={profile.phone} />
              </Section>

              {workerCats.length > 0 ? (
                <Section
                  header={t('worker.myCategories')}
                  footer={t('worker.personalLockedHint')}
                  style={styles.section}>
                  <View style={styles.chips}>
                    {workerCats.map(
                      (cat) =>
                        cat && <Chip key={cat.id} label={categoryName(cat, lang)} tone="tint" />
                    )}
                  </View>
                </Section>
              ) : null}

              <Section style={styles.section}>
                <Row
                  title={t('worker.editProfile')}
                  tone="primary"
                  centered
                  onPress={() => router.push('/worker/edit')}
                />
              </Section>
            </>
          ) : (
            <Text style={[Type.footnote, styles.empty, { color: theme.textSecondary }]}>
              {t('provider.adminOnlyHint')}
            </Text>
          )}
        </ProfileView>
      </ScrollView>

      <ProviderNav mode="worker" active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12 },
  section: { marginTop: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  empty: { paddingHorizontal: Layout.gutter + 4, marginTop: 20 },
});
