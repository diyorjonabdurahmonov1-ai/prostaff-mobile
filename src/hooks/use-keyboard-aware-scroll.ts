/**
 * Keeps the focused text input above the keyboard.
 *
 * `KeyboardAvoidingView` alone is not enough: it shrinks the container so the
 * content *can* fit, but it never scrolls, so a field halfway down a long form
 * stays exactly where it was — behind the keyboard. React Native's ScrollView
 * used to auto-scroll to the focused input and no longer does, so the scroll is
 * ours to do.
 *
 * Two things have to trigger it, and only together do they cover a real form:
 *
 *  1. The keyboard opening — handled by the `Keyboard` listener here.
 *  2. Moving from one field to the next while the keyboard is *already* open —
 *     no keyboard event fires for that, so `TextField` calls `scrollToFocused`
 *     from its `onFocus` via `KeyboardAwareScrollContext`.
 *
 * Measurement is done in window coordinates against the keyboard's own
 * `screenY`, which keeps it correct no matter what headers, footers or insets
 * sit around the scroll view.
 */

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  // React Native's own TextInput, not the app wrapper: this is only here for
  // the `State.currentlyFocusedInput()` static, which the wrapper does not
  // re-export (and does not need to — it renders the same native input).
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

/** Breathing room left between the field and the top of the keyboard. */
const GAP = 24;

/**
 * iOS fires `will` before the keyboard animates in, which lets the scroll ride
 * the same animation. Android only has `did`.
 */
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

export interface KeyboardAwareScroll {
  ref: React.RefObject<ScrollView | null>;
  /** Spread onto the ScrollView — tracks the offset the scroll math needs. */
  onScroll: ScrollHandler;
  scrollEventThrottle: number;
  /** Scroll whatever is focused right now into view. Safe to call any time. */
  scrollToFocused: () => void;
}

export function useKeyboardAwareScroll(onScrollProp?: ScrollHandler): KeyboardAwareScroll {
  const ref = useRef<ScrollView | null>(null);
  const offsetY = useRef(0);

  const onScroll = useCallback<ScrollHandler>(
    (event) => {
      offsetY.current = event.nativeEvent.contentOffset.y;
      onScrollProp?.(event);
    },
    [onScrollProp]
  );

  /**
   * `keyboardTop` is passed in on the keyboard event and read from
   * `Keyboard.metrics()` otherwise — on a focus change the keyboard is already
   * up, so its last known frame is the right one.
   */
  const scrollIntoView = useCallback((keyboardTop?: number) => {
    const input = TextInput.State.currentlyFocusedInput();
    const scroll = ref.current;
    if (!input || !scroll) return;

    const top = keyboardTop ?? Keyboard.metrics()?.screenY;
    if (top == null) return;

    input.measureInWindow((_x, y, _width, height) => {
      // A collapsed measurement means the input is not laid out yet; scrolling
      // on that would throw the list to a meaningless offset.
      if (height <= 0) return;
      const overlap = y + height + GAP - top;
      if (overlap <= 0) return;
      scroll.scrollTo({ y: Math.max(0, offsetY.current + overlap), animated: true });
    });
  }, []);

  const scrollToFocused = useCallback(() => {
    // One frame of slack: on a focus change the field may still be mounting,
    // and measuring it before layout returns zeros.
    setTimeout(() => scrollIntoView(), 50);
  }, [scrollIntoView]);

  useEffect(() => {
    const sub = Keyboard.addListener(SHOW_EVENT, (event) => {
      scrollIntoView(event.endCoordinates.screenY);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  return { ref, onScroll, scrollEventThrottle: 16, scrollToFocused };
}

/**
 * Lets a field deep inside the tree ask its scroll view to reveal it, without
 * every screen having to thread a ref down to each input.
 */
export const KeyboardAwareScrollContext = createContext<(() => void) | null>(null);

/** Returns a no-op outside a keyboard-aware scroll view, so fields stay usable. */
export function useScrollToFocused(): () => void {
  return useContext(KeyboardAwareScrollContext) ?? noop;
}

function noop() {}
