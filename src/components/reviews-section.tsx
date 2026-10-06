/**
 * What people said, under the score that summarises it.
 *
 * The rating on a profile is one number; it tells a customer how it went for
 * everyone else and nothing about why. These are the sentences behind it, and
 * they are the part someone actually reads before letting a stranger into their
 * home.
 *
 * A rating left without words still gets a row. Dropping those would make a
 * profile read better than its own average — five silent one-star jobs would
 * leave nothing on screen but the good review someone bothered to type.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';

import { Avatar } from '@/components/ui/avatar';
import { Section } from '@/components/ui/list';
import { Stars } from '@/components/ui/stars';
import { Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import type { Review } from '@/lib/types';

const AVATAR = 38;
/** Separators start past the avatar, the way a Contacts list does. */
const SEPARATOR_INSET = Layout.gutter + AVATAR + 12;

interface ReviewsSectionProps {
  reviews: Review[];
  /** Hidden entirely when there is nothing yet — pass `false` on a busy screen. */
  showEmpty?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ReviewsSection({ reviews, showEmpty = true, style }: ReviewsSectionProps) {
  const t = useT();
  const theme = useTheme();

  if (reviews.length === 0 && !showEmpty) return null;

  return (
    <Section
      header={reviews.length > 0 ? `${t('reviews.title')} · ${reviews.length}` : t('reviews.title')}
      separatorInset={SEPARATOR_INSET}
      style={style}
    >
      {reviews.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[Type.subhead, { color: theme.textSecondary }]}>{t('reviews.none')}</Text>
        </View>
      ) : (
        reviews.map((review) => <ReviewRow key={review.id} review={review} />)
      )}
    </Section>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const { lang } = useI18n();
  const theme = useTheme();

  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';
  const date = new Date(review.created_at).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.row}>
      <Avatar name={review.author_name} imageUrl={review.author_avatar} size={AVATAR} />

      <View style={styles.body}>
        <View style={styles.head}>
          <Text
            style={[Type.subheadEmphasized, styles.name, { color: theme.text }]}
            numberOfLines={1}
          >
            {review.author_name || '—'}
          </Text>
          <Text style={[Type.caption1, { color: theme.textTertiary }]}>{date}</Text>
        </View>

        <Stars value={review.stars} size={13} />

        {review.comment ? (
          <Text style={[Type.subhead, styles.comment, { color: theme.textSecondary }]}>
            {review.comment}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 14,
  },
  body: { flex: 1, gap: 5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1 },
  comment: { marginTop: 1 },
  empty: { paddingHorizontal: Layout.gutter, paddingVertical: 18 },
});
