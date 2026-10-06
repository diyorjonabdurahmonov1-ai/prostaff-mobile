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
import { endPaySession, updatePaySession, usePaySession } from '@/lib/pay-session';
import { detectBrand, needsCvv, submitCard } from '@/lib/payments';

/**
 * The card screen.
 *
 * # Why a screen and not the sheet it used to be
 *
 * International cards need a CVV, and confirming one means leaving the app for
 * the bank's 3DS page and coming back. A sheet had room for neither: three
 * fields and a privacy note already crowded it, and a sheet that survives a
 * trip out to a browser and back is a sheet fighting the navigator. A screen
 * gets a back button, a keyboard that behaves, and somewhere to put the CVV.
 *
 * # What it does not keep
 *
 * The card number and the CVV live in this component's state while they are
 * being typed and nowhere else. Not stored, not logged, not remembered between
 * payments; the next top-up starts from empty fields, and leaving the screen
 * discards them. Saved cards would need Atmos's card token, which is a
 * different flow and deliberately not this one.
 */
export default function PayCardScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const session = usePaySession();

  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The session is gone — answered, or this screen was reached directly. There
  // is nothing to pay for, so leave rather than draw an empty form.
  useEffect(() => {
    if (!session && !busy) router.back();
  }, [session, busy, router]);

  const brand = detectBrand(card);
  const wantsCvv = needsCvv(brand);
  // Shown under the number so the payer can see it was read the way they meant
  // it — and so the CVV field appearing has a visible reason.
  const brandHint =
    brand === 'local'
      ? t('pay.brandLocal')
      : brand === 'visa'
        ? 'Visa'
        : brand === 'mastercard'
          ? 'Mastercard'
          : undefined;

  const cardDigits = card.replace(/\D/g, '');
  const expiryDigits = expiry.replace(/\D/g, '');
  const cvvDigits = cvv.replace(/\D/g, '');
  const ready =
    cardDigits.length >= 16 && expiryDigits.length === 4 && (!wantsCvv || cvvDigits.length >= 3);

  /** Leaving without paying. Nothing was charged, so nothing is claimed. */
  const cancel = () => {
    if (busy) return; // A request is in flight; let it land rather than orphan it.
    endPaySession({ status: 'canceled', payment: session?.payment });
    router.back();
  };

  const submit = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const accepted = await submitCard(session.payment.id, card, expiry, cvv);
      updatePaySession({
        brand: accepted.brand,
        redirectUrl: accepted.redirect_url,
        maskedPan: accepted.masked_pan,
      });
      // `replace`, not `push`: the card has been handed over and the payer must
      // not be able to swipe back and send it a second time.
      if (accepted.next === 'otp' || accepted.next === '3ds') {
        router.replace('/pay/otp');
        return;
      }
      // The card needed no confirmation at all — a 3DS-exempt card the server
      // captured in the same request. Already paid; nothing left to show.
      endPaySession({ status: 'success', payment: accepted.payment ?? session.payment });
      router.back();
    } catch (err) {
      // The server passes the gateway's own wording through — "card expired",
      // "insufficient funds" — and it says more than anything invented here.
      console.log(err);

      setError(err instanceof ApiError ? err.message : t('common.genericError'));
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('pay.cardTitle')} back onBack={cancel} />}
      footer={
        <Button
          label={t('pay.continue')}
          icon="card"
          onPress={submit}
          loading={busy}
          disabled={!ready}
          fullWidth
        />
      }
    >
      <View style={styles.fields}>
        <View style={[styles.amount, { backgroundColor: theme.surface, borderRadius: Radius.lg }]}>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>
            {t('pay.amountLabel')}
          </Text>
          <Text style={Type.title2}>{formatSom(session?.payment.amount ?? 0)}</Text>
        </View>

        <TextField
          label={t('pay.cardNumber')}
          value={card}
          onChangeText={(v) => setCard(formatCardNumber(v))}
          keyboardType="number-pad"
          autoComplete="cc-number"
          maxLength={23}
          placeholder="0000 0000 0000 0000"
          hint={brandHint}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label={t('pay.expiry')}
              value={expiry}
              onChangeText={(v) => setExpiry(formatExpiry(v))}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="00/00"
            />
          </View>
          {/* Only international cards carry one, and a CVV box on a UzCard form
              is a field the payer will hunt for on the back of a card that does
              not have it. Shown when the number says it is needed. */}
          {wantsCvv ? (
            <View style={styles.half}>
              <TextField
                label={t('pay.cvv')}
                value={cvv}
                onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="000"
                secureTextEntry
                hint={t('pay.cvvHint')}
              />
            </View>
          ) : null}
        </View>

        {/* Said plainly, because a card form that does not say it invites the
            question. */}
        <Text style={[Type.caption1, { color: theme.textSecondary }]}>{t('pay.cardPrivacy')}</Text>

        {error ? <Text style={[Type.footnote, { color: theme.danger }]}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

/** Groups a card number in fours as it is typed, the way the card is printed. */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Inserts the slash so MM/YY reads back the way it does on the card. */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const styles = StyleSheet.create({
  fields: { gap: Space.md },
  amount: { padding: Space.md, gap: Space.xs },
  row: { flexDirection: 'row', gap: Space.md },
  half: { flex: 1 },
});
