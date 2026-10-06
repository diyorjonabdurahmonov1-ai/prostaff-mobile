import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { Sheet } from '@/components/ui/sheet';
import { TextField } from '@/components/ui/text-field';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import type {
  AdminPayment,
  AdminSubscription,
  PaymentTotals,
  SubscriptionPlan,
  SubscriptionTotals,
} from '@/lib/types';

interface HistoryResponse {
  subscriptions: AdminSubscription[];
  totals: SubscriptionTotals;
}

interface PaymentsResponse {
  payments: AdminPayment[];
  totals: PaymentTotals;
}

/**
 * The payment log's two readings.
 *
 * "Muammoli" is the one the office actually opens this for: every failure, plus
 * anything that settled with a note on it. Hunting for those by eye through a
 * list of successes is how a firm's complaint goes unanswered for a week.
 */
type PaymentFilter = 'problem' | '';

/** How a stored status reads, and what colour it earns. */
const PAYMENT_STATUS: Record<string, string> = {
  pending: 'Kutilmoqda',
  success: "To'landi",
  completed: "To'landi",
  canceled: 'Bekor qilindi',
  failed: 'Xato',
};

/**
 * Tariffs, and who has bought them.
 *
 * The two belong on one screen because they answer the same question from
 * either end: what a firm can buy, and what firms actually bought. Editing a
 * price here does not touch the history below it — what a firm paid is copied
 * onto its purchase row the day it pays, precisely so re-pricing a card cannot
 * rewrite last month.
 *
 * The plans differ in length and nothing else. Every subscribed firm gets the
 * same platform, so there is no feature list to maintain — only a term and a
 * price, and a longer term costing less per month is the whole offer.
 */
