/**
 * Whether the phone can reach the server right now, as the app's own requests
 * see it.
 *
 * Every request reports in: a reply of any kind means the line is up, and a
 * request that never got one (no network, or the timeout) is a strike. Two
 * strikes in a row mean the line is down. One alone is a slow moment, not worth
 * a banner. While it is down, `ConnectionBanner` probes the server and the first
 * answer clears it.
 */

import { useSyncExternalStore } from 'react';

let strikes = 0;
let down = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === down) return;
  down = next;
  listeners.forEach((l) => l());
}

export function reportNetwork(ok: boolean) {
  if (ok) {
    strikes = 0;
    set(false);
    return;
  }
  strikes += 1;
  if (strikes >= 2) set(true);
}

export function useConnectionDown(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => down,
    () => false,
  );
}
