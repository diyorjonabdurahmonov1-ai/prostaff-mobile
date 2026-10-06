/**
 * IshTopish design system — iOS 17 × Material You hybrid.
 *
 * Geometry rides an 8pt grid; cards carry 20–28pt continuous corners. Type is
 * a two-family pairing: **DM Sans** for anything titular (600 weight) and
 * **Inter** for body copy (400), both with the full Latin-Extended range the
 * Uzbek alphabet needs (oʻ gʻ sh ch, plus Cyrillic for the RU locale).
 *
 * One brand blue drives the whole product; green / amber / rose are semantic
 * only. Dark mode drops to a true #0D0D0D and lifts the blue so it keeps AA
 * contrast, the same way iOS lifts systemBlue.
 */

import '@/global.css';

import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/** 1 physical pixel — separators and borders are always hairlines. */
export const Hairline = StyleSheet.hairlineWidth;

/* ------------------------------------------------------------------ *
 * Brand
 * ------------------------------------------------------------------ */

export const Brand = {
  primary: '#1B6EF3',
  primaryDark: '#1557C7',
  primaryPressed: '#1560DA',
  primarySoft: '#E8F0FE',
  primarySoftDark: '#16233D',
  onPrimary: '#FFFFFF',
  /** Near-black used for ink, never pure #000 in light mode. */
  ink: '#0A0A0A',
  /** Page surface behind cards. */
  canvas: '#F8F9FA',
  success: '#12B76A',
} as const;

/**
 * Two-stop ramps for hero surfaces. Kept shallow — the system is flat-first,
 * a gradient is a signal (live, earning, accepting) not decoration.
 */
export const Gradients = {
  brand: ['#3B84FF', '#1355C4'] as const,
  /** The "Online · Ish qidirmoqda" sweep. */
  online: ['#12B76A', '#059669'] as const,
  worker: ['#3B84FF', '#1B6EF3'] as const,
  company: ['#0BA5A5', '#087F7F'] as const,
  wallet: ['#3B84FF', '#1355C4'] as const,
  success: ['#12B76A', '#059669'] as const,
  urgent: ['#F97066', '#F43F5E'] as const,
};

/* ------------------------------------------------------------------ *
 * Raw palette
 * ------------------------------------------------------------------ */

/** Neutral ramp — Tailwind-adjacent greys, the ones the spec names directly. */
export const Neutral = {
  0: '#FFFFFF',
  25: '#FCFCFD',
  50: '#F8F9FA',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
  950: '#0A0A0A',
} as const;

/**
 * Semantic accents. Each has a solid tone, a tinted wash for chips/badges and
 * a darkened text tone that stays legible on that wash.
 */
export const SystemLight = {
  blue: '#1B6EF3',
  green: '#12B76A',
  amber: '#F79009',
  rose: '#F43F5E',
  violet: '#7A5AF8',
  teal: '#0BA5A5',
  indigo: '#4F46E5',
  gray: Neutral[500],
  gray2: Neutral[400],
  gray3: Neutral[300],
  gray4: Neutral[200],
  gray5: Neutral[100],
  gray6: Neutral[50],
} as const;

export const SystemDark = {
  blue: '#5B96FF',
  green: '#2BD67F',
  amber: '#FDB022',
  rose: '#FF6B85',
  violet: '#9B85FF',
  teal: '#2CC9C9',
  indigo: '#7C74F0',
  gray: '#8B9099',
  gray2: '#6B7078',
  gray3: '#4A4F57',
  gray4: '#33373D',
  gray5: '#222528',
  gray6: '#161616',
} as const;

/** Legacy accent export, remapped onto the IshTopish palette. */
export const Accent = {
  success: SystemLight.green,
  successSoft: 'rgba(18,183,106,0.12)',
  successDark: '#0A7343',
  warning: SystemLight.amber,
  warningSoft: 'rgba(247,144,9,0.14)',
  warningText: '#B54708',
  danger: SystemLight.rose,
  dangerSoft: 'rgba(244,63,94,0.12)',
  dangerText: '#C01048',
} as const;

/**
 * Tints assigned to work categories — the 4pt accent strip down the left of a
 * job card and the chip icon colour both read from here.
 */
export const CategoryTints = [
  '#1B6EF3',
  '#12B76A',
  '#F79009',
  '#7A5AF8',
  '#0BA5A5',
  '#F43F5E',
  '#4F46E5',
  '#E4761B',
] as const;

