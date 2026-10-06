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
import { DotGrid, FadeUp } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Section } from '@/components/ui/list';
import { Layout, Stagger, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useT } from '@/i18n';
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

export default function LoginScreen() {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const router = useRouter();
  const { login } = useAuth();
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
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
      await login(normalized, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <DotGrid opacity={dark ? 0.06 : 0.04} />

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="chevron-back" size={26} color={theme.primary} />
            </Pressable>
            <LanguagePill />
          </View>

          <AuthBrand subtitle={t('auth.loginSubtitle')} size={64} />

          {/* 70ms apart: enough to read as a sequence, not enough to wait on. */}
          <FadeUp index={0} step={Stagger.list} delay={260}>
            <Section inset={Layout.gutter} style={styles.form}>
              <FieldRow prefix="+998" icon="call-outline">
                <TextInput
                  value={formatPhone(digits)}
                  onChangeText={(raw) => setDigits(unformat(raw))}
                  keyboardType="phone-pad"
                  placeholder="XX XXX-XX-XX"
                  placeholderTextColor={theme.textTertiary}
                  selectionColor={theme.primary}
                  maxLength={12}
                  style={[Type.body, styles.input, { color: theme.text }]}
                />
              </FieldRow>

              <FieldRow icon="lock-closed">
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
          </FadeUp>

          <FadeUp index={1} step={Stagger.list} delay={260}>
            <Pressable
              onPress={() => router.push('/auth/forgot-password')}
              hitSlop={8}
              style={({ pressed }) => [styles.forgot, pressed && styles.pressed]}
            >
              <Text style={[Type.footnoteEmphasized, { color: theme.primary }]}>
                {t('auth.forgotPassword')}
              </Text>
            </Pressable>
          </FadeUp>

          {error ? (
            <Text style={[Type.footnote, styles.error, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <FadeUp index={2} step={Stagger.list} delay={260} style={styles.actions}>
            <Button label={t('auth.loginButton')} size="lg" onPress={submit} loading={loading} />
          </FadeUp>

          <FadeUp index={3} step={Stagger.list} delay={260}>
            <Pressable
              onPress={() => router.replace('/auth/register')}
              hitSlop={8}
              style={({ pressed }) => [styles.bottomLink, pressed && styles.pressed]}
            >
              <Text style={[Type.subhead, { color: theme.textSecondary, textAlign: 'center' }]}>
                {t('auth.noAccount')}{' '}
                <Text style={[Type.subheadEmphasized, { color: theme.primary }]}>
                  {t('auth.signUp')}
                </Text>
              </Text>
            </Pressable>
          </FadeUp>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40, flexGrow: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingTop: 8,
  },
  pressed: { opacity: 0.5 },
  form: { marginTop: 28 },
  input: { flex: 1, paddingVertical: 16 },
  forgot: { alignSelf: 'flex-end', paddingHorizontal: Layout.gutter + 4, paddingTop: 12 },
  error: { textAlign: 'center', marginTop: 12, paddingHorizontal: Layout.gutter },
  actions: { paddingHorizontal: Layout.gutter, marginTop: 24 },
  bottomLink: { alignItems: 'center', marginTop: 20 },
});
