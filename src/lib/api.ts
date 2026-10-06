/**
 * Typed fetch client for the IshTopish backend.
 *
 * - Resolves the base URL: `EXPO_PUBLIC_API_URL` override wins; otherwise the
 *   Android emulator maps `localhost` -> `10.0.2.2`, everything else stays on
 *   `localhost`.
 * - Injects the Bearer token when set.
 * - **Automatic token refresh:** on a 401 response, tries to refresh the access
 *   token using the stored refresh token. If that succeeds the original request
 *   is retried transparently. If the refresh also fails the user is signed out.
 * - Parses the `{ error: { code, message } }` envelope into an `ApiError`.
 */

import { Platform } from 'react-native';

const DEFAULT_PORT = 8080;

/** Tunnel used when no explicit override is set (device testing without LAN). */
const FALLBACK_BASE_URL = 'https://api.prostaff.uz';
// const FALLBACK_BASE_URL = 'https://prostaf.onrender.com';

function resolveBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override && override.length > 0) return override.replace(/\/$/, '');
  if (FALLBACK_BASE_URL) return FALLBACK_BASE_URL;
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${DEFAULT_PORT}`;
}

/** Base origin, e.g. `http://localhost:8080`. */
export const API_BASE_URL = resolveBaseUrl();
/** REST prefix, e.g. `http://localhost:8080/api/v1`. */
export const API_URL = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// ---- Token state -----------------------------------------------------------

let authToken: string | null = null;
let refreshToken: string | null = null;

/** Called by auth store after login / refresh. */
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function getAuthToken(): string | null {
  return authToken;
}
export function setRefreshToken(token: string | null) {
  refreshToken = token;
}
export function getRefreshToken(): string | null {
  return refreshToken;
}

/**
 * Callback invoked when a token refresh succeeds. The auth store registers
 * this so that new tokens are persisted to SecureStore.
 */
let onTokenRefreshed: ((accessToken: string, newRefreshToken: string) => void) | null = null;
export function setOnTokenRefreshed(cb: typeof onTokenRefreshed) {
  onTokenRefreshed = cb;
}

/** Callback invoked when refresh fails (token revoked / expired). */
let onRefreshFailed: (() => void) | null = null;
export function setOnRefreshFailed(cb: typeof onRefreshFailed) {
  onRefreshFailed = cb;
}

// ---- Refresh logic ---------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to refresh the access token using the stored refresh token.
 * De-duplicated: concurrent 401s share one in-flight refresh.
 */
async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        token: string;
        refresh_token: string;
        expires_in: number;
      };
      authToken = data.token;
      refreshToken = data.refresh_token;
      onTokenRefreshed?.(data.token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ---- Request plumbing ------------------------------------------------------

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  /** override / supply a token for this single call (used before it is stored) */
  token?: string | null;
  signal?: AbortSignal;
  /** skip auto-refresh (used internally to prevent infinite loops) */
  _skipRefresh?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const base = path.startsWith('http')
    ? path
    : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = options.token !== undefined ? options.token : authToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: payload,
      signal: options.signal,
    });
  } catch (err) {
    throw new ApiError(
      'network_error',
      err instanceof Error ? err.message : 'Network request failed',
      0
    );
  }

  // --- Auto-refresh on 401 ---
  if (res.status === 401 && !options._skipRefresh && authToken) {
    if (refreshToken) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry with the refreshed token. `token: undefined` drops any explicit
        // per-call token — replaying the one that was just rejected would only
        // earn a second 401.
        return request<T>(method, path, body, {
          ...options,
          token: undefined,
          _skipRefresh: true,
        });
      }
    }
    // No refresh token or refresh failed — sign out.
    onRefreshFailed?.();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const envelope = data as { error?: { code?: string; message?: string } } | undefined;
    const code = envelope?.error?.code ?? `http_${res.status}`;
    const message = envelope?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(code, message, res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  del: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};

export type Api = typeof api;
