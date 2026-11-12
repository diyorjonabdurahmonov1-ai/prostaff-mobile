import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { LocationPicker } from '@/components/location-picker';
import { FadeUp } from '@/components/motion';
import { YandexMap } from '@/components/yandex-map';
import { Button } from '@/components/ui/button';
import { SelectableChip } from '@/components/ui/chip';
import { Header } from '@/components/ui/header';
import { Icon } from '@/components/ui/icon';
import { ImageStrip } from '@/components/ui/image-strip';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { StepDots } from '@/components/ui/step-dots';
import { TextField } from '@/components/ui/text-field';
import { Layout, Radius, Squircle, Stagger, Type, categoryTint } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { categoryIcon } from '@/lib/category-icon';
import { categoryName } from '@/lib/format';
import { MAX_ORDER_PHOTOS } from '@/lib/image';
import { getCoordsWithFallback } from '@/lib/location';
import { pickAndUploadImage } from '@/lib/upload';
import type { Gender } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useOrderFlow } from '@/store/order-flow';

import { ORDER_STEPS } from './categories';

/**
 * The most people one order may ask for. Matches the server's own cap.
 *
 * Enough for a banquet or a lorry; past it the job is a staffing contract the
 * office should be arranging rather than something typed into a form.
 */
export const MAX_WORKERS_PER_ORDER = 20;

/**
 * Step 2: what the job actually is.
 *
 * The category chosen in step 1 stays editable at the top rather than being
 * locked behind a back navigation — realising you picked the wrong category
 * three fields in is common, and losing the three fields to fix it is not
 * acceptable.
 */

