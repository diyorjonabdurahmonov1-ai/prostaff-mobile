/**
 * The realtime layer.
 *
 * Events arrive over the WebSocket in `lib/socket.ts` and the hooks below react
 * to them. Polling is still here, but demoted: it runs at a slow heartbeat as a
 * safety net for a socket that is down, not as the way news travels. It used to
 * be the only mechanism, at four seconds a poll, and every one of those was a
 * full read of the orders table on the server.
 *
 * Hooks:
 *  - useWorkerOrders(enabled) — worker: polls GET /worker/orders and splits out
 *    the still-open invites, which the panel and the orders screen render as a
 *    list. (There is no takeover to feed any more — the push does the alerting.)
 *  - usePollOrder(orderId, opts) — customer: polls GET /orders/{id} until a
 *    terminal/accepted status, exposing the latest Order.
 *  - useNotifications(enabled) — the inbox behind the notifications screen:
 *    the stored messages, plus marking them read.
 */

import { AppState } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { onOrderAlert, presentLocalNotification } from '@/lib/notifications';
import { socket } from '@/lib/socket';
import type { AppAlert, AppNotification, Order, OrderStatus, Role } from '@/lib/types';

/**
 * The safety net, not the mechanism. Long enough to cost nothing, short enough
 * that a phone whose socket is wedged still catches a job inside its window.
 */
const DEFAULT_INTERVAL = 30000;

/** Order events worth a re-read of the worker's feed. */
const ORDER_EVENTS = [
  'order.invite',
  'order.taken',
  'order.status',
  'order.accepted',
  // The last worker a hand-picked order could reach declined it. Without this
  // in the list the customer's screen kept its countdown running against an
  // order the server had already closed.
  'order.rejected',
  'order.expired',
];

/** Stable empty list so a disabled poller does not hand out a new array. */
const EMPTY_ORDERS: Order[] = [];
const EMPTY_ALERTS: AppAlert[] = [];

/**
 * What can change an account's standing: taking a job spends a free one,
 * topping up clears the balance warning, and the office selling months clears a
 * firm's.
 */
const ALERT_EVENTS = [
  'order.accepted',
  'order.status',
  'subscription.changed',
  'role.changed',
  'notification.new',
];

/** An invite still worth showing: open, and inside its window. */
export function isActiveInvite(order: Order): boolean {
  if (order.status !== 'invited' && order.status !== 'matching') return false;
  if (order.worker_id) return false;
  if (!order.invite_expires_at) return order.status === 'invited';
  return new Date(order.invite_expires_at).getTime() > Date.now();
}

/**
 * The worker's order feed. Returns everything the API gave us plus `incoming`,
 * the invites still open — that list is what the panel and the orders screen
 * render, so a job the worker ignored the first time is still sitting there.
 *
 * `refresh` is exposed for use straight after accept/reject, so the list does
 * not lag a poll behind the tap.
 */
