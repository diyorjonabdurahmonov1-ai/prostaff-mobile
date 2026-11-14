/**
 * What a worker must have switched on before they can take orders — beyond
 * location, which has its own hook.
 *
 * An order is only seen in time if the phone can ring and the app can show
 * itself over whatever the worker is doing:
 *
 *   - notifications, so a new order makes a sound and a banner;
 *   - "display over other apps", so the floating bubble can sit over a
 *     navigator and the app can come to the front.
 *
 * Android only. Where the build cannot show a bubble the second one is simply
 * reported as given (see lib/overlay), so an older build is never locked out.
 *
 * `checked` stays false until the first answer is in: a screen must not scold
 * the worker, and the guard must not take them offline, over a read that has
 * not happened yet.
 */

import * as IntentLauncher from 'expo-intent-launcher';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { appPackage } from '@/lib/background-access';
import { notificationPermissionGranted, requestNotificationPermission } from '@/lib/notifications';
import { openOverlaySettings, overlayGranted } from '@/lib/overlay';

/** How often the settings are re-read while a screen is open. */
const CHECK_MS = 8_000;

export interface WorkRequirements {
  checked: boolean;
  notifications: boolean;
  overlay: boolean;
  /** Everything needed is switched on. */
  ok: boolean;
  /** Re-reads the settings now. */
  refresh: () => Promise<void>;
  /** Asks for notifications — the prompt, or the settings page if it can no longer be shown. */
  askNotifications: () => Promise<void>;
  /** Opens the screen where "display over other apps" is switched on for this app. */
  askOverlay: () => Promise<void>;
}

export function useWorkRequirements(): WorkRequirements {
  const [state, setState] = useState({
    checked: false,
    notifications: true,
    overlay: true,
  });

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setState({ checked: true, notifications: true, overlay: true });
      return;
    }
    const notifications = await notificationPermissionGranted();
    setState({ checked: true, notifications, overlay: overlayGranted() });
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, CHECK_MS);
    // Coming back from system settings is exactly when one of them changes.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const askNotifications = useCallback(async () => {
    const result = await requestNotificationPermission();
    if (result === 'blocked') {
      // The prompt will not appear again: go to this app's notification switch.
      try {
        await IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS', {
          extra: { 'android.provider.extra.APP_PACKAGE': appPackage() },
        });
      } catch {
        await Linking.openSettings().catch(() => {});
      }
    }
    await refresh();
  }, [refresh]);

  const askOverlay = useCallback(async () => {
    if (!openOverlaySettings()) {
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.action.MANAGE_OVERLAY_PERMISSION',
          {
            data: `package:${appPackage()}`,
          }
        );
      } catch {
        await Linking.openSettings().catch(() => {});
      }
    }
  }, []);

  return {
    ...state,
    ok: state.notifications && state.overlay,
    refresh,
    askNotifications,
    askOverlay,
  };
}
