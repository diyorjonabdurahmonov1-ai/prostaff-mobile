/**
 * "Let the app work with the screen off" — for a provider on an Android phone
 * that is set to put it to sleep.
 *
 * A worker who is online with the phone in a pocket only gets work if the
 * phone lets this app keep running. Two settings decide that, and each row
 * here opens the right system screen in one tap rather than describing a path
 * through Settings that differs on every phone. The card goes away by itself
 * once both are dealt with, and never shows on a phone that needs neither.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  autostartConfirmed,
  batteryRestricted,
  confirmAutostart,
  needsAutostart,
  openAutostartSettings,
  openBatterySettings,
} from '@/lib/background-access';

export function BackgroundAccessCard() {
  const t = useT();
  const theme = useTheme();
  const [battery, setBattery] = useState(false);
  const [autostart, setAutostart] = useState(false);
  /** The autostart screen has been opened, so "done" can be offered. */
  const [visited, setVisited] = useState(false);

  const refresh = useCallback(async () => {
    setBattery(await batteryRestricted());
    setAutostart(needsAutostart() && !(await autostartConfirmed()));
  }, []);

  // Read on arrival and every time the worker comes back from Settings.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const first = setTimeout(refresh, 0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [refresh]);

  if (Platform.OS !== 'android' || (!battery && !autostart)) return null;

  return (
    <View style={[styles.card, Squircle, { backgroundColor: theme.warningSoft }]}>
      <View style={styles.head}>
        <View style={[styles.glyph, { backgroundColor: theme.surface }]}>
          <Icon name="notifications" size={22} color={theme.warning} />
        </View>
        <View style={styles.flex}>
          <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{t('bgAccess.title')}</Text>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{t('bgAccess.body')}</Text>
        </View>
      </View>

      {battery ? (
        <Step
          icon="shield-checkmark"
          title={t('bgAccess.batteryTitle')}
          hint={t('bgAccess.batteryHint')}
          action={t('bgAccess.batteryAction')}
          onPress={async () => {
            await openBatterySettings();
            refresh();
          }}
        />
      ) : null}

      {autostart ? (
        <Step
          icon="refresh"
          title={t('bgAccess.autostartTitle')}
          hint={t('bgAccess.autostartHint')}
          action={t('bgAccess.autostartAction')}
          onPress={async () => {
            setVisited(true);
            await openAutostartSettings();
          }}
          done={
            visited
              ? {
                  label: t('bgAccess.autostartDone'),
                  onPress: async () => {
                    await confirmAutostart();
                    refresh();
                  },
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

function Step({
  icon,
  title,
  hint,
  action,
  onPress,
  done,
}: {
  icon: IconName;
  title: string;
  hint: string;
  action: string;
  onPress: () => void;
  done?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View style={[styles.step, Squircle, { backgroundColor: theme.surface }]}>
      <View style={styles.stepText}>
        <Icon name={icon} size={18} color={theme.warning} />
        <View style={styles.flex}>
          <Text style={[Type.footnoteEmphasized, { color: theme.text }]}>{title}</Text>
          <Text style={[Type.caption1, { color: theme.textSecondary }]}>{hint}</Text>
        </View>
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          Squircle,
          { backgroundColor: theme.warning },
          pressed && styles.pressed,
        ]}>
        <Text style={[Type.subheadEmphasized, styles.white]}>{action}</Text>
        <Icon name="chevron-forward" size={14} color="#FFFFFF" />
      </Pressable>
      {done ? (
        <Pressable onPress={done.onPress} hitSlop={8} style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
          <Icon name="checkmark" size={14} color={theme.success} />
          <Text style={[Type.footnoteEmphasized, { color: theme.success }]}>{done.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  white: { color: '#FFFFFF' },
  card: { borderRadius: Radius.lg, padding: 14, gap: 10, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  glyph: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  step: { borderRadius: Radius.md, padding: 12, gap: 10 },
  stepText: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
  done: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
});
