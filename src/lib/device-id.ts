/**
 * A stable name for this install, sent with every request (X-Device-Id).
 *
 * One account may be open on one phone at a time; the server tells the phones
 * apart by this. It is made once, kept in the secure store, and survives
 * sign-outs (it names the phone, not the person) — but not a reinstall, which
 * is a new phone as far as anyone can tell.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'prostaff.device_id';

let cached: string | null = null;
let loading: Promise<string> | null = null;

function makeId(): string {
  const part = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${part()}${part()}${part()}${Date.now().toString(16)}`;
}

export function getDeviceId(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (!loading) {
    loading = (async () => {
      let id: string | null = null;
      try {
        id = await SecureStore.getItemAsync(KEY);
      } catch {
        // no secure store (web): fall through to an id for this session
      }
      if (!id) {
        id = makeId();
        try {
          await SecureStore.setItemAsync(KEY, id);
        } catch {
          // kept in memory only
        }
      }
      cached = id;
      return id;
    })();
  }
  return loading;
}
