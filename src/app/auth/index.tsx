import { useRouter } from 'expo-router';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguagePill } from '@/components/auth-form';
import { BrandMark } from '@/components/brand-mark';
import { DotGrid, FadeUp, PopIn } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Duration, Layout, Shadow, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * The app's front door — the screen the native splash hands over to.
 *
 * It repeats the splash composition (dot field, centred mark, wordmark) and
 * then animates the rest in, so the handover is one continuous move rather
 * than a cut. The mark springs up first, the wordmark and tagline follow at
 * 180ms, and the two calls to action stagger in behind them.
 *
 * Sign-in and sign-up are given equal visual weight — a marketplace needs both
 * halves of its market, and a first-time worker should not have to hunt for
 * the button that is actually meant for them.
 */
export default function WelcomeScreen() {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <DotGrid opacity={dark ? 0.06 : 0.04} />

      <View style={styles.hero}>
        <PopIn from={0.6} duration={Duration.page} style={dark ? undefined : Shadow.float}>
          <BrandMark size={72} />
        </PopIn>

        <FadeUp delay={180} style={styles.words}>
          <Text style={[Type.title1, styles.wordmark, { color: theme.text }]}>
            {t('common.appName')}
          </Text>
          <Text style={[Type.subhead, styles.tagline, { color: theme.textSecondary }]}>
            {t('auth.tagline')}
          </Text>
        </FadeUp>
      </View>

      <View style={styles.cta}>
        <FadeUp delay={320}>
          <Text style={[Type.footnote, styles.lead, { color: theme.textSecondary }]}>
            {t('auth.welcomeLead')}
          </Text>
        </FadeUp>

        <FadeUp delay={320} style={styles.button}>
          <Button label={t('auth.loginTitle')} size="lg" onPress={() => router.push('/auth/login')} />
        </FadeUp>

        <FadeUp delay={420} style={styles.button}>
          <Button
            label={t('auth.registerTitle')}
            size="lg"
            variant="outline"
            onPress={() => router.push('/auth/register')}
          />
        </FadeUp>

        <FadeUp delay={520} style={styles.language}>
          <LanguagePill />
        </FadeUp>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // 60 / 40 split: brand above, everything actionable within thumb reach.
  hero: { flex: 6, alignItems: 'center', justifyContent: 'center', gap: 20 },
  words: { alignItems: 'center', gap: 8 },
  wordmark: { letterSpacing: -0.5 },
  tagline: { textAlign: 'center' },

  cta: {
    flex: 4,
    justifyContent: 'flex-end',
    paddingHorizontal: Layout.gutter,
    paddingBottom: 12,
    gap: 12,
  },
  lead: { textAlign: 'center', paddingHorizontal: 16, marginBottom: 8 },
  button: { alignSelf: 'stretch' },
  language: { alignItems: 'center', marginTop: 12 },
});
