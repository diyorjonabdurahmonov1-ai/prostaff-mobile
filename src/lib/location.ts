import * as Location from 'expo-location';

import { TASHKENT } from '@/store/order-flow';

export interface Coords {
  lat: number;
  lng: number;
  /** false when we fell back to the default Tashkent location */
  resolved: boolean;
}

/** Mean Earth radius, km. */
const EARTH_KM = 6371;

/**
 * Great-circle distance in kilometres.
 *
 * The server only attaches `distance_km` to match results, so a worker looking
 * at an incoming invite has to derive it from their own profile coordinates
 * and the order's. Over a 15 km matching radius the haversine error against a
 * road route is irrelevant — what the worker needs is "near" or "not near".
 */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** How long a fix stays good enough to hand to the next caller. */
const FIX_TTL_MS = 60_000;

/** The last resolved fix, and when it arrived. */
let lastFix: { coords: Coords; at: number } | null = null;

/** The read that is happening right now, if any. */
let inFlight: Promise<Coords> | null = null;

async function readCoords(): Promise<Coords> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { lat: TASHKENT.lat, lng: TASHKENT.lng, resolved: false };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, resolved: true };
  } catch {
    return { lat: TASHKENT.lat, lng: TASHKENT.lng, resolved: false };
  }
}

/**
 * Requests foreground location permission and resolves current coordinates.
 * Falls back to central Tashkent on denial or any error.
 *
 * Shared, not per-call. Two things used to make the same phone read its GPS
 * twice for one screen: the order form resolves a fix on mount while the map
 * card asks for its own, and in development an effect body runs twice. Each
 * read is a separate permission check and a separate satellite fix, arriving
 * seconds apart — so the pin landed, then landed again somewhere slightly else,
 * and the map visibly jumped under the user.
 *
 * So callers within a minute of each other share one answer, and callers that
 * overlap share the one read that is already running.
 *
 * `force` skips the cache — that is the "detect my location" button, where the
 * whole point is a fresh reading.
 */
export async function getCoordsWithFallback(force = false): Promise<Coords> {
  if (!force && lastFix && Date.now() - lastFix.at < FIX_TTL_MS) {
    return lastFix.coords;
  }
  if (!force && inFlight) return inFlight;

  const read = readCoords().then((coords) => {
    // A fallback is not a fix: caching it would pin everyone to Tashkent for a
    // minute after one denied prompt, including the retry meant to fix it.
    if (coords.resolved) lastFix = { coords, at: Date.now() };
    return coords;
  });

  inFlight = read;
  try {
    return await read;
  } finally {
    if (inFlight === read) inFlight = null;
  }
}
