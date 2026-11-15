/**
 * The worker's position while they are on the way to a customer.
 *
 * "Yo'lga chiqdim" starts this; "Yetib keldim" (or the order ending) stops it.
 * Between the two the phone reports where it is every few seconds so the
 * customer can watch the worker come, like a taxi.
 *
 * It is a task of its own rather than a mode of the "I'm online" one in
 * `background-location.ts`: that one reports once a minute for dispatch, this
 * one has to be near real time, and the two have different lifetimes. And it
 * has to run in the background — the worker's first move after setting off is
 * to open a maps app for the route, which puts this one behind it.
 *
 * Android shows a standing notification while it runs (the price of reporting
 * with the screen off). It stops itself when the server says the trip is over —
 * arrived, cancelled, taken away — so a missed "stop" cannot leave it running.
 */

import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { api, API_URL, getAuthToken } from '@/lib/api';

const TASK = 'prostaff-trip-position';
const ORDER_KEY = 'prostaff.trip_order';
const TOKEN_KEY = 'prostaff.token';

/** Reports closer together than this are just noise on the customer's map. */
const REPORT_MIN_MS = 4_000;
let lastAt = 0;

/** True when the server is saying "this trip is not a thing any more". */
function tripIsOver(status?: number): boolean {
  return status === 403 || status === 404 || status === 409;
}

async function report(orderId: string, lat: number, lng: number): Promise<number | undefined> {
  const path = `/worker/orders/${orderId}/position`;
  if (getAuthToken()) {
    try {
      await api.post(path, { lat, lng });
      return 204;
    } catch (err) {
      return (err as { status?: number }).status;
    }
  }
  // Woken with nothing in memory: send with the stored token and leave it at
  // that (see background-location for why we do not refresh here).
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return undefined;
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lat, lng }),
  });
  return res.status;
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error) return;
    const fix = data?.locations?.[data.locations.length - 1];
    if (!fix) return;
    try {
      const orderId = await SecureStore.getItemAsync(ORDER_KEY);
      if (!orderId) return;
      const now = Date.now();
      if (now - lastAt < REPORT_MIN_MS) return;
      lastAt = now;
      const status = await report(orderId, fix.coords.latitude, fix.coords.longitude);
      if (tripIsOver(status)) await stopTripTracking();
    } catch {
      // A missed report is made up by the next one, seconds later.
    }
  });
}

/** Start reporting for this order. Safe to call again for the same order. */
export async function startTripTracking(
  orderId: string,
  notice: { title: string; body: string },
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(TASK);
    const current = await SecureStore.getItemAsync(ORDER_KEY);
    if (running && current === orderId) return true;
    await SecureStore.setItemAsync(ORDER_KEY, orderId);
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
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

/** Stop reporting: arrived, cancelled, or signed out. */
export async function stopTripTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  lastAt = 0;
  try {
    await SecureStore.deleteItemAsync(ORDER_KEY);
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
      await Location.stopLocationUpdatesAsync(TASK);
    }
  } catch {
    // Nothing was running.
  }
}
