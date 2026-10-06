import { Text } from '@/components/text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { LocationPicker } from '@/components/location-picker';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api } from '@/lib/api';
import { getCoordsWithFallback } from '@/lib/location';
import type { User } from '@/lib/types';
import { TASHKENT } from '@/store/order-flow';

/** Credit granted when the company is allowed to start with an empty wallet. */
const DEFAULT_CREDIT = 100_000;

/**
 * Open a company account.
 *
 * Same rule as workers: the office fills this in, the company signs in with the
 * phone number afterwards. Unlike workers, a company is never broadcast to — a
 * customer picks it from the list and orders at the published price, so that
 * price has to be right here.
 *
 * The record is the same shape as a worker's for the same reason: a firm with no
 * pin drops to the bottom of the nearby list.
 */
export default function AdminCompanyNewScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [gmail, setGmail] = useState('');
  // The firm on paper. Unique across the platform, and the key its three free
  // orders are counted against — the company-side twin of a worker's passport.
  const [inn, setInn] = useState('');
  // Months bought at the counter. Left at zero the firm starts on its free
  // orders, which is what the office wants for a trial.
  const [months, setMonths] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  // What the firm does, typed in rather than picked from the category list.
  // Optional: the office often opens the account off a phone call and the firm
  // writes this itself later, from its own panel.
  const [services, setServices] = useState('');
  // What a customer reads on the firm's page. Optional here — the firm can
  // finish its own profile (logo, gallery) from the panel after signing in.
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [employees, setEmployees] = useState('');
  const [experience, setExperience] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [lat, setLat] = useState(String(TASHKENT.lat));
  const [lng, setLng] = useState(String(TASHKENT.lng));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [credit, setCredit] = useState(true);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Per-field complaints, keyed by field.
   *
   * The button used to sit greyed out until the whole form was right, which is
   * no help to an operator with a firm on the phone: it says "no" without
   * saying which line is wrong. It stays live now and answers on press.
   */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Clears one field's complaint the moment it is being answered. */
  const clear = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

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
  /** Uzbek tax numbers are nine digits. */
  const innValid = inn.length === 9;

  /** Everything the server refuses the account for, checked before it is asked. */
  const validate = () => {
    const next: Record<string, string> = {};
    if (!digits) next.phone = 'Majburiy maydon';
    else if (digits.length !== 9) next.phone = "Raqam 9 ta raqamdan iborat bo'lishi kerak";
    if (!name.trim()) next.name = 'Majburiy maydon';
    if (!inn) next.inn = 'Majburiy maydon';
    else if (!innValid) next.inn = "INN 9 ta raqamdan iborat bo'lishi kerak";
    if (!(Number(price) > 0)) next.price = "Narxni kiriting — 0 dan katta bo'lishi kerak";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      setError("Belgilangan maydonlarni to'g'rilang");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await api.post<User>('/admin/companies', {
        phone: `+998${digits}`,
        inn,
        subscription_months: Number(months) || 0,
        name: name.trim(),
        gmail: gmail.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        images: [],
        services: services.trim(),
        lat: Number(lat) || TASHKENT.lat,
        lng: Number(lng) || TASHKENT.lng,
        credit_limit: credit ? DEFAULT_CREDIT : 0,
        online,
        address: address.trim(),
        working_hours: workingHours.trim(),
        employees_count: Number(employees) || 0,
        experience_years: Number(experience) || 0,
        email: email.trim(),
        website: website.trim(),
      });
      router.replace({ pathname: '/admin/user-detail' as any, params: { id: user.id } });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === 'conflict'
            ? "Bu raqam allaqachon firma sifatida ro'yxatdan o'tgan."
            : err.message
          : "Firma qo'shilmadi"
      );
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      header={<Header title="Yangi firma" back />}
      footer={<Button label="Firmani qo'shish" onPress={submit} loading={busy} />}
    >
      <View style={styles.body}>
        <Text style={[Type.footnote, styles.intro, { color: theme.textSecondary }]}>
          Firma shu telefon raqami bilan ilovaga kiradi. Hisob avtomatik ochiladi.
        </Text>

        <View style={styles.fields}>
          <TextField
            label="Telefon"
            value={phone}
            onChangeText={(v) => {
              setPhone(v.replace(/\D/g, '').slice(0, 9));
              clear('phone');
            }}
            keyboardType="number-pad"
            prefix="+998"
            placeholder="90 123 45 67"
            hint="Firma shu raqam bilan tizimga kiradi"
            error={errors.phone}
          />
          <TextField
            label="Firma nomi"
            value={name}
            onChangeText={(v) => {
              setName(v);
              clear('name');
            }}
            icon="business-outline"
            error={errors.name}
          />
          <TextField
            label="INN"
            value={inn}
            onChangeText={(v) => {
              setInn(v.replace(/\D/g, '').slice(0, 9));
              clear('inn');
            }}
            keyboardType="number-pad"
            placeholder="123456789"
            icon="reader-outline"
            /* A half-typed INN corrects itself as the operator types, so it is
               said once here rather than waiting for the submit. */
            error={
              errors.inn ??
              (inn.length > 0 && !innValid ? "INN 9 ta raqamdan iborat bo'lishi kerak" : null)
            }
            hint="Har bir firma uchun yagona. 3 ta bepul buyurtma shu raqamga bog'lanadi."
          />
          <TextField
            label="Obuna (oy)"
            value={months}
            onChangeText={(v) => setMonths(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            placeholder="0"
            icon="calendar-outline"
            hint="Bo'sh qoldirilsa, firma 3 ta bepul buyurtmadan boshlaydi"
          />
          <TextField
            label="Gmail (ixtiyoriy)"
            value={gmail}
            onChangeText={setGmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Xizmat haqi"
            value={price}
            onChangeText={(v) => {
              setPrice(v.replace(/\D/g, ''));
              clear('price');
            }}
            keyboardType="number-pad"
            icon="cash-outline"
            hint="Mijozlar shu narxda buyurtma beradi"
            accessory={<Text style={{ color: theme.textSecondary }}>so&apos;m</Text>}
            error={errors.price}
          />
          <TextField
            label="Tavsif"
            value={description}
            onChangeText={setDescription}
            placeholder="Firma va xizmatlar haqida"
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
          {/* What the firm does, typed in. Not required — the office usually
              has the phone number and the price and little else. */}
          <TextField
            label="Qanday ishlar qiladi (ixtiyoriy)"
            value={services}
            onChangeText={setServices}
            placeholder="Masalan: ta'mirlash, santexnika, elektrika"
            multiline
            numberOfLines={3}
            style={styles.textArea}
            hint="Mijoz firma sahifasida shu matnni o'qiydi"
          />
          <TextField
            label="Manzil"
            value={address}
            onChangeText={setAddress}
            icon="location-outline"
            placeholder="Chilonzor 5, Toshkent"
            hint="Mijoz firma sahifasida shu ma'lumotlarni ko'radi"
          />
          <TextField
            label="Ish vaqti"
            value={workingHours}
            onChangeText={setWorkingHours}
            placeholder="Dush–Shan 9:00–18:00"
          />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextField
                label="Xodimlar soni"
                value={employees}
                onChangeText={(v) => setEmployees(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="Tajriba (yil)"
                value={experience}
                onChangeText={(v) => setExperience(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <TextField
            label="Email (ixtiyoriy)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="info@firma.uz"
          />
          <TextField
            label="Veb-sayt (ixtiyoriy)"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            placeholder="firma.uz"
          />

          {/* Where the office is. Mijozlar ro'yxatni o'z joylashuvidan
              boshlab ko'radi, so a wrong pin buries the firm at the bottom. */}
          <View style={styles.group}>
            <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
              OFIS JOYLASHUVI
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
          footer="Faqat onlayn firmalar mijozlarga ko'rinadi. Firma har bir ishdan komissiya emas, oylik to'lov to'laydi — obuna tugagach yangi buyurtma qabul qila olmaydi."
        >
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
  textArea: { minHeight: 104, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  group: { gap: 10 },
  label: { paddingHorizontal: 4 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  section: { marginTop: 28 },
  error: { textAlign: 'center', marginTop: 16, paddingHorizontal: Layout.gutter },
});
