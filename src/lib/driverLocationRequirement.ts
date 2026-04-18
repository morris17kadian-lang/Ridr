import * as Location from 'expo-location';

export type DriverLocationGate = { ok: true } | { ok: false; message: string };

/**
 * Driver mode requires device location services on and foreground ("When In Use") permission
 * so the app can show the driver's position to riders and the map.
 */
export async function ensureDriverLocationReady(): Promise<DriverLocationGate> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return {
      ok: false,
      message:
        'Location is turned off on this device. Turn on Location services in Settings, then try Driver mode again.',
    };
  }

  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.granted) {
    return { ok: true };
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  if (!requested.granted) {
    return {
      ok: false,
      message:
        'Ridr needs Location access for Driver mode so riders can see where you are. Allow Location (While Using the App) in Settings to continue.',
    };
  }

  return { ok: true };
}
