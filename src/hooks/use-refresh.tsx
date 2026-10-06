/**
 * Pull to refresh, in one line per screen.
 *
 * Every list in the app already has a `load()` that fetches its data; the only
 * thing a screen was missing was somewhere to put the spinner. This wraps that
 * function so the gesture reuses exactly the same code path as the first load —
 * no second fetcher to keep in sync, and no screen where the pull quietly does
 * something slightly different from opening the screen fresh.
 *
 *   const { refreshControl } = useRefresh(load);
 *   <ScrollView refreshControl={refreshControl}>
 *
 * The screen keeps its own loading state for the first paint. This one is only
 * for the gesture: a full-screen spinner replacing content the user is already
 * looking at, because they pulled it down, is the wrong answer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function useRefresh(load: () => unknown | Promise<unknown>) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Held in a ref so a screen passing a fresh closure each render (the common
  // case — an inline arrow) does not hand every child a new refreshControl.
  // Written in an effect, never during render.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRef.current();
    } catch {
      // The screen's own error handling owns the message; the spinner's only
      // job is to stop.
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textMuted} />
  );

  return { refreshing, onRefresh, refreshControl };
}
