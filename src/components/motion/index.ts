/**
 * Motion primitives.
 *
 * Every animated behaviour in the product is one of these — screens compose
 * them, they never hand-roll a `withTiming`. That is what keeps the curve and
 * the durations identical across the app.
 */

export { CountUp } from './count-up';
export { DotGrid } from './dot-grid';
export { FadeUp, PopIn } from './fade-up';
export { ProgressRing } from './progress-ring';
export { PulseRing } from './pulse-ring';
export { Shimmer } from './shimmer';
export { Sparkline } from './sparkline';
