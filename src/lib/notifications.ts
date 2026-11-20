/**
 * Notifications, built entirely on `expo-notifications`.
 *
 * Three delivery paths, because no one of them covers every case:
 *
 * 1. **Firebase, direct** — the device's own FCM registration token goes to the
 *    server, which sends a real `notification` payload straight to Firebase.
 *    Android renders it itself, so it arrives with the app closed, killed, or
 *    asleep. This is the only path that behaves the way people expect a
 *    messaging app to.
 * 2. **Expo push** — the fallback, and all of iOS. Expo hands Android a
 *    *data-only* message, which is not a notification: it becomes one only once
 *    this app's process picks it up and draws it. Fine while the app is open,
 *    invisible the moment it is not. Expo Go (SDK 53+) has no remote push at
 *    all and silently returns no token.
 * 3. **Local notification** — fired by the app itself when the realtime layer
 *    sees a new invite. Works everywhere, including Expo Go, and only while the
 *    app is running.
 *
 * Everything here is best-effort: a failure never blocks the app.
 */

import { AppState, Platform } from 'react-native';

import { api } from '@/lib/api';

/**
 * Android channel the backend also targets via `channelId` on its pushes.
 *
 * `orders_v4` rings on the alarm stream. A notification's sound follows the
 * phone's ringer switch, so on silent or vibrate an order arrived as a buzz and
 * nothing else — the one moment the sound matters most. The alarm stream is not
 * muted by the ringer switch (only by the volume of alarms), which is what an
 * alarm clock relies on. A channel's audio cannot be changed once it exists, so
 * this is a new channel; `orders_v2` stays for servers that have not heard yet.
 */
export const ORDERS_CHANNEL = 'orders_v4';
/** The previous order channel: same ring, but on the notification stream. */
const ORDERS_V2_CHANNEL = 'orders_v2';
/**
 * The channel builds before the three-second ring used. A channel's sound is
 * fixed when it is created and cannot be changed afterwards, so a new sound is a
 * new channel — and the server has to be told which one this phone has. The old
 * one stays registered so a server that has not heard yet still reaches us.
 */
const LEGACY_ORDERS_CHANNEL = 'orders';
/** Whether the order channel above exists on this phone, so it is safe to name. */
let ordersChannelReady = false;
/**
 * Everyday messages — a role change, a note from the office, a subscription —
 * ring a soft chime here, not the three-second order ring. A new channel, since
 * a channel's sound cannot be changed once it exists.
 */
export const GENERAL_CHANNEL = 'general_v1';
let generalChannelReady = false;
/**
 * What this phone tells the server about its channels. `orders_v3` is not a
 * channel: it means "I have orders_v2 and general_v1", so the server may name
 * the general one (naming a channel the phone lacks files the message silently).
 */
function declaredChannel(): string | null {
  if (Platform.OS !== 'android' || !ordersChannelReady) return null;
  // `orders_v4` means "I have orders_v4 and general_v1" (the handshake, as
  // `orders_v3` was for orders_v2).
  return generalChannelReady ? 'orders_v4' : ORDERS_V2_CHANNEL;
}

type NotificationsModule = typeof import('expo-notifications');

function getConstants(): any {
  try {
    const Constants = require('expo-constants');
    return Constants.default ?? Constants;
  } catch {
    return null;
  }
}

function isExpoGo(): boolean {
  return getConstants()?.executionEnvironment === 'storeClient';
}

/**
 * Whether this build can receive server-sent push at all.
 *
 * Expo Go dropped remote push in SDK 53, and `getExpoPushTokenAsync` there
 * fails silently — which is exactly the shape "push doesn't work" usually
 * takes. The diagnostics screen says so out loud instead.
 */
export function remotePushSupported(): boolean {
  return !isExpoGo();
}

/**
 * EAS project id, required by `getExpoPushTokenAsync` since SDK 49. Passing
 * `undefined` makes the call fail, which is why push registration was silently
 * doing nothing.
 */
