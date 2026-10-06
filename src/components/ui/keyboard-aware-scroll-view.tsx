/**
 * A ScrollView that keeps the focused field above the keyboard.
 *
 * Drop-in replacement for `ScrollView` on any screen with a form. It wires the
 * measurement in `useKeyboardAwareScroll` and publishes the reveal callback so
 * `TextField` can ask to be scrolled into view when focus moves between fields
 * with the keyboard already up.
 *
 * `keyboardShouldPersistTaps="handled"` is the default here on purpose: without
 * it, the first tap on a button while an input is focused is swallowed by the
 * keyboard dismissal and the user has to tap twice.
 */

import { type ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import {
  KeyboardAwareScrollContext,
  useKeyboardAwareScroll,
} from '@/hooks/use-keyboard-aware-scroll';

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: ReactNode;
}

export function KeyboardAwareScrollView({
  children,
  onScroll,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'interactive',
  ...rest
}: KeyboardAwareScrollViewProps) {
  // Destructured rather than held as one object: the lint rule reads a property
  // access on a ref-carrying object as reading the ref during render.
  const { ref, onScroll: handleScroll, scrollEventThrottle, scrollToFocused } =
    useKeyboardAwareScroll(onScroll ?? undefined);

  return (
    <KeyboardAwareScrollContext.Provider value={scrollToFocused}>
      <ScrollView
        ref={ref}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        {...rest}>
        {children}
      </ScrollView>
    </KeyboardAwareScrollContext.Provider>
  );
}
