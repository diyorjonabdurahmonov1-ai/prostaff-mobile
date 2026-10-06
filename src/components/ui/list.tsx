import { Children, Fragment, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from '@/components/text';

import { Hairline, Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

/* ------------------------------------------------------------------ *
 * Section — an inset-grouped table view section
 * ------------------------------------------------------------------ */

interface SectionProps {
  children: ReactNode;
  /** Uppercase caption above the card. */
  header?: string;
  /** Explanatory copy under the card. */
  footer?: string;
  /** Side margin of the card. Pass 0 when the parent already pads. */
  inset?: number;
  /** Left inset of the hairline separators — use `Row.ICON_INSET` for icon rows. */
  separatorInset?: number;
  /** Drop the card chrome and just stack the rows (for full-bleed lists). */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * iOS grouped list: rounded card on the grouped background, hairline separators
 * between rows that stop short of the leading edge, caption above, note below.
 */
export function Section({
  children,
  header,
  footer,
  inset = Layout.gutter,
  separatorInset = Layout.separatorInset,
  plain = false,
  style,
}: SectionProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={[{ marginHorizontal: inset }, style]}>
      {header ? (
        <Text style={[styles.header, { color: theme.textSecondary }]}>{header.toUpperCase()}</Text>
      ) : null}

      <View
        style={[
          styles.card,
          !plain && { backgroundColor: theme.surface, borderRadius: Radius.grouped },
          Squircle,
        ]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: Hairline,
                  marginLeft: separatorInset,
                  backgroundColor: theme.separator,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>

      {footer ? (
        <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Row — a single cell inside a Section
 * ------------------------------------------------------------------ */

export interface RowProps {
  title: string;
  /** Secondary line under the title. */
  subtitle?: string;
  /** Right-hand detail text, iOS "value 1" style. */
  value?: string;
  icon?: IconName;
  /** Fill of the rounded icon tile. Defaults to the tint colour. */
  iconColor?: string;
  /** Replaces the icon tile entirely (avatars, flags, …). */
  left?: ReactNode;
  /** Replaces the accessory (switches, badges, …). */
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'primary' | 'danger';
  /** Centres the label — used for destructive / confirming rows. */
  centered?: boolean;
  /** Caption above the value instead of beside it — for long, wrapping values. */
  stacked?: boolean;
  disabled?: boolean;
}

/** Left inset for separators when the rows carry icon tiles. */
const ICON_INSET = Layout.gutter + Layout.iconTile + 12;

export function Row({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  left,
  right,
  chevron,
  onPress,
  tone = 'default',
  centered = false,
  stacked = false,
  disabled = false,
}: RowProps) {
  const theme = useTheme();

  const titleColor =
    tone === 'primary' ? theme.primary : tone === 'danger' ? theme.danger : theme.text;
  const showChevron = chevron ?? (!!onPress && !right && !centered);

  const body = (
    <>
      {left ??
        (icon ? (
          <View style={[styles.tile, Squircle, { backgroundColor: iconColor ?? theme.primary }]}>
            <Icon name={icon} size={17} color="#FFFFFF" />
          </View>
        ) : null)}

      <View style={[styles.labels, centered && styles.labelsCentered]}>
        {stacked ? (
          <>
            <Text style={[Type.footnote, { color: theme.textSecondary }]}>{title}</Text>
            <Text style={[Type.body, styles.stackedValue, { color: titleColor }]}>
              {value || '—'}
            </Text>
          </>
        ) : (
          <Text
            style={[Type.body, { color: titleColor }, centered && styles.centeredText]}
            numberOfLines={centered ? 1 : 2}>
            {title}
          </Text>
        )}
        {subtitle ? (
          <Text style={[Type.footnote, styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value && !stacked ? (
        <Text style={[Type.body, styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {showChevron ? (
        <Icon name="chevron-forward" size={17} color={theme.textTertiary} style={styles.chevron} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.highlight },
        disabled && { opacity: 0.4 },
      ]}>
      {body}
    </Pressable>
  );
}

Row.ICON_INSET = ICON_INSET;

const styles = StyleSheet.create({
  header: {
    ...Type.footnote,
    paddingHorizontal: 4,
    paddingBottom: 7,
  },
  footer: {
    ...Type.footnote,
    paddingHorizontal: 4,
    paddingTop: 7,
  },
  card: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Layout.rowHeight,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 11,
  },
  tile: {
    width: Layout.iconTile,
    height: Layout.iconTile,
    borderRadius: Radius.xs + 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: { flex: 1, gap: 1 },
  labelsCentered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  stackedValue: { marginTop: 2 },
  subtitle: { marginTop: 1 },
  value: { flexShrink: 1, maxWidth: '55%', textAlign: 'right' },
  chevron: { marginRight: -2, opacity: 0.9 },
});
