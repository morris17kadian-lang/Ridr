import Constants from 'expo-constants';

import type { LatLng } from '../screens/main/locationResolve';

/** Decode Google Encoded Polyline Algorithm Format → `{ latitude, longitude }[]`. */
export function decodeGooglePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
  } catch {
    return [];
  }

  return points;
}

export function linearRouteBetween(a: LatLng, b: LatLng, segments: number): LatLng[] {
  const n = Math.max(2, Math.min(96, Math.floor(segments)));
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    });
  }
  return out;
}

type DirectionsApiRoute = {
  overview_polyline?: { points?: string };
  legs?: Array<{
    steps?: Array<{ polyline?: { points?: string } }>;
  }>;
};

/** Merge per-step polylines (closer to Google Maps path than overview alone). */
function coordsFromDirectionsRoute(route: DirectionsApiRoute): LatLng[] {
  const legs = route.legs;
  if (legs?.length) {
    const merged: LatLng[] = [];
    for (const leg of legs) {
      for (const step of leg.steps ?? []) {
        const pts = decodeGooglePolyline(step.polyline?.points ?? '');
        if (pts.length === 0) continue;
        if (merged.length > 0) {
          const last = merged[merged.length - 1];
          const first = pts[0];
          if (last.latitude === first.latitude && last.longitude === first.longitude) {
            merged.push(...pts.slice(1));
          } else {
            merged.push(...pts);
          }
        } else {
          merged.push(...pts);
        }
      }
    }
    if (merged.length > 1) return merged;
  }
  const overview = route.overview_polyline?.points;
  if (overview) {
    const decoded = decodeGooglePolyline(overview);
    if (decoded.length > 1) return decoded;
  }
  return [];
}

function resolveGoogleMapsApiKey(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();

  const fromExpoConfig = (Constants.expoConfig?.extra?.googleMapsApiKey as string | undefined) ?? '';
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) return fromExpoConfig.trim();

  const fromManifest = (
    (Constants as unknown as { manifest?: { extra?: { googleMapsApiKey?: string } } }).manifest?.extra
      ?.googleMapsApiKey ?? ''
  );
  if (typeof fromManifest === 'string' && fromManifest.trim()) return fromManifest.trim();

  const fromManifest2 =
    (Constants as unknown as {
      manifest2?: { extra?: { expoClient?: { extra?: { googleMapsApiKey?: string } } } };
    }).manifest2?.extra?.expoClient?.extra?.googleMapsApiKey ?? '';
  if (typeof fromManifest2 === 'string' && fromManifest2.trim()) return fromManifest2.trim();

  const fromExpoConfigIOS = (Constants.expoConfig?.ios?.config as { googleMapsApiKey?: string } | undefined)
    ?.googleMapsApiKey;
  if (typeof fromExpoConfigIOS === 'string' && fromExpoConfigIOS.trim()) return fromExpoConfigIOS.trim();

  const fromExpoConfigAndroid = (
    Constants.expoConfig?.android?.config as { googleMaps?: { apiKey?: string } } | undefined
  )?.googleMaps?.apiKey;
  if (typeof fromExpoConfigAndroid === 'string' && fromExpoConfigAndroid.trim()) return fromExpoConfigAndroid.trim();

  const fromManifestIOS = (
    (Constants as unknown as { manifest?: { ios?: { config?: { googleMapsApiKey?: string } } } }).manifest?.ios
      ?.config?.googleMapsApiKey ?? ''
  );
  if (typeof fromManifestIOS === 'string' && fromManifestIOS.trim()) return fromManifestIOS.trim();

  const fromManifestAndroid = (
    (Constants as unknown as {
      manifest?: { android?: { config?: { googleMaps?: { apiKey?: string } } } };
    }).manifest?.android?.config?.googleMaps?.apiKey ?? ''
  );
  if (typeof fromManifestAndroid === 'string' && fromManifestAndroid.trim()) return fromManifestAndroid.trim();

  const fromGenericEnv = process.env.GOOGLE_MAPS_API_KEY;
  if (typeof fromGenericEnv === 'string' && fromGenericEnv.trim()) return fromGenericEnv.trim();

  return null;
}

export type DrivingRouteOptions = {
  /**
   * Adds `departure_time=now` + `traffic_model=best_guess` so Google returns a driving path
   * consistent with current traffic (same knobs as Maps driving preview).
   */
  useTraffic?: boolean;
  /** Prefer merged step polylines over overview only (richer road geometry). Default true when API is used. */
  useDetailedSteps?: boolean;
};

/**
 * Driving route coordinates (road-following when Maps key + Directions API available).
 * Falls back to a densified straight line in lat/lng (`geodesic: false` polyline compatible).
 */
export async function fetchDrivingRouteCoords(
  from: LatLng,
  to: LatLng,
  options?: DrivingRouteOptions
): Promise<LatLng[]> {
  const useTraffic = options?.useTraffic === true;
  const useDetailedSteps = options?.useDetailedSteps !== false;

  const key = resolveGoogleMapsApiKey();
  if (!key) return linearRouteBetween(from, to, 48);

  try {
    const originParam = `${from.latitude},${from.longitude}`;
    const destParam = `${to.latitude},${to.longitude}`;
    let url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}` +
      `&destination=${destParam}&mode=driving&key=${encodeURIComponent(key)}`;
    if (useTraffic) {
      url += '&departure_time=now&traffic_model=best_guess';
    }
    const response = await fetch(url);
    if (!response.ok) return linearRouteBetween(from, to, 48);
    const data = (await response.json()) as {
      status?: string;
      routes?: DirectionsApiRoute[];
    };
    if (data.status !== 'OK' || !data.routes?.[0]) {
      return linearRouteBetween(from, to, 48);
    }
    const route = data.routes[0];
    const coords = useDetailedSteps ? coordsFromDirectionsRoute(route) : [];
    if (coords.length > 1) return coords;
    const overview = route.overview_polyline?.points;
    if (overview) {
      const decoded = decodeGooglePolyline(overview);
      if (decoded.length > 1) return decoded;
    }
    return linearRouteBetween(from, to, 48);
  } catch {
    return linearRouteBetween(from, to, 48);
  }
}
