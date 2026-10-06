/**
 * Theme access. `useTheme()` returns the resolved iOS semantic palette,
 * `useThemeMode()` the raw appearance so components can branch on it
 * (materials, shadows and fills differ between light and dark on iOS).
 *
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type Theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemeMode = 'light' | 'dark';

export function useThemeMode(): ThemeMode {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  return Colors[useThemeMode()];
}