export function useWorkerOrders(
  enabled: boolean,
  intervalMs = DEFAULT_INTERVAL,
  workerUserId?: string | null
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return [];
    try {
      const next = (await api.get<Order[]>('/worker/orders')) ?? [];
      setOrders(next);
      return next;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * The heartbeat only beats while the socket is down.
     *
     * A connected app is told what happened; asking anyway is the polling this
     * was meant to remove. So the timer is armed on disconnect and disarmed the
     * moment the connection is back — when it is up, this hook makes no
     * requests at all.
     */
    const scheduleNext = () => {
      if (cancelled || timer || socket.connected) return;
      timer = setTimeout(tick, intervalMs);
    };

    const tick = async () => {
      timer = null;
      await refresh();
      scheduleNext();
    };

    // One read on mount regardless: the screen needs something to show.
    tick();

    /** Re-read now, and restart the heartbeat from now. */
    const refreshNow = () => {
      if (timer) clearTimeout(timer);
      tick();
    };

    // Losing the connection turns the heartbeat back on; regaining it turns it
    // off again. `onStatusChange` fires immediately, so this settles at mount.
    const unsubscribeStatus = socket.onStatusChange((connected) => {
      if (connected) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        scheduleNext();
      }
    });

    // The socket is the fast path: the server says a job arrived, we fetch it.
    // The event carries the order too, but re-reading keeps one source of truth
    // and costs a single request at the moment something actually happened.
    const unsubscribeSocket = socket.subscribe((event) => {
      if (ORDER_EVENTS.includes(event.type)) refreshNow();
    });
    // A reconnect means we were deaf for a while — catch up once.
    const unsubscribeReconnect = socket.onReconnect(refreshNow);
    // Push covers the app being closed; the foreground check covers the socket
    // having been torn down by the OS while it was.
    const unsubscribePush = onOrderAlert(refreshNow);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshNow();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStatus();
      unsubscribeSocket();
      unsubscribeReconnect();
      unsubscribePush();
      appStateSub.remove();
    };
  }, [enabled, intervalMs, refresh]);

  // Nothing is shown while disabled, without clearing state from an effect.
  //
  // `isMine` is the guard against somebody else's job. An order the server
  // returns because *this* worker was invited to it carries the status of
  // whoever actually took it, so a plain status test read "accepted" and put a
  // stranger's job on every losing worker's panel. Only the holder holds it.
  const list = enabled ? orders : EMPTY_ORDERS;
  const isMine = (o: Order) => !workerUserId || o.worker_id === workerUserId;
  const incoming = list.filter(isActiveInvite);
  const active =
    list.find((o) => (o.status === 'accepted' || o.status === 'in_progress') && isMine(o)) ?? null;
  const mine = list.filter((o) => !o.worker_id || isMine(o));

  return { orders: mine, incoming, active, loading: enabled && loading, refresh };
}

/** Statuses a job passes through while the provider still holds it. */
const ACTIVE_STATUSES: OrderStatus[] = ['accepted', 'in_progress'];
/** Statuses nothing follows — the history. */
const DONE_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'rejected', 'expired'];

/**
 * The firm's order feed — the company half of `useWorkerOrders`.
 *
 * A company is never broadcast to, so there are no invites to track and no
 * expiry window: an order is addressed to this firm and sits at `pending` until
 * it answers. What it does share with the worker's feed is where the news comes
 * from — the socket delivers, and the timer only runs while the socket is down.
 *
 * The three buckets are split here rather than in each screen so the panel and
 * the history screen can never disagree about what counts as "active".
 */
export function useCompanyOrders(enabled: boolean, intervalMs = DEFAULT_INTERVAL) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return [];
    try {
      const next = (await api.get<Order[]>('/company/orders')) ?? [];
      setOrders(next);
      return next;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (cancelled || timer || socket.connected) return;
      timer = setTimeout(tick, intervalMs);
    };

    const tick = async () => {
      timer = null;
      await refresh();
      scheduleNext();
    };

    tick();

    const refreshNow = () => {
      if (timer) clearTimeout(timer);
      tick();
    };

    const unsubscribeStatus = socket.onStatusChange((connected) => {
      if (connected) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        scheduleNext();
      }
    });
    const unsubscribeSocket = socket.subscribe((event) => {
      if (ORDER_EVENTS.includes(event.type)) refreshNow();
    });
    const unsubscribeReconnect = socket.onReconnect(refreshNow);
    const unsubscribePush = onOrderAlert(refreshNow);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshNow();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStatus();
      unsubscribeSocket();
      unsubscribeReconnect();
      unsubscribePush();
      appStateSub.remove();
    };
  }, [enabled, intervalMs, refresh]);

  const list = enabled ? orders : EMPTY_ORDERS;
  const pending = list.filter((o) => o.status === 'pending');
  const active = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const done = list.filter((o) => DONE_STATUSES.includes(o.status));

  return { orders: list, pending, active, done, loading: enabled && loading, refresh };
}

