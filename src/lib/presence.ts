/**
 * What the provider last asked for, known before the server confirms it.
 *
 * Location is followed in the background (`(app)/_layout.tsx`) and each move
 * is reported with the same call that puts a worker online — it carries
 * `online: true`. Between a worker tapping "offline" and the app learning the
 * server agreed, a move could arrive and put them straight back online: the
 * switch flipped, then quietly flipped back. The same held for a firm turning
 * live location off.
 *
 * So the tap is recorded here first, and the background report checks it
 * before sending anything. `null` means "nobody has asked for anything this
 * session" and the server's own state decides.
 */

let workerWantsOnline: boolean | null = null;
let firmWantsLive: boolean | null = null;

export function setWorkerIntent(online: boolean | null) {
  workerWantsOnline = online;
}

/** False only when the worker has asked to be offline and nothing newer. */
export function workerMayReport(): boolean {
  return workerWantsOnline !== false;
}

export function setFirmLiveIntent(live: boolean | null) {
  firmWantsLive = live;
}

export function firmMayReport(): boolean {
  return firmWantsLive !== false;
}
