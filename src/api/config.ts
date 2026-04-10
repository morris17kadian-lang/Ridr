import Constants from 'expo-constants';

export function getApiBaseUrl(): string {
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

export function getDefaultRideTypeSlug(): string {
  const v = process.env.EXPO_PUBLIC_RIDE_TYPE_SLUG;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return 'xlcab-go';
}
