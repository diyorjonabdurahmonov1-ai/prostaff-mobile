/**
 * An incoming job, as a list row.
 *
 * This used to be a full-screen takeover with a looping alarm. It isn't one any
 * more: an order arrives as a card in the worker's list, the push notification
 * does the alerting, and the worker answers when they choose to. The urgency is
 * still visible — the countdown bar drains and turns amber then rose — but it
 * no longer hijacks the phone.
 *
 * Everything a worker needs to say yes is on the card: what it pays, where it
 * is (on a real map), how far away that is, and how long is left.
 */

import { Image } from 'expo-image';
import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PhotoViewer, usePhotoViewer } from '@/components/ui/photo-viewer';
import { YandexMap } from '@/components/yandex-map';
import { Ease } from '@/constants/motion';
import { Layout, Radius, Squircle, Type, categoryTint } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { formatCountdown, useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { categoryIcon } from '@/lib/category-icon';
import { categoryName, formatSom } from '@/lib/format';
import { resolveImageUrl } from '@/lib/image';
import { distanceKm } from '@/lib/location';
import { hasCoords } from '@/lib/maps';
import type { Order, WorkerProfile } from '@/lib/types';

/** Below this many seconds the bar goes rose — the last-chance threshold. */
const URGENT_AT = 20;

interface IncomingOrderCardProps {
  order: Order;
  /** The worker's own profile, used for the "how far is it" line. */
  profile?: WorkerProfile | null;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  /**
   * Open the full job. The card is a summary by design — one line of
   * description, one thumbnail — and a worker who wants the rest of it should
   * not have to accept the job to find out what it is.
   */
  onOpen?: () => void;
  /** Drop the map to keep dense lists light. */
  compact?: boolean;
}

export function IncomingOrderCard({
  order,
  profile,
  busy = false,
  onAccept,
  onReject,
  onOpen,
  compact = false,
}: IncomingOrderCardProps) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const { byId } = useCategories();

  const deadline = order.invite_expires_at ? new Date(order.invite_expires_at).getTime() : null;
  const { remaining, expired } = useCountdown({ deadline });

  // Older orders carry one photo in `image_url` and no list; the card should
  // not have to know which kind of order it is looking at.
  const photos = order.images?.length ? order.images : order.image_url ? [order.image_url] : [];
  const viewer = usePhotoViewer();

  const category = byId(order.category_id);
  const tint = categoryTint(order.category_id);
  const away = profile && hasCoords(order) ? distanceKm(profile, order) : null;
  const urgent = remaining <= URGENT_AT;
  const barColor = urgent ? theme.danger : remaining <= 45 ? theme.warning : theme.success;

  return (
    <View style={[styles.card, Squircle, { backgroundColor: theme.surface }]}>
      <View style={[styles.strip, { backgroundColor: tint }]} />

      <View style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.tile, Squircle, { backgroundColor: `${tint}1A` }]}>
            <Icon name={categoryIcon(category)} size={26} color={tint} />
          </View>

          <Pressable
            onPress={onOpen}
            disabled={!onOpen}
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityLabel={onOpen ? t('work.view') : undefined}
            style={({ pressed }) => [styles.headText, pressed && onOpen ? styles.pressed : null]}>
            <Text style={[Type.headline, { color: theme.text }]} numberOfLines={2}>
              {order.description || categoryName(category, lang) || t('company.orderTitle')}
            </Text>
            <View style={styles.metaRow}>
              {away !== null ? (
                <View style={styles.meta}>
                  <Icon name="location" size={13} color={theme.primary} />
                  <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                    {`${away.toFixed(1)} km`}
                  </Text>
                </View>
              ) : null}
              {order.gender !== 'any' ? (
                <View style={styles.meta}>
                  <Icon name="person" size={13} color={theme.textTertiary} />
                  <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                    {t(order.gender === 'male' ? 'order.male' : 'order.female')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          {/* The way into the whole job: every photo, the full description, the
              map, and who placed it. Deliberately a control of its own rather
              than "tap the card" — the two buttons underneath are destructive
              enough that the card must not answer a stray tap. */}
          {onOpen ? (
            <Pressable
              onPress={onOpen}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('work.view')}
              style={({ pressed }) => [
                styles.eye,
                Squircle,
                { backgroundColor: theme.fillQuaternary },
                pressed && styles.pressed,
              ]}>
              <Icon name="eye-outline" size={20} color={theme.primary} />
            </Pressable>
          ) : null}

          {/* A 48-point thumbnail of a broken pipe tells a worker nothing —
              it is a promise that there is a photo, so tapping it has to open
              one. The badge says how many are behind it. */}
          {photos.length > 0 ? (
            <Pressable
              onPress={() => viewer.open(0)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('order.photo')}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              <Image
                source={{ uri: resolveImageUrl(photos[0]) }}
                style={[styles.thumb, { borderColor: theme.separator }]}
                contentFit="cover"
                transition={160}
              />
              {photos.length > 1 ? (
                <View style={[styles.thumbBadge, { backgroundColor: theme.text }]}>
                  <Text style={[Type.caption2Emphasized, { color: theme.surface }]}>
                    {photos.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>

        {/* The pay, the largest thing on the card. */}
        <View style={[styles.priceRow, { borderTopColor: theme.separator }]}>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{t('order.price')}</Text>
          <Text style={[Type.title2, { color: theme.text }]}>
            {`${formatSom(order.price)} ${t('common.som')}`}
          </Text>
        </View>

        {!compact && hasCoords(order) ? (
          <YandexMap
            point={{ lat: order.lat, lng: order.lng }}
            height={150}
            route
            caption={t('order.location')}
          />
        ) : null}

        {/* How long is left — a bar, not an alarm. */}
        {deadline && !expired ? (
          <View style={styles.timer}>
            <View style={[styles.track, { backgroundColor: theme.fillTertiary }]}>
              <TimerBar remaining={remaining} color={barColor} />
            </View>
            <Text style={[Type.footnoteEmphasized, { color: barColor }]}>
              {formatCountdown(remaining)}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={t('incoming.accept')}
            icon="checkmark"
            onPress={onAccept}
            loading={busy}
            disabled={expired}
            style={{ backgroundColor: theme.success }}
          />
          <Button
            label={t('incoming.reject')}
            variant="ghost"
            onPress={onReject}
            disabled={busy}
          />
        </View>
      </View>

      <PhotoViewer
        uris={photos}
        index={viewer.index}
        visible={viewer.visible}
        onClose={viewer.close}
      />
    </View>
  );
}

/** Drains left-to-right over the window the server granted. */
function TimerBar({ remaining, color }: { remaining: number; color: string }) {
  const width = useSharedValue(1);

  useEffect(() => {
    // 120s is the server's search window (store.InviteTTL).
    width.value = withTiming(Math.max(0, Math.min(1, remaining / 120)), {
      duration: 550,
      easing: Ease.linear,
    });
  }, [remaining, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, overflow: 'hidden', marginHorizontal: Layout.gutter },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  body: { padding: 16, paddingLeft: 20, gap: 12 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eye: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: Radius.md, borderWidth: 1 },
  thumbBadge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
  },

  timer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },

  actions: { gap: 4 },
});
