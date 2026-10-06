/**
 * Motion curves.
 *
 * The system runs on one signature curve — `cubic-bezier(0.34, 1.56, 0.64, 1)`.
 * It overshoots the target once (that 1.56 control point) and settles without a
 * second bounce, which is what makes an entrance feel sprung rather than
 * mechanical. Everything that *arrives* uses it; only things that *leave* use
 * an ease-in, because an element on its way out should not overshoot.
 *
 * Durations, stagger steps and the spring equivalents live in
 * `constants/theme.ts` alongside the rest of the tokens.
 */

import { Easing } from 'react-native-reanimated';

export const Ease = {
  /** The signature spring curve. Entrances, toggles, anything appearing. */
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Deceleration without overshoot — progress, draw-ins, colour shifts. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Exits only. */
  in: Easing.bezier(0.7, 0, 0.84, 0),
  /** Two-sided moves that start and end at rest. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Loops (shimmer sweep, ripple) — constant velocity reads as ambient. */
  linear: Easing.linear,
} as const;

/**
 * Delay for the nth item of a staggered group, capped so a long list never
 * makes the last row wait. Beyond ~8 items the eye stops reading it as a
 * sequence anyway.
 */
export function staggerDelay(index: number, step: number, max = 8): number {
  return Math.min(index, max) * step;
}
