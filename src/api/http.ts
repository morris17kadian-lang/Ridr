import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTH_SESSION_KEY, type AuthUser } from '../context/AuthContext';
import { getApiBaseUrl } from './config';

export type ApiErrorBody = {
  message?: string;
  error?: string;
  errors?: unknown[];
};

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const o = data as ApiErrorBody;
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof o.error === 'string' && o.error.trim()) return o.error;
  if (Array.isArray(o.errors) && o.errors.length > 0) {
    const first = o.errors[0];
    if (typeof first === 'string' && first.trim()) return first;
    if (first && typeof first === 'object' && 'message' in first) {
      const nested = (first as { message?: unknown }).message;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    json?: unknown;
    auth?: boolean;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_BASE_URL');

  const { method = 'GET', json, auth = true, headers: extraHeaders = {} } = options;
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const buildHeaders = (bearer: string | null): Record<string, string> => {
    const h: Record<string, string> = { ...extraHeaders };
    if (json !== undefined) h['Content-Type'] = 'application/json';
    if (auth && bearer) h.Authorization = `Bearer ${bearer}`;
    return h;
  };

  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (auth) {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) throw new Error('Not signed in');
    const session = JSON.parse(raw) as {
      accessToken?: string;
      refreshToken?: string;
    };
    accessToken = session.accessToken ?? null;
    refreshToken = session.refreshToken ?? null;
    if (!accessToken) throw new Error('Not signed in');
  }

  const exec = async (token: string | null): Promise<Response> => {
    return fetch(url, {
      method,
      headers: buildHeaders(token),
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  };

  let res = await exec(accessToken);

  if (res.status === 401 && auth && refreshToken) {
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshText = await refreshRes.text();
    let refreshData: { accessToken?: string; refreshToken?: string } = {};
    if (refreshText) {
      try {
        refreshData = JSON.parse(refreshText) as typeof refreshData;
      } catch {
        /* ignore */
      }
    }
    if (refreshRes.ok && refreshData.accessToken && refreshData.refreshToken) {
      const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as { user: AuthUser; accessToken: string; refreshToken: string };
        await AsyncStorage.setItem(
          AUTH_SESSION_KEY,
          JSON.stringify({
            ...session,
            accessToken: refreshData.accessToken,
            refreshToken: refreshData.refreshToken,
          })
        );
      }
      res = await exec(refreshData.accessToken);
    }
  }

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
    const message = extractErrorMessage(data, `Request failed (${res.status})`);
    throw new Error(message);
  }

  return data as T;
}
