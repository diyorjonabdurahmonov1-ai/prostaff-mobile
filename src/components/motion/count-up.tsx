/**
 * Counts a figure up from zero when it first lands on screen.
 *
 * Only worth doing for numbers the user came to the screen *for* — a balance,
 * a rating, a job count. Everything else should just render its value.
 *
 * Driven from JS rather than Reanimated because the payload is text: the
 * component isolates its own re-renders, so a 600ms count-up repaints one
 * `<Text>` and nothing around it.
 */

import { useEffect, useRef, useState } from 'react';
import {
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Text } from '@/components/text';

import { Duration } from '@/constants/theme';

interface CountUpProps {
  value: number;
  /** 600ms is the sweet spot — longer and the number feels stuck. */
  duration?: number;
  /** Digits after the decimal point. Ratings use 1, counts use 0. */
  decimals?: number;
  /** Wraps the final string (thousand separators, a suffix, …). */
  format?: (value: number) => string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Decelerating curve — fast out of the gate, gentle into the final digit. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({
  value,
  duration = Duration.page + 180,
  decimals = 0,
  format,
  style,
  numberOfLines,
}: CountUpProps) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (delta === 0) {
      setShown(value);
      return;
    }

    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const next = start + delta * easeOutCubic(t);
      setShown(next);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
        frame.current = null;
      }
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Land on the target so an interrupted run never leaves a stale figure.
      from.current = value;
    };
  }, [value, duration]);

  const rounded = decimals > 0 ? shown.toFixed(decimals) : String(Math.round(shown));

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {format ? format(Number(rounded)) : rounded}
    </Text>
  );
}
