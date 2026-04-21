import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOCALHOST_HOST_RE = /^(https?:\/\/)(localhost|127\.0\.0\.1)/i;

/**
 * On phones and Android emulators, `localhost` points at the device/emulator — not your dev machine.
 * Rewrites `http://localhost:3000/...` to a reachable host:
 * 1. `EXPO_PUBLIC_DEV_LAN_HOST` if set (e.g. `192.168.1.42`)
 * 2. Host from `Constants.expoConfig.hostUri` (Expo dev / tunnel)
 * 3. Android fallback: `10.0.2.2` (host loopback from Android emulator)
 * Web and unchanged URLs are left as-is.
 */
export function rewriteLocalHostInApiBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || !LOCALHOST_HOST_RE.test(trimmed)) return trimmed;

  if (Platform.OS === 'web') return trimmed;

  const manual = typeof process.env.EXPO_PUBLIC_DEV_LAN_HOST === 'string' ? process.env.EXPO_PUBLIC_DEV_LAN_HOST.trim() : '';
  if (manual) {
    return trimmed.replace(LOCALHOST_HOST_RE, (_, proto: string) => `${proto}${manual}`);
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.trim()) {
    const host = hostUri.split(':')[0]?.trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return trimmed.replace(LOCALHOST_HOST_RE, (_, proto: string) => `${proto}${host}`);
    }
  }

  if (Platform.OS === 'android') {
    return trimmed.replace(LOCALHOST_HOST_RE, (_, proto: string) => `${proto}10.0.2.2`);
  }

  return trimmed;
}

function readRawBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, '');

  const fromExpoConfig = Constants.expoConfig?.extra?.baseUrl;
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) {
    return fromExpoConfig.trim().replace(/\/+$/, '');
  }

  const fromManifest = (Constants as unknown as { manifest?: { extra?: { baseUrl?: string } } }).manifest?.extra
    ?.baseUrl;
  if (typeof fromManifest === 'string' && fromManifest.trim()) {
    return fromManifest.trim().replace(/\/+$/, '');
  }

  const fromManifest2 = (
    Constants as unknown as { manifest2?: { extra?: { expoClient?: { extra?: { baseUrl?: string } } } } }
  ).manifest2?.extra?.expoClient?.extra?.baseUrl;
  if (typeof fromManifest2 === 'string' && fromManifest2.trim()) {
    return fromManifest2.trim().replace(/\/+$/, '');
  }

  return '';
}

export function getApiBaseUrl(): string {
  return rewriteLocalHostInApiBaseUrl(readRawBaseUrl());
}

/**
 * Default: `{API_BASE_URL}/health` (e.g. `http://192.168.1.5:3000/api/v1/health` when base is `.../api/v1`).
 * Override with `EXPO_PUBLIC_HEALTH_URL` for a different path (e.g. root `http://host:3000/health`).
 */
export function getApiHealthUrl(): string {
  const explicit = typeof process.env.EXPO_PUBLIC_HEALTH_URL === 'string' ? process.env.EXPO_PUBLIC_HEALTH_URL.trim() : '';
  if (explicit) return rewriteLocalHostInApiBaseUrl(explicit.replace(/\/+$/, ''));

  const base = getApiBaseUrl();
  if (!base) return '';

  return rewriteLocalHostInApiBaseUrl(`${base}/health`);
}

export function getDefaultRideTypeSlug(): string {
  const v = process.env.EXPO_PUBLIC_RIDE_TYPE_SLUG;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'xlcab-go';
}
