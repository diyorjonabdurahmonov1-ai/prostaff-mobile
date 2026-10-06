/**
 * Password reset, last step. Reached from the code screen with a reset token
 * that authorises exactly one thing — setting this password. The user stays
 * signed out and lands back on the login screen, so the new password is used
 * once straight away rather than only being remembered later.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldRow } from '@/components/auth-form';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Icon } from '@/components/ui/icon';
import { Section } from '@/components/ui/list';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';

const MIN_PASSWORD_LENGTH = 6;

export default function NewPasswordScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; resetToken: string }>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(params.resetToken, password);
      router.replace('/auth/login');
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
        style={styles.flex}
      >
        <Header title={t('auth.newPasswordTitle')} back />

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[Type.subhead, styles.intro, { color: theme.textSecondary }]}>
            {t('auth.newPasswordSubtitle')}
          </Text>

          <Section inset={Layout.gutter}>
            <FieldRow>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={t('auth.newPasswordPlaceholder')}
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.primary}
                autoCapitalize="none"
                autoFocus
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

            <FieldRow>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                placeholder={t('auth.passwordConfirmPlaceholder')}
                placeholderTextColor={theme.textTertiary}
                selectionColor={theme.primary}
                autoCapitalize="none"
                style={[Type.body, styles.input, { color: theme.text }]}
              />
            </FieldRow>
          </Section>

          {error ? (
            <Text style={[Type.footnote, styles.error, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            <Button label={t('auth.savePassword')} onPress={submit} loading={loading} />
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
