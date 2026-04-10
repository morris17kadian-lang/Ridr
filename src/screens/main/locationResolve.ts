import * as Location from 'expo-location';

export type LatLng = { latitude: number; longitude: number };

/** Approximate bounding box for Jamaica (main island). */
export const JAMAICA_SERVICE_BOUNDS = {
  minLat: 17.68,
  maxLat: 18.53,
  minLng: -78.42,
  maxLng: -76.15,
} as const;

/** Center point for Places autocomplete bias (Kingston metro). */
export const KSA_MAP_CENTER: LatLng = { latitude: 17.997, longitude: -76.794 };

export const OUTSIDE_SERVICE_AREA_MESSAGE =
  'That location is outside Jamaica.';

function isValidLatLng(lat: number, lng: number): boolean {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function isInJamaicaServiceArea(c: LatLng): boolean {
  return (
    c.latitude >= JAMAICA_SERVICE_BOUNDS.minLat &&
    c.latitude <= JAMAICA_SERVICE_BOUNDS.maxLat &&
    c.longitude >= JAMAICA_SERVICE_BOUNDS.minLng &&
    c.longitude <= JAMAICA_SERVICE_BOUNDS.maxLng
  );
}

function formatCoordLabel(c: LatLng): string {
  return `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
}

type GeocodeGeometry = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

function pickCoordinateInJamaica(results: GeocodeGeometry[] | undefined): LatLng | null {
  if (!Array.isArray(results)) return null;
  for (const r of results) {
    const loc = r.geometry?.location;
    if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') continue;
    const pt: LatLng = { latitude: loc.lat, longitude: loc.lng };
    if (isInJamaicaServiceArea(pt)) return pt;
  }
  return null;
}

function pickFormattedInJamaica(results: GeocodeGeometry[] | undefined): string | null {
  if (!Array.isArray(results)) return null;
  for (const r of results) {
    const loc = r.geometry?.location;
    if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') continue;
    const pt: LatLng = { latitude: loc.lat, longitude: loc.lng };
    if (isInJamaicaServiceArea(pt)) {
      const f = r.formatted_address?.trim();
      if (f) return f;
    }
  }
  return null;
}

/** Avoid surfacing native / network "decode" errors from bad JSON bodies. */
async function parseGeocodeJson(response: Response): Promise<{
  status?: string;
  error_message?: string;
  results?: GeocodeGeometry[];
} | null> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as {
      status?: string;
      error_message?: string;
      results?: GeocodeGeometry[];
    };
  } catch {
    return null;
  }
}

const BOUNDS_PARAM = `${JAMAICA_SERVICE_BOUNDS.minLat},${JAMAICA_SERVICE_BOUNDS.minLng}|${JAMAICA_SERVICE_BOUNDS.maxLat},${JAMAICA_SERVICE_BOUNDS.maxLng}`;

async function geocodeAddress(
  address: string,
  apiKey?: string
): Promise<{ coordinate: LatLng | null; issue?: string }> {
  const q = address.trim();
  if (!q) return { coordinate: null, issue: 'Empty address' };
  if (apiKey) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}` +
        `&bounds=${encodeURIComponent(BOUNDS_PARAM)}` +
        `&region=jm` +
        `&key=${apiKey}`;
      const response = await fetch(url);
      const data = await parseGeocodeJson(response);
      if (!data) {
        return { coordinate: null, issue: 'Geocode response could not be read.' };
      }
      const inArea = pickCoordinateInJamaica(data.results);
      if (inArea) return { coordinate: inArea };
      if (data.results?.length && data.status === 'OK') {
        return { coordinate: null, issue: OUTSIDE_SERVICE_AREA_MESSAGE };
      }
      if (data.status && data.status !== 'OK') {
        return {
          coordinate: null,
          issue: `Geocode ${data.status}${data.error_message ? `: ${data.error_message}` : ''}`,
        };
      }
    } catch {
      /* fall through to device geocoder */
    }
  }

  try {
    const local = await Location.geocodeAsync(q);
    for (const g of local) {
      const pt: LatLng = { latitude: g.latitude, longitude: g.longitude };
      if (isInJamaicaServiceArea(pt)) return { coordinate: pt };
    }
    if (local[0]) {
      return { coordinate: null, issue: OUTSIDE_SERVICE_AREA_MESSAGE };
    }
  } catch {
    /* noop */
  }
  return { coordinate: null, issue: `Could not geocode "${q}"` };
}

