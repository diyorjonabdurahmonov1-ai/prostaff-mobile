/**
 * A firm's live location — the second place it can be found from.
 *
 * The office stays where it is (it is set in the profile editor). Live
 * location adds where the firm's phone is right now, for firms that work
 * from a van rather than a desk.
 *
 * One endpoint for both switching it and reporting moves:
 * `POST /company/live-location` with `{ enabled, lat?, lng? }`.
 */

import { api } from '@/lib/api';
import type { Fix } from '@/hooks/use-live-location';

export function setLiveLocation(enabled: boolean, fix?: Fix | null) {
  return api.post('/company/live-location', {
    enabled,
    ...(fix ? { lat: fix.lat, lng: fix.lng } : {}),
  });
}

/** How long ago a live point was reported, in whole minutes. */
export function minutesSince(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null;
}
