/**
 * The public offer, as a screen.
 *
 * It lives outside `(app)` on purpose: the registration screen links to it, and
 * somebody has to be able to read what they are agreeing to *before* they agree
 * to it — a route behind the auth guard could not be opened from there.
 *
 * The text itself is in constants/legal.ts. This file only lays it out, and
 * ends with the two ways to reach the office, because a question about the
 * terms is the most likely reason anybody is on this screen.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SupportSheet } from '@/components/support-sheet';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import {
  OFFER_LEAD,
  OFFER_SECTIONS,
  OFFER_UPDATED,
  OFFER_VERSION,
} from '@/constants/legal';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';

export default function OfferScreen() {
  const t = useT();
  const theme = useTheme();
  const { lang } = useI18n();
  const [support, setSupport] = useState(false);

  const updated = new Date(OFFER_UPDATED).toLocaleDateString();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Header title={t('legal.offer')} back />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[Type.footnote, { color: theme.textSecondary }]}>
          {t('legal.updated')}: {updated} · {t('legal.version')} {OFFER_VERSION}
        </Text>

        {/* The document is Uzbek whichever language the app is in — say so
            rather than let a Russian- or English-speaking reader assume the
            app simply failed to translate this screen. */}
        {lang === 'uz' ? null : (
          <Text style={[Type.footnote, styles.langNote, { color: theme.textSecondary }]}>
            {t('legal.uzOnly')}
          </Text>
        )}

        <Text style={[Type.body, styles.lead, { color: theme.text }]}>{OFFER_LEAD}</Text>

        {OFFER_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[Type.headline, { color: theme.text }]}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text
                key={paragraph}
                style={[Type.callout, styles.paragraph, { color: theme.textSecondary }]}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.contact}>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{t('legal.questions')}</Text>
          <Button label={t('support.title')} variant="secondary" onPress={() => setSupport(true)} />
        </View>
      </ScrollView>

      <SupportSheet visible={support} onClose={() => setSupport(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: Layout.gutter, paddingTop: 8, paddingBottom: 48 },
  langNote: { marginTop: 6 },
  lead: { marginTop: 16 },
  section: { marginTop: 26, gap: 8 },
  paragraph: { lineHeight: 22 },
  contact: { marginTop: 36, gap: 12 },
});
