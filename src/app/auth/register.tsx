import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBrand, FieldRow, LanguagePill } from '@/components/auth-form';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Section } from '@/components/ui/list';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { setPendingSignup } from '@/store/pending-signup';

import { Icon } from '@/components/ui/icon';

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

export default function RegisterScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { requestOtp } = useAuth();

  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drives the shortcut to the sign-in screen shown under the error.
  const [taken, setTaken] = useState(false);

  const submit = async () => {
    setError(null);
    setTaken(false);
    if (!name.trim()) {
      setError(t('auth.nameRequired'));
      return;
    }
    if (digits.length !== 9) {
      setError(t('auth.invalidPhone'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    const normalized = `+998${digits}`;
    setLoading(true);
    try {
      const res = await requestOtp(normalized);
      // Name and password go through module memory, not route params — see
      // store/pending-signup.
      setPendingSignup({ phone: normalized, name: name.trim(), password });
      router.push({
        pathname: '/auth/otp',
        params: {
          phone: normalized,
          devCode: res.dev_code ?? '',
          expiresIn: String(res.expires_in ?? ''),
        },
      });
    } catch (err) {
      // The number already has an account — say so in the user's language and
      // point at the screen that can actually help.
      if (err instanceof ApiError && err.code === 'phone_taken') {
        setError(t('auth.phoneTaken'));
        setTaken(true);
        return;
      }
      setTaken(false);
      setError(err instanceof ApiError ? err.message : t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Header back border={false} right={<LanguagePill />} />

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <AuthBrand subtitle={t('auth.registerSubtitle')} />

          <Section inset={Layout.gutter} style={styles.form}>
            <FieldRow>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('auth.namePlaceholder')}
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.primary}
                autoCapitalize="words"
                style={[Type.body, styles.input, { color: theme.text }]}
              />
            </FieldRow>

            <FieldRow prefix="+998">
              <TextInput
                value={formatPhone(digits)}
                onChangeText={(raw) => {
                  setDigits(unformat(raw));
                  // A different number deserves a fresh verdict.
                  setTaken(false);
                }}
                keyboardType="phone-pad"
                placeholder="XX XXX-XX-XX"
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.primary}
                maxLength={12}
                style={[Type.body, styles.input, { color: theme.text }]}
              />
            </FieldRow>

            <FieldRow>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.primary}
                autoCapitalize="none"
                style={[Type.body, styles.input, { color: theme.text }]}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textTertiary}
                />
              </Pressable>
            </FieldRow>
          </Section>

          <Pressable
            style={({ pressed }) => [styles.terms, pressed && { opacity: 0.6 }]}
            onPress={() => setAgreed(!agreed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
          >
            <Icon
              name={agreed ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={agreed ? theme.primary : theme.textTertiary}
            />
            <Text style={[Type.footnote, styles.termsText, { color: theme.textSecondary }]}>
              {t('auth.termsAgree')}
            </Text>
          </Pressable>

          {/* Ticking the box is a claim to have read something, so the
              something has to be one tap away — and openable before the
              account exists, which is why the route sits outside the guards. */}
          <Pressable
            onPress={() => router.push('/legal/offer')}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={[Type.footnote, styles.offerLink, { color: theme.primary }]}>
              {t('legal.readOffer')}
            </Text>
          </Pressable>

          {error ? (
            <Text style={[Type.footnote, styles.error, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={t('auth.registerButton')}
              onPress={submit}
              loading={loading}
              disabled={!agreed}
            />
            {taken ? (
              <Button
                label={t('auth.goToLogin')}
                variant="ghost"
                onPress={() => router.replace('/auth/login')}
              />
            ) : null}
          </View>

          <Pressable
            onPress={() => router.replace('/auth/login')}
            hitSlop={8}
            style={({ pressed }) => [styles.bottomLink, pressed && { opacity: 0.5 }]}
          >
            <Text style={[Type.subhead, { color: theme.textSecondary }]}>
              {t('auth.hasAccount')}{' '}
              <Text style={[Type.subheadEmphasized, { color: theme.primary }]}>
                {t('auth.signIn')}
              </Text>
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40, flexGrow: 1 },
  tabs: { paddingHorizontal: Layout.gutter, marginTop: 24 },
  form: { marginTop: 20 },
  input: { flex: 1, paddingVertical: 14 },
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: Layout.gutter + 4,
    marginTop: 18,
  },
  termsText: { flex: 1 },
  offerLink: {
    marginTop: 8,
    paddingHorizontal: Layout.gutter + 4 + 32,
    textDecorationLine: 'underline',
  },
  error: { textAlign: 'center', marginTop: 12, paddingHorizontal: Layout.gutter },
  actions: { paddingHorizontal: Layout.gutter, marginTop: 20 },
  bottomLink: { alignItems: 'center', marginTop: 18 },
});
