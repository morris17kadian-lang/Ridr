import type { LatLng } from '../locationResolve';

export function interpolateRoutePoint(route: LatLng[], progress: number): LatLng | null {
  if (route.length < 2) return route[0] ?? null;
  const clamped = Math.max(0, Math.min(1, progress));

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const len = Math.sqrt(dx * dx + dy * dy);
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
