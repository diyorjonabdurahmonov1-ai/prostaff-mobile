import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { SearchField } from '@/components/ui/search-field';
import { Segmented } from '@/components/ui/segmented';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import type { User } from '@/lib/types';

import { Icon } from '@/components/ui/icon';

type Filter = 'all' | 'online' | 'offline' | 'banned';

const ROW_INSET = Layout.gutter + 44 + 12;

export default function AdminWorkersScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<User[]>('/admin/users');
      setUsers((data ?? []).filter((u) => u.worker_profile));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** Admin can flip a worker online/offline without touching their phone. */
  const setOnline = async (user: User, online: boolean) => {
    setBusyId(user.id);
    // Optimistic — the switch should not lag behind the tap.
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id && u.worker_profile
          ? { ...u, worker_profile: { ...u.worker_profile, online } }
          : u,
      ),
    );
    try {
      await api.post(`/admin/workers/${user.id}/status`, { online });
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const wp = u.worker_profile!;
      if (tab === 'online' && !wp.online) return false;
      if (tab === 'offline' && wp.online) return false;
      if (tab === 'banned' && !wp.banned) return false;
      if (!q) return true;
      return (
        wp.full_name.toLowerCase().includes(q) ||
        wp.phone.includes(q) ||
        (u.gmail ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, tab, search]);

  const onlineCount = users.filter((u) => u.worker_profile?.online).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header
        title={t('customer.workers')}
        large
        back
        subtitle={`${users.length} ta · ${onlineCount} onlayn`}
        rightIcon="plus"
        onRightPress={() => router.push('/admin/worker-new' as any)}
      />

      <View style={styles.controls}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Ism yoki raqam" />
        <Segmented<Filter>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'Hammasi' },
            { value: 'online', label: t('common.online') },
            { value: 'offline', label: t('common.offline') },
            { value: 'banned', label: 'Blok' },
          ]}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Topilmadi"
          message="Ishchilar faqat shu yerdan qo'shiladi."
          actionLabel="Yangi ishchi qo'shish"
          onAction={() => router.push('/admin/worker-new' as any)}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <Section separatorInset={ROW_INSET}>
            {filtered.map((u) => {
              const wp = u.worker_profile!;
              const wallet = u.wallet;
              const balanceLow =
                (wallet?.balance ?? 0) < (wallet?.min_balance ?? 10000) &&
                (wp.credit_limit ?? 0) <= 0;
              return (
                <View key={u.id} style={styles.row}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/admin/user-detail' as any, params: { id: u.id } })
                    }
                    style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.55 }]}>
                    {/* The worker's own photo, not the account avatar — this is
                        the picture customers are shown. */}
                    <Avatar
                      name={wp.full_name || u.phone}
                      imageUrl={wp.avatar_url || u.avatar_url}
                      size={44}
                      online={wp.online}
                    />
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text
                          style={[Type.body, styles.name, { color: theme.text }]}
                          numberOfLines={1}>
                          {wp.full_name}
                        </Text>
                        <Icon name="star" size={12} color="#FFB800" />
                        <Text style={[Type.footnoteEmphasized, { color: theme.textSecondary }]}>
                          {wp.rating.toFixed(1)}
                        </Text>
                      </View>
                      <Text
                        style={[Type.footnote, { color: theme.textSecondary }]}
                        numberOfLines={1}>
                        {u.gmail || wp.phone}
                      </Text>
                      <View style={styles.tags}>
                        <Text style={[Type.caption1, { color: theme.textTertiary }]}>
                          {formatSom(wallet?.balance ?? 0)} {t('common.som')}
                        </Text>
                        {wp.credit_limit > 0 ? <Badge label="Kreditli" tone="primary" /> : null}
                        {balanceLow ? <Badge label="Balans yo'q" tone="warning" /> : null}
                        {wp.banned ? <Badge label="Blok" tone="danger" /> : null}
                      </View>
                    </View>
                  </Pressable>

                  <Switch
                    value={wp.online}
                    onValueChange={(v) => setOnline(u, v)}
                    disabled={busyId === u.id || wp.banned}
                    trackColor={{ true: theme.success, false: theme.fill }}
                    ios_backgroundColor={theme.fill}
                  />
                </View>
              );
            })}
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  controls: { paddingHorizontal: Layout.gutter, paddingTop: 12, gap: 12, paddingBottom: 4 },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 10,
    minHeight: 64,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flexShrink: 1 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