/**
 * Extracts a decimal lat/lng pair from free text (e.g. pasted URLs, notes, or "lat, lng" anywhere in the string).
 */
export function parseLatLngFromString(raw: string): LatLng | null {
  const s = raw.trim();
  if (!s) return null;

  const atMatch = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
  }

  const qMatch = s.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
  }

  const llMatch = s.match(/[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
  }

  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 2) {
    for (let i = 0; i < nums.length - 1; i += 1) {
      const lat = parseFloat(nums[i]);
      const lng = parseFloat(nums[i + 1]);
      if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

/** Resolves a place name, plus code, free text, or embedded lat/lng to coordinates (Jamaica). */
export async function resolveLocationQuery(
  query: string,
  apiKey?: string
): Promise<{ coordinate: LatLng | null; issue?: string }> {
  const parsed = parseLatLngFromString(query);
  if (parsed) {
    if (!isInJamaicaServiceArea(parsed)) {
      return { coordinate: null, issue: OUTSIDE_SERVICE_AREA_MESSAGE };
    }
    return { coordinate: parsed };
  }
  return geocodeAddress(query, apiKey);
}

/**
 * Reliable address line for map long-press: uses Google Geocoding reverse API when possible
 * (avoids Expo / platform reverse-geocode JSON decode issues on some devices).
 */
export async function reverseGeocodeMapPin(coordinate: LatLng, apiKey?: string | null): Promise<string> {
  if (!isInJamaicaServiceArea(coordinate)) {
    return formatCoordLabel(coordinate);
  }

  if (apiKey) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}` +
        `&key=${apiKey}&language=en`;
      const response = await fetch(url);
      const data = await parseGeocodeJson(response);
      if (data?.status === 'OK' && data.results?.length) {
        const formatted = pickFormattedInJamaica(data.results);
        if (formatted) return formatted;
        const r0 = data.results[0]?.formatted_address?.trim();
        if (r0) return r0;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const [geo] = await Location.reverseGeocodeAsync(coordinate);
    if (geo) {
      const label = [geo.name, geo.street, geo.city, geo.region]
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
      if (label.trim()) return label.trim();
    }
  } catch {
    /* fall through — avoid surfacing "decode" / platform errors */
  }

  return formatCoordLabel(coordinate);
}

/**
 * Exact coordinates for a Google Places autocomplete selection (avoids geocoding the description string, which can be offset).
 */
export async function fetchPlaceDetailsCoordinate(
  placeId: string,
  apiKey: string
): Promise<{ coordinate: LatLng | null; formattedAddress?: string }> {
  const id = placeId.trim();
  if (!id) return { coordinate: null };
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}` +
      `&fields=geometry%2Flocation%2Cformatted_address&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    const data = await parseGeocodeJson(response);
    const result = data as {
      status?: string;
      result?: {
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    } | null;
    if (!result || result.status !== 'OK' || !result.result?.geometry?.location) {
      return { coordinate: null };
    }
    const loc = result.result.geometry.location;
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return { coordinate: null };
    }
    const coordinate: LatLng = { latitude: loc.lat, longitude: loc.lng };
    if (!isInJamaicaServiceArea(coordinate)) {
      return { coordinate: null, formattedAddress: result.result.formatted_address };
    }
    return {
      coordinate,
      formattedAddress: result.result.formatted_address,
    };
  } catch {
    return { coordinate: null };
  }
}
