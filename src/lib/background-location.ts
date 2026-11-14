/**
 * Location that keeps reporting when the app is not on screen.
 *
 * A worker goes online and then puts the phone in a pocket, or opens another
 * app, and waits. The watch in `use-live-location` stops with the screen, so
 * the server went on measuring "near" from wherever the worker was when they
 * last looked at this app — an hour and a district ago.
 *
 * This keeps the position coming for as long as they are online:
 *
 *   - Android runs it as a foreground service, with a standing notification
 *     that says the worker is online and waiting. That notification is the
 *     price of the permission: started from the open app, the service may
 *     follow the phone with the ordinary "while using the app" permission, so
 *     nobody is asked for "allow all the time".
 *   - iOS keeps it going the same way, with the blue location indicator.
 *
 * It ends when the worker goes offline or signs out, and the system ends it if
 * the app is swiped away. New orders do not depend on it: those arrive as push
 * notifications whether or not anything here is running.
 *
 * The task itself is defined at module scope, as the task manager requires,
 * so this file is imported once from the root layout.
 */

import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { api, API_URL, getAuthToken } from '@/lib/api';
import { firmMayReport, workerMayReport } from '@/lib/presence';

const TASK = 'prostaff-live-location';
/** Who the running task reports for; survives the process being restarted. */
const MODE_KEY = 'prostaff.bg_location';
const TOKEN_KEY = 'prostaff.token';

export type BackgroundMode = 'worker' | 'company';

/** Reports closer together than this tell dispatch nothing new. */
const REPORT_MIN_MS = 60_000;
const REPORT_MIN_METRES = 150;

let last: { lat: number; lng: number; at: number } | null = null;

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function report(mode: BackgroundMode, lat: number, lng: number) {
  const path = mode === 'worker' ? '/worker/status' : '/company/live-location';
  const body = mode === 'worker' ? { online: true, lat, lng } : { enabled: true, lat, lng };
  // The usual case: the app is alive behind another one, signed in, and the
  // ordinary client does the work — including renewing a token that ran out.
  if (getAuthToken()) {
    await api.post(path, body);
    return;
  }
  // Woken with nothing in memory. Send with the stored token and leave it at
  // that: renewing here would replace the refresh token with one the sign-in
  // store never hears about, and sign the person out on their next launch.
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error) return;
    const fix = data?.locations?.[data.locations.length - 1];
    if (!fix) return;
    try {
      const mode = (await SecureStore.getItemAsync(MODE_KEY)) as BackgroundMode | null;
      if (mode !== 'worker' && mode !== 'company') return;
      // Not if they have just asked to stop — see lib/presence.
      if (mode === 'worker' ? !workerMayReport() : !firmMayReport()) return;
      const here = { lat: fix.coords.latitude, lng: fix.coords.longitude };
      const now = Date.now();
      if (last && now - last.at < REPORT_MIN_MS && metres(last, here) < REPORT_MIN_METRES) return;
      last = { ...here, at: now };
      await report(mode, here.lat, here.lng);
    } catch {
      // A missed report is made up by the next one.
    }
  });
}

/**
 * Start following the phone for a provider who is online. Safe to call again:
 * a task already running for the same provider is left alone.
 *
 * Returns false when it could not start — an older build without the
 * permission, Expo Go, the app not in front. The in-app watch still covers
 * the time the app is open, so nothing else depends on the answer.
 */
export async function startBackgroundLocation(
  mode: BackgroundMode,
  notice: { title: string; body: string },
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(TASK);
    const current = await SecureStore.getItemAsync(MODE_KEY);
    if (running && current === mode) return true;
    await SecureStore.setItemAsync(MODE_KEY, mode);
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      timeInterval: 60_000,
      // Let the system batch fixes while nothing is watching the screen.
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 100,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: notice.title,
        notificationBody: notice.body,
        notificationColor: '#1B6EF3',
        killServiceOnDestroy: true,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Stop following the phone: gone offline, signed out, or location lost. */
export async function stopBackgroundLocation(): Promise<void> {
  if (Platform.OS === 'web') return;
  last = null;
  try {
    await SecureStore.deleteItemAsync(MODE_KEY);
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
      await Location.stopLocationUpdatesAsync(TASK);
    }
  } catch {
    // Nothing was running.
  }
}
