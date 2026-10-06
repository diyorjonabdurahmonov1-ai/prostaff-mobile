import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { LocationPicker } from '@/components/location-picker';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Icon } from '@/components/ui/icon';
import { ImageStrip } from '@/components/ui/image-strip';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { YandexMap } from '@/components/yandex-map';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { getCoordsWithFallback } from '@/lib/location';
import type { CompanyProfile } from '@/lib/types';
import { pickAndUploadImage, pickAndUploadImages } from '@/lib/upload';
import { useAuth } from '@/store/auth';
import { TASHKENT } from '@/store/order-flow';

/** Gallery cap. A firm shows its range in a handful of photos, not an album. */
const MAX_GALLERY = 8;

/**
 * The firm's own profile editor.
 *
 * Everything here is read by a customer before they order, which is why the
 * screen asks for more than a name and a price: a logo, an address, opening
 * hours and a few photos are what turn a row in a list into a firm somebody is
 * willing to let into their home.
 */
export default function CompanyOnboardingScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const profile = user?.company_profile;

  const [name, setName] = useState(profile?.name ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [price, setPrice] = useState(String(profile?.price ?? 50000));
  // What the firm does, written out rather than ticked off a list. Optional:
  // the firm is bookable without it, so it never blocks a save.
  const [services, setServices] = useState(profile?.services ?? '');

  // A firm that predates the map on this form has no pin; centre the picker on
  // Tashkent so it starts somewhere real rather than in the Gulf of Guinea.
  const hasPin = !!profile && (profile.lat !== 0 || profile.lng !== 0);
  const [lat, setLat] = useState(String(hasPin ? profile!.lat : TASHKENT.lat));
  const [lng, setLng] = useState(String(hasPin ? profile!.lng : TASHKENT.lng));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [workingHours, setWorkingHours] = useState(profile?.working_hours ?? '');
  const [employees, setEmployees] = useState(
    profile?.employees_count ? String(profile.employees_count) : ''
  );
  const [experience, setExperience] = useState(
    profile?.experience_years ? String(profile.experience_years) : ''
  );
  const [email, setEmail] = useState(profile?.email ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [images, setImages] = useState<string[]>(profile?.images ?? []);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Per-field complaints, keyed by field.
   *
   * The save button used to sit greyed out until the form was complete, which
   * told the firm it could not save but never which of a dozen fields was the
   * reason. Now the button is always live: pressing it either saves or marks
   * the fields that are wrong, right under the field itself.
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
  };

  const changeLogo = async () => {
    setError(null);
    setUploading(true);
    try {
      const url = await pickAndUploadImage({ square: true, quality: 0.7 });
      if (url) setAvatarUrl(url);
    } catch {
      setError(t('photo.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const addGalleryPhotos = async () => {
    setError(null);
    setUploading(true);
    try {
      const urls = await pickAndUploadImages({ multiple: true });
      if (urls.length > 0) setImages((prev) => [...prev, ...urls].slice(0, MAX_GALLERY));
    } catch {
      setError(t('photo.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /** Everything the server refuses a profile for, checked before it is asked. */
  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('form.required');
    if (!description.trim()) next.description = t('form.required');
    if (!(Number(price) > 0)) next.price = t('form.pricePositive');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!profile) return;
    if (!validate()) {
      setError(t('form.fixErrors'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch<CompanyProfile>('/company/profile', {
        name: name.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        images,
        services: services.trim(),
        lat: Number(lat) || 0,
        lng: Number(lng) || 0,
        avatar_url: avatarUrl,
        address: address.trim(),
        working_hours: workingHours.trim(),
        employees_count: Number(employees) || 0,
        experience_years: Number(experience) || 0,
        email: email.trim(),
        website: website.trim(),
      });
      await refreshMe();
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('company.editProfile')} back />}
      /* Only an upload in flight still greys the button out — that one is a
         genuine "not yet", not a form the firm could fix by reading a message. */
      footer={
        <Button
          label={t('worker.saveChanges')}
          onPress={save}
          loading={busy}
          disabled={uploading}
        />
      }
    >
      <View style={styles.body}>
        {/* Logo — the firm's face in every list and on the order screen. */}
        <View style={styles.photoBlock}>
          <Pressable onPress={changeLogo} disabled={uploading} style={styles.photoTap}>
            <Avatar name={name || profile?.name} imageUrl={avatarUrl || undefined} size={84} />
            {uploading ? (
              <View style={[styles.photoVeil, { backgroundColor: theme.scrim }]}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : (
              <View style={[styles.cameraBadge, { backgroundColor: theme.surface }]}>
                <Icon name="camera" size={14} color={theme.textSecondary} />
              </View>
            )}
          </Pressable>
          <View style={styles.photoText}>
            <Text style={[Type.headline, { color: theme.text }]}>{t('company.logo')}</Text>
            <Text style={[Type.footnote, { color: theme.textSecondary }]}>
              {t('company.publicProfileHint')}
            </Text>
          </View>
        </View>

        <TextField
          label={t('company.name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            clear('name');
          }}
          placeholder={t('company.name')}
          error={errors.name}
        />

        <TextField
          label={t('company.description')}
          value={description}
          onChangeText={(v) => {
            setDescription(v);
            clear('description');
          }}
          multiline
          numberOfLines={4}
          placeholder={t('company.descriptionPlaceholder')}
          style={styles.textArea}
          error={errors.description}
        />

        <TextField
          label={t('company.price')}
          value={price}
          onChangeText={(v) => {
            setPrice(v);
            clear('price');
          }}
          keyboardType="number-pad"
          placeholder="50000"
          hint={t('company.priceHint')}
          error={errors.price}
        />

        {/* What the firm does, in its own words. Left optional on purpose: a
            firm is booked at its published price whether or not it wrote this
            line, so it is worth asking for but never worth blocking a save. */}
        <TextField
          label={t('company.services')}
          value={services}
          onChangeText={setServices}
          multiline
          numberOfLines={3}
          placeholder={t('company.servicesPlaceholder')}
          style={styles.textArea}
          hint={t('company.servicesHint')}
        />

        <TextField
          label={t('company.address')}
          value={address}
          onChangeText={setAddress}
          icon="location-outline"
          placeholder={t('company.addressPlaceholder')}
        />

        {/* And where it sits — the customer's list is ordered by distance. */}
        <View style={styles.group}>
          <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
            {t('company.location').toUpperCase()}
          </Text>
          <YandexMap
            point={{ lat: Number(lat) || TASHKENT.lat, lng: Number(lng) || TASHKENT.lng }}
            height={200}
            caption={t('map.edit')}
            hideOpenButton
            onPress={() => setPickerOpen(true)}
          />
          <View style={styles.locationRow}>
            <Text style={[Type.caption1, styles.label, { color: theme.textTertiary }]}>
              {`${(Number(lat) || 0).toFixed(5)}, ${(Number(lng) || 0).toFixed(5)}`}
            </Text>
            <Button
              label={t('company.useMyLocation')}
              icon="crosshair"
              variant="gray"
              size="sm"
              fullWidth={false}
              loading={locating}
              onPress={useMyLocation}
            />
          </View>
        </View>

        <TextField
          label={t('company.workingHours')}
          value={workingHours}
          onChangeText={setWorkingHours}
          placeholder={t('company.workingHoursPlaceholder')}
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField
              label={t('company.employees')}
              value={employees}
              onChangeText={(v) => setEmployees(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="12"
            />
          </View>
          <View style={styles.rowItem}>
            <TextField
              label={t('company.experience')}
              value={experience}
              onChangeText={(v) => setExperience(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="5"
            />
          </View>
        </View>

        <TextField
          label={t('company.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="info@firma.uz"
        />

        <TextField
          label={t('company.website')}
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          placeholder="firma.uz"
        />

        <View style={styles.gallery}>
          <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
            {t('company.gallery').toUpperCase()}
          </Text>
          <ImageStrip
            uris={images}
            max={MAX_GALLERY}
            addLabel={t('photo.add')}
            onAdd={addGalleryPhotos}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </View>

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
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
  body: { gap: 16, paddingTop: 8 },
  photoBlock: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 4 },
  photoTap: { width: 84, height: 84 },
  photoText: { flex: 1, gap: 3 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: { minHeight: 104, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  gallery: { gap: 10, paddingTop: 4 },
  group: { gap: 10, paddingTop: 4 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { paddingHorizontal: 4 },
  error: { fontSize: 14, textAlign: 'center', marginTop: 12 },
});
