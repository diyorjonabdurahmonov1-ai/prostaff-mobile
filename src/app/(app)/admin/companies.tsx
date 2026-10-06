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
import type { User } from '@/lib/types';

import { Icon } from '@/components/ui/icon';

type Filter = 'all' | 'online' | 'offline' | 'banned';

const ROW_INSET = Layout.gutter + 44 + 12;

export default function AdminCompaniesScreen() {
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
      setUsers((data ?? []).filter((u) => u.company_profile));
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

  const setOnline = async (user: User, online: boolean) => {
    const cp = user.company_profile!;
    setBusyId(user.id);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id && u.company_profile
          ? { ...u, company_profile: { ...u.company_profile, online } }
          : u,
      ),
    );
    try {
      await api.post(`/admin/companies/${cp.id}/status`, { online });
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const cp = u.company_profile!;
      if (tab === 'online' && !cp.online) return false;
      if (tab === 'offline' && cp.online) return false;
      if (tab === 'banned' && !cp.banned) return false;
      if (!q) return true;
      return cp.name.toLowerCase().includes(q) || cp.phone.includes(q);
    });
  }, [users, tab, search]);

  const onlineCount = users.filter((u) => u.company_profile?.online).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header
        title={t('customer.companies')}
        large
        back
        subtitle={`${users.length} ta · ${onlineCount} onlayn`}
        rightIcon="plus"
        onRightPress={() => router.push('/admin/company-new' as any)}
      />

      <View style={styles.controls}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Firma nomi yoki raqam" />
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
          icon="business-outline"
          title="Topilmadi"
          message="Firmalar faqat shu yerdan qo'shiladi."
          actionLabel="Yangi firma qo'shish"
          onAction={() => router.push('/admin/company-new' as any)}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <Section separatorInset={ROW_INSET}>
            {filtered.map((u) => {
              const cp = u.company_profile!;
              return (
                <View key={u.id} style={styles.row}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/admin/user-detail' as any, params: { id: u.id } })
                    }
                    style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.55 }]}>
                    <Avatar
                      name={cp.name}
                      imageUrl={cp.avatar_url || u.avatar_url}
                      size={44}
                      online={cp.online}
                    />
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text
                          style={[Type.body, styles.name, { color: theme.text }]}
                          numberOfLines={1}>
                          {cp.name}
                        </Text>
                        <Icon name="star" size={12} color="#FFB800" />
                        <Text style={[Type.footnoteEmphasized, { color: theme.textSecondary }]}>
                          {cp.rating.toFixed(1)}
                        </Text>
                      </View>
                      <Text
                        style={[Type.footnote, { color: theme.textSecondary }]}
                        numberOfLines={1}>
                        {u.gmail || cp.phone}
                      </Text>
                      <View style={styles.tags}>
                        <Text style={[Type.caption1, { color: theme.textTertiary }]}>
                          {cp.ratings_count} ta baho
                        </Text>
                        {cp.banned ? <Badge label="Blok" tone="danger" /> : null}
                      </View>
                    </View>
                  </Pressable>

                  <Switch
                    value={cp.online}
                    onValueChange={(v) => setOnline(u, v)}
                    disabled={busyId === u.id || cp.banned}
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