/**
 * Announces new invites in the notification tray.
 *
 * Mounted once at the app root for workers. The card in the list is where the
 * job is answered; this is only the tap on the shoulder — and it is what covers
 * Expo Go, where remote push does not exist at all. Each order is announced at
 * most once per session.
 */
export function useInviteAlerts(enabled: boolean, intervalMs = DEFAULT_INTERVAL) {
  const announcedRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      timer = null;
      try {
        const orders = (await api.get<Order[]>('/worker/orders')) ?? [];
        const fresh = orders.filter((o) => isActiveInvite(o) && !announcedRef.current.has(o.id));
        for (const order of fresh) {
          announcedRef.current.add(order.id);
          // The first pass only records what is already open — opening the app
          // should not replay every invite as a fresh banner.
          if (primedRef.current) {
            presentLocalNotification({
              title: 'Yangi buyurtma!',
              body: order.description || undefined,
              data: { type: 'order.invite', order_id: order.id },
            });
          }
        }
        primedRef.current = true;
      } catch {
        // swallow — a failed read is retried by the next tick
      } finally {
        scheduleNext();
      }
    };

    /**
     * Same rule as the feed: no heartbeat while the socket is up.
     *
     * This hook and `useWorkerOrders` read the very same endpoint, and both are
     * mounted at once whenever a worker is on their panel — so an ungated timer
     * here doubled every request the app made.
     */
    function scheduleNext() {
      if (cancelled || timer || socket.connected) return;
      timer = setTimeout(tick, intervalMs);
    }

    tick();

    const unsubscribeStatus = socket.onStatusChange((connected) => {
      if (connected) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        scheduleNext();
      }
    });

    // The fast path: an invite event announces itself, no request needed.
    const unsubscribeSocket = socket.subscribe((event) => {
      if (event.type === 'order.invite') {
        if (timer) clearTimeout(timer);
        timer = null;
        tick();
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStatus();
      unsubscribeSocket();
    };
  }, [enabled, intervalMs]);
}

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'rejected', 'expired'];

interface PollOrderOptions {
  enabled?: boolean;
  intervalMs?: number;
  /** stop polling once the order reaches one of these statuses */
  stopWhen?: OrderStatus[];
}

/**
 * Polls a single order. Stops automatically when the order reaches a terminal
 * status (or one supplied via `stopWhen`).
 */