export default function AdminPlansScreen() {
  const theme = useTheme();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [history, setHistory] = useState<AdminSubscription[]>([]);
  const [totals, setTotals] = useState<SubscriptionTotals | null>(null);
  /**
   * When the history was read, so "Faol / Tugagan" is decided against one
   * instant rather than re-read from the clock on every re-render.
   */
  const [loadedAt, setLoadedAt] = useState(0);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentTotals, setPaymentTotals] = useState<PaymentTotals | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('problem');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** null = closed, 'new' = create, otherwise the plan being edited. */
  const [editing, setEditing] = useState<SubscriptionPlan | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, h, pay] = await Promise.all([
        api.get<SubscriptionPlan[]>('/admin/subscription-plans'),
        api.get<HistoryResponse>('/admin/subscriptions'),
        api.get<PaymentsResponse>(
          `/admin/payments${paymentFilter ? `?status=${paymentFilter}` : ''}`,
        ),
      ]);
      setPlans(p ?? []);
      setHistory(h?.subscriptions ?? []);
      setTotals(h?.totals ?? null);
      setPayments(pay?.payments ?? []);
      setPaymentTotals(pay?.totals ?? null);
      setLoadedAt(Date.now());
    } catch {
      // keep whatever is on screen; pull-to-refresh is right there
    } finally {
      setLoading(false);
    }
  }, [paymentFilter]);

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
      } catch (err) {
        Alert.alert('Xatolik', err instanceof Error ? err.message : 'Amal bajarilmadi');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const toggle = (plan: SubscriptionPlan) =>
    run(() => api.patch(`/admin/subscription-plans/${plan.id}`, { active: !plan.active }));

  const remove = (plan: SubscriptionPlan) => {
    Alert.alert(
      "Tarifni o'chirish",
      `${plan.title || `${plan.months} oy`} tarifi o'chiriladi. Sotilgan obunalarga ta'sir qilmaydi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: () =>
            run(() => api.del(`/admin/subscription-plans/${plan.id}`)).then(() => setEditing(null)),
        },
      ],
    );
  };

  const submit = (values: PlanValues) => {
    const body = {
      months: values.months,
      price: values.price,
      old_price: values.oldPrice,
      title: values.title,
      sort: values.months,
    };
    const request =
      editing === 'new' || editing === null
        ? () => api.post('/admin/subscription-plans', body)
        : () => api.patch(`/admin/subscription-plans/${editing.id}`, body);
    return run(request).then(() => setEditing(null));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header title="Tariflar va to'lovlar" large back />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        {/* The money, and the firms somebody should be ringing this week. */}
        <View style={styles.stats}>
          <StatTile
            label="Sotilgan"
            value={formatSom(totals?.sold ?? 0)}
            hint={`${totals?.count ?? 0} ta to'lov`}
            tint={theme.success}
          />
          <StatTile
            label="Faol obuna"
            value={String(totals?.active_firms ?? 0)}
            hint={`${totals?.expiring_firms ?? 0} tasi tugayapti`}
            tint={theme.primary}
          />
        </View>

        {/* ---- The cards a firm chooses between ---- */}
        <Section
          header="Tarif kartalari"
          style={styles.section}
          footer="Tariflar imkoniyatlari bir xil — faqat muddat va narx bilan farq qiladi. Muddat uzunroq bo'lsa, oylik to'lov arzonroq.">
          {plans.length === 0 ? (
            <Row
              stacked
              title={loading ? 'Yuklanmoqda…' : 'Tarif yo’q'}
              value={
                loading
                  ? undefined
                  : "Firma ilovada obunani rasmiylashtira olmaydi. Quyida tarif qo'shing."
              }
            />
          ) : (
            plans.map((plan) => (
              <Row
                key={plan.id}
                title={plan.title || `${plan.months} oy`}
                subtitle={`${formatSom(plan.price)} so'm · oyiga ${formatSom(plan.per_month)} so'm${
                  plan.discount_percent > 0 ? ` · −${plan.discount_percent}%` : ''
                }`}
                onPress={() => setEditing(plan)}
                right={
                  <Switch
                    value={plan.active}
                    onValueChange={() => toggle(plan)}
                    disabled={busy}
                    trackColor={{ true: theme.success, false: theme.fill }}
                    ios_backgroundColor={theme.fill}
                  />
                }
              />
            ))
          )}
        </Section>

        <View style={styles.actions}>
          <Button label="Tarif qo'shish" icon="plus" onPress={() => setEditing('new')} />
        </View>

        {/* ---- Who bought what ---- */}
        <Section
          header="Sotib olingan obunalar"
          style={styles.section}
          footer="Har bir to'lovda o'sha kungi narx saqlanadi — tarif narxini o'zgartirsangiz, tarix o'zgarmaydi.">
          {history.length === 0 ? (
            <Row title={loading ? 'Yuklanmoqda…' : 'Hozircha obuna sotilmagan'} />
          ) : (
            history.map((sub) => {
              const ends = new Date(sub.ends_at);
              const live = ends.getTime() > loadedAt;
              return (
                <Row
                  key={sub.id}
                  title={sub.company_name || '—'}
                  subtitle={`${sub.months} oy · ${formatSom(sub.amount)} so'm${
                    sub.discount_percent > 0 ? ` · −${sub.discount_percent}%` : ''
                  }\n${new Date(sub.created_at).toLocaleDateString()} → ${ends.toLocaleDateString()}`}
                  value={live ? 'Faol' : 'Tugagan'}
                />
              );
            })
          )}
        </Section>

        {/* ---- Every payment attempt, including the ones that failed ---- */}
        <Section
          header="To'lovlar"
          style={styles.section}
          footer="Xatolik matni to'lov tizimidan kelgan javob asosida yoziladi. Muammoli to'lov bo'yicha firmaga qo'ng'iroq qilish kerak bo'lishi mumkin.">
          <Row
            title="Faqat muammolilar"
            subtitle={
              paymentTotals
                ? `${paymentTotals.problems} ta muammo · ${paymentTotals.failed} ta xato · ${paymentTotals.pending} ta kutilmoqda`
                : undefined
            }
            right={
              <Switch
                value={paymentFilter === 'problem'}
                onValueChange={(on) => setPaymentFilter(on ? 'problem' : '')}
                trackColor={{ true: theme.success, false: theme.fill }}
                ios_backgroundColor={theme.fill}
              />
            }
          />
          {payments.length === 0 ? (
            <Row
              title={
                loading
                  ? 'Yuklanmoqda…'
                  : paymentFilter === 'problem'
                    ? "Muammoli to'lov yo'q"
                    : "To'lov yo'q"
              }
            />
          ) : (
            payments.map((pay) => (
              <Row
                key={pay.id}
                stacked={!!pay.error}
                title={pay.company_name || pay.user_name || pay.user_phone || '—'}
                subtitle={`${
                  pay.purpose === 'subscription'
                    ? `Obuna${pay.months ? ` · ${pay.months} oy` : ''}`
                    : 'Hamyon'
                } · ${formatSom(pay.amount)} so'm · ${PAYMENT_STATUS[pay.status] ?? pay.status}\n${new Date(
                  pay.created_at,
                ).toLocaleString()}`}
                // The whole point of the log: what went wrong, in words, where
                // somebody answering the phone can read it.
                value={pay.error || undefined}
              />
            ))
          )}
        </Section>
      </ScrollView>

      <PlanSheet
        plan={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        onDelete={editing && editing !== 'new' ? () => remove(editing) : undefined}
      />
    </SafeAreaView>
  );
}

/* ===================== Sheet ===================== */

interface PlanValues {
  months: number;
  price: number;
  oldPrice: number;
  title: string;
}

/**
 * Add or correct one card.
 *
 * "Eski narx" is the struck-through figure and nothing else — it is never
 * charged, and the discount badge is computed from the gap between the two.
 */
function PlanSheet({
  plan,
  busy,
  onClose,
  onSubmit,
  onDelete,
}: {
  plan: SubscriptionPlan | 'new' | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: PlanValues) => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const existing = plan && plan !== 'new' ? plan : null;

  // Keyed on the plan id so opening a different card re-seeds the fields:
  // without it the sheet would keep whatever was typed for the previous one.
  const [months, setMonths] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [title, setTitle] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = existing?.id ?? (plan === 'new' ? 'new' : null);
  if (plan && key !== seeded) {
    setSeeded(key);
    setMonths(existing ? String(existing.months) : '');
    setPrice(existing ? String(existing.price) : '');
    setOldPrice(existing?.old_price ? String(existing.old_price) : '');
    setTitle(existing?.title ?? '');
  }

  const parsedMonths = Number(months.replace(/\D/g, ''));
  const parsedPrice = Number(price.replace(/\D/g, ''));
  const parsedOld = Number(oldPrice.replace(/\D/g, ''));
  const perMonth = parsedMonths > 0 ? Math.round(parsedPrice / parsedMonths) : 0;
  const discount =
    parsedOld > parsedPrice && parsedOld > 0
      ? Math.round(((parsedOld - parsedPrice) / parsedOld) * 100)
      : 0;
  const valid = parsedMonths > 0 && parsedPrice > 0;

  return (
    <Sheet
      visible={!!plan}
      onClose={onClose}
      title={existing ? 'Tarifni tahrirlash' : 'Yangi tarif'}
      message="Muddat va narx. Tariflar imkoniyatlari bir xil, shuning uchun boshqa sozlama yo'q."
      footer={
        <>
          <Button
            label={valid ? `${parsedMonths} oy · ${formatSom(parsedPrice)} so'm` : 'Ma’lumot kiriting'}
            onPress={() => onSubmit({ months: parsedMonths, price: parsedPrice, oldPrice: parsedOld, title: title.trim() })}
            loading={busy}
            disabled={!valid}
          />
          {onDelete ? (
            <Button label="O'chirish" variant="danger" onPress={onDelete} />
          ) : null}
          <Button label="Bekor qilish" variant="ghost" onPress={onClose} />
        </>
      }>
      <TextField
        label="Necha oy"
        value={months}
        onChangeText={(v) => setMonths(v.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        icon="calendar-outline"
      />
      <TextField
        label="Narx (butun muddat uchun)"
        value={price}
        onChangeText={(v) => setPrice(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        icon="cash-outline"
        hint={perMonth > 0 ? `Oyiga ${formatSom(perMonth)} so'm` : undefined}
      />
      <TextField
        label="Eski narx (ixtiyoriy)"
        value={oldPrice}
        onChangeText={(v) => setOldPrice(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        icon="pricetag"
        hint={
          discount > 0
            ? `Kartada −${discount}% chegirma ko'rinadi`
            : "Kartada chizib tashlangan holda ko'rinadi"
        }
      />
      <TextField
        label="Nomi (ixtiyoriy)"
        value={title}
        onChangeText={setTitle}
        placeholder="Masalan: Yillik"
      />
      <Text style={[Type.caption1, styles.sheetNote, { color: theme.textTertiary }]}>
        Narxni o&apos;zgartirsangiz, allaqachon sotilgan obunalar o&apos;zgarmaydi.
      </Text>
    </Sheet>
  );
}

/* ===================== Bits ===================== */

function StatTile({
  label,
  value,
  hint,
  tint,
}: {
  label: string;
  value: string;
  hint: string;
  tint: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, Squircle, { backgroundColor: theme.surface }]}>
      <Text style={[Type.footnote, { color: tint }]}>{label}</Text>
      <Text style={[Type.title2, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12, paddingBottom: 48 },
  stats: { flexDirection: 'row', gap: 12, paddingHorizontal: Layout.gutter },
  tile: { flex: 1, borderRadius: Radius.card, padding: 16, gap: 2 },
  section: { marginTop: 28 },
  actions: { paddingHorizontal: Layout.gutter, marginTop: 16 },
  sheetNote: { marginTop: 4 },
});