function projectId(): string | undefined {
  const c = getConstants();
  return (
    c?.expoConfig?.extra?.eas?.projectId ??
    c?.easConfig?.projectId ??
    c?.manifest?.extra?.eas?.projectId
  );
}

let cached: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (cached === undefined) {
    try {
      cached = require('expo-notifications');
    } catch {
      cached = null;
    }
  }
  return cached ?? null;
}

/* ------------------------------------------------------------------ *
 * Order alert fan-out
 * ------------------------------------------------------------------ */

/**
 * Subscribers woken by an order-related notification (received or tapped). The
 * realtime layer uses this to poll immediately instead of waiting for the next
 * tick, so the job is already in the worker's list when they open the app.
 */
const orderAlertHandlers = new Set<() => void>();

/** Subscribe to order notifications. Returns an unsubscribe function. */
export function onOrderAlert(handler: () => void): () => void {
  orderAlertHandlers.add(handler);
  return () => orderAlertHandlers.delete(handler);
}

function isOrderPush(data: unknown): boolean {
  const type = (data as { type?: unknown } | undefined)?.type;
  return typeof type === 'string' && type.startsWith('order.');
}

function fireOrderAlert() {
  for (const handler of orderAlertHandlers) handler();
}

/* ------------------------------------------------------------------ *
 * Taps
 * ------------------------------------------------------------------ */

/** What a tapped notification was about, in the terms a screen cares about. */
export interface NotificationTap {
  type: string;
  orderId: string | null;
  /**
   * True when the notification is a job being *offered* to this user — a
   * worker's invite or a firm's new order. Those open on the provider screen,
   * where the job can actually be answered; everything else is news about an
   * order the user placed.
   */
  offer: boolean;
}

const tapHandlers = new Set<(tap: NotificationTap) => void>();

/** Subscribe to notification taps. Returns an unsubscribe function. */
export function onNotificationTap(handler: (tap: NotificationTap) => void): () => void {
  tapHandlers.add(handler);
  return () => tapHandlers.delete(handler);
}

function describeTap(data: unknown): NotificationTap {
  const record = (data ?? {}) as { type?: unknown; order_id?: unknown };
  const type = typeof record.type === 'string' ? record.type : '';
  const orderId = typeof record.order_id === 'string' && record.order_id ? record.order_id : null;
  return { type, orderId, offer: type === 'order.invite' || type === 'order.new' };
}

/**
 * The tap that launched the app from cold, if there was one.
 *
 * `addNotificationResponseReceivedListener` only fires for taps that happen
 * while the JS runtime is alive. Tapping an invite on a locked phone starts the
 * app from nothing, and that tap arrives *before* any listener exists — which
 * is precisely the case a push notification is for. Expo keeps it, and this is
 * how it is claimed. Read once: a second read would replay it on every mount.
 */
let coldStartTapConsumed = false;

export async function consumeColdStartTap(): Promise<NotificationTap | null> {
  if (coldStartTapConsumed) return null;
  coldStartTapConsumed = true;
  const Notifications = notifications();
  if (!Notifications) return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return describeTap(response.notification.request.content.data);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------ */

let configured = false;

/** Called once at the app root. Safe to call repeatedly. */
export function configureNotifications() {
  if (configured) return;
  configured = true;

  const Notifications = notifications();
  if (!Notifications) return;

  // Show the banner even while the app is in the foreground — an incoming job
  // is exactly the case where a silent notification would be useless.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // A push for a stored message, arriving while the app is open: the app
      // shows that message itself (see useNotificationBridge), so showing the
      // push as well made every message ring twice. Pushes with no stored
      // message behind them — and every push while the app is closed — are
      // untouched.
      const content = notification.request.content;
      const trigger = notification.request.trigger as { type?: string } | null;
      const duplicate =
        trigger?.type === 'push' &&
        AppState.currentState === 'active' &&
        typeof (content.data as { notification_id?: unknown } | undefined)?.notification_id === 'string';
      return {
        shouldShowBanner: !duplicate,
        shouldShowList: !duplicate,
        shouldPlaySound: !duplicate,
        shouldSetBadge: false,
      };
    },
  });

  ensureAndroidChannels();

  Notifications.addNotificationReceivedListener((event) => {
    if (isOrderPush(event.request.content.data)) fireOrderAlert();
  });
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (isOrderPush(data)) fireOrderAlert();
    const tap = describeTap(data);
    for (const handler of tapHandlers) handler(tap);
  });
}