export function usePollOrder(orderId: string | null, options: PollOrderOptions = {}) {
  const { enabled = true, intervalMs = DEFAULT_INTERVAL } = options;
  const stopWhen = options.stopWhen ?? TERMINAL_STATUSES;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept in a ref so a caller passing a fresh array each render does not restart
  // the poll loop; written in an effect, never during render.
  const stopWhenRef = useRef(stopWhen);
  useEffect(() => {
    stopWhenRef.current = stopWhen;
  }, [stopWhen]);

  const refetch = useCallback(async () => {
    if (!orderId) return null;
    try {
      const next = await api.get<Order>(`/orders/${orderId}`);
      setOrder(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
      return null;
    }
  }, [orderId]);

  useEffect(() => {
    if (!enabled || !orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Stops for good once the order reaches a status nothing follows.
    let settled = false;

    const scheduleNext = () => {
      if (cancelled || settled || timer || socket.connected) return;
      timer = setTimeout(tick, intervalMs);
    };

    const tick = async () => {
      timer = null;
      const next = await refetch();
      if (cancelled) return;
      if (next && stopWhenRef.current.includes(next.status)) {
        settled = true;
        return;
      }
      scheduleNext();
    };

    tick();

    const unsubscribeStatus = socket.onStatusChange((connected) => {
      if (connected) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        scheduleNext();
      }
    });

    // "A worker accepted" should land on the customer's screen the instant it
    // happens, not up to a poll later — this is the moment the whole flow is
    // judged on.
    const unsubscribeSocket = socket.subscribe((event) => {
      if (!ORDER_EVENTS.includes(event.type)) return;
      if (timer) clearTimeout(timer);
      tick();
    });
    const unsubscribeReconnect = socket.onReconnect(() => {
      if (timer) clearTimeout(timer);
      tick();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStatus();
      unsubscribeSocket();
      unsubscribeReconnect();
    };
  }, [enabled, orderId, intervalMs, refetch]);

  return { order, error, refetch };
}

/**
 * Bridges server-side notifications to the device tray.
 *
 * Stored notifications (admin messages, order updates) used to land in the
 * database and nowhere else — nothing in the app ever displayed them. This
 * polls for anything new and presents it locally through expo-notifications,
 * so it shows up even when remote push is unavailable (Expo Go).
 */
export function useNotificationBridge(enabled: boolean, intervalMs = DEFAULT_INTERVAL) {
  const sinceRef = useRef<string | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      primedRef.current = false;
      sinceRef.current = null;
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      timer = null;
      try {
        const since = sinceRef.current;
        const fresh = await api.get<AppNotification[]>('/notifications', {
          query: since ? { since } : undefined,
        });
        if (!cancelled && fresh && fresh.length > 0) {
          // Watermark forward so each poll only asks for what is new. The list
          // comes back newest-first, so that is `fresh[0]` — taking the last
          // element moved the watermark *backwards* and replayed the same
          // messages as banners on every single poll.
          sinceRef.current = fresh[0].created_at;
          // The first pass only establishes the watermark — otherwise opening
          // the app would replay every old message as a fresh banner.
          if (primedRef.current) {
            for (const n of fresh) {
              presentLocalNotification({
                title: n.title || 'PROSTAFF',
                body: n.body,
                data: { type: n.type, notification_id: n.id },
              });
            }
          }
        }
        if (!cancelled) primedRef.current = true;
      } catch {
        // swallow — the next tick retries
      } finally {
        scheduleNext();
      }
    };

    function scheduleNext() {
      if (cancelled || timer || socket.connected) return;
      timer = setTimeout(tick, intervalMs);
    }

    tick();

    const unsubscribeStatus = socket.onStatusChange((connected) => {
      if (connected) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        scheduleNext();
      }
    });

    /**
     * `notification.new` is the event the server actually sends.
     *
     * This used to listen for `admin.push` alone — and because the poll timer is
     * deliberately not scheduled while the socket is up, a connected app never
     * re-read the inbox at all. Everything the server filed against the account
     * arrived in the database, went out as a socket frame nobody was listening
     * for, and never reached the tray: a firm sitting in the app watched a new
     * order appear in its list with no notification of any kind. `admin.push`
     * stays for servers that predate `notification.new`.
     */
    const unsubscribeSocket = socket.subscribe((event) => {
      if (event.type !== 'notification.new' && event.type !== 'admin.push') return;
      if (timer) clearTimeout(timer);
      timer = null;
      tick();
    });
    // A socket that dropped and came back has missed whatever happened in
    // between, and the tray is exactly where that would go unnoticed.
    const unsubscribeReconnect = socket.onReconnect(() => {
      if (timer) clearTimeout(timer);
      timer = null;
      tick();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStatus();
      unsubscribeSocket();
      unsubscribeReconnect();
    };
  }, [enabled, intervalMs]);
}

/**
 * The notification inbox, for the screen that shows it.
 *
 * Every read asks for the whole list rather than only what is new. The
 * incremental version watermarked on `fresh[fresh.length - 1]`, and the server
 * returns newest-first — so the watermark was the *oldest* row of each batch
 * and every poll re-fetched everything it had just seen, duplicating the list.
 * The inbox is capped at fifty rows server-side anyway; one small read is
 * simpler than a watermark that has to be right.
 *
 * Same rule as everything else here: the socket delivers, and the timer is only
 * armed while there is no socket.
 */
