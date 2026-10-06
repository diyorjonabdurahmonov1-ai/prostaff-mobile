import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Space, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiError } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { endPaySession, usePaySession } from '@/lib/pay-session';
import { confirmCard, open3DS, resendOtp, submitOtp } from '@/lib/payments';

/**
 * The confirmation screen — one screen for both ways a card is confirmed.
 *
 * # Why they share a screen
 *
 * They are the same step: the card is in, nothing has been captured, and the
 * payer has one thing left to do. What that thing is depends on the card, and
 * the server has already said which in `brand`/`redirectUrl`:
 *
 *   - a local card was texted a code, so this asks for it;
 *   - an international one needs 3DS at the payer's own bank, so this opens
 *     that page and captures the payment when they come back.
 *
 * Splitting them into two routes would duplicate the amount, the error line,
 * the cancel path and the settle handling to save one conditional.
 *
 * # Why the code is not read from the SMS automatically
 *
 * It could be, on Android. It is not, because the same screen is reached by a
 * payer who never gets an SMS at all, and a field that sometimes fills itself
 * and sometimes does not is worse than one that never does.
 */
export default function PayConfirmScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const session = usePaySession();

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** Whether the payer has been out to the bank's page and come back. */
  const [returned, setReturned] = useState(false);

  const is3DS = !!session?.redirectUrl;

  useEffect(() => {
    if (!session && !busy) router.back();
  }, [session, busy, router]);

  /**
   * Backstop for leaving by a swipe or the hardware back button rather than by
   * the cancel button. Without it the wallet screen would wait for ever on a
   * promise nothing is left to answer.
   *
   * Harmless when the flow ended properly: `endPaySession` takes the resolver
   * before using it, so a second call finds nothing and does nothing.
   */
  useEffect(() => () => endPaySession({ status: 'canceled' }), []);

  const cancel = () => {
    if (busy) return;
    endPaySession({ status: 'canceled', payment: session?.payment });
    router.back();
  };

  const settle = (result: Awaited<ReturnType<typeof submitOtp>>) => {
    endPaySession(result);
    router.back();
  };

  /** Local card: spend the code. This is the call that moves the money. */
  const confirmOtp = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      settle(await submitOtp(session.payment.id, otp));
    } catch (err) {
      console.dir(err);
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
      setBusy(false);
    }
  };

  /** International card: out to the bank, then capture. */
  const goTo3DS = async () => {
    if (!session?.redirectUrl) return;
    setBusy(true);
    setError(null);
    setNote(null);
    await open3DS(session.redirectUrl);
    // Coming back proves only that the browser closed — the payer may have
    // authenticated, failed, or given up — so the capture below is what decides
    // it, and it is a separate tap. Doing it automatically here would show a
    // failure to somebody who deliberately backed out.
    setReturned(true);
    setBusy(false);
  };

  const capture = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      settle(await confirmCard(session.payment.id));
    } catch (err) {
      console.log(err);
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await resendOtp(session.payment.id);
      setNote(t('pay.otpResent'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const otpReady = otp.replace(/\D/g, '').length >= 4;

  return (
    <Screen
      header={
        <Header title={is3DS ? t('pay.confirmTitle') : t('pay.otpTitle')} back onBack={cancel} />
      }
      footer={
        is3DS ? (
          <Button
            label={returned ? t('pay.confirm') : t('pay.open3ds')}
            icon={returned ? undefined : 'card'}
            onPress={returned ? capture : goTo3DS}
            loading={busy}
            fullWidth
          />
        ) : (
          <Button
            label={t('pay.confirm')}
            onPress={confirmOtp}
            loading={busy}
            disabled={!otpReady}
            fullWidth
          />
        )
      }
    >
      <View style={styles.fields}>
        <View style={[styles.amount, { backgroundColor: theme.surface, borderRadius: Radius.lg }]}>
          <Text style={[Type.footnote, { color: 'white' }]}>{t('pay.amountLabel')}</Text>
          <Text style={Type.title2}>{formatSom(session?.payment.amount ?? 0)}</Text>
          {session?.maskedPan ? (
            <Text style={[Type.footnote, { color: theme.textSecondary }]}>{session.maskedPan}</Text>
          ) : null}
        </View>

        <Text style={[Type.footnote, { color: theme.textSecondary }]}>
          {is3DS
            ? returned
              ? t('pay.confirmAfter3ds')
              : t('pay.confirm3dsMessage')
            : t('pay.otpMessage')}
        </Text>

        {is3DS ? null : (
          <>
            <TextField
              label={t('pay.otpLabel')}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
            />
            <Button label={t('pay.otpResend')} variant="ghost" onPress={resend} disabled={busy} />
          </>
        )}

        {note ? <Text style={[Type.footnote, { color: theme.textSecondary }]}>{note}</Text> : null}
        {error ? <Text style={[Type.footnote, { color: theme.danger }]}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Space.md },
  amount: { padding: Space.md, gap: Space.xs },
});
