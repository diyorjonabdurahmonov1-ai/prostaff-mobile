/**
 * The floating bubble and the "display over other apps" permission.
 *
 * A worker who is online and has left the app — to a navigator, to the home
 * screen — sees a small round bubble over everything, the way a taxi driver's
 * app does. It turns into an alert when an order arrives, and touching it
 * brings the app back. Android only: it needs the permission the user switches
 * on in system settings, and a native module that draws the window.
 *
 * Where the native module is missing — Expo Go, a build from before it existed,
 * the browser, an iPhone — nothing here does anything, and the permission is
 * reported as not required, so no one is locked out of work by a feature their
 * build cannot have.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

interface NativeOverlay {
  canDrawOverlays(): boolean;
  openOverlaySettings(): boolean;
  showBubble(label: string): boolean;
  ringBubble(label: string): boolean;
  hideBubble(): boolean;
  bringToFront(): boolean;
  startKeepAlive(title: string, body: string): boolean;
  stopKeepAlive(): boolean;
}

const native: NativeOverlay | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeOverlay>('ProstaffOverlay') : null;

/** Whether this build can show a bubble and so needs the permission for it. */
export const overlayRequired = native !== null;

/** True when the permission is given — or when this build does not need it. */
export function overlayGranted(): boolean {
  if (!native) return true;
  try {
    return native.canDrawOverlays();
  } catch {
    return false;
  }
}

/** Opens the system screen where the permission is switched on. */
export function openOverlaySettings(): boolean {
  if (!native) return false;
  try {
    return native.openOverlaySettings();
  } catch {
    return false;
  }
}

/** Puts the quiet bubble on screen. */
export function showBubble(label: string): void {
  try {
    native?.showBubble(label);
  } catch {
    // The bubble is a convenience; never let it break the app.
  }
}

/** Turns the bubble into an alert, with the text beside it. */
export function ringBubble(label: string): void {
  try {
    native?.ringBubble(label);
  } catch {
    // As above.
  }
}

export function hideBubble(): void {
  try {
    native?.hideBubble();
  } catch {
    // As above.
  }
}

/** Brings the app in front of whatever is on screen. */
export function bringToFront(): void {
  try {
    native?.bringToFront();
  } catch {
    // As above.
  }
}

/**
 * Holds the app's process while a provider is online and nothing else does —
 * a firm that does not share its location. Shows a standing notification.
 */
export function startKeepAlive(title: string, body: string): void {
  try {
    native?.startKeepAlive(title, body);
  } catch {
    // As above.
  }
}

export function stopKeepAlive(): void {
  try {
    native?.stopKeepAlive();
  } catch {
    // As above.
  }
}
