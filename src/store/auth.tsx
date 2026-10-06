/**
 * Auth store: holds the JWT access token, refresh token and current `User`,
 * plus the active role mode.
 *
 * Persists tokens and user via expo-secure-store.
 *
 * Refresh flow:
 *  - On 401, the API client (`lib/api.ts`) automatically calls
 *    `POST /auth/refresh` with the stored refresh token.
 *  - On success, the new tokens are persisted here via `onTokenRefreshed`.
 *  - On failure, the user is signed out via `onRefreshFailed`.
 *
 * Exposes: requestOtp, verifyOtp, refreshMe, signOut, setActiveMode.
 */

import * as SecureStore from 'expo-secure-store';

import { resetPushToken } from '@/lib/notifications';
import { socket } from '@/lib/socket';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  api,
  setRefreshToken as setApiRefreshToken,
  setAuthToken,
  setOnRefreshFailed,
  setOnTokenRefreshed,
} from '@/lib/api';
import type {
  ForgotPasswordResponse,
  LoginResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  ResetVerifyResponse,
  User,
} from '@/lib/types';

const TOKEN_KEY = 'prostaff.token';
const REFRESH_TOKEN_KEY = 'prostaff.refresh_token';
const USER_KEY = 'prostaff.user';
const MODE_KEY = 'prostaff.mode';
/**
 * Set once the user has switched modes from the profile screen themselves.
 *
 * Without it there is no way to tell a mode somebody chose from one the app
 * picked for them, and the two need opposite treatment: a chosen mode is never
 * overridden, while a default one has to follow the account. The office opens a
 * worker's profile hours after they signed up as a customer, and the app finds
 * out on the next `/me` — at which point the account is a worker and the session
 * it is sitting in is not.
 */
const MODE_CHOSEN_KEY = 'prostaff.mode_chosen';

export type ActiveMode = 'customer' | 'worker' | 'company';

interface AuthContextValue {
  hydrated: boolean;
  token: string | null;
  user: User | null;
  activeMode: ActiveMode;
  isAuthenticated: boolean;
  requestOtp: (phone: string) => Promise<OtpRequestResponse>;
  verifyOtp: (phone: string, code: string, name?: string, password?: string) => Promise<User>;
  login: (phone: string, password: string) => Promise<User>;
  /** Password reset step 1 — sends a code to the phone. */
  forgotPassword: (phone: string) => Promise<ForgotPasswordResponse>;
  /** Step 2 — spends the code for a token that only authorises step 3. */
  verifyResetCode: (phone: string, code: string) => Promise<ResetVerifyResponse>;
  /** Step 3 — the user picks the new password. Does not sign them in. */
  resetPassword: (resetToken: string, password: string) => Promise<void>;
  refreshMe: () => Promise<User | null>;
  signOut: () => Promise<void>;
  setActiveMode: (mode: ActiveMode) => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore (web / unavailable)
  }
}

/**
 * The mode a freshly signed-in account belongs in.
 *
 * Every session used to open in customer mode, whoever was signing in. For a
 * worker that is the wrong app: the customer home, the customer tabs, and a
 * profile whose "Mijoz" row is the one marked active — their own panel sitting
 * behind a switch they had to know to find. A provider account signs into its
 * provider side, because that is what the account is for. Ordering as a customer
 * stays one tap away on the profile, and the choice is remembered from then on.
 *
 * Someone holding both hats lands on the worker one: it is the side with jobs
 * arriving in real time, and the side where being in the wrong mode costs work.
 */
