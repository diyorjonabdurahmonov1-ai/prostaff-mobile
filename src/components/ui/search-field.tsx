import {
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';
import { TextInput } from '@/components/text';

import { Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (value: string) => void;
}

/** UISearchBar: system-fill capsuleish field with a magnifier and a clear button. */
export function SearchField({ value, onChangeText, placeholder, ...rest }: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View style={[styles.field, Squircle, { backgroundColor: theme.fillTertiary }]}>
      <Icon name="search" size={17} color={theme.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        selectionColor={theme.primary}
        autoCorrect={false}
        clearButtonMode="never"
        style={[styles.input, Type.body, { color: theme.text }]}
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Icon name="close-circle" size={17} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: Radius.grouped,
    paddingHorizontal: 8,
  },
  input: { flex: 1, paddingVertical: 0 },
});