/**
 * Android needs a channel before anything is shown. "orders" is MAX importance
 * and bypasses Do Not Disturb, matching the `channelId` the backend sends.
 */
async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync(LEGACY_ORDERS_CHANNEL, {
      name: 'Buyurtmalar (eski)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 500, 800, 500],
      lightColor: '#534AB7',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Umumiy',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#534AB7',
    });
    await Notifications.setNotificationChannelAsync(GENERAL_CHANNEL, {
      name: 'Xabarlar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#534AB7',
      sound: 'notify_chime.wav',
    });
    generalChannelReady = true;
    // Kept as it was, for a server that still names it.
    await Notifications.setNotificationChannelAsync(ORDERS_V2_CHANNEL, {
      name: 'Buyurtmalar (eski)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 300, 700, 300, 700],
      lightColor: '#534AB7',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      sound: 'order_ring.wav',
    });
    // Three rings and three buzzes, about three seconds in all: long enough to
    // be heard over a navigator's voice, short enough not to be a siren — and on
    // the alarm stream, so a phone on silent or vibrate still rings.
    await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
      name: 'Buyurtmalar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 300, 700, 300, 700],
      lightColor: '#534AB7',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      sound: 'order_ring.wav',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
      },
    });
    ordersChannelReady = true;
  } catch {
    // Channel creation is best-effort.
  }
}

/** Reads the current permission without prompting — for the diagnostics screen. */
export async function notificationPermissionGranted(): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Asks for notification permission and says how it went: `granted`, `denied`
 * (the system prompt was refused but can be shown again), or `blocked` (it
 * will not be shown again — only the app's settings can switch it on).
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  const Notifications = notifications();
  if (!Notifications) return 'blocked';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'blocked';
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (requested.granted) return 'granted';
    return requested.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'blocked';
  }
}

/** Requests runtime permission. Returns whether we may post notifications. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return requested.granted;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Local notifications — work in Expo Go and without a push server
 * ------------------------------------------------------------------ */

/**
 * What the device has already posted, by what it was about.
 *
 * The same event reaches the app by more than one road — the invite poll and the
 * stored notification both announce a new order — and each used to post its own
 * banner, so one job rang two or three times. A message is keyed by its stored
 * id, or by its type and order; whichever road gets there first posts it and
 * the rest are dropped.
 */
const postedAt = new Map<string, number>();
const POSTED_MEMORY_MS = 10 * 60_000;

function alreadyPosted(data?: Record<string, unknown>): boolean {
  const type = typeof data?.type === 'string' ? data.type : '';
  const orderId = typeof data?.order_id === 'string' ? data.order_id : '';
  const noteId = typeof data?.notification_id === 'string' ? data.notification_id : '';
  const keys = [noteId && `n:${noteId}`, orderId && `o:${type}:${orderId}`].filter(Boolean) as string[];
  if (keys.length === 0) return false;
  const now = Date.now();
  for (const [k, at] of postedAt) if (now - at > POSTED_MEMORY_MS) postedAt.delete(k);
  const seen = keys.some((k) => postedAt.has(k));
  for (const k of keys) postedAt.set(k, now);
  return seen;
}

/** Posts a notification from the device itself, right now. */
export async function presentLocalNotification(input: {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (alreadyPosted(input.data)) return;
  // Only orders ring. Everything else — a role change, a message from the
  // office — gets the soft chime channel (when this phone has it).
  const type = typeof input.data?.type === 'string' ? input.data.type : '';
  const isOrder = type.startsWith('order.') || type === '';
  const channelId = !isOrder && generalChannelReady ? GENERAL_CHANNEL : ORDERS_CHANNEL;
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    if (!(await ensureNotificationPermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
        sound: 'default',
        ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : null),
      },
      trigger:
        Platform.OS === 'android'
          ? ({
              channelId,
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 1,
            } as any)
          : null,
    });
  } catch {
    // Never let a notification failure break a flow.
  }
}

