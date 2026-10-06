import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { formatCountdown, useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { clearPendingSignup, getPendingSignup } from '@/store/pending-signup';

const CODE_LENGTH = 4;

/** Matches the server's per-phone SMS cooldown (otpResendWindow). */
const RESEND_COOLDOWN_SECONDS = 60;

/** Fallback when the server didn't say — the server's own OTP TTL is 2 minutes. */
const DEFAULT_CODE_TTL_SECONDS = 120;

export default function OtpScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { verifyOtp, requestOtp, forgotPassword, verifyResetCode } = useAuth();
  const params = useLocalSearchParams<{
    phone: string;
    devCode?: string;
    expiresIn?: string;
    /** 'reset' comes from the forgot-password screen; anything else signs in. */
    mode?: string;
  }>();
  const phone = params.phone ?? '';
  const isReset = params.mode === 'reset';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState(() => (params.devCode ?? '').length === CODE_LENGTH);
  const inputRef = useRef<TextInput>(null);

  // Both clocks start when the code that brought us here was sent.
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [codeTTL, setCodeTTL] = useState(
    () => Number(params.expiresIn) || DEFAULT_CODE_TTL_SECONDS
  );

  const { remaining: resendIn, expired: canResend } = useCountdown({
    deadline: sentAt + RESEND_COOLDOWN_SECONDS * 1000,
  });
  const { remaining: codeValidFor, expired: codeExpired } = useCountdown({
    deadline: sentAt + codeTTL * 1000,
  });

  // The sign-up details never travel as route params — see store/pending-signup.
  useEffect(() => clearPendingSignup, []);

  const submit = useCallback(
    async (value: string) => {
      setError(null);
      setLoading(true);
      try {
        if (isReset) {
          // Reset stays signed out: the code buys a token that authorises the new
          // password and nothing else.
          const res = await verifyResetCode(phone, value);
          router.replace({
            pathname: '/auth/new-password',
            params: { phone, resetToken: res.reset_token },
          });
          return;
        }
        const signup = getPendingSignup(phone);
        await verifyOtp(phone, value, signup?.name, signup?.password);
        clearPendingSignup();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('common.networkError'));
        setCode('');
        setLoading(false);
      }
    },
    [isReset, phone, router, t, verifyOtp, verifyResetCode]
  );

  const onChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(next);
    if (next.length === CODE_LENGTH && !codeExpired) submit(next);
  };

  const resend = async () => {
    if (!canResend) return;
    setError(null);
    setCode('');
    setLoading(true);
    try {
      // Reset goes back through forgot-password so an unregistered number still
      // gets no SMS, exactly as on the first send.
      const res = isReset ? await forgotPassword(phone) : await requestOtp(phone);
      setDevHint(!!res.dev_code);
      // Restart both clocks: this is a brand new code.
      setCodeTTL(res.expires_in || DEFAULT_CODE_TTL_SECONDS);
      setSentAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const cells = Array.from({ length: CODE_LENGTH });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Header title={t('auth.otpTitle')} back />

      <View style={styles.body}>
        <Text style={[Type.subhead, styles.subtitle, { color: theme.textSecondary }]}>
          {t('auth.otpSubtitle')}
          {'\n'}
          <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{phone}</Text>
        </Text>

        <Pressable style={styles.cells} onPress={() => inputRef.current?.focus()}>
          {cells.map((_, i) => {
            const char = code[i] ?? '';
            const active = i === Math.min(code.length, CODE_LENGTH - 1);
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  Squircle,
                  {
                    backgroundColor: theme.surface,
                    borderColor: active && !codeExpired ? theme.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[Type.title1, { color: theme.text }]}>{char}</Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          editable={!codeExpired}
          autoFocus
          style={styles.hiddenInput}
        />

        <Text
          style={[
            Type.footnote,
            styles.center,
            { color: codeExpired ? theme.danger : theme.textSecondary },
          ]}
        >
          {codeExpired
            ? t('auth.codeExpired')
            : t('auth.codeValidFor', { time: formatCountdown(codeValidFor) })}
        </Text>

        {error ? (
          <Text style={[Type.footnote, styles.center, { color: theme.danger }]}>{error}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={t('auth.verify')}
            onPress={() => submit(code)}
            loading={loading}
            disabled={code.length !== CODE_LENGTH || codeExpired}
          />
          <Button
            label={canResend ? t('auth.resend') : t('auth.resendIn', { s: resendIn })}
            onPress={resend}
            variant="ghost"
            disabled={!canResend}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Layout.gutter, paddingTop: 32, gap: 24 },
  subtitle: { textAlign: 'center' },
  center: { textAlign: 'center' },
  cells: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  cell: {
    width: 64,
    height: 72,
    borderRadius: Radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  actions: { gap: 6, marginTop: 8 },
});
