import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SelectableChip } from '@/components/ui/chip';
import { Header } from '@/components/ui/header';
import { Icon } from '@/components/ui/icon';
import { ImageStrip } from '@/components/ui/image-strip';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { categoryName } from '@/lib/format';
import { pickAndUploadImage, pickAndUploadImages } from '@/lib/upload';
import type { WorkerProfile } from '@/lib/types';
import { useAuth } from '@/store/auth';

/** How many work photos a worker may carry. Enough to show range, few enough to scroll. */
const MAX_WORK_PHOTOS = 6;

/**
 * The worker's own edit screen.
 *
 * Two halves: the terms they trade on (price, categories) and the profile a
 * customer reads before letting them into their home (photo, bio, experience,
 * area, past work). Identity — name, phone, age — is not here: that belongs to
 * the admin who opened the account.
 */
export default function WorkerEditScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshMe } = useAuth();
  const { categories } = useCategories();
  const profile = user?.worker_profile;

  const [priceMin, setPriceMin] = useState(String(profile?.price_min ?? 0));
  const [priceMax, setPriceMax] = useState(String(profile?.price_max ?? 0));
  const [selected, setSelected] = useState<Set<string>>(new Set(profile?.category_ids ?? []));

  /**
   * What is on offer, plus whatever this worker already claims.
   *
   * A category the office retired is not something to newly pick up, but a
   * worker who signed up for it before still has it on their record — and
   * dropping it off their own edit screen would mean they could neither see it
   * nor let go of it, while it kept them in the dispatch list for a service the
   * platform no longer sells.
   */
  const pickable = categories.filter((c) => c.active !== false || selected.has(c.id));

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [about, setAbout] = useState(profile?.about ?? '');
  const [experience, setExperience] = useState(
    profile?.experience_years ? String(profile.experience_years) : ''
  );
  const [address, setAddress] = useState(profile?.address ?? '');
  const [images, setImages] = useState<string[]>(profile?.images ?? []);

  const [uploading, setUploading] = useState(false);
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

  const changePhoto = async () => {
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

  const addWorkPhotos = async () => {
    setError(null);
    setUploading(true);
    try {
      const urls = await pickAndUploadImages({ multiple: true });
      if (urls.length > 0) setImages((prev) => [...prev, ...urls].slice(0, MAX_WORK_PHOTOS));
    } catch {
      setError(t('photo.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch<WorkerProfile>('/worker/profile', {
        price_min: Number(priceMin) || 0,
        price_max: Number(priceMax) || 0,
        category_ids: Array.from(selected),
        avatar_url: avatarUrl,
        about: about.trim(),
        experience_years: Number(experience) || 0,
        address: address.trim(),
        images,
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
      header={<Header title={t('worker.editProfile')} back />}
      footer={
        <Button
          label={t('worker.saveChanges')}
          onPress={save}
          loading={busy}
          disabled={selected.size === 0 || uploading}
        />
      }>
      <View style={styles.body}>
        {/* The face on the profile. */}
        <View style={styles.photoBlock}>
          <Pressable onPress={changePhoto} disabled={uploading} style={styles.photoTap}>
            <Avatar name={profile?.full_name} imageUrl={avatarUrl || undefined} size={84} />
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
            <Text style={[Type.headline, { color: theme.text }]}>{t('worker.photo')}</Text>
            <Text style={[Type.footnote, { color: theme.textSecondary }]}>
              {t('worker.publicProfileHint')}
            </Text>
          </View>
        </View>

        <TextField
          label={t('worker.about')}
          value={about}
          onChangeText={setAbout}
          placeholder={t('worker.aboutPlaceholder')}
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />

        <View style={styles.priceRow}>
          <View style={styles.priceItem}>
            <TextField
              label={t('worker.experience')}
              value={experience}
              onChangeText={(v) => setExperience(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="3"
            />
          </View>
          <View style={styles.priceItem}>
            <TextField
              label={t('worker.address')}
              value={address}
              onChangeText={setAddress}
              placeholder={t('worker.addressPlaceholder')}
            />
          </View>
        </View>

        <View style={styles.catSection}>
          <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
            {t('worker.works').toUpperCase()}
          </Text>
          <ImageStrip
            uris={images}
            max={MAX_WORK_PHOTOS}
            addLabel={t('worker.addWork')}
            onAdd={addWorkPhotos}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceItem}>
            <TextField label={t('worker.priceMin')} value={priceMin} onChangeText={setPriceMin} keyboardType="number-pad" />
          </View>
          <View style={styles.priceItem}>
            <TextField label={t('worker.priceMax')} value={priceMax} onChangeText={setPriceMax} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.catSection}>
          <Text style={[Type.footnote, styles.label, { color: theme.textSecondary }]}>
            {t('worker.myCategories').toUpperCase()}
          </Text>
          <View style={styles.chips}>
            {pickable.map((c) => (
              <SelectableChip
                key={c.id}
                label={categoryName(c, lang)}
                selected={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 24, paddingTop: 8 },
  photoBlock: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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
  priceRow: { flexDirection: 'row', gap: 12 },
  priceItem: { flex: 1 },
  catSection: { gap: 10 },
  label: { paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 15, textAlign: 'center' },
});
