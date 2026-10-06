/**
 * The realtime connection — one WebSocket for the whole app.
 *
 * This is what replaces polling. Every worker's phone used to ask the server
 * "anything for me?" every four seconds; each of those was a full read of the
 * orders table. Now the server writes to a socket the moment something happens,
 * and the app asks for nothing.
 *
 * Why a WebSocket and not SSE: React Native has no `EventSource`. The app has
 * had SSE code in it all along and it never once ran on a phone — `new
 * EventSource(...)` throws a ReferenceError that a try/catch quietly swallowed.
 * `WebSocket` is polyfilled by React Native core, so it actually works.
 *
 * # What this is not
 *
 * It is not a replacement for push notifications. iOS suspends an app the
 * moment it is backgrounded and Android's Doze cuts the connection loose — for
 * a phone in a pocket, which is most of the day, there is no socket. Push stays
 * the only way to reach a worker who is not looking at the screen.
 *
 * # Reconnecting
 *
 * Mobile networks drop. On reconnect the app has missed whatever happened while
 * it was away, so listeners are told (`onReconnect`) and fetch once — a socket
 * that silently loses events is worse than polling.
 */

import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE_URL, getAuthToken } from '@/lib/api';

export interface SocketEvent<T = unknown> {
  type: string;
  data?: T;
}

type Listener = (event: SocketEvent) => void;

/** Backoff between reconnects: quick at first, then out of the way. */
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 20000, 30000];

/**
 * How much of each delay is randomised.
 *
 * The delays above are shared by every phone running this app, so without this
 * every one of them retries in the same second. That is not a problem when one
 * network drops; it is a problem when the *server* restarts, because then every
 * connected phone was disconnected at the same instant and comes back in one
 * synchronised wave — a wave that reconnects, and then refetches, because
 * `onReconnect` fires on each of them at once too.
 *
 * Spreading each delay over a window turns that wave into a queue. 0.5 means a
 * delay of d lands somewhere in [d, 1.5d], which is enough to smear the first
 * retry of a thousand phones across a second and a half and costs the phone
 * that reconnects last half a second.
 */
const RETRY_JITTER = 0.5;

class RealtimeSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectListeners = new Set<() => void>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;
  private appStateSub: { remove: () => void } | null = null;
  /** True once a connection has been established at least once. */
  private everConnected = false;
  /** Why the last attempt failed, for the diagnostics screen. */
  private lastError: string | null = null;
  private attempts = 0;

  /** Live connection, for anything that wants to show a status dot. */
  get connected(): boolean {
    return this.ws?.readyState === 1; // OPEN
  }

  /**
   * What the connection is doing, in words. "Not connected" on its own sends
   * people hunting through the wrong layer; the close code says whether the
   * server refused the token, the URL is wrong, or nothing is listening.
   */
  get diagnosis(): { url: string; attempts: number; error: string | null } {
    return {
      url: `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/ws`,
      attempts: this.attempts,
      error: this.lastError,
    };
  }

  /** Called after sign-in. Safe to call repeatedly. */
  start() {
    if (this.enabled) return;
    this.enabled = true;

    // A backgrounded app has its socket torn down by the OS without always
    // telling us; coming back to the foreground is the moment to check.
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
    this.open();
  }

  /** Called on sign-out. Drops the connection and forgets the schedule. */
  stop() {
    this.enabled = false;
    this.clearTimer();
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.everConnected = false;
    const socket = this.ws;
    this.ws = null;
    // Detach handlers first: closing fires onclose, which would otherwise
    // schedule a reconnect for a session that is over.
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }
    this.emitStatus();
  }

  /** Subscribe to every event. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to "the connection came back". Anything holding server state
   * should re-read it here: the gap is exactly what the socket could not tell
   * you about.
   */
  onReconnect(listener: () => void): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  /**
   * Watch the connection itself. Fires immediately with the current state, so a
   * screen that mounts mid-session shows the truth rather than "disconnected"
   * until something next changes.
   */
  onStatusChange(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.connected);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus() {
    const state = this.connected;
    for (const listener of this.statusListeners) listener(state);
  }

  private onAppState = (state: AppStateStatus) => {
    if (state !== 'active' || !this.enabled) return;
    if (!this.connected) {
      this.clearTimer();
      this.retry = 0;
      this.open();
    }
  };

  private open() {
    if (!this.enabled) return;
    const token = getAuthToken();
    if (!token) {
      // Not a permanent state: the token is set moments after sign-in and on
      // every refresh. Returning without rescheduling left the socket dead for
      // the rest of the session, with polling quietly carrying the app.
      this.lastError = 'no auth token yet';
      this.scheduleRetry();
      return;
    }
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;

    const url = `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/ws?token=${encodeURIComponent(token)}`;
    this.attempts += 1;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'could not open socket';
      this.scheduleRetry();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.retry = 0;
      this.lastError = null;
      // The first connection is not a reconnect — the screens that just mounted
      // have already fetched their state.
      if (this.everConnected) {
        for (const listener of this.reconnectListeners) listener();
      }
      this.everConnected = true;
      this.emitStatus();
    };

    socket.onmessage = (message) => {
      if (typeof message.data !== 'string') return;
      let parsed: SocketEvent;
      try {
        parsed = JSON.parse(message.data) as SocketEvent;
      } catch {
        return; // not ours
      }
      if (!parsed?.type) return;
      for (const listener of this.listeners) listener(parsed);
    };

    socket.onerror = () => {
      // `onclose` always follows; the retry is scheduled there so it happens once.
    };

    socket.onclose = (event) => {
      if (this.ws === socket) this.ws = null;
      // 1006 is "closed abnormally" — no handshake at all, which in practice
      // means the URL is unreachable or the route does not exist.
      const code = (event as { code?: number })?.code;
      const reason = (event as { reason?: string })?.reason;
      if (!this.everConnected) {
        this.lastError = reason || `closed (code ${code ?? 'unknown'})`;
      }
      this.emitStatus();
      this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    if (!this.enabled || this.timer) return;
    const base = RETRY_DELAYS[Math.min(this.retry, RETRY_DELAYS.length - 1)];
    // Never shorter than the base delay, only later — the backoff is there to
    // give a struggling server room, and jitter that could shorten it would be
    // working against the thing it is meant to help.
    const delay = base * (1 + Math.random() * RETRY_JITTER);
    this.retry += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open();
    }, delay);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const socket = new RealtimeSocket();

/**
 * Live connection state, for anything that wants to show it.
 *
 * Kept next to the socket rather than in a store: it is derived from one
 * object's lifecycle and nothing else in the app owns it.
 */
export function useSocketStatus(): boolean {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => socket.onStatusChange(setConnected), []);
  return connected;
}

/**
 * The connection plus why it is not up, for the diagnostics screen.
 *
 * Re-read on every status change and once a second while down, because the
 * interesting values (attempt count, last close reason) change between status
 * transitions, not on them.
 */
export function useSocketDiagnosis() {
  const connected = useSocketStatus();
  const [info, setInfo] = useState(socket.diagnosis);
  useEffect(() => {
    // Sampled rather than pushed: the attempt count and the last close reason
    // change between status transitions, not on them. Only ticks while the
    // diagnostics screen is on screen.
    const id = setInterval(() => setInfo(socket.diagnosis), 1000);
    return () => clearInterval(id);
  }, []);
  return { connected, ...info };
}
