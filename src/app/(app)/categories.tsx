import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/backdrop';
import { CategoryArt } from '@/components/category-art';
import { FadeUp } from '@/components/motion';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SearchField } from '@/components/ui/search-field';
import { StepDots } from '@/components/ui/step-dots';
import { Layout, MaxContentWidth, Radius, Shadow, Squircle, Stagger, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { categoryName } from '@/lib/format';
import type { Category } from '@/lib/types';
import { useOrderFlow } from '@/store/order-flow';

/**
 * The order flow is three steps the customer drives — category → details →
 * review — and then the server takes over: the order is broadcast to every
 * worker nearby and the first to accept it wins.
 */
export const ORDER_STEPS = 3;

/**
 * Step 1: pick the kind of work.
 *
 * Each category owns a colour that follows it through the rest of the flow —
 * onto the chip in step 2, the accent strip on the review card, and the strip
 * down the side of the alert the worker eventually sees.
 */
export default function CategoriesScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  // The choosing list: a service the office has retired is not on offer today.
  const { activeCategories, loading, error, reload } = useCategories();
  const { reset } = useOrderFlow();
  const { refreshControl } = useRefresh(reload);

  /**
   * Workers the customer already picked, when they arrived from the nearby list.
   *
   * They ride in as route parameters rather than in the shared draft, because
   * `reset` below deliberately throws that draft away — a selection stored there
   * before this screen ran would be the one thing the fresh-draft rule silently
   * deleted. Arriving from the home card there are none, and the order is the
   * ordinary broadcast.
   */
  const params = useLocalSearchParams<{
    worker?: string | string[];
    workerName?: string | string[];
    /** Set by the home screen's search bar: open with the keyboard up. */
    focus?: string;
  }>();
  const targetWorkerIds = asList(params.worker);
  const targetWorkerNames = asList(params.workerName);
  // Names are only for showing back to the customer, so a mismatched pair is
  // not worth refusing the order over — but pairing them up by index when they
  // disagree would label workers with each other's names.
  const namesMatch = targetWorkerNames.length === targetWorkerIds.length;

  /**
   * Typing narrows the grid, in whichever language the name was typed.
   * Apostrophes are ignored, so "tamir" finds "Ta'mirlash".
   */
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = plain(query);
    if (!q) return activeCategories;
    return activeCategories.filter((c) =>
      [c.name_uz, c.name_ru, c.name_en].some((name) => plain(name ?? '').includes(q)),
    );
  }, [activeCategories, query]);

  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((Math.min(width, MaxContentWidth) - Layout.gutter * 2 - GRID_GAP) / 2);

  const choose = (category: Category) => {
    // A fresh draft per order — leftovers from an abandoned flow would leak in.
    reset({
      categoryId: category.id,
      targetWorkerIds,
      targetWorkerNames: namesMatch ? targetWorkerNames : [],
    });
    router.push('/details');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Backdrop />
      <Header
        title={t('customer.workers')}
        large
        back
        subtitle={
          targetWorkerIds.length > 0
            ? `${t('pick.chosen', { n: targetWorkerIds.length })} · ${t('category.subtitle')}`
            : t('category.subtitle')
        }
      />

      <View style={styles.steps}>
        <StepDots step={0} total={ORDER_STEPS} />
      </View>

      <View style={styles.search}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('category.search')}
          autoFocus={params.focus === '1'}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : error || activeCategories.length === 0 ? (
        <EmptyState icon="grid-outline" title={t('common.genericError')} message={error ?? undefined} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.gridScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}>
          {shown.length === 0 ? (
            <EmptyState icon="search" title={t('category.noMatch')} />
          ) : (
            <View style={styles.grid}>
              {shown.map((category, i) => (
                <CategoryTile
                  key={category.id}
                  index={i}
                  width={tileWidth}
                  category={category}
                  label={categoryName(category, lang)}
                  onPress={() => choose(category)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * A `|`-joined route parameter, as a list.
 *
 * The array form is still accepted because Expo Router may hand one back — it
 * returns a bare string for a single value and an array for several — but what
 * this app sends is always one joined string, precisely so the count cannot
 * change shape on the way through. See the push in the workers list.
 */
function asList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const parts = Array.isArray(value) ? value : [value];
  return parts.flatMap((part) => part.split('|')).filter(Boolean);
}

/** A name as the search compares it: lower case, no apostrophes of any kind. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[ʻʼ’‘'`´]/g, '').trim();
}

const GRID_GAP = 12;
/** The picture's height on a tile — wide and short, like a card's cover. */
const ART_HEIGHT = 92;

/**
 * One service: its picture as the cover, its name under it.
 *
 * The picture comes from the name itself (`lib/category-art.ts`), so a service
 * the office adds tomorrow arrives with one.
 */
function CategoryTile({
  category,
  label,
  width,
  index,
  onPress,
}: {
  category: Category;
  label: string;
  width: number;
  index: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';

  return (
    <FadeUp index={index} step={Stagger.list} style={{ width }}>
      <PressableScale onPress={onPress} scaleTo={0.96} accessibilityLabel={label} style={dark ? undefined : Shadow.card}>
        <View style={[styles.tile, Squircle, { backgroundColor: theme.surface }]}>
          <CategoryArt category={category} width={width - 16} height={ART_HEIGHT} radius={14} iconSize={44} />
          <Text
            style={[Type.subheadEmphasized, styles.tileLabel, { color: theme.text }]}
            numberOfLines={2}>
            {label}
          </Text>
        </View>
      </PressableScale>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  steps: { paddingTop: 12, paddingBottom: 4 },
  search: { paddingHorizontal: Layout.gutter, paddingTop: 8 },
  gridScroll: { paddingBottom: 32 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: Layout.gutter,
    paddingTop: 16,
  },
  tile: { borderRadius: Radius.card, padding: 8, gap: 10, paddingBottom: 12 },
  // Two lines reserved, so a row of tiles with a long and a short name lines up.
  tileLabel: { paddingHorizontal: 4, minHeight: 40 },
});
