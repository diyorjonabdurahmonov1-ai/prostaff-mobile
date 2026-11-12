import { Text } from '@/components/text';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { PROVIDER_NAV_HEIGHT, ProviderNav } from '@/components/provider-nav';
import { Avatar } from '@/components/ui/avatar';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { formatSom } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { Backdrop } from '@/components/backdrop';

/**
 * The firm's profile — the same account rows every mode shows, plus the record
 * customers read before ordering. The panel home keeps only the two things a
 * firm opens the app for: are we taking work, and what has come in.
 */
export default function CompanyProfileScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const profile = user?.company_profile ?? null;

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Backdrop />
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
        }
      >
        <ProfileView>
          {profile ? (
            <>
              <Section
                header={t('company.about')}
                footer={t('company.priceHint')}
                style={styles.section}
              >
                <Row
                  title={t('company.logo')}
                  value={profile.avatar_url ? undefined : t('photo.add')}
                  right={
                    profile.avatar_url ? (
                      <Avatar name={profile.name} imageUrl={profile.avatar_url} size={28} />
                    ) : null
                  }
                  onPress={() => router.push('/company/onboarding')}
                  chevron
                />
                <Row title={t('company.name')} value={profile.name} />
                <Row
                  title={t('company.price')}
                  value={`${formatSom(profile.price)} ${t('common.som')}`}
                />
                <Row stacked title={t('company.description')} value={profile.description || '—'} />
                {/* Optional, so an empty line is not a fault to flag — the
                    editor is one tap away on the logo row above. */}
                <Row
                  stacked
                  title={t('company.services')}
                  value={profile.services?.trim() || t('company.servicesEmpty')}
                />
              </Section>

              <Section header={t('companyDetail.contact')} style={styles.section}>
                <Row title={t('company.phone')} value={profile.phone} />
                <Row title={t('company.address')} value={profile.address || '—'} />
                {/* <Row
                  title={t('company.location')}
                  value={
                    profile.lat || profile.lng
                      ? `${profile.lat.toFixed(3)}, ${profile.lng.toFixed(3)}`
                      : '—'
                  }
                /> */}
                <Row title={t('company.workingHours')} value={profile.working_hours || '—'} />
                <Row
                  title={t('company.employees')}
                  value={profile.employees_count ? String(profile.employees_count) : '—'}
                />
                <Row
                  title={t('companyDetail.experience')}
                  value={
                    profile.experience_years
                      ? `${profile.experience_years} ${t('workerDetail.years')}`
                      : '—'
                  }
                />
                {profile.email ? <Row title={t('company.email')} value={profile.email} /> : null}
                {profile.website ? (
                  <Row title={t('company.website')} value={profile.website} />
                ) : null}
              </Section>

              <PhotoGallery uris={profile.images} header={t('company.gallery')} />

              <Section style={styles.section}>
                <Row
                  title={t('company.editProfile')}
                  tone="primary"
                  centered
                  onPress={() => router.push('/company/onboarding')}
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

      <ProviderNav mode="company" active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12 },
  section: { marginTop: 28 },
  empty: { paddingHorizontal: Layout.gutter + 4, marginTop: 20 },
});
