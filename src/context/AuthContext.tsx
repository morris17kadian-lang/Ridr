import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchDriversMeApplicationStatus } from '../api/driverProfile';
import { getApiBaseUrl } from '../api/config';
import {
  clearProfileIdentityFromStorage,
  DRIVER_PROFILE_CACHE_KEY,
} from '../lib/appCacheStorage';
import { isDriverApplicationApprovedNormalized } from '../lib/driverApplicationGate';
import { ensureDriverLocationReady } from '../lib/driverLocationRequirement';

export const AUTH_SESSION_KEY = 'ridr_auth_session_v1';
export const APP_MODE_KEY = 'ridr_app_mode_v1';
const REFRESH_MARGIN_MS = 60_000;

export type AppMode = 'rider' | 'driver';
export type AppUserRole = 'user' | 'driver';

export type AuthUser = {
  email: string;
  uid: string;
  role: AppUserRole;
  username?: string;
  staffCode?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export type SignInResult =
  | {
      status: 'signed-in';
      role: AppUserRole;
      /** From `drivers.applicationStatus` via `GET /drivers/me`; not derived from user.role. */
      driversDocEligible: boolean;
    }
  | {
      status: 'password-reset-required';
      identifier: string;
      resetToken?: string;
      staffCode?: string;
    };

export type SignUpPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  appMode: AppMode;
  /** `drivers.applicationStatus` satisfies approved bucket (via `GET /drivers/me`). */
  driverModeEligible: boolean;
  /** Refetch signed-in driver's Mongo document; returning whether approved for Driver mode. */
  refreshDriverProfile: () => Promise<boolean>;
  setAppMode: (mode: AppMode) => Promise<void>;
  setUserRole: (role: AppUserRole) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<SignInResult>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
  markPasswordResetSent: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppModeState] = useState<AppMode>('rider');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  /** Canonical driver onboarding state: Mongo `drivers.applicationStatus`. */
  const [driversCollectionApplicationStatus, setDriversCollectionApplicationStatus] = useState<string | null>(null);

  const baseUrl = useMemo(() => getApiBaseUrl(), []);

  const driverModeEligible = useMemo(
    () => isDriverApplicationApprovedNormalized(driversCollectionApplicationStatus),
    [driversCollectionApplicationStatus]
  );

  type AuthSession = {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };

  type ApiAuthResponse = {
    user: {
      id: string;
      email: string;
      role?: string;
      username?: string;
      staffCode?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    accessToken: string;
    refreshToken: string;
    mustResetPassword?: boolean;
    passwordResetToken?: string;
  };

  const toAuthUser = useCallback((apiUser: ApiAuthResponse['user']): AuthUser => {
    return {
      uid: apiUser.id,
      email: apiUser.email.trim().toLowerCase(),
      role: apiUser.role === 'driver' ? 'driver' : 'user',
      ...(typeof apiUser.username === 'string' ? { username: apiUser.username } : {}),
      ...(typeof apiUser.staffCode === 'string' ? { staffCode: apiUser.staffCode } : {}),
      ...(typeof apiUser.firstName === 'string' ? { firstName: apiUser.firstName } : {}),
      ...(typeof apiUser.lastName === 'string' ? { lastName: apiUser.lastName } : {}),
      ...(typeof apiUser.phone === 'string' ? { phone: apiUser.phone } : {}),
    };
  }, []);

  const parseJwtExpMs = useCallback((jwt: string): number | null => {
    try {
      const payload = jwt.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padLen = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
      const padded = normalized.padEnd(normalized.length + padLen, '=');
      const decoded = globalThis.atob ? globalThis.atob(padded) : '';
      if (!decoded) return null;
      const parsed = JSON.parse(decoded) as { exp?: number };
      return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null;
    } catch {
      return null;
    }
  }, []);

  const isTokenExpiredOrNearExpiry = useCallback(
    (jwt: string) => {
      const expMs = parseJwtExpMs(jwt);
      if (!expMs) return true;
      return Date.now() >= expMs - REFRESH_MARGIN_MS;
    },
    [parseJwtExpMs]
  );

  const persistSession = useCallback(async (next: AuthSession | null) => {
    if (next) {
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
      setUser(next.user);
      setAccessToken(next.accessToken);
      setRefreshToken(next.refreshToken);
      return;
    }

    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    await AsyncStorage.removeItem(DRIVER_PROFILE_CACHE_KEY);
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setDriversCollectionApplicationStatus(null);
  }, []);

  const refreshDriverProfile = useCallback(async (): Promise<boolean> => {
    if (!baseUrl) return false;
    const sessionRaw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!sessionRaw) {
      setDriversCollectionApplicationStatus(null);
      return false;
    }
    let sessionParsed: Record<string, unknown>;
    try {
      sessionParsed = JSON.parse(sessionRaw) as Record<string, unknown>;
    } catch {
      return false;
    }
    const u = sessionParsed.user as { uid?: string; id?: string } | undefined;
    const uidRaw = u?.uid ?? u?.id;
    const uid =
      typeof uidRaw === 'string' && uidRaw.trim()
        ? uidRaw.trim()
        : typeof uidRaw === 'number' && Number.isFinite(uidRaw)
          ? String(uidRaw)
          : null;
    const at = typeof sessionParsed.accessToken === 'string' ? sessionParsed.accessToken : null;
    const rt =
      typeof sessionParsed.refreshToken === 'string' ? sessionParsed.refreshToken : undefined;
    if (!uid || !at) {
      setDriversCollectionApplicationStatus(null);
      return false;
    }
    try {
      const { applicationStatusLower } = await fetchDriversMeApplicationStatus(
        { accessToken: at, refreshToken: rt },
        async (a, r) => {
          const latest = JSON.parse(
            (await AsyncStorage.getItem(AUTH_SESSION_KEY)) ?? '{}'
          ) as Record<string, unknown>;
          await AsyncStorage.setItem(
            AUTH_SESSION_KEY,
            JSON.stringify({ ...latest, accessToken: a, refreshToken: r })
          );
          setAccessToken(a);
          setRefreshToken(r);
        }
      );
      setDriversCollectionApplicationStatus(applicationStatusLower);
      await AsyncStorage.setItem(
        DRIVER_PROFILE_CACHE_KEY,
        JSON.stringify({ uid, applicationStatusLower })
      );
      return isDriverApplicationApprovedNormalized(applicationStatusLower);
    } catch {
      return false;
    }
  }, [baseUrl]);

  const setAppMode = useCallback(
    async (mode: AppMode) => {
      if (mode === 'driver') {
        const eligible = await refreshDriverProfile();
        if (!eligible) {
          throw new Error('Your account is not yet approved for Driver mode.');
        }
        const loc = await ensureDriverLocationReady();
        if (!loc.ok) {
          throw new Error(loc.message);
        }
      }
      setAppModeState(mode);
      await AsyncStorage.setItem(APP_MODE_KEY, mode);
    },
    [refreshDriverProfile]
  );

  const setUserRole = useCallback(async (role: AppUserRole) => {
    setUser((prev) => (prev ? { ...prev, role } : prev));
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
      if (!parsed || typeof parsed !== 'object' || !parsed.user) return;
      const next = {
        ...parsed,
        user: {
          ...parsed.user,
          role,
        },
      };
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
    } catch {
      /* ignore persistence errors */
    }
  }, []);

  const requestJson = useCallback(
    async <T,>(path: string, payload: Record<string, string>): Promise<T> => {
      if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_BASE_URL');

      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          throw new Error(`Invalid server response (${res.status})`);
        }
      }

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        if (data && typeof data === 'object') {
          const asObj = data as {
            message?: unknown;
            error?: unknown;
            errors?: unknown;
          };

          if (typeof asObj.message === 'string' && asObj.message.trim()) {
            message = asObj.message;
          } else if (typeof asObj.error === 'string' && asObj.error.trim()) {
            message = asObj.error;
          } else if (Array.isArray(asObj.errors) && asObj.errors.length > 0) {
            const first = asObj.errors[0];
            if (typeof first === 'string' && first.trim()) {
              message = first;
            } else if (first && typeof first === 'object' && 'message' in first) {
              const nested = (first as { message?: unknown }).message;
              if (typeof nested === 'string' && nested.trim()) message = nested;
            }
          }
        }
        throw new Error(message);
      }

      return data as T;
    },
    [baseUrl]
  );

  useEffect(() => {
    (async () => {
      let gateEligibleForDriverUi = false;

      try {
        const [raw, savedMode] = await Promise.all([
          AsyncStorage.getItem(AUTH_SESSION_KEY),
          AsyncStorage.getItem(APP_MODE_KEY),
        ]);

        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.user &&
              typeof parsed.user === 'object' &&
              typeof parsed.user.email === 'string' &&
              typeof parsed.user.uid === 'string' &&
              typeof parsed.accessToken === 'string' &&
              typeof parsed.refreshToken === 'string'
            ) {
              const restoredUser: AuthUser = {
                email: parsed.user.email,
                uid: parsed.user.uid,
                role: parsed.user.role === 'driver' ? 'driver' : 'user',
                ...(typeof parsed.user.username === 'string' ? { username: parsed.user.username } : {}),
                ...(typeof parsed.user.staffCode === 'string' ? { staffCode: parsed.user.staffCode } : {}),
                ...(typeof parsed.user.firstName === 'string' ? { firstName: parsed.user.firstName } : {}),
                ...(typeof parsed.user.lastName === 'string' ? { lastName: parsed.user.lastName } : {}),
                ...(typeof parsed.user.phone === 'string' ? { phone: parsed.user.phone } : {}),
              };

              try {
                const dRaw = await AsyncStorage.getItem(DRIVER_PROFILE_CACHE_KEY);
                if (dRaw) {
                  const o = JSON.parse(dRaw) as {
                    uid?: string;
                    applicationStatusLower?: string | null;
                  };
                  if (o.uid === restoredUser.uid) {
                    const st = typeof o.applicationStatusLower === 'string' ? o.applicationStatusLower : null;
                    setDriversCollectionApplicationStatus(st);
                  }
                }
              } catch {
                /* stale cache */
              }

              if (!isTokenExpiredOrNearExpiry(parsed.accessToken)) {
                await persistSession({
                  user: restoredUser,
                  accessToken: parsed.accessToken,
                  refreshToken: parsed.refreshToken,
                });
              } else {
                const refreshed = await requestJson<{ accessToken: string; refreshToken: string }>(
                  '/auth/refresh',
                  { refreshToken: parsed.refreshToken }
                );
                await persistSession({
                  user: restoredUser,
                  accessToken: refreshed.accessToken,
                  refreshToken: refreshed.refreshToken,
                });
              }

              gateEligibleForDriverUi = await refreshDriverProfile();
            }
          } catch {
            await AsyncStorage.removeItem(AUTH_SESSION_KEY);
          }
        }

        if (savedMode === 'rider' || savedMode === 'driver') {
          if (savedMode === 'driver') {
            if (!gateEligibleForDriverUi) {
              setAppModeState('rider');
              await AsyncStorage.setItem(APP_MODE_KEY, 'rider');
            } else {
              const loc = await ensureDriverLocationReady();
              if (loc.ok) {
                setAppModeState('driver');
              } else {
                setAppModeState('rider');
                await AsyncStorage.setItem(APP_MODE_KEY, 'rider');
              }
            }
          } else {
            setAppModeState('rider');
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isTokenExpiredOrNearExpiry, persistSession, refreshDriverProfile, requestJson]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<SignInResult> => {
      const trimmed = identifier.trim();
      if (!trimmed) throw new Error('Email or staff code required');
      if (!password) throw new Error('Password required');

      const normalized = trimmed.toLowerCase();
      const isEmail = normalized.includes('@');
      const username = trimmed.toUpperCase();

      const data = await requestJson<ApiAuthResponse>('/auth/login', {
        ...(isEmail ? { email: normalized } : { username, staffCode: username }),
        identifier: isEmail ? normalized : username,
        password,
      });

      if (data.mustResetPassword) {
        return {
          status: 'password-reset-required',
          identifier: data.user.staffCode ?? data.user.username ?? (isEmail ? normalized : username),
          ...(typeof data.passwordResetToken === 'string' && data.passwordResetToken
            ? { resetToken: data.passwordResetToken }
            : {}),
          ...(typeof data.user.staffCode === 'string' ? { staffCode: data.user.staffCode } : {}),
        };
      }

      await persistSession({
        user: toAuthUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      const driversDocEligible = await refreshDriverProfile();

      return {
        status: 'signed-in',
        role: data.user.role === 'driver' ? 'driver' : 'user',
        driversDocEligible,
      };
    },
    [persistSession, refreshDriverProfile, requestJson, toAuthUser]
  );

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      const trimmed = payload.email.trim().toLowerCase();
      if (!trimmed) throw new Error('Email required');
      if (!payload.password || payload.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const data = await requestJson<ApiAuthResponse>('/auth/register', {
        email: trimmed,
        password: payload.password,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        phone: payload.phone.trim(),
      });

      await persistSession({
        user: toAuthUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      void refreshDriverProfile();
    },
    [persistSession, refreshDriverProfile, requestJson, toAuthUser]
  );

  const signOut = useCallback(async () => {
    await clearProfileIdentityFromStorage();
    await persistSession(null);
  }, [persistSession]);

  const markPasswordResetSent = useCallback(async (_email: string) => {
    /* Hook for future Firebase sendPasswordResetEmail */
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      appMode,
      driverModeEligible,
      refreshDriverProfile,
      setAppMode,
      signIn,
      signUp,
      signOut,
      setUserRole,
      markPasswordResetSent,
    }),
    [
      user,
      loading,
      appMode,
      driverModeEligible,
      refreshDriverProfile,
      setAppMode,
      signIn,
      signUp,
      signOut,
      setUserRole,
      markPasswordResetSent,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
