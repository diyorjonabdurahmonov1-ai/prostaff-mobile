/**
 * A provider's live location, kept honest — a worker's, or a mobile firm's.
 *
 * Dispatch rings the workers near a job, so a worker the app cannot place is a
 * worker who cannot be sent work — or worse, one who is sent the wrong work.
 * Going online used to read the GPS through `getCoordsWithFallback`, which
 * answers a denied permission with central Tashkent: a worker in Samarkand who
 * tapped "don't allow" went online as a worker in Tashkent.
 *
 * This hook is the one place that knows whether the app can see the worker:
 *
 *   - `status` — `ok`, or why not: permission not given yet (`denied`), given
 *     "never ask again" (`blocked`, only Settings can fix it), or location
 *     services switched off on the phone (`off`).
 *   - `fix()` — whatever gets them to `ok` from where they are: the system
 *     prompt, the "turn on location" dialog, or the app's settings page.
 *   - while `tracking`, follows the phone and reports where the worker is, so
 *     the server's idea of "near" stays where the worker actually is.
 *
 * It re-checks when the app comes back to the foreground and every few seconds
 * while open, which is how switching location off mid-shift is noticed.
 */

import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

export type LocationStatus = 'checking' | 'ok' | 'denied' | 'blocked' | 'off';

export interface Fix {
  lat: number;
  lng: number;
}

/** How often the permission and the location switch are re-read while open. */
const CHECK_MS = 10_000;
/** Reports closer together than this add load without telling dispatch anything. */
const REPORT_MIN_MS = 60_000;
const REPORT_MIN_METRES = 150;

async function readStatus(): Promise<LocationStatus> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return perm.canAskAgain ? 'denied' : 'blocked';
    // Granted is not enough: with the phone's location switched off the app is
    // allowed to ask and gets nothing back.
    if (!(await Location.hasServicesEnabledAsync())) return 'off';
    return 'ok';
  } catch {
    return 'off';
  }
}

/** A real fix, or nothing — never a stand-in city. */
export async function getPreciseFix(): Promise<Fix | null> {
  if ((await readStatus()) !== 'ok') return null;
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

function metresBetween(a: Fix, b: Fix): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useLiveLocation({
  tracking,
  onMove,
}: {
  /** Follow the phone and report moves — on while the provider is sharing it. */
  tracking: boolean;
  /** Called with a fresh position, throttled by time and distance. */
  onMove?: (fix: Fix) => void;
}) {
  const [status, setStatus] = useState<LocationStatus>('checking');

  const refresh = useCallback(async () => {
    const next = await readStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    // The first read happens from a timer callback, not the effect body.
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  // Kept in a ref so a new callback identity does not restart the GPS watch.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!tracking || status !== 'ok') return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let last: { fix: Fix; at: number } | null = null;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50,
        timeInterval: 30_000,
      },
      (pos) => {
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const now = Date.now();
        if (
          last &&
          now - last.at < REPORT_MIN_MS &&
          metresBetween(last.fix, fix) < REPORT_MIN_METRES
        ) {
          return;
        }
        last = { fix, at: now };
        onMoveRef.current?.(fix);
      },
      // The watch dies when location is switched off; the next check notices.
      () => refresh(),
    )
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => refresh());

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [tracking, status, refresh]);

  /** Whatever gets the worker from their current status to `ok`. */
  const fix = useCallback(async () => {
    const now = await readStatus();
    if (now === 'denied') {
      await Location.requestForegroundPermissionsAsync().catch(() => null);
    } else if (now === 'off') {
      if (Platform.OS === 'android') {
        // The system's own "turn on location" dialog, without leaving the app.
        await Location.enableNetworkProviderAsync().catch(() => Linking.openSettings());
      } else {
        await Linking.openSettings();
      }
    } else if (now === 'blocked') {
      // "Don't ask again" — only the app's settings page can undo it.
      await Linking.openSettings();
    }
    return refresh();
  }, [refresh]);

  return { status, fix, refresh };
}
