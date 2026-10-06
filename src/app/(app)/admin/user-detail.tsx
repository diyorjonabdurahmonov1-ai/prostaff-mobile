import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { Sheet } from '@/components/ui/sheet';
import { TextField } from '@/components/ui/text-field';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import type { Role, User } from '@/lib/types';

/** Credit granted when "balanssiz ruxsat" is switched on. */
const DEFAULT_CREDIT = 100_000;

const ROLE_LABELS: Record<Role, string> = {
  customer: 'Mijoz',
  worker: 'Ishchi',
  company: 'Firma',
  admin: 'Admin',
};

type SheetKind = 'roles' | 'message' | 'balance' | 'subscription' | null;

export default function AdminUserDetailScreen() {
  const t = useT();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const load = useCallback(async () => {
    try {
      setUser(await api.get<User>(`/admin/users/${id}`));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshControl } = useRefresh(load);

  /** Runs an admin mutation, then re-reads the user so the UI shows truth. */
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <Header title="Foydalanuvchi" back />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <Header title="Foydalanuvchi" back />
        <EmptyState icon="person-outline" title="Foydalanuvchi topilmadi" />
      </SafeAreaView>
    );
  }

  const wp = user.worker_profile;
  const cp = user.company_profile;
  const name = user.name || wp?.full_name || cp?.name || user.phone;
  const hasCredit = (wp?.credit_limit ?? user.wallet?.credit_limit ?? 0) > 0;

  const role: { label: string; tone: BadgeTone } = user.roles.includes('admin')
    ? { label: 'Admin', tone: 'warning' }
    : user.roles.includes('worker')
      ? { label: t('profile.mode.worker'), tone: 'primary' }
      : user.roles.includes('company')
        ? { label: t('profile.mode.company'), tone: 'success' }
        : { label: t('profile.mode.customer'), tone: 'neutral' };

  /* ---- actions ---- */

  const toggleRole = (r: Role) =>
    run(() =>
      api.post(`/admin/users/${user.id}/roles`, {
        role: r,
        action: user.roles.includes(r) ? 'remove' : 'add',
      }),
    );

  const setWorkerOnline = (online: boolean) =>
    run(() => api.post(`/admin/workers/${user.id}/status`, { online }));

  const setCompanyOnline = (online: boolean) =>
    run(() => api.post(`/admin/companies/${cp!.id}/status`, { online }));

  // The user-level endpoint works for companies too, not just workers.
  const toggleCredit = (allow: boolean) =>
    run(() =>
      api.post(`/admin/users/${user.id}/credit-limit`, { amount: allow ? DEFAULT_CREDIT : 0 }),
    );

  const toggleWorkerBan = () =>
    run(() => api.post(`/admin/workers/${user.id}/${wp!.banned ? 'unban' : 'ban'}`));

  const toggleCompanyBan = () =>
    run(() => api.post(`/admin/companies/${cp!.id}/${cp!.banned ? 'unban' : 'ban'}`));

  /**
   * Hands the three free jobs back.
   *
   * The counter deliberately survives a profile being deleted and re-created —
   * that is what keeps it three per person — so an honest mistake (a trial
   * spent on a test order) has no way back except this. Confirmed, because it
   * is giving away work.
   */
  const resetFreeOrders = (role: 'worker' | 'company') => {
    Alert.alert(
      'Bepul ishlarni tiklash',
      role === 'worker'
        ? `${name} yana ${wp?.free_orders_limit ?? 3} ta ishni balanssiz qabul qila oladi. Davom etasizmi?`
        : `${name} yana ${cp?.free_orders_limit ?? 3} ta buyurtmani obunasiz qabul qila oladi. Davom etasizmi?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Tiklash',
          onPress: () =>
            run(() => api.post(`/admin/users/${user.id}/free-orders`, { role, used: 0 })),
        },
      ],
    );
  };

  const toggleActive = () => {
    const blocking = user.active;
    Alert.alert(
      blocking ? 'Bloklash' : 'Blokdan chiqarish',
      blocking
        ? `${name} ilovadan foydalana olmaydi. Davom etasizmi?`
        : `${name} yana ilovadan foydalana oladi.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: blocking ? 'Bloklash' : 'Ochish',
          style: blocking ? 'destructive' : 'default',
          onPress: () => run(() => api.patch(`/admin/users/${user.id}`, { active: !blocking })),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header title="Foydalanuvchi" back />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        {/* Hero. A provider's own photo wins over the account avatar: this
            screen is where an admin checks what customers are being shown. */}
        <View style={styles.hero}>
          <Avatar
            name={name}
            imageUrl={wp?.avatar_url || cp?.avatar_url || user.avatar_url}
            size={88}
          />
          <Text style={[Type.title1, styles.centerText, { color: theme.text }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[Type.subhead, { color: theme.textSecondary }]}>
            {user.gmail || user.phone}
          </Text>
          <View style={styles.badges}>
            {user.roles.map((r) => (
              <Badge key={r} label={ROLE_LABELS[r] ?? r} tone={r === role.label ? role.tone : 'neutral'} />
            ))}
            {!user.active ? <Badge label="Bloklangan" tone="danger" /> : null}
          </View>
        </View>

        {/* Identity */}
        <Section header="Ma'lumotlar">
          <Row title={t('order.phone')} value={user.phone} />
          {user.gmail ? <Row title="Gmail" value={user.gmail} /> : null}
          {/* The document the account was opened against. Shown to the office
              and nobody else — it is what the free jobs are counted under, so
              an admin checking "why does this worker have no trial left" needs
              to be able to read it. */}
          {wp ? <Row title="Passport seriyasi" value={wp.passport_series || '—'} /> : null}
          {cp ? <Row title="INN" value={cp.inn || '—'} /> : null}
          <Row title={t('order.created')} value={new Date(user.created_at).toLocaleDateString()} />
          {wp ? (
            <Row
              title={t('workerDetail.gender')}
              value={`${wp.gender === 'male' ? t('order.male') : t('order.female')}, ${wp.age}`}
            />
          ) : null}
          {wp ? (
            <Row
              title={t('worker.myPrices')}
              value={`${formatSom(wp.price_min)} – ${formatSom(wp.price_max)}`}
            />
          ) : null}
          {wp ? <Row title="Manzil" value={`${wp.lat.toFixed(3)}, ${wp.lng.toFixed(3)}`} /> : null}
          {cp ? (
            <Row
              title="Manzil"
              value={cp.lat || cp.lng ? `${cp.lat.toFixed(3)}, ${cp.lng.toFixed(3)}` : '—'}
            />
          ) : null}
          <Row
            title={t('profile.balance')}
            value={`${formatSom(user.wallet?.balance ?? 0)} ${t('common.som')}`}
          />
          <Row
            title={t('worker.rating')}
            value={
              wp
                ? `${wp.rating.toFixed(1)} (${wp.ratings_count})`
                : cp
                  ? `${cp.rating.toFixed(1)} (${cp.ratings_count})`
                  : '—'
            }
          />
        </Section>

        {/* The public profile, exactly as a customer reads it. Empty fields are
            shown as "—" so an admin can see what still needs filling in. */}
        {wp || cp ? (
          <Section header={t('worker.publicProfile')} style={styles.section}>
            <Row title={t('worker.photo')} value={wp?.avatar_url || cp?.avatar_url ? '✓' : '—'} />
            {wp ? (
              <>
                <Row stacked title={t('worker.about')} value={wp.about || '—'} />
                <Row
                  title={t('workerDetail.experience')}
                  value={
                    wp.experience_years
                      ? `${wp.experience_years} ${t('workerDetail.years')}`
                      : '—'
                  }
                />
                <Row title={t('workerDetail.address')} value={wp.address || '—'} />
                <Row title={t('workerDetail.works')} value={String(wp.images?.length ?? 0)} />
              </>
            ) : null}
            {cp ? (
              <>
                <Row stacked title={t('company.description')} value={cp.description || '—'} />
                <Row title={t('companyDetail.address')} value={cp.address || '—'} />
                <Row title={t('companyDetail.workingHours')} value={cp.working_hours || '—'} />
                <Row
                  title={t('companyDetail.employees')}
                  value={cp.employees_count ? String(cp.employees_count) : '—'}
                />
                <Row
                  title={t('companyDetail.experience')}
                  value={
                    cp.experience_years
                      ? `${cp.experience_years} ${t('workerDetail.years')}`
                      : '—'
                  }
                />
                {/* What the firm typed; a firm from before the field shows the
                    count of the categories it ticked instead. */}
                <Row
                  stacked
                  title={t('companyDetail.services')}
                  value={
                    cp.services?.trim() ||
                    (cp.category_ids?.length ? String(cp.category_ids.length) : '—')
                  }
                />
                {cp.email ? <Row title={t('companyDetail.email')} value={cp.email} /> : null}
                {cp.website ? <Row title={t('companyDetail.website')} value={cp.website} /> : null}
                <Row title={t('companyDetail.gallery')} value={String(cp.images?.length ?? 0)} />
              </>
            ) : null}
          </Section>
        ) : null}

        {/* The photos themselves, not just a count. */}
        <PhotoGallery
          uris={wp?.images ?? cp?.images}
          header={wp ? t('workerDetail.works') : t('companyDetail.gallery')}
        />

        {wp ? (
          <View style={styles.stats}>
            <StatTile value={String(wp.ratings_count)} label={t('status.completed')} />
            <StatTile value={wp.rating.toFixed(1)} label={t('worker.rating')} />
            <StatTile
              value={wp.online ? t('common.online') : t('common.offline')}
              label="Holati"
              tint={wp.online ? theme.success : theme.textSecondary}
            />
          </View>
        ) : null}

        {/* Worker controls */}
        {wp ? (
          <Section
            header="Ishchi nazorati"
            separatorInset={Row.ICON_INSET}
            style={styles.section}
            footer="Onlayn holatni admin ham o'zgartira oladi. Balanssiz ruxsat berilsa, ishchi hisobida pul bo'lmasa ham buyurtma qabul qila oladi.">
            <Row
              icon={wp.online ? 'radio' : 'moon'}
              iconColor={wp.online ? theme.success : theme.textMuted}
              title="Onlayn"
              right={
                <Switch
                  value={wp.online}
                  onValueChange={setWorkerOnline}
                  disabled={busy}
                  trackColor={{ true: theme.success, false: theme.fill }}
                  ios_backgroundColor={theme.fill}
                />
              }
            />
            <Row
              icon="shield-checkmark"
              iconColor="#007AFF"
              title="Balanssiz ruxsat"
              subtitle={hasCredit ? `Limit: ${formatSom(wp.credit_limit)} so'm` : undefined}
              right={
                <Switch
                  value={hasCredit}
                  onValueChange={toggleCredit}
                  disabled={busy}
                  trackColor={{ true: theme.success, false: theme.fill }}
                  ios_backgroundColor={theme.fill}
                />
              }
            />
            <Row
              icon="sparkle"
              iconColor="#AF52DE"
              title="Bepul ishlar"
              subtitle="Passport seriyasi bo'yicha hisoblanadi"
              value={`${freeLeft(wp)} / ${wp.free_orders_limit}`}
              onPress={() => resetFreeOrders('worker')}
              disabled={busy}
            />
            <Row
              icon={wp.banned ? 'lock-open' : 'ban'}
              iconColor={wp.banned ? theme.success : theme.danger}
              title={wp.banned ? 'Ishchini blokdan chiqarish' : 'Ishchini bloklash'}
              onPress={toggleWorkerBan}
              disabled={busy}
            />
          </Section>
        ) : null}

        {/* Company controls */}
        {cp ? (
          <Section
            header="Firma nazorati"
            separatorInset={Row.ICON_INSET}
            style={styles.section}
            footer="Faqat onlayn firmalar xizmat ko'rsatish ro'yxatida ko'rinadi. Firma komissiya emas, oylik to'lov to'laydi — obuna tugagach yangi buyurtma qabul qila olmaydi.">
            <Row
              icon={cp.online ? 'radio' : 'moon'}
              iconColor={cp.online ? theme.success : theme.textMuted}
              title="Onlayn"
              right={
                <Switch
                  value={cp.online}
                  onValueChange={setCompanyOnline}
                  disabled={busy}
                  trackColor={{ true: theme.success, false: theme.fill }}
                  ios_backgroundColor={theme.fill}
                />
              }
            />
            <Row title="Xizmat haqi" value={`${formatSom(cp.price)} ${t('common.som')}`} />
            {/* A firm's account is months, not a balance. This is where they
                are sold, and where an admin reads how many are left. */}
            <Row
              icon={cp.subscription_active ? 'checkmark-circle' : 'warning'}
              iconColor={cp.subscription_active ? theme.success : theme.warning}
              title="Obuna"
              subtitle={
                cp.subscription_until
                  ? `Tugash sanasi: ${new Date(cp.subscription_until).toLocaleDateString()}`
                  : 'Hali rasmiylashtirilmagan'
              }
              value={
                cp.subscription_active
                  ? `${cp.subscription_days_left} kun`
                  : cp.subscription_until
                    ? 'Tugagan'
                    : '—'
              }
              onPress={() => setSheet('subscription')}
              disabled={busy}
            />
            <Row
              icon="sparkle"
              iconColor="#AF52DE"
              title="Bepul buyurtmalar"
              subtitle="INN bo'yicha hisoblanadi"
              value={`${freeLeft(cp)} / ${cp.free_orders_limit}`}
              onPress={() => resetFreeOrders('company')}
              disabled={busy}
            />
            <Row
              icon="shield-checkmark"
              iconColor="#007AFF"
              title="Balanssiz ruxsat"
              right={
                <Switch
                  value={hasCredit}
                  onValueChange={toggleCredit}
                  disabled={busy}
                  trackColor={{ true: theme.success, false: theme.fill }}
                  ios_backgroundColor={theme.fill}
                />
              }
            />
            <Row
              icon={cp.banned ? 'lock-open' : 'ban'}
              iconColor={cp.banned ? theme.success : theme.danger}
              title={cp.banned ? 'Firmani blokdan chiqarish' : 'Firmani bloklash'}
              onPress={toggleCompanyBan}
              disabled={busy}
            />
          </Section>
        ) : null}

        {/* Universal admin actions */}
        <Section header="Admin amallari" separatorInset={Row.ICON_INSET} style={styles.section}>
          <Row
            icon="ribbon"
            iconColor="#5E5CE6"
            title="Rollar"
            value={user.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
            onPress={() => setSheet('roles')}
          />
          <Row
            icon="chatbubble"
            iconColor="#34C759"
            title="Xabar yuborish"
            onPress={() => setSheet('message')}
          />
          <Row
            icon="cash"
            iconColor="#FF9500"
            title="Balans qo'shish"
            value={`${formatSom(user.wallet?.balance ?? 0)}`}
            onPress={() => setSheet('balance')}
          />
        </Section>

        <Section style={styles.section}>
          <Row
            title={user.active ? 'Bloklash' : 'Blokdan chiqarish'}
            tone={user.active ? 'danger' : 'primary'}
            centered
            onPress={toggleActive}
            disabled={busy}
          />
        </Section>
      </ScrollView>

      <RolesSheet
        visible={sheet === 'roles'}
        onClose={() => setSheet(null)}
        roles={user.roles}
        busy={busy}
        onToggle={toggleRole}
      />
      <MessageSheet
        visible={sheet === 'message'}
        onClose={() => setSheet(null)}
        onSend={(title, body) =>
          run(() => api.post(`/admin/users/${user.id}/push`, { title, body })).then(() =>
            setSheet(null),
          )
        }
        busy={busy}
      />
      <SubscriptionSheet
        visible={sheet === 'subscription'}
        onClose={() => setSheet(null)}
        until={cp?.subscription_until}
        onSubmit={(months, pricePerMonth, discount) =>
          run(() =>
            api.post(`/admin/companies/${cp!.id}/subscription`, {
              months,
              // Left out when the office is charging the standard rate, so the
              // platform price stays the single source of it.
              ...(pricePerMonth > 0 ? { price_per_month: pricePerMonth } : {}),
              ...(discount > 0 ? { discount_percent: discount } : {}),
            }),
          ).then(() => setSheet(null))
        }
        busy={busy}
      />
      <BalanceSheet
        visible={sheet === 'balance'}
        onClose={() => setSheet(null)}
        current={user.wallet?.balance ?? 0}
        onSubmit={(amount) =>
          run(() => api.post(`/admin/users/${user.id}/balance`, { amount })).then(() =>
            setSheet(null),
          )
        }
        busy={busy}
      />
    </SafeAreaView>
  );
}

/* ===================== Sheets ===================== */

const ASSIGNABLE: Role[] = ['customer', 'worker', 'company', 'admin'];

function RolesSheet({
  visible,
  onClose,
  roles,
  busy,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  roles: Role[];
  busy: boolean;
  onToggle: (role: Role) => void;
}) {
  const theme = useTheme();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Rollar"
      message="Foydalanuvchiga rol berish yoki olib tashlash."
      footer={<Button label="Yopish" variant="gray" onPress={onClose} />}>
      <Section inset={0} separatorInset={Layout.gutter}>
        {ASSIGNABLE.map((role) => (
          <Row
            key={role}
            title={ROLE_LABELS[role]}
            right={
              <Switch
                value={roles.includes(role)}
                onValueChange={() => onToggle(role)}
                disabled={busy}
                trackColor={{ true: theme.success, false: theme.fill }}
                ios_backgroundColor={theme.fill}
              />
            }
          />
        ))}
      </Section>
    </Sheet>
  );
}

function MessageSheet({
  visible,
  onClose,
  onSend,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (title: string, body: string) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const send = () => {
    onSend(title.trim() || 'PROSTAFF', body.trim());
    setTitle('');
    setBody('');
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Xabar yuborish"
      message="Xabar foydalanuvchining bildirishnomalariga darhol yetib boradi."
      footer={
        <>
          <Button label="Yuborish" onPress={send} loading={busy} disabled={!body.trim()} />
          <Button label="Bekor qilish" variant="ghost" onPress={onClose} />
        </>
      }>
      <TextField label="Sarlavha" value={title} onChangeText={setTitle} placeholder="PROSTAFF" />
      <TextField
        label="Matn"
        value={body}
        onChangeText={setBody}
        placeholder="Xabar matnini yozing…"
        multiline
        numberOfLines={4}
      />
    </Sheet>
  );
}

const QUICK_AMOUNTS = [10_000, 50_000, 100_000, 500_000];

function BalanceSheet({
  visible,
  onClose,
  current,
  onSubmit,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  current: number;
  onSubmit: (amount: number) => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState('');
  const parsed = Number(amount.replace(/\D/g, ''));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Balans qo'shish"
      message={`Joriy balans: ${formatSom(current)} so'm`}
      footer={
        <>
          <Button
            label={parsed > 0 ? `+${formatSom(parsed)} so'm qo'shish` : "Miqdorni kiriting"}
            onPress={() => {
              onSubmit(parsed);
              setAmount('');
            }}
            loading={busy}
            disabled={parsed <= 0}
          />
          <Button label="Bekor qilish" variant="ghost" onPress={onClose} />
        </>
      }>
      <TextField
        label="Miqdor"
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="0"
        icon="cash-outline"
      />
      <View style={styles.quick}>
        {QUICK_AMOUNTS.map((value) => (
          <Button
            key={value}
            label={formatSom(value)}
            variant="gray"
            size="sm"
            fullWidth={false}
            onPress={() => setAmount(String(value))}
          />
        ))}
      </View>
    </Sheet>
  );
}

const QUICK_MONTHS = [1, 3, 6, 12];

/**
 * Selling a firm months.
 *
 * Price and discount are left blank for the usual case — the platform price
 * applies and nothing has to be typed. Filling them in is how the office gives
 * one firm a deal without moving the price for everybody, and both are stored
 * on the payment, so what this firm paid today survives a later price change.
 */
function SubscriptionSheet({
  visible,
  onClose,
  until,
  onSubmit,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  until?: string;
  onSubmit: (months: number, pricePerMonth: number, discount: number) => void;
  busy: boolean;
}) {
  const [months, setMonths] = useState('1');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');

  const parsedMonths = Number(months.replace(/\D/g, ''));
  const parsedPrice = Number(price.replace(/\D/g, ''));
  const parsedDiscount = Math.min(Number(discount.replace(/\D/g, '')) || 0, 100);
  const total = parsedPrice > 0 ? Math.round((parsedPrice * parsedMonths * (100 - parsedDiscount)) / 100) : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Obunani uzaytirish"
      message={
        until
          ? `Joriy muddat: ${new Date(until).toLocaleDateString()} — yangi oylar shu sanadan qo'shiladi.`
          : 'Firma hali obuna rasmiylashtirmagan. Muddat bugundan boshlanadi.'
      }
      footer={
        <>
          <Button
            label={
              parsedMonths > 0
                ? total > 0
                  ? `${parsedMonths} oy · ${formatSom(total)} so'm`
                  : `${parsedMonths} oyga uzaytirish`
                : 'Oy sonini kiriting'
            }
            onPress={() => onSubmit(parsedMonths, parsedPrice, parsedDiscount)}
            loading={busy}
            disabled={parsedMonths <= 0}
          />
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
      <View style={styles.quick}>
        {QUICK_MONTHS.map((value) => (
          <Button
            key={value}
            label={`${value} oy`}
            variant="gray"
            size="sm"
            fullWidth={false}
            onPress={() => setMonths(String(value))}
          />
        ))}
      </View>
      <TextField
        label="Oylik narx (ixtiyoriy)"
        value={price}
        onChangeText={(v) => setPrice(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder="Umumiy narx qo'llanadi"
        icon="cash-outline"
      />
      <TextField
        label="Chegirma % (ixtiyoriy)"
        value={discount}
        onChangeText={(v) => setDiscount(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        placeholder="0"
        icon="pricetag"
      />
    </Sheet>
  );
}

/* ===================== Bits ===================== */

/** Trial jobs still in hand, never negative. */
function freeLeft(profile: { free_orders_used: number; free_orders_limit: number }): number {
  return Math.max(profile.free_orders_limit - profile.free_orders_used, 0);
}

function StatTile({ value, label, tint }: { value: string; label: string; tint?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, Squircle, { backgroundColor: theme.surface }]}>
      <Text style={[Type.title3, { color: tint ?? theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  centerText: { textAlign: 'center' },

  hero: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    paddingBottom: 24,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 2 },

  stats: { flexDirection: 'row', gap: 12, marginTop: 28, paddingHorizontal: Layout.gutter },
  statTile: {
    flex: 1,
    borderRadius: Radius.card,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 1,
  },

  section: { marginTop: 28 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