function defaultModeFor(user: User): ActiveMode {
  if (user.worker_profile) return 'worker';
  if (user.company_profile) return 'company';
  return 'customer';
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [activeMode, setActiveMode_] = useState<ActiveMode>('customer');
  /** Whether `activeMode` is the user's own choice — see MODE_CHOSEN_KEY. */
  const modeChosenRef = useRef(false);
  /**
   * The current mode, readable without depending on it.
   *
   * `refreshMe` needs to know the mode to decide whether to move it, and it is
   * called from a `useFocusEffect` on nearly every screen — taking `activeMode`
   * as a dependency would give the callback a new identity on every switch and
   * re-run all of those effects for nothing.
   */
  const activeModeRef = useRef<ActiveMode>('customer');
  const setActiveModeState = useCallback((mode: ActiveMode) => {
    activeModeRef.current = mode;
    setActiveMode_(mode);
  }, []);

  // hydrate from secure storage on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const [storedToken, storedRefreshToken, storedUser, storedMode, storedChosen] =
        await Promise.all([
          secureGet(TOKEN_KEY),
          secureGet(REFRESH_TOKEN_KEY),
          secureGet(USER_KEY),
          secureGet(MODE_KEY),
          secureGet(MODE_CHOSEN_KEY),
        ]);
      if (!active) return;
      if (storedToken) {
        setToken(storedToken);
        setAuthToken(storedToken);
      }
      if (storedRefreshToken) {
        setApiRefreshToken(storedRefreshToken);
      }
      if (storedUser) {
        try {
          setUserState(JSON.parse(storedUser) as User);
        } catch {
          // corrupt cache — ignore
        }
      }
      if (storedMode === 'worker' || storedMode === 'company' || storedMode === 'customer') {
        setActiveModeState(storedMode);
      }
      modeChosenRef.current = storedChosen === 'true';
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [setActiveModeState]);

  /**
   * The realtime connection follows the session. Started here rather than in a
   * screen so it survives navigation, and stopped on sign-out so the next
   * account does not inherit the previous one's socket.
   */
  useEffect(() => {
    if (!token) {
      socket.stop();
      return;
    }
    socket.start();
  }, [token]);

  const persistUser = useCallback((next: User | null) => {
    setUserState(next);
    if (next) secureSet(USER_KEY, JSON.stringify(next));
    else secureDelete(USER_KEY);
  }, []);

  // Register callbacks with the API client for auto-refresh.
  const doSignOut = useCallback(async () => {
    setToken(null);
    setAuthToken(null);
    setApiRefreshToken(null);
    persistUser(null);
    setActiveModeState('customer');
    modeChosenRef.current = false;
    await Promise.all([
      secureDelete(TOKEN_KEY),
      secureDelete(REFRESH_TOKEN_KEY),
      secureDelete(USER_KEY),
      secureDelete(MODE_KEY),
      secureDelete(MODE_CHOSEN_KEY),
    ]);
  }, [persistUser, setActiveModeState]);

  useEffect(() => {
    // When the API client successfully refreshes tokens, persist them.
    setOnTokenRefreshed((newAccessToken: string, newRefreshToken: string) => {
      setToken(newAccessToken);
      setAuthToken(newAccessToken);
      setApiRefreshToken(newRefreshToken);
      secureSet(TOKEN_KEY, newAccessToken);
      secureSet(REFRESH_TOKEN_KEY, newRefreshToken);
    });

    // When refresh fails, sign out.
    setOnRefreshFailed(() => {
      doSignOut();
    });

    return () => {
      setOnTokenRefreshed(null);
      setOnRefreshFailed(null);
    };
  }, [doSignOut]);

  const requestOtp = useCallback((phone: string) => {
    return api.post<OtpRequestResponse>('/auth/otp/request', { phone });
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string, name?: string, password?: string) => {
      const res = await api.post<OtpVerifyResponse>('/auth/otp/verify', {
        phone,
        code,
        ...(name ? { name } : {}),
        ...(password ? { password } : {}),
      });
      // Store access token.
      setToken(res.token);
      setAuthToken(res.token);
      await secureSet(TOKEN_KEY, res.token);
      // Store refresh token.
      setApiRefreshToken(res.refresh_token);
      await secureSet(REFRESH_TOKEN_KEY, res.refresh_token);
      persistUser(res.user);
      // A fresh session starts on the mode the account implies, and stays open
      // to being moved with it until the user picks one for themselves.
      const mode = defaultModeFor(res.user);
      setActiveModeState(mode);
      modeChosenRef.current = false;
      await Promise.all([secureSet(MODE_KEY, mode), secureDelete(MODE_CHOSEN_KEY)]);
      return res.user;
    },
    [persistUser, setActiveModeState]
  );

  const login = useCallback(
    async (phone: string, password: string) => {
      const res = await api.post<LoginResponse>('/auth/login', { phone, password });
      setToken(res.token);
      setAuthToken(res.token);
      await secureSet(TOKEN_KEY, res.token);
      setApiRefreshToken(res.refresh_token);
      await secureSet(REFRESH_TOKEN_KEY, res.refresh_token);
      persistUser(res.user);
      // A fresh session starts on the mode the account implies, and stays open
      // to being moved with it until the user picks one for themselves.
      const mode = defaultModeFor(res.user);
      setActiveModeState(mode);
      modeChosenRef.current = false;
      await Promise.all([secureSet(MODE_KEY, mode), secureDelete(MODE_CHOSEN_KEY)]);
      return res.user;
    },
    [persistUser, setActiveModeState]
  );

  const forgotPassword = useCallback((phone: string) => {
    return api.post<ForgotPasswordResponse>('/auth/forgot-password', { phone });
  }, []);

  const verifyResetCode = useCallback((phone: string, code: string) => {
    return api.post<ResetVerifyResponse>('/auth/forgot-password/verify', { phone, code });
  }, []);

  const resetPassword = useCallback(async (resetToken: string, password: string) => {
    await api.post('/auth/reset-password', { reset_token: resetToken, password });
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return null;
    try {
      const me = await api.get<User>('/me');
      persistUser(me);
      // The office opens worker and firm accounts, not the app — so the moment
      // a session learns it has become one is here, on an ordinary refresh. A
      // mode the user never chose follows the account; one they did is theirs.
      if (!modeChosenRef.current) {
        const next = defaultModeFor(me);
        if (next !== activeModeRef.current) {
          setActiveModeState(next);
          secureSet(MODE_KEY, next);
        }
      }
      return me;
    } catch {
      return null;
    }
  }, [token, persistUser, setActiveModeState]);

  const signOut = useCallback(async () => {
    // Notify server to revoke refresh token.
    const rt = await secureGet(REFRESH_TOKEN_KEY);
    if (rt) {
      api.post('/auth/logout', { refresh_token: rt }).catch(() => {});
    }
    // Forget the push token so the next account registers its own.
    resetPushToken();
    await doSignOut();
  }, [doSignOut]);

  /**
   * The deliberate switch from the profile screen. It is what marks the mode as
   * the user's own, so nothing — not the next `/me`, not a restart — moves them
   * out of it again.
   */
  const setActiveMode = useCallback(
    (mode: ActiveMode) => {
      setActiveModeState(mode);
      modeChosenRef.current = true;
      secureSet(MODE_KEY, mode);
      secureSet(MODE_CHOSEN_KEY, 'true');
    },
    [setActiveModeState]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      token,
      user,
      activeMode,
      isAuthenticated: !!token,
      requestOtp,
      verifyOtp,
      login,
      forgotPassword,
      verifyResetCode,
      resetPassword,
      refreshMe,
      signOut,
      setActiveMode,
      setUser: persistUser,
    }),
    [
      hydrated,
      token,
      user,
      activeMode,
      requestOtp,
      verifyOtp,
      login,
      forgotPassword,
      verifyResetCode,
      resetPassword,
      refreshMe,
      signOut,
      setActiveMode,
      persistUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
