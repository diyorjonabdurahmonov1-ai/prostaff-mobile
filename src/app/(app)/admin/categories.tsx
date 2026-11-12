import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Icon } from '@/components/ui/icon';
import { Row, Section } from '@/components/ui/list';
import { Sheet } from '@/components/ui/sheet';
import { TextField } from '@/components/ui/text-field';
import { Layout, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { CategoryArt } from '@/components/category-art';

/**
 * The service list.
 *
 * Every order names one of these and every provider claims a few, which makes it
 * the table the whole platform is indexed by — and, until this screen, the one
 * table only a deploy could change. Seven rows were compiled into the server;
 * the office learning that nobody searches for "Ko'k tushuruvchi" could do
 * nothing about it.
 *
 * Two rules follow from what a category is attached to:
 *
 *   - Renaming is free. An order stores the id, so a corrected name appears on
 *     every record that already used it, last year's included.
 *   - Deleting is not. A category with orders or providers behind it can only be
 *     switched off: retiring keeps the name on those records and takes the row
 *     off every picker, which is exactly what "we stopped doing that" means.
 *     Only an unused row — the typo from two minutes ago — is removed outright,
 *     and the server is what decides that.
 */
export default function AdminCategoriesScreen() {
  const theme = useTheme();
  // The apps cache this list; editing it here has to invalidate that cache, or
  // the admin's own customer tab keeps offering the category they just retired.
  const { reload: reloadShared } = useCategories();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** null = closed, 'new' = create, otherwise the category being edited. */
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  /**
   * The row whose "⋯" is open.
   *
   * Editing and deleting are one tap apart and one of them cannot be undone, so
   * they do not sit next to each other on a crowded row where a thumb decides
   * which. The menu names both, in words, before either happens.
   */
  const [menuFor, setMenuFor] = useState<Category | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.get<Category[]>('/admin/categories');
      setCategories(list ?? []);
    } catch {
      // keep whatever is on screen; pull-to-refresh is right there
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { refreshControl } = useRefresh(load);

  /** Runs a mutation, then re-reads so the screen shows truth rather than hope. */
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await load();
        await reloadShared();
      } catch (err) {
        Alert.alert('Xatolik', err instanceof Error ? err.message : 'Amal bajarilmadi');
      } finally {
        setBusy(false);
      }
    },
    [load, reloadShared],
  );

  const toggle = (c: Category) =>
    run(() => api.patch(`/admin/categories/${c.id}`, { active: !c.active }));

  const remove = (c: Category) => {
    const orders = c.orders_count ?? 0;
    const providers = c.providers_count ?? 0;
    if (orders + providers > 0) {
      // Said before the tap rather than after it: the counts are already on
      // screen, so there is no reason to walk the operator into a refusal.
      Alert.alert(
        "O'chirib bo'lmaydi",
        `"${c.name_uz}" ${orders} ta buyurtma va ${providers} ta ijrochida ishlatilmoqda. ` +
          "O'chirilsa, o'sha yozuvlarda xizmat nomi yo'qoladi. O'rniga faolsizlantiring — " +
          "eski yozuvlarda nomi qoladi, yangi buyurtmalarda ko'rinmaydi.",
        [{ text: 'Tushunarli' }],
      );
      return;
    }
    Alert.alert(
      "Kategoriyani o'chirish",
      `"${c.name_uz}" o'chiriladi. Unga hech qanday buyurtma yoki ijrochi bog'lanmagan.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () => run(() => api.del(`/admin/categories/${c.id}`)),
        },
      ],
    );
  };

  const submit = (values: CategoryValues) => {
    const body = {
      name_uz: values.nameUz,
      name_ru: values.nameRu,
      name_en: values.nameEn,
    };
    const request =
      editing === 'new' || editing === null
        ? () => api.post('/admin/categories', body)
        : () => api.patch(`/admin/categories/${editing.id}`, body);
    return run(request).then(() => setEditing(null));
  };

  const activeCount = categories.filter((c) => c.active).length;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}>
      {/* Adding is the reason the office opens this screen, so it is in the bar
          rather than under however many rows the list has grown to. */}
      <Header
        title="Kategoriyalar"
        large
        back
        rightIcon="plus"
        onRightPress={() => setEditing('new')}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        <Text style={[Type.footnote, styles.intro, { color: theme.textSecondary }]}>
          Mijoz buyurtmani shu ro&apos;yxatdan tanlaydi, ishchi esa shularni o&apos;ziga
          biriktiradi.
          {categories.length > 0
            ? ` ${activeCount} ta faol, ${categories.length - activeCount} ta faolsizlantirilgan.`
            : ''}
        </Text>

        <Section
          header="Xizmat turlari"
          style={styles.section}
          footer="Nomni o'zgartirish xavfsiz — eski buyurtmalarda ham yangi nom ko'rinadi. Tahrirlash va o'chirish uchun qator yonidagi uch nuqtani bosing.">
          {categories.length === 0 ? (
            <Row
              stacked
              title={loading ? 'Yuklanmoqda…' : "Kategoriya yo'q"}
              value={
                loading
                  ? undefined
                  : "Mijoz buyurtma bera olmaydi. Yuqoridagi + tugmasi bilan qo'shing."
              }
            />
          ) : (
            categories.map((c) => (
              <Row
                key={c.id}
                // The picture customers will see for it — chosen from the name
                // (lib/category-art.ts), so fixing a name can change it.
                left={<CategoryArt category={c} width={40} height={40} radius={11} />}
                title={c.name_uz}
                subtitle={`${c.name_ru} · ${c.name_en}\n${c.orders_count ?? 0} ta buyurtma · ${
                  c.providers_count ?? 0
                } ta ijrochi`}
                onPress={() => setMenuFor(c)}
                right={
                  <View style={styles.rowRight}>
                    <Switch
                      value={c.active}
                      onValueChange={() => toggle(c)}
                      disabled={busy}
                      trackColor={{ true: theme.success, false: theme.fill }}
                      ios_backgroundColor={theme.fill}
                    />
                    <Pressable onPress={() => setMenuFor(c)} hitSlop={10} style={styles.more}>
                      <Icon name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                }
              />
            ))
          )}
        </Section>

        <Text style={[Type.caption1, styles.note, { color: theme.textTertiary }]}>
          Kategoriya rasmi uning nomiga qarab avtomatik tanlanadi: yangi kategoriya
          qo&apos;shsangiz yoki nomini tuzatsangiz, mos rasm o&apos;zi chiqadi.
        </Text>

        <Text style={[Type.caption1, styles.note, { color: theme.textTertiary }]}>
          Faolsizlantirilgan kategoriya yangi buyurtmalarda ko&apos;rinmaydi, lekin eski
          buyurtmalarda nomi saqlanib qoladi. Shuning uchun ishlatilgan kategoriyani
          o&apos;chirib bo&apos;lmaydi — faqat o&apos;chirib qo&apos;yish mumkin.
        </Text>
      </ScrollView>

      {/* What the "⋯" opens. Each action is a labelled button, so neither is
          reachable by a thumb aimed at the other. */}
      <Sheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name_uz ?? ''}
        message={
          menuFor
            ? `${menuFor.orders_count ?? 0} ta buyurtma · ${menuFor.providers_count ?? 0} ta ijrochi`
            : undefined
        }
        footer={
          <>
            <Button
              label="Tahrirlash"
              icon="pencil"
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                if (target) setEditing(target);
              }}
            />
            <Button
              label="O'chirish"
              icon="trash"
              variant="danger"
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                if (target) remove(target);
              }}
            />
            <Button label="Bekor qilish" variant="ghost" onPress={() => setMenuFor(null)} />
          </>
        }
      />

      <CategorySheet
        category={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      />
    </SafeAreaView>
  );
}

/* ===================== Sheet ===================== */

interface CategoryValues {
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

/**
 * Add or correct one category.
 *
 * Only the Uzbek name is required. The other two are sent blank when the office
 * does not fill them in and the server copies the Uzbek name across: a chip with
 * no text on it is worse for a Russian-speaking customer than a chip in the
 * wrong language.
 */
function CategorySheet({
  category,
  busy,
  onClose,
  onSubmit,
}: {
  category: Category | 'new' | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryValues) => void;
}) {
  const theme = useTheme();
  const existing = category && category !== 'new' ? category : null;

  // Keyed on the id so opening a different row re-seeds the fields: without it
  // the sheet would keep whatever was typed for the previous one.
  const [nameUz, setNameUz] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = existing?.id ?? (category === 'new' ? 'new' : null);
  if (category && key !== seeded) {
    setSeeded(key);
    setNameUz(existing?.name_uz ?? '');
    setNameRu(existing?.name_ru ?? '');
    setNameEn(existing?.name_en ?? '');
    setError(null);
  }

  const submit = () => {
    if (!nameUz.trim()) {
      setError('Majburiy maydon');
      return;
    }
    onSubmit({ nameUz: nameUz.trim(), nameRu: nameRu.trim(), nameEn: nameEn.trim() });
  };

  return (
    <Sheet
      visible={!!category}
      onClose={onClose}
      title={existing ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
      message="Nomni o'zgartirish eski buyurtmalarga zarar qilmaydi — ular kategoriyaning nomini emas, o'zini saqlaydi."
      footer={
        <>
          <Button label="Saqlash" onPress={submit} loading={busy} />
          <Button label="Bekor qilish" variant="ghost" onPress={onClose} />
        </>
      }>
      <TextField
        label="Nomi (o'zbekcha)"
        value={nameUz}
        onChangeText={(v) => {
          setNameUz(v);
          setError(null);
        }}
        placeholder="Masalan: Xona tozalash"
        error={error}
      />
      <TextField
        label="Nomi (ruscha)"
        value={nameRu}
        onChangeText={setNameRu}
        placeholder="Уборка комнат"
      />
      <TextField
        label="Nomi (inglizcha)"
        value={nameEn}
        onChangeText={setNameEn}
        placeholder="Room cleaning"
      />
      <Text style={[Type.caption1, styles.sheetNote, { color: theme.textTertiary }]}>
        Ruscha va inglizcha nomlar bo&apos;sh qolsa, o&apos;zbekchasi ishlatiladi.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12, paddingBottom: 48 },
  intro: { paddingHorizontal: Layout.gutter + 4 },
  section: { marginTop: 20 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  more: { padding: 2 },
  note: { paddingHorizontal: Layout.gutter + 4, marginTop: 20 },
  sheetNote: { marginTop: 4 },
});
