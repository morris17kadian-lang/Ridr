import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AUTH_SESSION_KEY = 'ridr_auth_session_v1';

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

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (
              parsed &&
              typeof parsed === 'object' &&
              'email' in parsed &&
              'uid' in parsed &&
              typeof (parsed as AuthUser).email === 'string' &&
              typeof (parsed as AuthUser).uid === 'string'
            ) {
              const u = parsed as AuthUser;
              setUser({
                email: u.email,
                uid: u.uid,
                ...(typeof u.firstName === 'string' ? { firstName: u.firstName } : {}),
                ...(typeof u.lastName === 'string' ? { lastName: u.lastName } : {}),
                ...(typeof u.phone === 'string' ? { phone: u.phone } : {}),
              });
            }
          } catch {
            await AsyncStorage.removeItem(AUTH_SESSION_KEY);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: AuthUser | null) => {
    if (next) {
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    }
    setUser(next);
  }, []);

  const signIn = useCallback(
    async (email: string, _password: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) throw new Error('Email required');
      await persist({ email: trimmed, uid: `local_${Date.now()}` });
    },
    [persist]
  );

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      const trimmed = payload.email.trim().toLowerCase();
      if (!trimmed) throw new Error('Email required');
      if (!payload.password || payload.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      await persist({
        email: trimmed,
        uid: `local_${Date.now()}`,
        firstName: payload.firstName.trim() || undefined,
        lastName: payload.lastName.trim() || undefined,
        phone: payload.phone.trim() || undefined,
      });
    },
    [persist]
  );

  const signOut = useCallback(async () => {
    await persist(null);
  }, [persist]);

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