export function useNotifications(enabled: boolean, intervalMs = DEFAULT_INTERVAL) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = (await api.get<AppNotification[]>('/notifications')) ?? [];
      setNotifications(list.slice(0, 50));
    } catch {
      // keep whatever is on screen
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  /** Clears the unread dots — what opening the screen means. */
  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    try {
      await api.post('/notifications/read', {});
    } catch {
      // the flag is cosmetic; the next read reconciles it
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      timer = null;
      await refresh();
      if (!cancelled) scheduleNext();
    };

    function scheduleNext() {
      if (cancelled || timer || socket.connected) return;
      timer = setTimeout(tick, intervalMs);
    }

    tick();

    const unsubscribeStatus = socket.onStatusChange((connected) => {
      if (connected) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        scheduleNext();
      }
    });

    // Anything the server files against this account lands as notification.new;
    // admin.push is kept because the older server build still sends only that.
    const unsubscribeSocket = socket.subscribe((event) => {
      if (event.type !== 'notification.new' && event.type !== 'admin.push') return;
      if (timer) clearTimeout(timer);
      timer = null;
      tick();
    });
    const unsubscribeReconnect = socket.onReconnect(() => {
      if (timer) clearTimeout(timer);
      timer = null;
      tick();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribeStatus();
      unsubscribeSocket();
      unsubscribeReconnect();
    };
  }, [enabled, intervalMs, refresh]);

  return { notifications, loading: enabled && loading, refresh, markAllRead };
}

/**
 * The standing warnings on the account: out of free jobs and short of the
 * minimum balance, or a firm whose month is nearly up.
 *
 * Read rather than pushed, because these are a *state* and not an event — a
 * worker who was warned last night is still in the same state this morning, and
 * a banner that only appeared once would be a banner that appeared while nobody
 * was looking. Refreshed on the events that can change it: a job accepted spends
 * a free one, an admin selling months clears the whole thing.
 */
export function useAlerts(enabled: boolean, intervalMs = DEFAULT_INTERVAL) {
  const [alerts, setAlerts] = useState<AppAlert[]>(EMPTY_ALERTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = (await api.get<AppAlert[]>('/alerts')) ?? [];
      setAlerts(list.length ? list : EMPTY_ALERTS);
    } catch {
      // keep whatever is on screen — a failed poll is not good standing
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      timer = null;
      await refresh();
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };
    tick();

    const unsubscribe = socket.subscribe((event) => {
      if (!ALERT_EVENTS.includes(event.type)) return;
      if (timer) clearTimeout(timer);
      timer = null;
      tick();
    });
    const unsubscribeReconnect = socket.onReconnect(() => {
      if (timer) clearTimeout(timer);
      timer = null;
      tick();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      unsubscribeReconnect();
    };
  }, [enabled, intervalMs, refresh]);

  /** Only the ones about the hat this panel is wearing. */
  const forRole = useCallback(
    (role: Role) => alerts.filter((a) => a.role === role),
    [alerts]
  );

  return { alerts, forRole, loading: enabled && loading, refresh };
}

/**
 * Keeps the worker/company panels in sync when an admin changes a user's roles.
 *
 * This used to open an `EventSource`. React Native does not have one — the
 * constructor threw a ReferenceError on every phone, a try/catch swallowed it,
 * and role changes silently never arrived. It is a socket subscription now, and
 * the arguments it no longer needs are kept so callers do not have to change.
 */
export function useRoleChangeListener(
  enabled: boolean,
  token: string | null,
  onRoleChanged: () => void,
  _baseUrl?: string
) {
  const onRoleChangedRef = useRef(onRoleChanged);
  useEffect(() => {
    onRoleChangedRef.current = onRoleChanged;
  });

  useEffect(() => {
    if (!enabled || !token) return;
    return socket.subscribe((event) => {
      if (event.type === 'role.changed') onRoleChangedRef.current();
    });
  }, [enabled, token]);
}
