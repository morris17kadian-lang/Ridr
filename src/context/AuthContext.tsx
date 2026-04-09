import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const AUTH_SESSION_KEY = 'ridr_auth_session_v1';
const REFRESH_MARGIN_MS = 60_000;

export type AuthUser = {
  email: string;
  uid: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
  /** Called after forgot-password flow — local session only for UI demo */
  markPasswordResetSent: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
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
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    accessToken: string;
    refreshToken: string;
  };

  const toAuthUser = useCallback((apiUser: ApiAuthResponse['user']): AuthUser => {
    return {
      uid: apiUser.id,
      email: apiUser.email.trim().toLowerCase(),
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
      try {
        const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
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
                ...(typeof parsed.user.firstName === 'string' ? { firstName: parsed.user.firstName } : {}),
                ...(typeof parsed.user.lastName === 'string' ? { lastName: parsed.user.lastName } : {}),
                ...(typeof parsed.user.phone === 'string' ? { phone: parsed.user.phone } : {}),
              };

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
    async (email: string, password: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) throw new Error('Email required');
      if (!password) throw new Error('Password required');

      const data = await requestJson<ApiAuthResponse>('/auth/login', {
        email: trimmed,
        password,
      });

      await persistSession({
        user: toAuthUser(data.user),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
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
      signIn,
      signUp,
      signOut,
      markPasswordResetSent,
    }),
    [user, loading, signIn, signUp, signOut, markPasswordResetSent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
