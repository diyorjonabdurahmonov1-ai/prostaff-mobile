import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { Header } from '@/components/ui/header';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { Backdrop } from '@/components/backdrop';

/**
 * The customer's profile tab.
 *
 * Just the shared profile body — a customer has no provider record to show, so
 * nothing is passed into `ProfileView`. The worker and firm equivalents live at
 * /worker/profile and /company/profile, each with their own bottom bar.
 */
export default function ProfileScreen() {
  const t = useT();
  const theme = useTheme();
  const { refreshMe } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

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
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary} // iOS
            colors={[theme.primary]} // Android
          />
        }>
        <ProfileView />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12, paddingBottom: 40 },
});
