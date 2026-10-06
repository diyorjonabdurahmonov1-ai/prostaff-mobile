/**
 * The app's `Text` and `TextInput`.
 *
 * Identical to React Native's, except that the OS font-size setting does not
 * resize them. The layout here is built on a fixed type ramp with fixed line
 * heights, buttons and rows sized to match; letting the system multiply every
 * size by up to 2× does not enlarge that layout, it breaks it — labels clip
 * inside buttons and two-column rows collide.
 *
 * React 19 dropped `defaultProps` on function components, so there is no way
 * to set this once on React Native's own components. Hence the wrappers, and
 * hence the rule: import `Text` / `TextInput` from here, never from
 * `react-native`.
 *
 * `allowFontScaling` sits before the spread, so a screen that genuinely wants
 * to follow the system setting can still pass `allowFontScaling` itself.
 *
 * Trade-off, stated plainly: this opts the app out of an accessibility feature.
 * Someone who enlarges text system-wide because they cannot read small type
 * gets no larger text here. If that ever needs revisiting, changing `false` to
 * a `maxFontSizeMultiplier` of ~1.3 in these two components is the whole edit.
 */

import { forwardRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

export const Text = forwardRef<RNText, TextProps>(function Text(props, ref) {
  return <RNText allowFontScaling={false} {...props} ref={ref} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput allowFontScaling={false} {...props} ref={ref} />;
});

// Declaration merging: the name is both the component (value) and the instance
// type, so `useRef<TextInput>(null)` and `<TextInput />` both keep working
// after an import is switched over from react-native. That is exactly what
// no-redeclare exists to catch in plain JS, and exactly what makes these two
// drop-in replacements in TypeScript.
/* eslint-disable @typescript-eslint/no-redeclare */
export type Text = RNText;
export type TextInput = RNTextInput;
/* eslint-enable @typescript-eslint/no-redeclare */
