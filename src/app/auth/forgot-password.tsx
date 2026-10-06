import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldRow } from '@/components/auth-form';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Section } from '@/components/ui/list';
import { Layout, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';

function formatPhone(digits: string): string {
  let result = '';
  for (let i = 0; i < digits.length && i < 9; i++) {
    if (i === 2) result += ' ';
    if (i === 5 || i === 7) result += '-';
    result += digits[i];
  }
  return result;
}

function unformat(text: string): string {
  return text.replace(/\D/g, '').slice(0, 9);
}

export default function ForgotPasswordScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { forgotPassword } = useAuth();

  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (digits.length !== 9) {
      setError(t('auth.invalidPhone'));
      return;
    }
    const normalized = `+998${digits}`;
    setLoading(true);
    try {
      const res = await forgotPassword(normalized);
      // The code screen is shared with sign-in; `mode` is what tells it to end
      // on the new-password screen instead of signing the user in.
      router.push({
        pathname: '/auth/otp',
        params: {
          phone: normalized,
          devCode: res.dev_code ?? '',
          expiresIn: String(res.expires_in ?? ''),
          mode: 'reset',
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}>
        <Header title={t('auth.forgotTitle')} back />

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[Type.subhead, styles.intro, { color: theme.textSecondary }]}>
            {t('auth.forgotSubtitle')}
          </Text>

          <Section inset={Layout.gutter}>
            <FieldRow prefix="+998">
              <TextInput
                value={formatPhone(digits)}
                onChangeText={(raw) => setDigits(unformat(raw))}
                keyboardType="phone-pad"
                placeholder="XX XXX-XX-XX"
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.primary}
                maxLength={12}
                autoFocus
                style={[Type.body, styles.input, { color: theme.text }]}
              />
            </FieldRow>
          </Section>

          {error ? (
            <Text style={[Type.footnote, styles.error, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            <Button label={t('auth.sendCode')} onPress={submit} loading={loading} />
            <Button label={t('auth.backToLogin')} variant="ghost" onPress={() => router.back()} />
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingTop: 20, paddingBottom: 40 },
  intro: { paddingHorizontal: Layout.gutter + 4, marginBottom: 18 },
  input: { flex: 1, paddingVertical: 14 },
  error: { textAlign: 'center', marginTop: 12, paddingHorizontal: Layout.gutter },
  actions: { paddingHorizontal: Layout.gutter, marginTop: 24, gap: 6 },
});
