/**
 * How to reach the office.
 *
 * Two channels, and they are not interchangeable: Telegram is where most people
 * write, the phone is what answers when somebody cannot write. Both live here
 * rather than in a screen, because the same pair appears on the profile, in the
 * "ask an admin to open your account" alert and in the public offer.
 */

import { Linking } from 'react-native';

/** The office number — support, and the only way onto the platform as a provider. */
export const SUPPORT_PHONE = '+998 94 080 94 45';

/** Support account on Telegram, without the leading `@`. */
export const SUPPORT_TELEGRAM = 'Prostaffsupport';
export const SUPPORT_TELEGRAM_HANDLE = `@${SUPPORT_TELEGRAM}`;

/**
 * The `tg:` deep link. Every Telegram-family client registers this scheme —
 * Telegram, Telegram X, Plus Messenger, Videogram — which is exactly why it is
 * the one we open: on Android the system raises its own "Open with" chooser
 * when more than one of them is installed, so the choice of client is the
 * user's and we do not have to guess (or probe for) which one they prefer.
 */
export const TELEGRAM_APP_URL = `tg://resolve?domain=${SUPPORT_TELEGRAM}`;

/**
 * The plain `t.me` address. Two jobs: it is the fallback when no client is
 * installed, and it is the second route offered in the sheet — iOS hands `tg:`
 * to whichever client claimed it first and never asks, so somebody with two of
 * them needs a link the browser can hand on to the one they actually want.
 */
export const TELEGRAM_WEB_URL = `https://t.me/${SUPPORT_TELEGRAM}`;

/** Dial the office. */
export function callSupport(): Promise<unknown> {
  return Linking.openURL(`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`);
}

/**
 * Open the chat in an installed Telegram client, falling back to `t.me` when
 * the deep link goes nowhere. Returns false only if neither could be opened.
 */
export async function openTelegramApp(): Promise<boolean> {
  try {
    await Linking.openURL(TELEGRAM_APP_URL);
    return true;
  } catch {
    return openTelegramLink();
  }
}

/** Open the chat through `t.me`, letting the OS pick the app. */
export async function openTelegramLink(): Promise<boolean> {
  try {
    await Linking.openURL(TELEGRAM_WEB_URL);
    return true;
  } catch {
    return false;
  }
}
