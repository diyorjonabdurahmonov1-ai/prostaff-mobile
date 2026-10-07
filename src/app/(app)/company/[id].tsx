import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationPicker } from '@/components/location-picker';
import { ReviewsSection } from '@/components/reviews-section';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { ImageStrip } from '@/components/ui/image-strip';
import { PhotoGallery } from '@/components/ui/photo-gallery';
import { Screen } from '@/components/ui/screen';
import { Stars } from '@/components/ui/stars';
import { TextField } from '@/components/ui/text-field';
import { YandexMap } from '@/components/yandex-map';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { useCategories } from '@/hooks/use-categories';
import { ApiError, api } from '@/lib/api';
import { categoryName, formatSom } from '@/lib/format';
import { MAX_ORDER_PHOTOS, resolveImageUrl } from '@/lib/image';
import { getCoordsWithFallback } from '@/lib/location';
import { pickAndUploadImage } from '@/lib/upload';
import type { CompanyProfile, Order, Review } from '@/lib/types';
import { useAuth } from '@/store/auth';

import { Icon } from '@/components/ui/icon';

export default function CompanyDetailScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { categories } = useCategories();

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [description, setDescription] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  // Several: one photo rarely explains a job (see the worker order flow).
  const [images, setImages] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number; resolved: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** The order just placed — the success screen opens it. */
  const [placed, setPlaced] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve GPS as soon as the order form opens — the company needs an address.
  useEffect(() => {
    if (!showOrderForm || coords) return;
    let active = true;
    getCoordsWithFallback().then((c) => {
      if (active) setCoords(c);
    });
    return () => {
      active = false;
    };
  }, [showOrderForm, coords]);

  /** Uploaded on pick, so the firm on the other end can actually open it. */
  const pickImage = async () => {
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await pickAndUploadImage();
      if (url) setImages((prev) => [...prev, url]);
    } catch {
      setError(t('photo.uploadFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  /**
   * The detail route first, then the list as a fallback — an older backend
   * without `GET /companies/{id}` still has the record, just not on its own URL.
   */
  const load = useCallback(async () => {
    // The profile and the reviews go out together — they land on the same
    // screen, and reviews failing must not blank the profile behind them.
    const [profile, list] = await Promise.all([
      api.get<CompanyProfile>(`/companies/${id}`).catch(() => null),
      api.get<Review[]>(`/companies/${id}/reviews`).catch(() => [] as Review[]),
    ]);
    setReviews(list ?? []);
    if (profile) {
      setCompany(profile);
      return;
    }
    try {
      const all = await api.get<CompanyProfile[]>('/companies');
      setCompany((all ?? []).find((c) => c.id === id) ?? null);
    } catch {
      // leave whatever is on screen; the empty state covers a first failure
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const { refreshControl } = useRefresh(load);

  /**
   * Only a place the customer actually is, or picked.
   *
   * The GPS helper answers a refused permission with central Tashkent, and the
   * form used to send that — a firm drove to the city centre for a job on the
   * other side of it. A guess is now only where the map starts: the customer
   * confirms a point on it, or allows location, before the order can go.
   */
  const locationReady = !!coords?.resolved;

  const sendOrder = async () => {
    if (!id || description.trim().length === 0 || !locationReady) return;
    setBusy(true);
    setError(null);
    try {
      const order = await api.post<Order>(`/companies/${id}/order`, {
        description: description.trim(),
        phone: phone.trim(),
        name: name.trim(),
        images,
        lat: coords!.lat,
        lng: coords!.lng,
      });
      setPlaced(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <Header title={t('companyDetail.title')} back />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (placed) {
    return (
      <Screen scroll={false} padded={false} contentStyle={styles.successWrap}>
        <View style={[styles.successGlyph, { backgroundColor: theme.successSoft }]}>
          <Icon name="checkmark" size={44} color={theme.success} />
        </View>
        <Text style={[Type.title2, styles.centerText, { color: theme.text }]}>
          {t('company.sentTitle')}
        </Text>
        <Text style={[Type.subhead, styles.centerText, { color: theme.textSecondary }]}>
          {t('company.sentBody')}
        </Text>
        <View style={styles.successAction}>
          {/* Straight to the order: that is where its answer will show up. */}
          <Button
            label={t('company.viewOrder')}
            icon="reader"
            onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: placed.id } })}
          />
          <Button label={t('common.done')} variant="gray" onPress={() => router.navigate('/')} />
        </View>
      </Screen>
    );
  }

  if (!company) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <Header title={t('companyDetail.title')} back />
        <EmptyState icon="alert-circle-outline" title={t('common.error')} />
      </SafeAreaView>
    );
  }

  // What the firm does, and whether it ever put itself on the map. Both are
  // optional on the wire: a record created before either existed has neither.
  //
  // The firm writes this line itself now; the category chips are what firms
  // registered before that ticked, and they stay on screen for as long as those
  // records do — a firm that never came back to type its services out should
  // not lose the line it already had.
  const companyCats = (company.category_ids ?? [])
    .map((cid) => categories.find((c) => c.id === cid))
    .filter(Boolean);
  const services = company.services?.trim();
  const officePinned = !!company.lat && !!company.lng;

  const createdDate = new Date(company.created_at).toLocaleDateString(
    lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  return (
    <Screen
      padded={false}
      header={<Header title={t('companyDetail.title')} back />}
      refreshControl={refreshControl}
      /* No call button, and no number in the contact section either — the same
         rule as a worker's profile. A firm that can be rung straight off the
         listing is a firm the platform never books, and the customer loses the
         order record along with it. The number comes with the order once the
         firm accepts. */
      footer={
        <View style={styles.footer}>
          {!company.online ? (
            // An offline firm is not taking work; an order sent now would sit
            // unanswered with no clock on it. Point at the firms that are.
            <Button
              label={t('company.pickOther')}
              icon="business"
              variant="gray"
              style={styles.primaryBtn}
              onPress={() => router.navigate({ pathname: '/', params: { panel: 'companies' } })}
            />
          ) : showOrderForm ? (
            <Button
              label={t('company.sendOrder')}
              style={styles.primaryBtn}
              loading={busy}
              disabled={!description.trim() || !locationReady}
              onPress={sendOrder}
            />
          ) : (
            <Button
              label={t('companyDetail.orderService')}
              style={styles.primaryBtn}
              onPress={() => setShowOrderForm(true)}
            />
          )}
        </View>
      }>
      {/* Hero */}
      <View style={styles.hero}>
        <Avatar name={company.name} imageUrl={company.avatar_url} size={92} />
        <Text style={[Type.title1, styles.centerText, { color: theme.text }]} numberOfLines={2}>
          {company.name}
        </Text>
        <Stars value={company.rating} showValue count={company.ratings_count} size={16} />
        <Badge
          label={company.online ? t('common.online') : t('common.offline')}
          tone={company.online ? 'success' : 'neutral'}
          dot
        />
      </View>

      {!company.online ? (
        <View style={[styles.offline, Squircle, { backgroundColor: theme.warningSoft }]}>
          <Icon name="moon" size={18} color={theme.warning} />
          <Text style={[Type.footnote, styles.locationText, { color: theme.text }]}>
            {t('company.offlineNotice')}
          </Text>
        </View>
      ) : null}

      {/* How big, how long — the two questions customers ask on the phone.
          The rating is not repeated here; the hero already shows it as stars. */}
      {company.employees_count || company.experience_years ? (
        <View style={styles.stats}>
          {company.employees_count ? (
            <StatTile
              value={`${company.employees_count} ${t('companyDetail.people')}`}
              label={t('companyDetail.employees')}
            />
          ) : null}
          {company.experience_years ? (
            <StatTile
              value={`${company.experience_years} ${t('workerDetail.years')}`}
              label={t('companyDetail.experience')}
            />
          ) : null}
        </View>
      ) : null}

      {/* Always on screen, like a worker's bio: an empty section says the firm
          has not written anything, which is itself worth knowing. */}
      <Section header={t('company.about')} style={styles.section}>
        <Row
          stacked
          title={t('company.description')}
          value={company.description || t('companyDetail.noAbout')}
        />
      </Section>

      {services ? (
        <Section header={t('companyDetail.services')} style={styles.section}>
          <Row stacked title={t('company.services')} value={services} />
        </Section>
      ) : companyCats.length > 0 ? (
        <Section header={t('companyDetail.services')} style={styles.section}>
          <View style={styles.chips}>
            {companyCats.map(
              (cat) => cat && <Chip key={cat.id} label={categoryName(cat, lang)} tone="tint" />,
            )}
          </View>
        </Section>
      ) : null}

      <PhotoGallery uris={company.images} header={t('companyDetail.gallery')} />

      {/* What customers said. The stars in the hero are the average of these. */}
      <ReviewsSection reviews={reviews} style={styles.section} />

      <Section
        header={t('company.price')}
        style={styles.section}
        footer={t('company.atCompanyPrice')}>
        <Row
          title={t('company.price')}
          value={`${formatSom(company.price)} ${t('common.som')}`}
        />
      </Section>

      <Section header={t('companyDetail.contact')} style={styles.section}>
        {company.address ? (
          <Row stacked title={t('companyDetail.address')} value={company.address} />
        ) : null}
        {company.working_hours ? (
          <Row title={t('companyDetail.workingHours')} value={company.working_hours} />
        ) : null}
        {company.email ? <Row title={t('companyDetail.email')} value={company.email} /> : null}
        {company.website ? (
          <Row
            title={t('companyDetail.website')}
            value={company.website}
            onPress={() => Linking.openURL(withScheme(company.website!))}
          />
        ) : null}
        <Row title={t('companyDetail.memberSince')} value={createdDate} />
      </Section>

      {/* Where the office is. Shown only when the firm actually dropped a pin —
          an unset record would otherwise point at 0,0 in the Atlantic. */}
      {officePinned ? (
        <View style={styles.mapWrap}>
          <YandexMap
            point={{ lat: company.lat, lng: company.lng }}
            height={180}
            caption={t('companyDetail.address')}
          />
        </View>
      ) : null}

      {showOrderForm ? (
        <View style={styles.form}>
          <Text style={[Type.footnote, styles.caption, { color: theme.textSecondary }]}>
            {t('company.orderTitle').toUpperCase()}
          </Text>
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder={t('company.orderDescription')}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
          <TextField
            value={name}
            onChangeText={setName}
            icon="person-outline"
            placeholder={t('worker.fullName')}
          />
          <TextField
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            icon="call-outline"
            placeholder={t('order.phone')}
          />

          {/* Optional photos — often the fastest way to explain the job. */}
          <View style={styles.photoField}>
            <Text style={[Type.footnote, { color: theme.textSecondary }]}>
              {`${t('order.photo')} · ${t('common.optional')}`}
            </Text>
            <ImageStrip
              max={MAX_ORDER_PHOTOS}
              uris={images}
              onAdd={pickImage}
              onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
              addLabel={uploadingPhoto ? t('common.loading') : t('order.addPhoto')}
            />
          </View>

          {/* The company drives to this pin, so it is editable here too — in
              the full-screen picker, which is the only place a drag on a map
              cannot be mistaken for a drag on the form. */}
          {coords ? (
            <YandexMap
              point={{ lat: coords.lat, lng: coords.lng }}
              height={200}
              caption={t('map.edit')}
              hideOpenButton
              onPress={() => setPickerOpen(true)}
            />
          ) : null}

          <View style={[styles.location, Squircle, { backgroundColor: theme.surface }]}>
            <Icon
              name={!coords ? 'location-outline' : coords.resolved ? 'location' : 'alert-circle-outline'}
              size={19}
              color={!coords ? theme.textMuted : coords.resolved ? theme.success : theme.warning}
            />
            <Text style={[Type.subhead, styles.locationText, { color: theme.textSecondary }]}>
              {!coords
                ? t('order.locationDetecting')
                : coords.resolved
                  ? t('order.locationReady')
                  : t('company.needLocation')}
            </Text>
          </View>
          {coords && !coords.resolved ? (
            <Button
              label={t('company.pickOnMap')}
              icon="location"
              variant="secondary"
              onPress={() => setPickerOpen(true)}
            />
          ) : null}

          {error ? (
            <Text style={[Type.footnote, styles.centerText, { color: theme.danger }]}>{error}</Text>
          ) : null}
        </View>
      ) : null}

      {coords ? (
        <LocationPicker
          visible={pickerOpen}
          point={{ lat: coords.lat, lng: coords.lng }}
          onClose={() => setPickerOpen(false)}
          onConfirm={({ lat, lng }) => setCoords({ lat, lng, resolved: true })}
        />
      ) : null}
    </Screen>
  );
}

/** One figure from the firm's record, in the row under the hero. */
function StatTile({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statTile, Squircle, { backgroundColor: theme.surface }]}>
      <Text style={[Type.title2, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[Type.caption1, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Firms type "example.uz"; Linking needs a scheme or the tap does nothing. */
function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centerText: { textAlign: 'center' },

  stats: { flexDirection: 'row', gap: 12, paddingHorizontal: Layout.gutter },
  statTile: {
    flex: 1,
    borderRadius: Radius.card,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 1,
  },

  hero: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    paddingBottom: 24,
  },

  section: { marginTop: 28 },
  caption: { paddingHorizontal: Layout.gutter + 4, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  mapWrap: { marginTop: 28, paddingHorizontal: Layout.gutter },


  form: { marginTop: 28, paddingHorizontal: Layout.gutter, gap: 12 },
  textArea: { minHeight: 104, textAlignVertical: 'top' },

  photoField: { gap: 8 },
  photoWrap: { alignSelf: 'flex-start' },
  photo: { width: 128, height: 128, borderRadius: Radius.lg },
  photoRemove: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    height: 96,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: Radius.card,
  },
  locationText: { flex: 1 },

  footer: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  primaryBtn: { flex: 1 },

  successWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  successGlyph: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successAction: { alignSelf: 'stretch', marginTop: 24, gap: 8 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Layout.gutter,
    marginBottom: 20,
    padding: 14,
    borderRadius: Radius.card,
  },
});
