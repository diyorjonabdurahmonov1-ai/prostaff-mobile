/**
 * Making a stored image URL loadable *now*.
 *
 * `POST /uploads` returns an absolute URL built from whatever host the phone
 * reached the server on, and that string is what lands in the database. The
 * host is not stable: a quick tunnel gets a new name every time it restarts,
 * an upload made over the LAN carries a `192.168.x.x` that means nothing on
 * another network, and one made from an emulator carries `10.0.2.2`. Every one
 * of those URLs is dead the moment the app talks to the backend some other way
 * — which is why photos that uploaded fine came back as blank avatars.
 *
 * The id inside the URL is the part that matters. So: keep the id, throw the
 * host away, and rebuild the URL against the base this app is using right now.
 */

import { API_BASE_URL } from '@/lib/api';

/** `/api/v1/files/<id>` wherever it appears in a stored URL. */
const FILE_PATH = /\/api\/v1\/files\/[^/?#\s]+/;

/**
 * Returns a URL an `<Image>` can load, or `undefined` for nothing at all.
 *
 * - our own uploads (any host) → re-pointed at the current API base
 * - a bare path (`/api/v1/...`) → prefixed with the current API base
 * - anything else (a real external URL, a local `file://` preview) → untouched,
 *   because rewriting those would break the picker preview and any image the
 *   platform does not host itself
 */
export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(FILE_PATH);
  if (match) return API_BASE_URL + match[0];

  if (trimmed.startsWith('/')) return API_BASE_URL + trimmed;

  return trimmed;
}

/** The list form, dropping anything that resolves to nothing. */
export function resolveImageUrls(urls?: readonly (string | null | undefined)[] | null): string[] {
  if (!urls) return [];
  return urls.map(resolveImageUrl).filter((u): u is string => !!u);
}

/**
 * How many photos one order may carry.
 *
 * The server enforces the same number and trims anything past it, so a form
 * that let somebody attach more would be a form that silently threw the extras
 * away between "sent" and "received".
 */
export const MAX_ORDER_PHOTOS = 6;
