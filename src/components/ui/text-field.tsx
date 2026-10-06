import { forwardRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';
import { Text, TextInput } from '@/components/text';

import { Layout, Radius, Squircle, Type } from '@/constants/theme';
import { useScrollToFocused } from '@/hooks/use-keyboard-aware-scroll';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  locked?: boolean;
  lockedHint?: string;
  /** Static text glued to the left of the input, e.g. a dial code. */
  prefix?: string;
  /** Custom trailing accessory (eye toggle, unit, …). */
  accessory?: ReactNode;
  /** Show the iOS clear button once there is text. */
  clearable?: boolean;
  onClear?: () => void;
}

/**
 * iOS form field: a grouped surface with continuous corners, 17pt body text and
 * a tint ring while focused. Labels sit above as grouped-table captions.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    icon,
    locked,
    lockedHint,
    prefix,
    accessory,
    clearable,
    onClear,
    style,
    editable,
    multiline,
    value,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const disabled = locked || editable === false;
  // Moving from one field to the next fires no keyboard event — the keyboard is
  // already up — so the field asks to be revealed itself.
  const scrollToFocused = useScrollToFocused();

  const ring = error ? theme.danger : focused ? theme.primary : 'transparent';

  return (
    <View style={styles.wrap}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
          {locked ? <Icon name="lock-closed" size={11} color={theme.textTertiary} /> : null}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          Squircle,
          multiline && styles.fieldMultiline,
          {
            backgroundColor: disabled ? theme.fillQuaternary : theme.surface,
            // Always 2pt so gaining focus tints the ring without shifting layout.
            borderColor: ring,
            borderWidth: 2,
          },
        ]}>
        {icon ? <Icon name={icon} size={18} color={theme.textTertiary} /> : null}
        {prefix ? <Text style={[Type.body, { color: theme.text }]}>{prefix}</Text> : null}

        <TextInput
          ref={ref}
          editable={!disabled}
          value={value}
          multiline={multiline}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.primary}
          onFocus={(e) => {
            setFocused(true);
            scrollToFocused();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, Type.body, { color: theme.text }, style]}
          {...rest}
        />

        {clearable && value ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Icon name="close-circle" size={17} color={theme.textTertiary} />
          </Pressable>
        ) : null}
        {accessory}
      </View>

      {error ? (
        <Text style={[Type.footnote, styles.hint, { color: theme.danger }]}>{error}</Text>
      ) : locked && lockedHint ? (
        <Text style={[Type.footnote, styles.hint, { color: theme.textSecondary }]}>{lockedHint}</Text>
      ) : hint ? (
        <Text style={[Type.footnote, styles.hint, { color: theme.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 7, alignSelf: 'stretch' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: Layout.rowHeight + 6,
    borderRadius: Radius.grouped,
    paddingHorizontal: Layout.gutter,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, paddingVertical: 12 },
  hint: { paddingHorizontal: 4 },
});
