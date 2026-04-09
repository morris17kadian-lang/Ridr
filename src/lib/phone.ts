import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

const RESERVED_E164_KEY = 'ridr_registered_e164_list';

/** Dial prefix as shown in UI (e.g. +1876, +44) without spaces. */
export function buildRawInternational(countryDial: string, nationalDigits: string): string {
  const cc = countryDial.replace(/\D/g, '');
  const nat = nationalDigits.replace(/\D/g, '');
  if (!cc || !nat) return '';
  return `+${cc}${nat}`;
}

/**
 * Validates and returns canonical E.164 using libphonenumber-js.
 * `defaultCountry` helps when the composed string is ambiguous (optional).
 */
export function validateToE164(
  countryDial: string,
  nationalDigits: string,
):
  | { ok: true; e164: string }
  | { ok: false; error: string } {
  const raw = buildRawInternational(countryDial, nationalDigits);
  if (!raw || raw.length < 10) {
    return { ok: false, error: 'Enter your phone number including area or mobile prefix.' };
  }

  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed || !isValidPhoneNumber(parsed.number)) {
    return { ok: false, error: 'Enter a valid phone number for the selected country.' };
  }

  return { ok: true, e164: parsed.number };
}

export function formatE164International(e164: string): string {
  const p = parsePhoneNumberFromString(e164);
  return p ? p.formatInternational() : e164;
}

/**
 * Ensures one canonical E.164 per device registry (demo/local).
 * Production: replace with server-side uniqueness (Auth + Firestore index).
 */
export async function reserveE164(
  e164: string,
  previousE164: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = await AsyncStorage.getItem(RESERVED_E164_KEY);
  let list: string[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    list = Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    list = [];
  }

  const withoutPrevious = previousE164 ? list.filter(x => x !== previousE164) : [...list];

  if (withoutPrevious.includes(e164)) {
    return {
      ok: false,
      error: 'This phone number is already registered to another account on this device.',
    };
  }

  withoutPrevious.push(e164);
  await AsyncStorage.setItem(RESERVED_E164_KEY, JSON.stringify(withoutPrevious));
  return { ok: true };
}

/** Remove an E.164 from the local registry (e.g. when clearing phone). */
export async function releaseE164(e164: string): Promise<void> {
  const raw = await AsyncStorage.getItem(RESERVED_E164_KEY);
  let list: string[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    list = Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    list = [];
  }
  await AsyncStorage.setItem(
    RESERVED_E164_KEY,
    JSON.stringify(list.filter(x => x !== e164)),
  );
}

/** Migrate legacy storage into national digits + optional E.164 when missing. */
export function migrateLegacyNational(savedPhone: string | undefined, countryDial: string): string {
  if (!savedPhone?.trim()) return '';
  const digits = savedPhone.replace(/\D/g, '');
  const cc = countryDial.replace(/\D/g, '');
  if (cc && digits.startsWith(cc)) {
    return digits.slice(cc.length);
  }
  return digits;
}