export default function DetailsScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  // The chip row offers a choice, so it lists only what is on offer; `byId`
  // still reads the full list, for a draft that names something since retired.
  const { activeCategories, byId } = useCategories();
  const { draft, update } = useOrderFlow();

  /**
   * Whether to ask how many workers are wanted.
   *
   * Only when the customer has not named anybody. Picking two people off the
   * nearby list *is* the answer — they want those two — so a counter beside it
   * asks the same question twice and lets the two disagree: "3" next to two
   * chosen faces has no meaning the app could honour. When workers are named,
   * the count is how many were named.
   */
  const asksHowMany = draft.targetWorkerIds.length === 0;

  const [locating, setLocating] = useState(!draft.locationResolved);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const category = draft.categoryId ? byId(draft.categoryId) : undefined;

  // prefill phone from the signed-in user
  useEffect(() => {
    if (!draft.phone && user?.phone) update({ phone: user.phone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);

  // `force`: the button exists to take a *new* reading, so it skips the cache
  // that the automatic resolve below is happy to share.
  const locate = async () => {
    setLocating(true);
    const coords = await getCoordsWithFallback(true);
    update({ lat: coords.lat, lng: coords.lng, locationResolved: coords.resolved });
    setLocating(false);
  };

  // resolve GPS once
  useEffect(() => {
    if (draft.locationResolved) return;
    let active = true;
    (async () => {
      const coords = await getCoordsWithFallback();
      if (!active) return;
      update({ lat: coords.lat, lng: coords.lng, locationResolved: coords.resolved });
      setLocating(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The photo is uploaded here, not when the order is submitted.
   *
   * It has to become a real URL before it leaves this device: the worker who
   * gets rung is on another phone, and a picker's `file://` path means nothing
   * there — which is why order photos have never actually been visible to
   * anyone but the customer who attached them.
   */
  const pickImage = async () => {
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      const url = await pickAndUploadImage();
      if (url) update({ images: [...draft.images, url] });
    } catch {
      setPhotoError(t('photo.uploadFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  /**
   * The address has to be the customer's own: found by GPS, or put on the map
   * by hand. The form used to go ahead on central Tashkent when location was
   * refused, so the order rang workers around the city centre for a job that
   * was somewhere else entirely — and nobody near the customer ever heard it.
   */
  const canContinue =
    draft.description.trim().length > 0 &&
    draft.phone.trim().length > 0 &&
    Number(draft.price) > 0 &&
    draft.locationResolved;

  return (
    <Screen
      padded={false}
      header={
        <View>
          <Header title={t('order.detailsTitle')} subtitle={categoryName(category, lang)} />
          <View style={styles.steps}>
            <StepDots step={1} total={ORDER_STEPS} />
          </View>
        </View>
      }
      footer={
        <Button
          label={t('order.review')}
          iconRight="arrow-forward"
          size="lg"
          disabled={!canContinue}
          onPress={() => router.push('/review')}
        />
      }>
      <View style={styles.body}>
        {/* Category — still changeable, without losing the form. */}
        <FadeUp index={0} step={Stagger.list}>
          <Caption>{t('order.category')}</Caption>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {activeCategories.map((c) => (
              <SelectableChip
                key={c.id}
                label={categoryName(c, lang)}
                icon={categoryIcon(c)}
                tint={categoryTint(c.id)}
                selected={c.id === draft.categoryId}
                onToggle={() => update({ categoryId: c.id })}
              />
            ))}
          </ScrollView>
        </FadeUp>

        {/* How many people the job takes.
            Above the description, because it changes what the customer is
            describing: "bazmga yordamchi" for one person and for five is not
            the same brief. A stepper rather than a text field — the answer is
            always a small number, and a keyboard for it is a keyboard too many
            on a form that already has four. */}
        {asksHowMany ? (
          <FadeUp index={1} step={Stagger.list} style={styles.field}>
            <Caption>{t('order.workersNeeded')}</Caption>
            <WorkerCounter
              value={draft.workersNeeded}
              max={MAX_WORKERS_PER_ORDER}
              onChange={(workersNeeded) => update({ workersNeeded })}
            />
            <Text style={[Type.footnote, styles.counterHint, { color: theme.textSecondary }]}>
              {t('order.workersNeededHint')}
            </Text>
          </FadeUp>
        ) : null}

        {/* Who should come, when nobody in particular has been named.
            A customer who picked three workers off the nearby list has already
            answered this — more precisely than the filter can — and leaving the
            control here would let them set a preference that the order then
            ignores. */}
        {draft.targetWorkerIds.length === 0 ? (
          <FadeUp index={1} step={Stagger.list} style={styles.field}>
            <Caption>{t('order.gender')}</Caption>
            <Segmented<Gender>
              size="lg"
              value={draft.gender}
              onChange={(gender) => update({ gender })}
              options={[
                { value: 'male', label: t('order.male') },
                { value: 'female', label: t('order.female') },
                { value: 'any', label: t('order.any') },
              ]}
            />
          </FadeUp>
        ) : null}

        <FadeUp index={2} step={Stagger.list}>
          <TextField
            label={t('order.description')}
            value={draft.description}
            onChangeText={(description) => update({ description })}
            placeholder={t('order.descriptionPlaceholder')}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
        </FadeUp>

        <FadeUp index={3} step={Stagger.list} style={styles.field}>
          <Caption>{`${t('order.photo')} · ${t('common.optional')}`}</Caption>
          {/* Several: a job is usually explained by the broken thing, the room
              it is in and the way to it — one slot made the customer choose. */}
          <ImageStrip
            max={MAX_ORDER_PHOTOS}
            uris={draft.images}
            onAdd={pickImage}
            onRemove={(index) => update({ images: draft.images.filter((_, i) => i !== index) })}
            addLabel={uploadingPhoto ? t('common.loading') : t('order.addPhoto')}
          />
          {photoError ? (
            <Text style={[Type.footnote, styles.photoError, { color: theme.danger }]}>
              {photoError}
            </Text>
          ) : null}
        </FadeUp>

        {/* The worker must know what the job pays before being called. */}
        <FadeUp index={4} step={Stagger.list}>
          <TextField
            label={t('order.price')}
            icon="cash-outline"
            value={draft.price}
            onChangeText={(price) => update({ price: price.replace(/\D/g, '') })}
            keyboardType="number-pad"
            placeholder={t('order.pricePlaceholder')}
            // With several workers chosen this figure is what each of them is
            // paid, not what the job costs — said here, where it is typed,
            // rather than only on the review screen after the fact.
            hint={
              draft.targetWorkerIds.length > 1
                ? t('order.priceEachHint')
                : t('order.priceHint')
            }
            accessory={
              <Text style={[Type.subhead, { color: theme.textSecondary }]}>{t('common.som')}</Text>
            }
          />
        </FadeUp>

        <FadeUp index={5} step={Stagger.list}>
          <TextField
            label={t('order.phone')}
            icon="call-outline"
            value={draft.phone}
            onChangeText={(phone) => update({ phone })}
            keyboardType="phone-pad"
          />
        </FadeUp>

        {/* The map is the address field: the pin is where the worker comes, so
            it stays editable — but the editing happens full screen. Dragging it
            here meant the map and the form competed for the same vertical
            gesture, and the page could only be scrolled from beside the card. */}
        <FadeUp index={6} step={Stagger.list} style={styles.field}>
          <Caption>{t('order.location')}</Caption>
          <YandexMap
            point={{ lat: draft.lat, lng: draft.lng }}
            height={220}
            caption={t('map.edit')}
            hideOpenButton
            onPress={() => setPickerOpen(true)}
          />
          <View style={styles.locationRow}>
            <Text
              style={[
                Type.footnote,
                styles.locationHint,
                { color: draft.locationResolved ? theme.textSecondary : theme.danger },
              ]}>
              {draft.locationResolved
                ? t('order.locationReady')
                : locating
                  ? t('order.locationDetecting')
                  : t('order.locationNeeded')}
            </Text>
            <Button
              label={locating ? t('order.locationDetecting') : t('order.detectLocation')}
              icon="crosshair"
              variant="gray"
              size="sm"
              fullWidth={false}
              loading={locating}
              onPress={locate}
            />
          </View>
          <Text style={[Type.caption1, styles.locationHint, { color: theme.textTertiary }]}>
            {/* The radius is what decides who gets rung on an ordinary order.
                On a targeted one it decides nothing, and promising a 15 km
                search to somebody who named three workers is simply untrue. */}
            {draft.targetWorkerIds.length > 0 ? t('pick.selectedHint') : t('order.radiusHint')}
          </Text>
        </FadeUp>
      </View>

      <LocationPicker
        visible={pickerOpen}
        point={{ lat: draft.lat, lng: draft.lng }}
        onClose={() => setPickerOpen(false)}
        onConfirm={({ lat, lng }) => update({ lat, lng, locationResolved: true })}
      />
    </Screen>
  );
}

/**
 * How many people are wanted, as a stepper.
 *
 * Bounded at both ends by something real: one, because a job with nobody on it
 * is not a job, and the cap above, because past a handful this stops being an
 * order and becomes a staffing arrangement the office should be making. The
 * number is large and central so it reads as the answer rather than as a
 * setting.
 */
function WorkerCounter({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const theme = useTheme();
  const step = (delta: number) => onChange(Math.min(max, Math.max(1, value + delta)));

  return (
    <View style={[styles.counter, Squircle, { backgroundColor: theme.surface }]}>
      <CounterStep icon="minus" disabled={value <= 1} onPress={() => step(-1)} />
      <Text style={[Type.title2, styles.counterValue, { color: theme.text }]}>{value}</Text>
      <CounterStep icon="plus" disabled={value >= max} onPress={() => step(1)} />
    </View>
  );
}

/**
 * One end of the stepper. A module-level component, not one defined inside
 * `WorkerCounter` — a component created during render is a new type on every
 * render, so React unmounts and remounts the button on each tap instead of
 * updating it.
 */
function CounterStep({
  icon,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.counterBtn,
        { backgroundColor: theme.fillTertiary },
        pressed && !disabled ? { opacity: 0.6 } : null,
        disabled ? { opacity: 0.35 } : null,
      ]}>
      <Icon name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

function Caption({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text style={[Type.overline, styles.caption, { color: theme.textSecondary }]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  steps: { paddingBottom: 12 },
  body: { gap: 24, paddingHorizontal: Layout.gutter, paddingTop: 16, paddingBottom: 8 },
  field: { gap: 0 },
  caption: { paddingHorizontal: 4, paddingBottom: 10 },
  chipRow: { gap: 8, paddingRight: Layout.gutter },
  photoError: { paddingHorizontal: 4, paddingTop: 8 },
  textArea: { minHeight: 112, textAlignVertical: 'top' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  locationHint: { flex: 1, paddingHorizontal: 4 },

  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: { flex: 1, textAlign: 'center' },
  counterHint: { paddingHorizontal: 4, paddingTop: 8 },
});
