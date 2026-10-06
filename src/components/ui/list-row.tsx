import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Layout, Radius, Squircle } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Row, type RowProps } from './list';

import { type IconName } from './icon';

interface ListRowProps extends Omit<RowProps, 'icon'> {
  icon?: IconName;
  left?: ReactNode;
  right?: ReactNode;
}

/**
 * A standalone grouped row — same cell as {@link Row} but carrying its own
 * rounded surface, for the odd place that needs one row outside a Section.
 */
export function ListRow(props: ListRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        Squircle,
        { backgroundColor: theme.surface, borderRadius: Radius.grouped },
      ]}>
      <Row {...props} />
    </View>
  );
}

/** Full-width hairline used to separate stacked rows outside a Section. */
export function RowSeparator({ inset = Layout.separatorInset }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, marginLeft: inset, backgroundColor: theme.separator }} />
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
