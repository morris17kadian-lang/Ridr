import { apiRequest } from './http';

/** Parses common shapes from `GET /drivers/nearby`. Returns null if the payload is unrecognized (caller should not infer zero drivers). */
export function countDriversInNearbyResponse(data: unknown): number | null {
  if (data == null) return null;
  if (Array.isArray(data)) return data.length;
  if (typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.drivers)) return o.drivers.length;
  if (Array.isArray(o.data)) return o.data.length;
  if (Array.isArray(o.items)) return o.items.length;
  if (typeof o.count === 'number' && Number.isFinite(o.count)) return o.count;
  if (typeof o.total === 'number' && Number.isFinite(o.total)) return o.total;
  return null;
}

export async function getNearbyDrivers(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
}): Promise<unknown> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm ?? 5),
  });
  return apiRequest<unknown>(`/drivers/nearby?${q.toString()}`, {
    method: 'GET',
    auth: true,
  });
}
