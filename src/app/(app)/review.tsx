import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Button } from '@/components/ui/button';
import { YandexMap } from '@/components/yandex-map';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { PhotoSlider } from '@/components/ui/photo-slider';
import { Screen } from '@/components/ui/screen';
import { Layout, Radius, Type } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { categoryName, formatSom } from '@/lib/format';
import type { Order } from '@/lib/types';
import { finishFlow } from '@/lib/nav';
import { useOrderFlow } from '@/store/order-flow';

/** A few random characters, so two customers ordering in the same millisecond
 *  cannot collide on a batch id. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function ReviewScreen() {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { byId } = useCategories();
  const { draft } = useOrderFlow();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = draft.categoryId ? byId(draft.categoryId) : undefined;
  const genderLabel =
    draft.gender === 'male'
      ? t('order.male')
      : draft.gender === 'female'
        ? t('order.female')
        : t('order.any');

  /**
   * How many orders go out — one per worker wanted, or one per worker named.
   * Also how many times the price is paid, since each order pays its own worker.
   */
  const workersNeeded = draft.targetWorkerIds.length || Math.max(draft.workersNeeded || 1, 1);
  const unitPrice = Number(draft.price) || 0;

  const submit = async () => {
    // Guard rather than fail silently — a missing category used to make the
    // submit button do nothing at all.
    if (!draft.categoryId) {
      setError(t('category.subtitle'));
      router.replace('/categories');
      return;
    }
    setSubmitting(true);
    setError(null);

    /**
     * One order per worker wanted.
     *
     * A job for five people is five orders, not one order with five places on
     * it. The multi-place version was built and taken back out over the money:
     * when only three of five accepted, those three had already been charged
     * their commission for an evening that was two people short, and there was
     * no honest way to price or refund the difference. Splitting the job splits
     * that question with it — each order is taken or it is not, each worker
     * pays for the job they actually got, and nobody is ever owed a refund.
     *
     * It is also the only shape that answers "I want *both* of these two
     * workers". One order aimed at two people is still one job: the first to
     * accept takes it and the second is told it is gone.
     *
     * Named workers get one order each, addressed to them alone. An ordinary
     * request for five gets five identical broadcasts — a worker who takes one
     * becomes busy and is dropped from the others, so five different people end
     * up with them.
     */
    const targets: (string | null)[] = draft.targetWorkerIds.length
      ? draft.targetWorkerIds
      : Array.from({ length: workersNeeded }, () => null);

    /**
     * What ties these orders together for the server.
     *
     * Five independent broadcasts rang every nearby worker five times — five
     * cards and five pushes each, four of them dead the moment the worker
     * answered the first. Sharing an id lets dispatch offer each worker one
     * order out of the set, which is what asking for five workers meant.
     *
     * Only for a real batch: a single order has nothing to be grouped with, and
     * an empty id is what every ordinary order carries.
     */
    const batchId = targets.length > 1 ? `b${Date.now().toString(36)}${randomSuffix()}` : '';

    // In parallel, and settled rather than raced: one order failing must not
    // cancel the four already on their way, and the customer is owed an honest
    // count of what actually went out.
    const results = await Promise.allSettled(
      targets.map((workerId) =>
        api.post<Order>('/orders', {
          category_id: draft.categoryId,
          gender: draft.gender,
          description: draft.description,
          images: draft.images,
          phone: draft.phone,
          price: unitPrice,
          lat: draft.lat,
          lng: draft.lng,
          ...(batchId ? { batch_id: batchId, batch_size: targets.length } : {}),
          ...(workerId ? { target_worker_ids: [workerId] } : {}),
        })
      )
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length) {
      const first = failed[0] as PromiseRejectedResult;
      setError(first.reason instanceof ApiError ? first.reason.message : t('common.genericError'));
      setSubmitting(false);
      return;
    }
    if (failed.length > 0) {
      // Partly through is still through. Say which part, and let them look at
      // what did go out rather than stranding them on this screen.
      Alert.alert(
        t('order.partialTitle'),
        t('order.partialBody', { sent: results.length - failed.length, total: results.length })
      );
    }
    finishFlow('/orders');
  };

  return (
    <Screen
      padded={false}
      header={
        <Header
          title={t('order.reviewTitle')}
          rightIcon="close"
          onRightPress={() => router.back()}
          back={false}
        />
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={workersNeeded > 1 ? t('order.submitMany', { n: workersNeeded }) : t('order.submit')}
            icon="paper-plane"
            onPress={submit}
            loading={submitting}
          />
          <Button label={t('order.editOrder')} variant="ghost" onPress={() => router.back()} />
        </View>
      }>
      {/* Who is being called, when the customer chose them by hand. First,
          because it is the part of this order that is unusual — and the part
          they would want to catch before sending if it were wrong. The gender
          row is dropped alongside it: naming people settles the question, and
          the server ignores the filter for a targeted order anyway. */}
      {draft.targetWorkerIds.length > 0 ? (
        <Section
          header={`${t('pick.selected')} · ${draft.targetWorkerIds.length}`}
          footer={t('pick.selectedHint')}
          style={styles.first}>
          {draft.targetWorkerNames.length > 0 ? (
            draft.targetWorkerNames.map((name, i) => (
              <Row key={`${name}-${i}`} icon="person" iconColor="#5E7CFA" title={name} />
            ))
          ) : (
            <Row title={t('pick.chosen', { n: draft.targetWorkerIds.length })} />
          )}
        </Section>
      ) : null}

      <Section
        header={t('order.category')}
        style={draft.targetWorkerIds.length > 0 ? styles.section : styles.first}>
        <Row title={categoryName(category, lang) || '—'} />
        {draft.targetWorkerIds.length === 0 ? (
          <Row title={t('order.gender')} value={genderLabel} />
        ) : null}
      </Section>

      <Section header={t('order.description')} style={styles.section}>
        <Row stacked title={t('order.description')} value={draft.description || '—'} />
      </Section>

      {/* What this costs.
          With several workers the figure on the form is what *each* of them is
          paid, so the total is spelled out here rather than left as arithmetic
          the customer does after the fact: ten workers at 200 000 is two
          million so'm, and that is not a number to be surprised by. */}
      <Section
        header={t('order.price')}
        style={styles.section}
        footer={workersNeeded > 1 ? t('order.priceEachHint') : t('order.priceHint')}>
        <Row
          title={workersNeeded > 1 ? t('order.priceEach') : t('order.price')}
          value={`${formatSom(unitPrice)} ${t('common.som')}`}
        />
        {workersNeeded > 1 ? (
          <>
            <Row title={t('order.ordersCount', { n: workersNeeded })} />
            <Row
              title={t('order.priceTotal', { n: workersNeeded })}
              value={`${formatSom(unitPrice * workersNeeded)} ${t('common.som')}`}
            />
          </>
        ) : null}
      </Section>

      <Section header={t('order.phone')} style={styles.section}>
        <Row title={t('order.phone')} value={draft.phone} />
        <Row
          title={t('order.location')}
          value={draft.locationResolved ? t('order.locationReady') : t('order.useDefaultLocation')}
        />
      </Section>

      {/* Last look at where the worker is being sent. */}
      <View style={styles.mapWrap}>
        <YandexMap point={{ lat: draft.lat, lng: draft.lng }} height={170} />
      </View>

      {/* Everything the worker will be shown, at a size worth checking. */}
      <PhotoSlider uris={draft.images} header={t('order.photo')} height={220} />

      {error ? (
        <Text style={[Type.footnote, styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 6 },
  first: { marginTop: 20 },
  section: { marginTop: 28 },
  mapWrap: { paddingHorizontal: Layout.gutter, marginTop: 20 },
  photoWrap: { paddingHorizontal: Layout.gutter, marginTop: 28 },
  photo: { width: '100%', height: 200, borderRadius: Radius.lg },
  error: { textAlign: 'center', marginTop: 16, paddingHorizontal: Layout.gutter },
});
