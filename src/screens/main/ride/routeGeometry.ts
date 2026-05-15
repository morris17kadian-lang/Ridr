import type { LatLng } from '../locationResolve';

/** Ground distance between two points (meters) — used to weight progress along the polyline. */
function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}

/**
 * Point at fractional distance [0,1] along the polyline (vertex to vertex).
 * Uses linear interpolation in latitude/longitude between consecutive vertices so the result lies
 * exactly on the same path as `Polyline` with `geodesic={false}` (straight segments in map space).
 */
export function interpolateRoutePoint(route: LatLng[], progress: number): LatLng | null {
  if (route.length < 2) return route[0] ?? null;
  const clamped = Math.max(0, Math.min(1, progress));

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const len = haversineMeters(a, b);
    segmentLengths.push(len);
    total += len;
  }
  if (total <= 0) return route[0];

  const target = clamped * total;
  let traversed = 0;

  for (let i = 0; i < segmentLengths.length; i += 1) {
    const seg = segmentLengths[i];
    const next = traversed + seg;
    if (target <= next) {
      const local = seg > 0 ? (target - traversed) / seg : 0;
      const start = route[i];
      const end = route[i + 1];
      return {
        latitude: start.latitude + (end.latitude - start.latitude) * local,
        longitude: start.longitude + (end.longitude - start.longitude) * local,
      };
    }
    traversed = next;
  }

  return route[route.length - 1];
}

/** Geographic bearing from `a` to `b` in degrees; 0 = north, clockwise. */
export function bearingBetweenPoints(a: LatLng, b: LatLng): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = (Math.atan2(y, x) * 180) / Math.PI;
  θ = (θ + 360) % 360;
  return θ;
}

/** Compass bearing along the polyline at fractional progress [0,1]. */
export function routeBearingAtProgress(route: LatLng[], progress: number): number {
  if (route.length < 2) return 0;
  const p = Math.max(0, Math.min(1, progress));
  const delta = 0.008;
  const from = interpolateRoutePoint(route, p);
  const to = interpolateRoutePoint(route, Math.min(1, p + delta));
  if (!from || !to) return 0;
  return bearingBetweenPoints(from, to);
}