/** Stable per-category colour so a category looks the same on every screen. */
export function categoryTint(id: string | undefined): string {
  if (!id) return CategoryTints[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CategoryTints[hash % CategoryTints.length];
}

/* ------------------------------------------------------------------ *
 * Semantic colours
 * ------------------------------------------------------------------ */

export const Colors = {
  light: {
    /* tint */
    primary: Brand.primary,
    primaryDark: Brand.primaryDark,
    primaryPressed: Brand.primaryPressed,
    primarySoft: 'rgba(27,110,243,0.10)',
    primarySoftSolid: Brand.primarySoft,
    onPrimary: Brand.onPrimary,
    onPrimaryText: Brand.onPrimary,

    /* backgrounds */
    background: Brand.canvas,
    backgroundPage: Brand.canvas,
    backgroundPlain: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: Neutral[100],
    surfaceSelected: 'rgba(27,110,243,0.10)',
    backgroundElement: '#FFFFFF',
    backgroundSelected: 'rgba(27,110,243,0.10)',
    /** row highlight while pressed */
    highlight: Neutral[200],

    /* fills — translucent, layer over any background */
    fill: 'rgba(10,10,10,0.10)',
    fillSecondary: 'rgba(10,10,10,0.08)',
    fillTertiary: Neutral[100],
    fillQuaternary: 'rgba(10,10,10,0.04)',

    /* separators */
    separator: 'rgba(10,10,10,0.10)',
    border: Neutral[200],
    borderLight: '#F0F0F0',

    /* labels */
    text: Brand.ink,
    textSecondary: Neutral[500],
    textMuted: Neutral[400],
    textTertiary: '#B6BCC6',
    textQuaternary: '#DDE1E6',

    /* status */
    success: SystemLight.green,
    successSoft: 'rgba(18,183,106,0.12)',
    successSoftSolid: '#E6F9F1',
    successDark: '#0A7343',
    warning: SystemLight.amber,
    warningSoft: 'rgba(247,144,9,0.14)',
    warningSoftSolid: '#FEF0C7',
    warningText: '#B54708',
    danger: SystemLight.rose,
    dangerSoft: 'rgba(244,63,94,0.12)',
    dangerSoftSolid: '#FFF1F3',
    dangerText: '#C01048',
    info: SystemLight.blue,
    infoSoft: 'rgba(27,110,243,0.12)',

    /* chrome */
    barBackground: 'rgba(248,249,250,0.94)',
    scrim: 'rgba(10,10,10,0.50)',
  },
  dark: {
    primary: SystemDark.blue,
    primaryDark: Brand.primary,
    primaryPressed: '#7DAEFF',
    primarySoft: 'rgba(91,150,255,0.18)',
    primarySoftSolid: Brand.primarySoftDark,
    onPrimary: '#FFFFFF',
    onPrimaryText: '#FFFFFF',

    background: '#0D0D0D',
    backgroundPage: '#0D0D0D',
    backgroundPlain: '#0D0D0D',
    surface: '#161616',
    surfaceElevated: '#1E1E1E',
    surfaceMuted: '#1E1E1E',
    surfaceSelected: 'rgba(91,150,255,0.18)',
    backgroundElement: '#161616',
    backgroundSelected: 'rgba(91,150,255,0.18)',
    highlight: '#242424',

    fill: 'rgba(255,255,255,0.14)',
    fillSecondary: 'rgba(255,255,255,0.10)',
    fillTertiary: 'rgba(255,255,255,0.07)',
    fillQuaternary: 'rgba(255,255,255,0.04)',

    separator: 'rgba(255,255,255,0.12)',
    border: '#2A2A2A',
    borderLight: '#1E1E1E',

    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#7A7F87',
    textTertiary: '#5A5F66',
    textQuaternary: '#3A3F46',

    success: SystemDark.green,
    successSoft: 'rgba(43,214,127,0.18)',
    successSoftSolid: '#0E2E20',
    successDark: SystemDark.green,
    warning: SystemDark.amber,
    warningSoft: 'rgba(253,176,34,0.18)',
    warningSoftSolid: '#2E2312',
    warningText: '#FEDF89',
    danger: SystemDark.rose,
    dangerSoft: 'rgba(255,107,133,0.18)',
    dangerSoftSolid: '#331119',
    dangerText: '#FFC7D0',
    info: SystemDark.blue,
    infoSoft: 'rgba(91,150,255,0.18)',

    barBackground: 'rgba(13,13,13,0.94)',
    scrim: 'rgba(0,0,0,0.60)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
/** Widened so both schemes are assignable (values are literal strings under `as const`). */
export type Theme = { readonly [K in ThemeColor]: string };

/* ------------------------------------------------------------------ *
 * Typography — DM Sans (display) + Inter (body)
 * ------------------------------------------------------------------ */

/**
 * Static font faces, loaded once in the root layout. Variants set
 * `fontFamily` and never `fontWeight`: with static faces Android ignores the
 * weight and iOS synthesises a fake bold, so the family *is* the weight.
 */
export const Font = {
  display: 'DMSans_600SemiBold',
  displayBold: 'DMSans_700Bold',
  displayMedium: 'DMSans_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const Type = {
  /** Splash wordmark / balance figures. */
  display: { fontFamily: Font.displayBold, fontSize: 34, lineHeight: 42, letterSpacing: -0.8 },
  largeTitle: { fontFamily: Font.displayBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.7 },
  title1: { fontFamily: Font.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  title2: {
    fontFamily: Font.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: 'white',
  },
  title3: { fontFamily: Font.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  headline: { fontFamily: Font.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },

  body: { fontFamily: Font.body, fontSize: 16, lineHeight: 24, letterSpacing: -0.1 },
  bodyEmphasized: { fontFamily: Font.bodySemi, fontSize: 16, lineHeight: 24, letterSpacing: -0.1 },
  callout: { fontFamily: Font.body, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  calloutEmphasized: {
    fontFamily: Font.bodySemi,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  subhead: { fontFamily: Font.body, fontSize: 15, lineHeight: 20, letterSpacing: -0.08 },
  subheadEmphasized: {
    fontFamily: Font.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.08,
  },
  footnote: { fontFamily: Font.body, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  footnoteEmphasized: { fontFamily: Font.bodySemi, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption1: { fontFamily: Font.body, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  caption1Emphasized: {
    fontFamily: Font.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  caption2: { fontFamily: Font.body, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  caption2Emphasized: {
    fontFamily: Font.bodySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  /** Uppercase section captions above grouped lists. */
  overline: { fontFamily: Font.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

export const Fonts = Platform.select({
  web: {
    sans: `${Font.body}, system-ui, sans-serif`,
    serif: 'ui-serif, serif',
    rounded: `${Font.display}, system-ui, sans-serif`,
    mono: 'ui-monospace, monospace',
  },
  default: { sans: Font.body, serif: 'serif', rounded: Font.display, mono: 'monospace' },
});

/* ------------------------------------------------------------------ *
 * Metrics — 8pt grid
 * ------------------------------------------------------------------ */

/** The grid unit. Every gap and pad below is a multiple (or a half step). */
export const GRID = 8;

export const Space = {
  /** 4 — half step, only for icon/label gaps */
  hair: GRID / 2,
  xs: GRID, // 8
  sm: GRID * 1.5, // 12
  md: GRID * 2, // 16
  lg: GRID * 3, // 24
  xl: GRID * 4, // 32
  xxl: GRID * 6, // 48
} as const;

/** Legacy scale kept so untouched screens keep compiling. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const Radius = {
  xs: 8,
  sm: 10,
  md: 12,
  /**
   * Inset-grouped list card and the fields that live inside one.
   *
   * UIKit draws an inset-grouped table at 10pt, and it is the single loudest
   * tell that a screen is not iOS: at the 20pt this used to share with hero
   * cards, a Settings-shaped list read as a stack of Material cards no matter
   * how correct the type and separators were.
   */
  grouped: 10,
  /**
   * Media and hero cards — a map, a balance panel, a job card. Larger than a
   * list, because these are surfaces rather than rows, but well short of the
   * 20pt pill they used to be.
   */
  card: 14,
  /** filled buttons — the spec's 16px CTA */
  button: 16,
  lg: 16,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

export const Layout = {
  /** standard side margin */
  gutter: 20,
  /** the airy 24pt margin the worker home and job alert use */
  gutterWide: 24,
  /** left inset of a row separator (aligns with the label, past the icon) */
  separatorInset: 20,
  /** minimum tappable height — UITableViewCell's 44pt */
  rowHeight: 44,
  navBarHeight: 48,
  tabBarHeight: 52,
  iconTile: 32,
} as const;

/** `borderCurve` squircles the corner the way SwiftUI's continuous style does. */
export const Squircle = { borderCurve: 'continuous' } satisfies ViewStyle;

export const Shadow = {
  card: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  /** Under a floating hero card (balance, timer sheet). */
  float: {
    shadowColor: '#1B6EF3',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  /** the tiny lift under a segmented-control thumb */
  thumb: {
    shadowColor: '#0A0A0A',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} satisfies Record<string, ViewStyle>;

/* ------------------------------------------------------------------ *
 * Motion tokens
 *
 * The signature curve is cubic-bezier(0.34, 1.56, 0.64, 1) — it overshoots
 * once and settles, no second bounce. `Ease` (the curve itself) lives in
 * `constants/motion.ts` because it needs Reanimated; the physical spring
 * equivalents live here so plain style modules can use them import-free.
 * ------------------------------------------------------------------ */

/** Never exceed `page` for ordinary UI — 500ms+ reads as lag. */
export const Duration = {
  micro: 120,
  fast: 200,
  base: 280,
  page: 420,
} as const;

/** Loop timings. Loops are informational only, never decorative. */
export const Loop = {
  pulse: 1800,
  shimmer: 3000,
  status: 2000,
  ripple: 1400,
  /** the rapid oscillation the countdown ring picks up in its last 10s */
  urgent: 400,
} as const;

/** Per-item entrance delay. More than this and a list reads as slow. */
export const Stagger = {
  list: 70,
  card: 100,
  stat: 80,
} as const;

/** `withSpring` presets tuned to match the signature bezier. */
export const Motion = {
  press: { damping: 20, stiffness: 400, mass: 0.6 },
  snappy: { damping: 18, stiffness: 260, mass: 0.9 },
  gentle: { damping: 22, stiffness: 140, mass: 1 },
  /** the overshoot-once feel of cubic-bezier(0.34, 1.56, 0.64, 1) */
  bouncy: { damping: 12, stiffness: 220, mass: 0.9 },
  /** slides a toggle knob / segmented thumb */
  toggle: { damping: 15, stiffness: 210, mass: 0.8 },
} as const;

export const BottomTabInset = Platform.select({ ios: 52, android: 82 }) ?? 0;
export const MaxContentWidth = 640;
