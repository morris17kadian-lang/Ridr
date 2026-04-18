import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ensureDriverLocationReady } from '../lib/driverLocationRequirement';

export const AUTH_SESSION_KEY = 'ridr_auth_session_v1';
export const APP_MODE_KEY = 'ridr_app_mode_v1';
const DEMO_ACCESS_TOKEN_PREFIX = 'ridr_demo_access_token';
const REFRESH_MARGIN_MS = 60_000;

export type AppMode = 'rider' | 'driver';

export type AuthUser = {
  email: string;
  uid: string;
  username?: string;
  staffCode?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export type SignInResult =
  | { status: 'signed-in' }
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
  setAppMode: (mode: AppMode) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<SignInResult>;
  signInSampleRider: () => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
  /** Called after forgot-password flow — local session only for UI demo */
  markPasswordResetSent: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppModeState] = useState<AppMode>('rider');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    const fromEnv = process.env.EXPO_PUBLIC_BASE_URL;
    if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, '');

    const fromExpoConfig = Constants.expoConfig?.extra?.baseUrl;
    if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) {
      return fromExpoConfig.trim().replace(/\/+$/, '');
    }

    const fromManifest = ((Constants as unknown as { manifest?: { extra?: { baseUrl?: string } } }).manifest
      ?.extra?.baseUrl ?? '');
    if (typeof fromManifest === 'string' && fromManifest.trim()) {
      return fromManifest.trim().replace(/\/+$/, '');
    }

    const fromManifest2 = ((Constants as unknown as {
      manifest2?: { extra?: { expoClient?: { extra?: { baseUrl?: string } } } };
    }).manifest2?.extra?.expoClient?.extra?.baseUrl ?? '');
    if (typeof fromManifest2 === 'string' && fromManifest2.trim()) {
      return fromManifest2.trim().replace(/\/+$/, '');
    }

    return '';
  }, []);

  type AuthSession = {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };

  type ApiAuthResponse = {
    user: {
      id: string;
      email: string;
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
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const setAppMode = useCallback(async (mode: AppMode) => {
    if (mode === 'driver') {
      const loc = await ensureDriverLocationReady();
      if (!loc.ok) {
        throw new Error(loc.message);
      }
    }
    setAppModeState(mode);
    await AsyncStorage.setItem(APP_MODE_KEY, mode);
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

  const signInSampleRider = useCallback(async () => {
    const demoSession: AuthSession = {
      user: {
        uid: 'sample-rider-001',
        email: 'sample.rider@ridr.app',
        username: 'sample.rider',
        firstName: 'Sample',
        lastName: 'Rider',
        phone: '+18765550199',
      },
      accessToken: `${DEMO_ACCESS_TOKEN_PREFIX}:${Date.now()}`,
      refreshToken: 'ridr_demo_refresh_token',
    };
    await persistSession(demoSession);
  }, [persistSession]);

  useEffect(() => {
    (async () => {
      try {
        const [raw, savedMode] = await Promise.all([
          AsyncStorage.getItem(AUTH_SESSION_KEY),
          AsyncStorage.getItem(APP_MODE_KEY),
        ]);
        if (savedMode === 'rider' || savedMode === 'driver') {
          if (savedMode === 'driver') {
            const loc = await ensureDriverLocationReady();
            if (loc.ok) {
              setAppModeState('driver');
            } else {
              setAppModeState('rider');
              await AsyncStorage.setItem(APP_MODE_KEY, 'rider');
            }
          } else {
            setAppModeState('rider');
          }
        }
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
                ...(typeof parsed.user.username === 'string' ? { username: parsed.user.username } : {}),
                ...(typeof parsed.user.staffCode === 'string' ? { staffCode: parsed.user.staffCode } : {}),
                ...(typeof parsed.user.firstName === 'string' ? { firstName: parsed.user.firstName } : {}),
                ...(typeof parsed.user.lastName === 'string' ? { lastName: parsed.user.lastName } : {}),
                ...(typeof parsed.user.phone === 'string' ? { phone: parsed.user.phone } : {}),
              };

              if (
                parsed.accessToken.startsWith(DEMO_ACCESS_TOKEN_PREFIX) ||
                !isTokenExpiredOrNearExpiry(parsed.accessToken)
              ) {
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
            }
          } catch {
            await AsyncStorage.removeItem(AUTH_SESSION_KEY);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isTokenExpiredOrNearExpiry, persistSession, requestJson]);

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

      return { status: 'signed-in' };
    },
    [persistSession, requestJson, toAuthUser]
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
    },
    [persistSession, requestJson, toAuthUser]
  );

  const signOut = useCallback(async () => {
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
      setAppMode,
      signIn,
      signInSampleRider,
      signUp,
      signOut,
      markPasswordResetSent,
    }),
    [user, loading, appMode, setAppMode, signIn, signInSampleRider, signUp, signOut, markPasswordResetSent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
