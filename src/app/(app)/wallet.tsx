import { Text } from '@/components/text';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SelectableChip } from '@/components/ui/chip';
import { Header } from '@/components/ui/header';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Gradients, Layout, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { checkout } from '@/lib/payments';
import type { Wallet } from '@/lib/types';
import { useAuth } from '@/store/auth';

import { Icon } from '@/components/ui/icon';

const PRESETS = [10000, 20000, 50000, 100000];

export default function WalletScreen() {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const { refreshMe } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState('50000');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Warnings read differently from confirmations, and "not confirmed yet" is a
  // warning: the money may well be on its way.
  const [noticeTone, setNoticeTone] = useState<'success' | 'warning' | 'danger'>('success');

  const load = useCallback(async () => {
    try {
      const w = await api.get<Wallet>('/wallet');
      setWallet(w);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // A top-up settles at the provider, not here, so "did my money arrive" is a
  // question this screen has to be able to answer on demand.
  const { refreshControl } = useRefresh(async () => {
    await load();
    await refreshMe();
  });

  /**
   * Opens the Atmos invoice page, then waits to be told the money landed.
   *
   * The wait is not decoration. The bank confirms a payment to our backend, not
   * to this phone, so the browser closing proves nothing — the balance below is
   * only redrawn once the server says it settled.
   */
  const pay = async () => {
    const value = parseInt(amount.replace(/\D/g, ''), 10);
    if (!value || value < 1000) {
      setNoticeTone('danger');
      setNotice(t('wallet.minHint'));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await checkout('/wallet/topup', { amount: value });

      // Closing the card form is not an outcome to report: nothing was
      // charged, and a banner saying so would read as a failure that happened
      // to somebody rather than a choice they made.
      if (result.status === 'canceled') return;
      if (result.status === 'success') {
        setNoticeTone('success');
        setNotice(t('wallet.success'));
      } else if (result.status === 'pending') {
        // Late, not lost. Saying "failed" here is the one message that would be
        // actively untrue for somebody whose card has already been charged.
        setNoticeTone('warning');
        setNotice(t('wallet.pending'));
      } else {
        setNoticeTone('danger');
        setNotice(t('wallet.failed'));
      }
      await load();
      await refreshMe();
    } catch (err) {
      setNoticeTone('danger');
      setNotice(t('common.genericError'));
      console.dir(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      refreshControl={refreshControl}
      footer={<Button label={t('wallet.pay')} icon="card" onPress={pay} loading={busy} />}
    >
      <Header title={t('wallet.title')} large />

      {/* Balance card */}
      <View style={[styles.cardWrap, dark ? null : Shadow.card]}>
        <LinearGradient
          colors={[Gradients.wallet[0], Gradients.wallet[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, Squircle]}
        >
          <View style={styles.cardTop}>
            <Text style={[Type.footnote, styles.cardLabel]}>{t('wallet.balance')}</Text>
            <Icon name="wallet" size={22} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={[Type.largeTitle, styles.cardValue]}>
            {formatSom(wallet?.balance ?? 0)}
            <Text style={[Type.title3, styles.cardUnit]}> {t('common.som')}</Text>
          </Text>
          {wallet && wallet.credit_limit > 0 ? (
            <Text style={[Type.footnote, styles.cardCredit]}>
              {t('wallet.creditLimit')}: {formatSom(wallet.credit_limit)} {t('common.som')}
            </Text>
          ) : null}
        </LinearGradient>
      </View>

      {/* Provider. One gateway, so this states it rather than asking — a picker
          with a single option is a question with one answer. */}
      <Text style={[Type.footnote, styles.caption, { color: theme.textSecondary }]}>
        {t('wallet.provider').toUpperCase()}
      </Text>
      <View style={[styles.block, styles.providerRow]}>
        <View style={[styles.providerBadge, Squircle, { backgroundColor: theme.surface }]}>
          <Icon name="card" size={20} color={theme.primary} />
          <View style={styles.providerText}>
            <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{t('wallet.atmos')}</Text>
            <Text style={[Type.caption1, { color: theme.textSecondary }]}>
              {t('wallet.atmosHint')}
            </Text>
          </View>
        </View>
      </View>

      {/* Amount */}
      <Text style={[Type.footnote, styles.caption, { color: theme.textSecondary }]}>
        {t('wallet.amount').toUpperCase()}
      </Text>
      <View style={[styles.block, styles.presets]}>
        {PRESETS.map((p) => (
          <SelectableChip
            key={p}
            label={formatSom(p)}
            selected={amount === String(p)}
            onToggle={() => setAmount(String(p))}
          />
        ))}
      </View>

      <View style={styles.block}>
        <TextField
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          hint={t('wallet.minHint')}
          icon="cash-outline"
        />
      </View>

      {notice ? (
        <Text
          style={[
            Type.footnote,
            styles.notice,
            {
              color:
                noticeTone === 'success'
                  ? theme.success
                  : noticeTone === 'warning'
                    ? theme.warningText
                    : theme.danger,
            },
          ]}
        >
          {notice}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardWrap: { marginHorizontal: Layout.gutter, marginTop: 12 },
  card: { borderRadius: Radius.xl, padding: 22, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { color: 'rgba(255,255,255,0.85)' },
  cardValue: { color: '#FFFFFF' },
  cardUnit: { color: 'rgba(255,255,255,0.85)' },
  cardCredit: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  caption: { paddingHorizontal: Layout.gutter + 4, marginTop: 28, marginBottom: 8 },
  block: { paddingHorizontal: Layout.gutter },
  providerRow: { flexDirection: 'row' },
  providerBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.card,
    padding: 14,
  },
  providerText: { flex: 1, gap: 1 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { textAlign: 'center', marginTop: 20, paddingHorizontal: Layout.gutter },
});
