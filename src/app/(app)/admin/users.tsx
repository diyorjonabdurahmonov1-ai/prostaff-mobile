import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { SearchField } from '@/components/ui/search-field';
import { Segmented } from '@/components/ui/segmented';
import { Layout, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

import { Icon } from '@/components/ui/icon';

type TabFilter = 'all' | 'workers' | 'companies' | 'blocked';

const ROW_INSET = Layout.gutter + 44 + 12;

export default function AdminUsersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');

  // No `setLoading(true)` on the way in: this runs again on every keystroke in
  // the search field and on every pull, and replacing the list with a spinner
  // each time makes both feel like the screen is reloading from scratch. The
  // flag only covers the first paint.
  const load = useCallback(async () => {
    try {
      const data = await api.get<User[]>('/admin/users', { query: { query: search } });
      setUsers(data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshControl } = useRefresh(load);

  const filtered = users.filter((u) => {
    if (tab === 'workers') return u.roles.includes('worker');
    if (tab === 'companies') return u.roles.includes('company');
    if (tab === 'blocked') return !u.active;
    return true;
  });

  const roleBadge = (u: User): { label: string; tone: BadgeTone } => {
    if (u.roles.includes('admin')) return { label: 'Admin', tone: 'warning' };
    if (u.roles.includes('worker')) return { label: 'Ishchi', tone: 'primary' };
    if (u.roles.includes('company')) return { label: 'Firma', tone: 'success' };
    return { label: 'Mijoz', tone: 'neutral' };
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header title="Foydalanuvchilar" large back subtitle={`${users.length} ta`} />

      <View style={styles.controls}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Qidirish" />
        <Segmented<TabFilter>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'Hammasi' },
            { value: 'workers', label: 'Ishchi' },
            { value: 'companies', label: 'Firma' },
            { value: 'blocked', label: 'Blok' },
          ]}
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon="people-outline" title="Topilmadi" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
          <Section separatorInset={ROW_INSET}>
            {filtered.map((u) => {
              const badge = roleBadge(u);
              const name = u.name || u.phone;
              return (
                <Pressable
                  key={u.id}
                  onPress={() =>
                    router.push({ pathname: '/admin/user-detail' as any, params: { id: u.id } })
                  }
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: theme.highlight },
                  ]}>
                  <Avatar name={name} imageUrl={u.avatar_url} size={44} />
                  <View style={styles.info}>
                    <Text style={[Type.body, { color: theme.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
                      {u.phone}
                    </Text>
                    {u.gmail ? (
                      <Text
                        style={[Type.caption1, { color: theme.textTertiary }]}
                        numberOfLines={1}>
                        {u.gmail}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={badge.label} tone={badge.tone} />
                  <Icon name="chevron-forward" size={17} color={theme.textTertiary} />
                </Pressable>
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
  controls: { paddingHorizontal: Layout.gutter, paddingTop: 12, gap: 12 },
  scroll: { paddingTop: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 10,
    minHeight: 60,
  },
  info: { flex: 1, gap: 2 },
});
