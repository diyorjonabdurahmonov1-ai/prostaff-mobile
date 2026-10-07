/**
 * The job a worker is on right now, at the top of their home screen.
 *
 * Once a worker accepts a job, everything they need for it lives here: who the
 * customer is and their number, where to go (with directions one tap away),
 * and the two ways the job ends — finished, or called off. It used to be a
 * single row pointing at the orders tab, which put the customer's phone and the
 * address two screens away from a worker standing at a door.
 *
 * Both endings ask first. They are one tap each and cannot be undone, and a
 * mis-tap on "cancel" while reaching for the phone would hand the job back to
 * the dispatcher with the customer still waiting.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { PulseRing } from '@/components/motion';
import { Text } from '@/components/text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { YandexMap } from '@/components/yandex-map';
import { Gradients, Radius, Squircle, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { categoryIcon } from '@/lib/category-icon';
import { categoryName, formatSom, telUrl } from '@/lib/format';
import { hasCoords, openInYandex } from '@/lib/maps';
import type { Order, OrderCustomer } from '@/lib/types';

type Ending = 'complete' | 'cancel';

export function ActiveJobCard({
  order,
  onOpen,
  onEnded,
}: {
  order: Order;
  /** The full job screen. */
  onOpen: () => void;
  /** Called once the job is over, so the home screen can re-read its state. */
  onEnded: () => Promise<unknown> | void;
}) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const { byId } = useCategories();

  const [customer, setCustomer] = useState<OrderCustomer | null>(null);
  const [confirm, setConfirm] = useState<Ending | null>(null);
  const [busy, setBusy] = useState(false);

  // The customer's name and photo are a nicety; the job works without them.
  useEffect(() => {
    let live = true;
    api
      .get<OrderCustomer>(`/orders/${order.id}/customer`)
      .then((c) => live && setCustomer(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [order.id]);

  const category = byId(order.category_id);
  const phone = order.customer_phone || customer?.phone || '';
  const name = order.customer_name || customer?.name || t('job.customer');
  const point = hasCoords(order) ? { lat: order.lat, lng: order.lng } : null;

  /**
   * Part of a team the customer is still putting together.
   *
   * Asked for four, two found: the two who said yes wait until the rest are
   * found or the customer decides to start without them. Until then the server
   * keeps the address and number back — a worker who set off now might arrive
   * to a job that is called off for want of hands — and the card says why.
   */
  const gathering = (order.batch_size ?? 0) > 1 && order.batch_ready === false;

  const end = async (how: Ending) => {
    setBusy(true);
    try {
      // Cancelling is the API's own provider exit (the same call the order
      // screen makes). Finishing from the worker's side is new: the server has
      // so far let only the customer mark a job complete.
      await api.post(
        how === 'cancel' ? `/orders/${order.id}/cancel` : `/worker/orders/${order.id}/complete`,
      );
      setConfirm(null);
      await onEnded();
    } catch (err) {
      setConfirm(null);
      Alert.alert(
        t('common.error'),
        err instanceof Error && err.message ? err.message : t('common.genericError'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, Squircle, { backgroundColor: theme.surface }, dark ? null : styles.lift]}>
      {/* ---- Header band: what the job is and what it pays ---- */}
      <LinearGradient
        colors={[Gradients.worker[0], Gradients.brand[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.band}>
        <View style={styles.bandTop}>
          <View style={styles.livePill}>
            <View style={styles.liveDot}>
              <PulseRing size={7} color="#FFFFFF" filled />
              <View style={styles.liveCore} />
            </View>
            <Text style={[Type.caption1Emphasized, styles.white]}>{t('job.inProgress')}</Text>
          </View>
          <Pressable
            onPress={onOpen}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('work.title')}
            style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}>
            <Text style={[Type.caption1Emphasized, styles.white]}>{t('job.details')}</Text>
            <Icon name="chevron-forward" size={12} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.bandBody}>
          <View style={styles.catTile}>
            <Icon name={categoryIcon(category)} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={[Type.headline, styles.white]} numberOfLines={1}>
              {categoryName(category, lang) || t('company.orderTitle')}
            </Text>
            {order.description ? (
              <Text style={[Type.footnote, styles.dim]} numberOfLines={2}>
                {order.description}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[Type.title1, styles.white]}>
          {formatSom(order.price)}
          <Text style={[Type.subhead, styles.dim]}> {t('common.som')}</Text>
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {gathering ? (
          <View style={[styles.waiting, Squircle, { backgroundColor: theme.warningSoft }]}>
            <View style={[styles.waitingGlyph, { backgroundColor: theme.surface }]}>
              <Icon name="hourglass" size={22} color={theme.warning} />
            </View>
            <View style={styles.flex}>
              <Text style={[Type.subheadEmphasized, { color: theme.text }]}>
                {t('job.gatheringTitle')}
              </Text>
              <Text style={[Type.footnote, { color: theme.textSecondary }]}>
                {t('job.gatheringBody', {
                  found: order.batch_found ?? 1,
                  total: order.batch_size ?? 1,
                })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ---- Who ---- */}
        {gathering ? null : (
          <View style={[styles.customer, Squircle, { backgroundColor: theme.fillQuaternary }]}>
            <Avatar name={name} imageUrl={customer?.avatar_url} size={44} />
            <View style={styles.flex}>
              <Text style={[Type.caption1, { color: theme.textSecondary }]}>{t('job.customer')}</Text>
              <Text style={[Type.subheadEmphasized, { color: theme.text }]} numberOfLines={1}>
                {name}
              </Text>
              {phone ? (
                <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
                  {phone}
                </Text>
              ) : null}
            </View>
            {phone ? (
              <Pressable
                onPress={() => Linking.openURL(telUrl(phone))}
                accessibilityRole="button"
                accessibilityLabel={t('incoming.callCustomer')}
                style={({ pressed }) => [
                  styles.callBtn,
                  { backgroundColor: theme.success },
                  pressed && styles.pressed,
                ]}>
                <Icon name="call" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* ---- Where ---- The same Yandex map the rest of the app uses; a tap
            anywhere on it, or on its "Yo'l ko'rsatish" pill, asks Yandex for
            directions. */}
        {point && !gathering ? (
          <View style={styles.mapBlock}>
            <YandexMap
              point={point}
              height={150}
              route
              caption={t('order.location')}
              onPress={() => openInYandex(point, true)}
            />
          </View>
        ) : null}

        {/* ---- How it ends ---- */}
        <View style={styles.actions}>
          {/* Hand-built rather than a Button variant: the system has no soft
              destructive style, and a blue outline would read as the safe
              choice next to the green one. */}
          <Pressable
            onPress={() => setConfirm('cancel')}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cancelBtn,
              Squircle,
              { backgroundColor: theme.dangerSoft },
              (pressed || busy) && styles.pressed,
            ]}>
            <Icon name="close" size={20} color={theme.danger} />
            <Text style={[Type.bodyEmphasized, { color: theme.danger }]}>{t('job.cancel')}</Text>
          </Pressable>
          {gathering ? null : (
            <Button
              label={t('job.done')}
              icon="checkmark"
              onPress={() => setConfirm('complete')}
              disabled={busy}
              fullWidth={false}
              style={[styles.flex, { backgroundColor: theme.success }]}
            />
          )}
        </View>
      </View>

      <Sheet
        visible={confirm !== null}
        onClose={() => !busy && setConfirm(null)}
        title={t('job.areYouSure')}
        message={confirm === 'cancel' ? t('job.cancelConfirm') : t('job.doneConfirm')}
        footer={
          <>
            <Button
              label={confirm === 'cancel' ? t('job.yesCancel') : t('job.yesDone')}
              icon={confirm === 'cancel' ? 'close' : 'checkmark'}
              variant={confirm === 'cancel' ? 'danger' : 'primary'}
              loading={busy}
              onPress={() => confirm && end(confirm)}
              style={confirm === 'cancel' ? undefined : { backgroundColor: theme.success }}
            />
            <Button label={t('job.no')} variant="gray" disabled={busy} onPress={() => setConfirm(null)} />
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  white: { color: '#FFFFFF' },
  dim: { color: 'rgba(255,255,255,0.82)' },

  card: { borderRadius: Radius.xl, overflow: 'hidden' },
  lift: {
    shadowColor: '#1B6EF3',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  band: { padding: 18, gap: 14 },
  bandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  liveDot: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  liveCore: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bandBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catTile: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  body: { padding: 14, gap: 12 },
  customer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
  },
  waitingGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapBlock: { borderRadius: Radius.lg, overflow: 'hidden' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: Radius.lg,
  },
});
