/**
 * "This version no longer works — update."
 *
 * The server changes on the day it is deployed; an app on somebody's phone
 * changes when they get round to it. When the two drift far enough apart that
 * the old app would break in ways nobody can explain over the phone, the office
 * sets the oldest version still allowed, and anything older is stopped here,
 * before sign-in, with one button that leads to the store.
 *
 * It fails open on purpose. No answer, a slow network, an older server without
 * the endpoint, a version string it cannot read: the app carries on. Locking
 * people out is only ever done on a clear "yes, too old".
 */

import Constants from 'expo-constants';
import { type ReactNode, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { API_URL } from '@/lib/api';

interface VersionInfo {
  min_version?: string;
  android_url?: string;
  ios_url?: string;
}

/** -1, 0 or 1 for dotted numbers; null when either is not one. */
export function compareVersions(a: string, b: string): number | null {
  const parse = (v: string) => (/^\d+(\.\d+)*$/.test(v.trim()) ? v.trim().split('.').map(Number) : null);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function UpdateGate({ children }: { children: ReactNode }) {
  const t = useT();
  const theme = useTheme();
  // undefined: carry on. A string or null: too old, with or without a link.
  const [storeUrl, setStoreUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // The browser build is always the latest one served.
    if (Platform.OS === 'web') return;
    const current = Constants.expoConfig?.version;
    if (!current) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(`${API_URL}/app/version`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<VersionInfo>) : null))
      .then((info) => {
        if (!info?.min_version) return;
        if (compareVersions(current, info.min_version) !== -1) return;
        const url = Platform.OS === 'ios' ? info.ios_url : info.android_url;
        setStoreUrl(url && url.startsWith('https://') ? url : null);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  if (storeUrl === undefined) return <>{children}</>;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.glyph, { backgroundColor: theme.primarySoft }]}>
        <Icon name="refresh" size={36} color={theme.primary} />
      </View>
      <Text style={[Type.title2, styles.center, { color: theme.text }]}>{t('update.title')}</Text>
      <Text style={[Type.body, styles.center, { color: theme.textSecondary }]}>{t('update.body')}</Text>
      {storeUrl ? (
        <Button label={t('update.action')} icon="refresh" onPress={() => Linking.openURL(storeUrl)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: 28, gap: 14 },
  glyph: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 6,
  },
  center: { textAlign: 'center' },
});
