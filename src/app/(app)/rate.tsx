import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Screen } from '@/components/ui/screen';
import { Stars } from '@/components/ui/stars';
import { TextField } from '@/components/ui/text-field';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { finishFlow } from '@/lib/nav';
import type { Rating } from '@/lib/types';

import { Icon } from '@/components/ui/icon';

export default function RateScreen() {
  const t = useT();
  const theme = useTheme();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      await api.post<Rating>(`/orders/${orderId}/rate`, {
        stars,
        comment: comment.trim() || undefined,
      });
      setDone(true);
    } catch {
      setBusy(false);
    }
  };

  // The rating is the last screen of a job, and the whole trail behind it —
  // the order form, the review, the finished order — is spent. `finishFlow`
  // empties it, so Back from the orders list leaves the app instead of walking
  // back into a rating that has already been given.
  const close = () => finishFlow('/orders');

  if (done) {
    return (
      <Screen scroll={false} padded={false} contentStyle={styles.center}>
        <View style={[styles.successGlyph, { backgroundColor: theme.successSoft }]}>
          <Icon name="heart" size={44} color={theme.success} />
        </View>
        <Text style={[Type.title2, styles.centerText, { color: theme.text }]}>
          {t('rate.thanks')}
        </Text>
        <View style={styles.successAction}>
          <Button label={t('common.done')} onPress={close} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      header={
        <Header title={t('rate.title')} rightIcon="close" onRightPress={close} back={false} />
      }
      footer={<Button label={t('rate.submit')} onPress={submit} loading={busy} disabled={stars < 1} />}>

      <View style={styles.body}>
        <Text style={[Type.title3, styles.centerText, { color: theme.text }]}>
          {t('rate.stars')}
        </Text>

        <View style={styles.starsWrap}>
          <Stars value={stars} onChange={setStars} size={42} />
          <Text style={[Type.subheadEmphasized, { color: theme.textSecondary }]}>
            {stars} / 5
          </Text>
        </View>

        <TextField
          label={t('rate.comment')}
          value={comment}
          onChangeText={setComment}
          placeholder={t('rate.commentPlaceholder')}
          multiline
          numberOfLines={3}
          style={styles.textArea}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerText: { textAlign: 'center' },
  successGlyph: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successAction: { alignSelf: 'stretch', marginTop: 28 },

  body: { paddingHorizontal: Layout.gutter, paddingTop: 32, gap: 24 },
  starsWrap: { alignItems: 'center', gap: 12 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
});
