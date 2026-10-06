import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

interface StarsProps {
  value: number;
  /** when provided the component becomes an input */
  onChange?: (value: number) => void;
  size?: number;
  /** show the numeric value next to the stars (display mode) */
  showValue?: boolean;
  count?: number;
}

/**
 * Star rating — display or input.
 *
 * Earned stars carry a full-strength duotone fill and empty ones drop to the
 * bare stroke, so the row reads at a glance without either state resorting to
 * a solid glyph.
 */
export function Stars({ value, onChange, size = 22, showValue = false, count }: StarsProps) {
  const theme = useTheme();
  const stars = [1, 2, 3, 4, 5];
  const fill = '#F79009';

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {stars.map((i) => {
          const filled = i <= Math.round(value);
          const star = (
            <Icon
              name="star"
              size={size}
              weight={filled ? 'duotone' : 'regular'}
              duotoneOpacity={1}
              color={filled ? fill : theme.textQuaternary}
            />
          );
          return onChange ? (
            <Pressable
              key={i}
              onPress={() => onChange(i)}
              hitSlop={8}
              style={({ pressed }) => [styles.tap, pressed && { opacity: 0.5 }]}>
              {star}
            </Pressable>
          ) : (
            <View key={i}>{star}</View>
          );
        })}
      </View>

      {showValue ? (
        <Text style={[Type.footnoteEmphasized, { color: theme.textSecondary }]}>
          {value.toFixed(1)}
          {count !== undefined ? ` · ${count}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tap: { padding: 2 },
});
