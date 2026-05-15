import AsyncStorage from '@react-native-async-storage/async-storage';

/** Cached `/users/me` JSON — safe to clear to force refetch */
export const PROFILE_ME_CACHE_KEY = 'profile_me_cache_v1';
/** Cached `GET /drivers/me` applicationStatus keyed by user — cleared on identity switch */
export const DRIVER_PROFILE_CACHE_KEY = 'ridr_drivers_me_cache_v1';
export const ACTIVE_TRIP_STORAGE_KEY = 'active_trip_v1';
export const BOOKED_RIDES_STORAGE_KEY = 'booked_rides_v1';

/** Local profile fields keyed per device — cleared on sign-out / account switch to avoid showing another user's data */
export const PROFILE_IDENTITY_KEYS = [
  PROFILE_ME_CACHE_KEY,
  DRIVER_PROFILE_CACHE_KEY,
  'profile_first_name',
  'profile_last_name',
  'profile_email',
  'profile_phone',
  'profile_phone_e164',
  'profile_username',
] as const;

export async function clearProfileIdentityFromStorage(): Promise<void> {
  await AsyncStorage.multiRemove([...PROFILE_IDENTITY_KEYS]);
}

const CACHE_KEYS = [
  PROFILE_ME_CACHE_KEY,
  ACTIVE_TRIP_STORAGE_KEY,
  BOOKED_RIDES_STORAGE_KEY,
  'profile_cards',
  'profile_default_card',
] as const;

/** Clears local caches (trips, activity, profile snapshot, payment method copy). Does not sign out or remove profile form fields. */
export async function clearAppCache(): Promise<void> {
  await AsyncStorage.multiRemove([...CACHE_KEYS]);
}
