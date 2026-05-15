import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTH_SESSION_KEY } from '../context/AuthContext';
import { getApiBaseUrl } from './config';
import { apiRequest } from './http';
import type { RideRequestDto } from './rides';

async function readAccessToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return typeof parsed.accessToken === 'string' ? parsed.accessToken : null;
  } catch {
    return null;
  }
}

async function authorizedJsonGet(url: string, token: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = null;
      }
    }
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

const tryArray = (v: unknown): RideRequestDto[] | null =>
  Array.isArray(v) ? (v as RideRequestDto[]) : null;

/** Normalizes `{ rideRequests }`, `{ items }`, `{ data }`, `{ driver }` fragments, or raw arrays. */
export function normalizeRideRequestListEnvelope(raw: unknown): RideRequestDto[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as RideRequestDto[];
  if (typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;

  let hit =
    tryArray(o.rideRequests) ??
    tryArray(o.requests) ??
    tryArray(o.items) ??
    tryArray(o.rides) ??
    tryArray(o.results) ??
    tryArray(o.incomingRideRequests) ??
    tryArray(o.pendingRideRequests) ??
    tryArray(o.openRideRequests);

  if (hit) return hit;

  const data = o.data;
  if (Array.isArray(data)) return data as RideRequestDto[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    hit =
      tryArray(d.rideRequests) ??
      tryArray(d.requests) ??
      tryArray(d.items) ??
      tryArray(d.incomingRideRequests);
    if (hit) return hit;
  }

  const driver = o.driver;
  if (driver && typeof driver === 'object') {
    return normalizeRideRequestListEnvelope(driver);
  }

  return [];
}

function mergeRideLists(primary: RideRequestDto[], envelope: unknown): RideRequestDto[] {
  const a = normalizeRideRequestListEnvelope(envelope);
  const map = new Map<string, RideRequestDto>();
  for (const r of [...primary, ...a]) {
    if (typeof r.id === 'string' && r.id) map.set(r.id, r);
  }
  return [...map.values()];
}

/**
 * Announce availability + last known coordinates so riders can match this driver (`isAvailable`).
 */
export async function patchDriverPresenceOnServer(input: {
  latitude: number;
  longitude: number;
  isAvailable: boolean;
}): Promise<boolean> {
  void input.latitude;
  void input.longitude;
  try {
    await apiRequest<{ driver?: { id?: string; isAvailable?: boolean } }>('/drivers/me', {
      method: 'PATCH',
      auth: true,
      json: { isAvailable: input.isAvailable },
    });
    return true;
  } catch {
    return false;
  }
}

/** Writes driver's latest GPS point to backend `currentLocation` ([lng, lat]). */
export async function patchDriverCurrentLocationOnServer(input: {
  latitude: number;
  longitude: number;
}): Promise<boolean> {
  try {
    await apiRequest<{ driver?: { id?: string } }>('/drivers/me/location', {
      method: 'PATCH',
      auth: true,
      json: { lat: input.latitude, lng: input.longitude },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * When `coords` set: tries geo-scoped driver offer endpoints then falls back to `GET /rides`.
 * When offline / no coords: `GET /rides` only (history + lifecycle).
 */
export async function fetchInboundRideRequests(coords: {
  latitude: number;
  longitude: number;
} | null): Promise<RideRequestDto[]> {
  const baseUrl = getApiBaseUrl();
  const token = await readAccessToken();
  if (!baseUrl || !token) return [];

  if (coords) {
    const lat = encodeURIComponent(String(coords.latitude));
    const lng = encodeURIComponent(String(coords.longitude));
    const withGeo = [
      `/drivers/me/ride-requests?lat=${lat}&lng=${lng}`,
      `/drivers/me/incoming-rides?lat=${lat}&lng=${lng}`,
      `/rides/for-driver?lat=${lat}&lng=${lng}`,
      `/rides/driver-pool?lat=${lat}&lng=${lng}`,
      `/rides/offers?lat=${lat}&lng=${lng}`,
    ];

    for (const path of withGeo) {
      const { ok, data } = await authorizedJsonGet(`${baseUrl}${path}`, token);
      if (!ok || data == null) continue;
      const merged = mergeRideLists([], data);
      if (merged.length > 0) return merged;
    }
  }

  try {
    const { rideRequests } = await apiRequest<{ rideRequests: RideRequestDto[] }>('/rides', {
      method: 'GET',
      auth: true,
    });
    return Array.isArray(rideRequests) ? rideRequests : [];
  } catch {
    return [];
  }
}

export async function tryAcceptRideAsDriver(
  rideRequestId: string
): Promise<{ ok: boolean; rideRequest?: RideRequestDto; message?: string }> {
  const baseUrl = getApiBaseUrl();
  const token = await readAccessToken();
  if (!baseUrl || !token) return { ok: false, message: 'Not signed in' };

  const id = encodeURIComponent(rideRequestId);
  const attempts: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
    { method: 'POST', path: `/rides/${id}/accept` },
    { method: 'POST', path: `/rides/${id}/driver/accept` },
    { method: 'PATCH', path: `/rides/${id}`, body: { action: 'accept', role: 'driver' } },
  ];

  for (const a of attempts) {
    try {
      const res = await fetch(`${baseUrl}${a.path}`, {
        method: a.method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(a.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: a.body ? JSON.stringify(a.body) : undefined,
      });
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          /* ignore */
        }
      }
      if (!res.ok) continue;
      const rideRequest =
        data && typeof data === 'object' && data !== null && 'rideRequest' in data
          ? (data as { rideRequest?: RideRequestDto }).rideRequest
          : undefined;
      return {
        ok: true,
        ...(rideRequest && typeof rideRequest === 'object' ? { rideRequest } : {}),
      };
    } catch {
      /* next */
    }
  }

  return { ok: false, message: 'Accept endpoint not available' };
}
