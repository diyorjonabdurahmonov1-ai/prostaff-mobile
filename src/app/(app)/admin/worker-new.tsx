import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { LocationPicker } from '@/components/location-picker';
import { Button } from '@/components/ui/button';
import { SelectableChip } from '@/components/ui/chip';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { categoryName } from '@/lib/format';
import { getCoordsWithFallback } from '@/lib/location';
import type { User } from '@/lib/types';
import { TASHKENT } from '@/store/order-flow';

/** Credit granted when the worker is allowed to start with an empty wallet. */
const DEFAULT_CREDIT = 100_000;

/**
 * Open a worker account.
 *
 * Workers never sign themselves up — the office takes their details over the
 * phone and fills this in. The account is keyed on the phone number, so the
 * worker afterwards just logs in with it and the panel is already there.
 *
 * The location matters more than it looks: orders are broadcast to everyone
 * within 15 km of the job, so a worker parked at the wrong coordinates simply
 * never hears a phone ring.
 */
export default function AdminWorkerNewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { lang } = useI18n();
  // A brand-new worker only ever gets the services still on offer.
  const { activeCategories } = useCategories();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  // The passport is what the worker's three free jobs are counted against, and
  // it is unique across the platform — which is what stops a worker collecting
  // another three by being re-registered under a new number.
  const [passport, setPassport] = useState('');
  const [gmail, setGmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('');
  const [priceMin, setPriceMin] = useState('50000');
  const [priceMax, setPriceMax] = useState('150000');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lat, setLat] = useState(String(TASHKENT.lat));
  const [lng, setLng] = useState(String(TASHKENT.lng));
  const [locating, setLocating] = useState(false);
  // The public half of the record. Optional here on purpose — the office takes
  // these over the phone if it has them, and the worker can fill in the rest
  // (and their photo) from their own panel afterwards.
  const [about, setAbout] = useState('');
  const [experience, setExperience] = useState('');
  const [address, setAddress] = useState('');
  const [credit, setCredit] = useState(true);
  // Off by default: a new worker goes online themselves, from their own panel,
  // once they are actually ready to take a job.
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const useMyLocation = async () => {
    setLocating(true);
    const coords = await getCoordsWithFallback();
    setLat(String(coords.lat));
    setLng(String(coords.lng));
    setLocating(false);
    if (!coords.resolved) {
      Alert.alert('Joylashuv', "Ruxsat berilmadi — Toshkent markazi qo'yildi.");
    }
  };

  const digits = phone.replace(/\D/g, '');
  /** Two letters and seven digits — AA1234567. Checked here so a typo is caught
   *  at the field rather than by a 409 after everything else is filled in. */
  const passportValid = /^[A-Z]{2}\d{7}$/.test(passport);
  const canSubmit =
    digits.length === 9 &&
    fullName.trim().length > 0 &&
    passportValid &&
    Number(age) > 0 &&
    selected.size > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.post<User>('/admin/workers', {
        phone: `+998${digits}`,
        passport_series: passport,
        full_name: fullName.trim(),
        gmail: gmail.trim(),
        gender,
        age: Number(age),
        price_min: Number(priceMin) || 0,
        price_max: Number(priceMax) || 0,
        lat: Number(lat) || TASHKENT.lat,
        lng: Number(lng) || TASHKENT.lng,
        category_ids: Array.from(selected),
        credit_limit: credit ? DEFAULT_CREDIT : 0,
        online,
        about: about.trim(),
        experience_years: Number(experience) || 0,
        address: address.trim(),
      });
      router.replace({ pathname: '/admin/user-detail' as any, params: { id: user.id } });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === 'conflict'
            ? 'Bu raqam allaqachon ishchi sifatida ro\'yxatdan o\'tgan.'
            : // duplicate_passport / invalid_passport already say exactly what
              // is wrong, in Uzbek, so they are printed as they arrive.
              err.message
          : 'Ishchi qo\'shilmadi',
      );
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      header={<Header title="Yangi ishchi" back />}
      footer={
        <Button label="Ishchini qo'shish" onPress={submit} loading={busy} disabled={!canSubmit} />
      }>
      <View style={styles.body}>
        <Text style={[Type.footnote, styles.intro, { color: theme.textSecondary }]}>
          Ishchi shu telefon raqami bilan ilovaga kiradi. Hisob avtomatik ochiladi.
        </Text>

        <View style={styles.fields}>
          <TextField
            label="Telefon"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            prefix="+998"
            placeholder="90 123 45 67"
            hint="Ishchi shu raqam bilan tizimga kiradi"
          />
          <TextField
            label="To'liq ism"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
          />
          <TextField
            label="Passport seriyasi"
            value={passport}
            onChangeText={(v) =>
              setPassport(
                v
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 9),
              )
            }
            autoCapitalize="characters"
            placeholder="AA1234567"
            icon="reader-outline"
            hint={
              passport.length > 0 && !passportValid
                ? "Namuna: AA1234567 — 2 harf va 7 raqam"
                : "Har bir ishchi uchun yagona. 3 ta bepul ish shu raqamga bog'lanadi."
            }
          />
          <TextField
            label="Gmail (ixtiyoriy)"
            value={gmail}
            onChangeText={setGmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.group}>
            <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>JINSI</Text>
            <View style={styles.chips}>
              <SelectableChip
                label="Erkak"
                selected={gender === 'male'}
                onToggle={() => setGender('male')}
              />
              <SelectableChip
                label="Ayol"
                selected={gender === 'female'}
                onToggle={() => setGender('female')}
              />
            </View>
          </View>

          <TextField
            label="Yosh"
            value={age}
            onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            icon="calendar-outline"
          />

          <TextField
            label="Ishchi haqida (ixtiyoriy)"
            value={about}
            onChangeText={setAbout}
            multiline
            numberOfLines={3}
            placeholder="Qanday ishlarni qiladi, qancha tajribasi bor?"
            hint="Mijoz ishchini tanlashdan oldin shuni o'qiydi"
            style={styles.textArea}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextField
                label="Tajriba (yil)"
                value={experience}
                onChangeText={(v) => setExperience(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="Ish hududi"
                value={address}
                onChangeText={setAddress}
                placeholder="Chilonzor, Toshkent"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextField
                label="Eng kam narx"
                value={priceMin}
                onChangeText={(v) => setPriceMin(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="Eng yuqori narx"
                value={priceMax}
                onChangeText={(v) => setPriceMax(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.group}>
            <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
              XIZMAT TURLARI
            </Text>
            <View style={styles.chips}>
              {activeCategories.map((c) => (
                <SelectableChip
                  key={c.id}
                  label={categoryName(c, lang)}
                  selected={selected.has(c.id)}
                  onToggle={() => toggle(c.id)}
                />
              ))}
            </View>
            <Text style={[Type.caption1, styles.label, { color: theme.textTertiary }]}>
              Buyurtma faqat shu turlar bo&apos;yicha keladi — kamida bittasi kerak.
            </Text>
          </View>

          {/* Where the worker works from. Buyurtmalar shu nuqtadan 15 km
              radiusda keladi, so a wrong pin means a silent phone. */}
          <View style={styles.group}>
            <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
              ISH JOYI
            </Text>
            <YandexMap
              point={{ lat: Number(lat) || TASHKENT.lat, lng: Number(lng) || TASHKENT.lng }}
              height={220}
              caption="Xaritada o'zgartirish"
              hideOpenButton
              onPress={() => setPickerOpen(true)}
            />
            <View style={styles.locationRow}>
              <Text style={[Type.caption1, styles.label, { color: theme.textTertiary }]}>
                {`${(Number(lat) || 0).toFixed(5)}, ${(Number(lng) || 0).toFixed(5)}`}
              </Text>
              <Button
                label="Hozirgi joylashuv"
                icon="crosshair"
                variant="gray"
                size="sm"
                fullWidth={false}
                loading={locating}
                onPress={useMyLocation}
              />
            </View>
          </View>
        </View>

        <Section
          separatorInset={Layout.gutter}
          style={styles.section}
          footer="Buyurtmalar 15 km radiusdagi onlayn ishchilarga yuboriladi. Yangi ishchi hisobi bo'sh bo'lsa ham dastlabki 3 ta ishni qabul qila oladi — keyin balans talab qilinadi. Balanssiz ruxsat berilsa, bu cheklov umuman qo'llanmaydi.">
          <Row
            title="Darhol onlayn"
            right={
              <Switch
                value={online}
                onValueChange={setOnline}
                trackColor={{ true: theme.success, false: theme.fill }}
                ios_backgroundColor={theme.fill}
              />
            }
          />
          <Row
            title="Balanssiz ruxsat"
            subtitle={credit ? "Limit: 100 000 so'm" : undefined}
            right={
              <Switch
                value={credit}
                onValueChange={setCredit}
                trackColor={{ true: theme.success, false: theme.fill }}
                ios_backgroundColor={theme.fill}
              />
            }
          />
        </Section>

        {error ? (
          <Text style={[Type.footnote, styles.error, { color: theme.danger }]}>{error}</Text>
        ) : null}
      </View>

      <LocationPicker
        visible={pickerOpen}
        point={{ lat: Number(lat) || TASHKENT.lat, lng: Number(lng) || TASHKENT.lng }}
        onClose={() => setPickerOpen(false)}
        onConfirm={(p) => {
          setLat(String(p.lat));
          setLng(String(p.lng));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 12, paddingBottom: 24, gap: 4 },
  intro: { paddingHorizontal: Layout.gutter, paddingBottom: 12 },
  fields: { gap: 20, paddingHorizontal: Layout.gutter },
  group: { gap: 10 },
  label: { paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  section: { marginTop: 28 },
  error: { textAlign: 'center', marginTop: 16, paddingHorizontal: Layout.gutter },
});