/* ------------------------------------------------------------------ *
 * Remote push token
 * ------------------------------------------------------------------ */

let registeredToken: string | null = null;

/**
 * The device's own FCM registration token, as last sent to the server.
 *
 * This is not the Expo token and is not interchangeable with it. Expo's push
 * service hands Android a *data-only* message, which is not a notification:
 * nothing appears until this app's process wakes up and draws one. That is
 * exactly why an invite shows while the app is open and vanishes the moment it
 * is closed — with the process gone, Android has nobody to give the message to.
 *
 * The raw device token lets the server go to Firebase directly and send a real
 * notification payload, which Android renders with the app entirely uninvolved.
 * It is what makes the tray behave like every other messaging app's.
 */
let registeredDeviceToken: string | null = null;

/** The device (FCM/APNs) token, when this platform has one. */
async function devicePushToken(): Promise<string | null> {
  const Notifications = notifications();
  if (!Notifications || isExpoGo()) return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token?.data === 'string' && token.data ? token.data : null;
  } catch (err) {
    // Not fatal: the Expo token below still covers iOS and any build whose
    // Firebase setup is incomplete.
    lastError = (err as Error)?.message ?? String(err);
    return null;
  }
}

/**
 * Why the last registration failed, for the diagnostics screen.
 *
 * `registerPushToken` swallows everything so a push problem can never break a
 * screen — but swallowed silently, the commonest failure on Android (the build
 * has no FCM configuration, so `getExpoPushTokenAsync` cannot reach Firebase)
 * looks exactly like "nothing happened". The reason is kept so it can be read
 * out loud on the device instead of guessed at from a log cable.
 */
let lastError: string | null = null;

/**
 * Registers the Expo push token with the backend so the server can alert the
 * user with the app closed. Call once the user is authenticated — the endpoint
 * is behind auth, so registering before login just 401s.
 *
 * Returns the token, or null when push is unavailable (Expo Go, permission
 * denied, no EAS project id).
 */
export async function registerPushToken(): Promise<string | null> {
  const Notifications = notifications();
  if (!Notifications) {
    lastError = 'expo-notifications is not in this build';
    return null;
  }

  // Expo Go (SDK 53+) has no push support — local notifications still work.
  if (isExpoGo()) {
    lastError = 'Expo Go has no remote push — use a dev or release build';
    return null;
  }

  try {
    if (!(await ensureNotificationPermission())) {
      lastError = 'notification permission not granted';
      return null;
    }
    await ensureAndroidChannels();

    // The device token is the one that matters on Android, and it is fetched
    // first so a build whose Expo project has no credentials still ends up
    // reachable — the two failures are independent.
    const deviceToken = await devicePushToken();

    const id = projectId();
    if (!id) lastError = 'no EAS projectId in app config';

    let token: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync(
        id ? { projectId: id } : undefined
      );
      token = tokenData.data || null;
    } catch (err) {
      lastError = (err as Error)?.message ?? String(err);
    }

    const tokenIsNew = !!token && token !== registeredToken;
    const deviceIsNew = !!deviceToken && deviceToken !== registeredDeviceToken;
    if (!tokenIsNew && !deviceIsNew) return token;

    await api.post('/me/push-token', {
      ...(token ? { token } : null),
      ...(deviceToken ? { device_token: deviceToken } : null),
      // Only once the channels really exist: naming one the phone does not have
      // would file every message under "Miscellaneous", silent.
      ...(declaredChannel() ? { channel: declaredChannel() } : null),
    });
    if (token) registeredToken = token;
    if (deviceToken) registeredDeviceToken = deviceToken;
    if (token || deviceToken) lastError = null;
    return token;
  } catch (err) {
    lastError = (err as Error)?.message ?? String(err);
    return null;
  }
}

/**
 * Keeps this device's push token registered for as long as the user is signed
 * in. Returns an unsubscribe function.
 *
 * A single call at login was not enough, and the gaps it left all look
 * identical from the phone — the tray simply stays empty with the app closed:
 *
 *  - The first attempt runs while the permission dialog is still on screen, or
 *    with no network, or against an access token that is mid-refresh. It fails,
 *    nothing retries, and the account has no token on the server for the rest
 *    of the install.
 *  - The user denies the prompt, turns notifications on in Android settings
 *    later, and nothing ever asks again.
 *  - Expo rotates the token (an app update, a restored backup, an FCM refresh).
 *    The server keeps pushing at the old one, which Expo answers with
 *    DeviceNotRegistered — into a log nobody reads.
 *
 * So: register now, again whenever the app is brought to the foreground, and
 * immediately whenever Expo hands out a new token.
 */
export function startPushRegistration(): () => void {
  let cancelled = false;

  const attempt = () => {
    if (cancelled) return;
    registerPushToken();
  };

  attempt();

  const appStateSub = AppState.addEventListener('change', (state) => {
    // Coming back from Settings is the moment a denied permission most often
    // becomes a granted one, and the app is told about it exactly here.
    if (state === 'active') attempt();
  });

  // A rotated token is a new device as far as the server is concerned.
  const Notifications = notifications();
  let tokenSub: { remove: () => void } | null = null;
  try {
    tokenSub =
      Notifications?.addPushTokenListener(({ data }) => {
        if (cancelled || typeof data !== 'string' || !data) return;
        registeredToken = null; // force the POST; the value genuinely changed
        api
          .post('/me/push-token', {
            token: data,
            ...(declaredChannel() ? { channel: declaredChannel() } : null),
          })
          .then(
          () => {
            registeredToken = data;
          },
          () => {
            // The next foreground retries it.
          }
        );
      }) ?? null;
  } catch {
    // Listener registration is best-effort, like everything else here.
  }

  return () => {
    cancelled = true;
    appStateSub.remove();
    tokenSub?.remove();
  };
}

/** Why the last `registerPushToken` produced no token. Diagnostics only. */
export function lastPushError(): string | null {
  return lastError;
}

/** Clears the cached token so the next login re-registers. */
export function resetPushToken() {
  registeredToken = null;
  registeredDeviceToken = null;
}

/** The Expo token this session registered, if any. Diagnostics only. */
export function currentPushToken(): string | null {
  return registeredToken;
}

/**
 * The device (FCM) token this session registered. Diagnostics only — but the
 * important one on Android: without it the server can only reach this phone
 * through Expo, and Expo cannot reach it at all once the app is closed.
 */
export function currentDeviceToken(): string | null {
  return registeredDeviceToken;
}

/**
 * Asks the server to push to this device and reports what Expo said.
 *
 * A local notification proves the tray works; only this proves the whole chain
 * — token stored server-side, Expo accepted it, the device is reachable — which
 * is the part that silently breaks.
 */
export interface PushTestResult {
  sent: boolean;
  reason?: string;
  error?: string;
  token?: string;
  /**
   * Expo's verdict after the push service actually handed the message to
   * FCM/APNs. An accepted message that was never delivered — the shape "push
   * works in the app but nothing arrives with it closed" always takes — shows
   * up here and nowhere else.
   */
  delivered?: boolean;
  receipt_pending?: boolean;
  /** Expo's machine-readable code, e.g. `MismatchSenderId`. */
  code?: string;
  /** What has to be changed, in plain words. */
  hint?: string;
  /**
   * Which path the server used: `fcm` reaches a closed app, `expo` does not on
   * Android. Knowing which one answered is the difference between "push is
   * broken" and "push works, but only while you are looking at it".
   */
  transport?: 'fcm' | 'expo';
}

export async function sendServerPushTest(): Promise<PushTestResult> {
  try {
    return await api.post<PushTestResult>('/me/push-test', {});
  } catch (err) {
    return { sent: false, reason: 'request_failed', error: (err as Error).message };
  }
}
