import { getApiBaseUrl } from './config';

/**
 * API contract (aligned with backend `driver-summary`):
 *
 * - `GET /users/me` — top-level **`driver`**: `null` | **`{ id, applicationStatus, applicationSubmittedAt, documentsCount, vehicle }`**
 *   (`applicationStatus`: `pending_review` | `approved` | `rejected`)
 *
 * - `GET /drivers/me` — **`{ driver: null }`** | **`{ driver: DriverSummary }`** (same inner shape as `/users/me`’s object)
 */

/** Coerce common API scalars for driver onboarding status. */
function coerceDriverApplicationScalar(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase();
  if (typeof v === 'number' && Number.isInteger(v)) {
    /** Backend-specific ints — extend when your API documents enum codes. */
    const byInt: Record<number, string> = {
      0: 'pending',
      1: 'pending_review',
      2: 'approved',
      3: 'accepted',
      4: 'active',
      5: 'verified',
      10: 'rejected',
    };
    return byInt[v] ?? null;
  }
  return null;
}

function syntheticApprovedIfBooleanFlags(o: Record<string, unknown>): string | null {
  if (
    o.isApproved === true ||
    o.applicationApproved === true ||
    o.driverApproved === true ||
    o.driverApplicationApproved === true ||
    o.isAccepted === true ||
    o.accepted === true ||
    o.applicationAccepted === true
  ) {
    return 'approved';
  }
  return null;
}

function pickStatusFromDriverLikeObject(o: Record<string, unknown>): string | null {
  const fromBool = syntheticApprovedIfBooleanFlags(o);
  if (fromBool) return fromBool;

  const keys = [
    'applicationStatus',
    'application_status',
    'driverApplicationStatus',
    /** Many REST handlers expose generic `status` on the driver row. */
    'status',
    'applicationState',
    'application_state',
    'verificationStatus',
    'verification_status',
    'reviewStatus',
    'review_status',
    'state',
    'driverStatus',
    'driver_status',
  ] as const;

  for (const k of keys) {
    const raw = o[k];
    const s = coerceDriverApplicationScalar(raw);
    if (s) return s;
  }

  return null;
}

function tryDriversDocApplicationStatus(o: Record<string, unknown>): string | null {
  return pickStatusFromDriverLikeObject(o);
}

function diveRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

/**
 * Reads **`applicationStatus`** from `DriverSummary` payloads and common envelopes (`driver`, `data.driver`, arrays).
 */
export function pickDriversCollectionApplicationStatus(raw: unknown): string | null {
  if (raw == null) return null;

  if (Array.isArray(raw) && raw.length > 0) {
    const first = diveRecord(raw[0]);
    if (first) {
      const arrS = tryDriversDocApplicationStatus(first);
      if (arrS) return arrS;
    }
  }

  if (typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;

  /** Some list endpoints return `{ items: [ driverDoc ] }`. */
  const items = root.items;
  if (Array.isArray(items) && items.length > 0) {
    const first = diveRecord(items[0]);
    if (first) {
      const itS = tryDriversDocApplicationStatus(first);
      if (itS) return itS;
    }
  }

  let s = tryDriversDocApplicationStatus(root);
  if (s) return s;

  /**
   * `GET /drivers/me` → `{ driver: null | DriverSummary }`.
   * `GET /users/me` → optional top-level **`driver`** (same object or null).
   */
  const driverEnvelope = diveRecord(
    root.driver ?? root.driverRecord ?? root.driver_document ?? root.driverDoc
  );
  if (driverEnvelope) {
    s = tryDriversDocApplicationStatus(driverEnvelope);
    if (s) return s;
  }

  const data = diveRecord(root.data);
  if (data) {
    s = tryDriversDocApplicationStatus(data);
    if (s) return s;
    const nestedDriver = diveRecord(data.driver);
    if (nestedDriver) {
      s = tryDriversDocApplicationStatus(nestedDriver);
      if (s) return s;
    }
    const nestedProfile = diveRecord(data.driverProfile ?? data.driver_profile);
    if (nestedProfile) {
      s = tryDriversDocApplicationStatus(nestedProfile);
      if (s) return s;
    }
    const dataDrivers = data.drivers;
    if (Array.isArray(dataDrivers) && dataDrivers.length > 0) {
      const first = diveRecord(dataDrivers[0]);
      if (first) {
        s = tryDriversDocApplicationStatus(first);
        if (s) return s;
      }
    }
  }

  const payload = diveRecord(root.payload ?? root.result ?? root.driverDocument);
  if (payload) {
    s = tryDriversDocApplicationStatus(payload);
    if (s) return s;
  }

  const driverProfile = diveRecord(root.driverProfile ?? root.driver_profile);
  if (driverProfile) {
    s = tryDriversDocApplicationStatus(driverProfile);
    if (s) return s;
  }

  const profile = diveRecord(root.profile);
  if (profile) {
    s = tryDriversDocApplicationStatus(profile);
    if (s) return s;
    const profileDriver = diveRecord(
      profile.driver ?? profile.driverRecord ?? profile.driver_profile ?? profile.driverProfile
    );
    if (profileDriver) {
      s = tryDriversDocApplicationStatus(profileDriver);
      if (s) return s;
    }
  }

  const user = diveRecord(root.user);
  if (user) {
    const userDriver = diveRecord(
      user.driver ?? user.driverRecord ?? user.driverProfile ?? user.driver_profile
    );
    if (userDriver) {
      s = tryDriversDocApplicationStatus(userDriver);
      if (s) return s;
    }
    s = tryDriversDocApplicationStatus(user);
    if (s) return s;
  }

  /** `{ drivers: [ {...} ] }` */
  const driversArr = root.drivers;
  if (Array.isArray(driversArr) && driversArr.length > 0) {
    const first = diveRecord(driversArr[0]);
    if (first) {
      s = tryDriversDocApplicationStatus(first);
      if (s) return s;
    }
  }

  return null;
}

export type DriverProfileFetchTokens = {
  accessToken: string;
  refreshToken?: string;
};

const DRIVER_PROFILE_GET_PATHS = [
  '/drivers/me',
  '/driver/me',
  '/drivers/profile',
  '/users/me/driver',
] as const;

const USERS_ME_FALLBACK_PATH = '/users/me';

/**
 * Loads driver gate state: **`GET /drivers/me`** first (`{ driver }` envelope), then alternates,
 * then **`GET /users/me`** if needed (top-level **`driver`**). Parses **`applicationStatus`**
 * (`pending_review` | `approved` | `rejected`). On 401, refreshes tokens once, then retries.
 */
export async function fetchDriversMeApplicationStatus(
  tokens: DriverProfileFetchTokens,
  persistRefreshedTokens?: (accessToken: string, refreshToken: string) => Promise<void>
): Promise<{
  applicationStatusLower: string | null;
  accessToken: string;
  refreshToken: string | undefined;
}> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('Missing EXPO_PUBLIC_BASE_URL');
  }

  let accessToken = tokens.accessToken;
  let refreshToken = tokens.refreshToken;

  async function fetchPath(path: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  /** If `probe` is 401 and refresh succeeds, tokens are advanced and callers should retry reads. */
  async function refreshIfUnauthorized(probe: Response): Promise<void> {
    if (probe.status !== 401) return;
    if (typeof refreshToken !== 'string' || !refreshToken.trim() || !persistRefreshedTokens) return;
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshText = await refreshRes.text();
    let refreshed: { accessToken?: string; refreshToken?: string } = {};
    if (refreshText) {
      try {
        refreshed = JSON.parse(refreshText) as typeof refreshed;
      } catch {
        /* ignore */
      }
    }
    if (
      refreshRes.ok &&
      typeof refreshed.accessToken === 'string' &&
      typeof refreshed.refreshToken === 'string'
    ) {
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      await persistRefreshedTokens(refreshed.accessToken, refreshed.refreshToken);
    }
  }

  /** Prime token refresh once using the canonical path before scanning alternates. */
  const probe = await fetchPath(DRIVER_PROFILE_GET_PATHS[0]);
  await refreshIfUnauthorized(probe);

  let applicationStatusLower: string | null = null;
  for (const path of DRIVER_PROFILE_GET_PATHS) {
    const res = await fetchPath(path);
    if (res.status === 404 || res.status === 204) continue;
    if (!res.ok) continue;
    const raw: unknown = await res.json().catch(() => null);
    const st = pickDriversCollectionApplicationStatus(raw);
    if (st != null) {
      applicationStatusLower = st;
      break;
    }
  }

  /** Many backends only embed the Mongo `drivers` row on `GET /users/me` (sibling `driver` / `driverRecord`). */
  if (applicationStatusLower === null) {
    const res = await fetchPath(USERS_ME_FALLBACK_PATH);
    if (res.ok) {
      const raw: unknown = await res.json().catch(() => null);
      applicationStatusLower = pickDriversCollectionApplicationStatus(raw);
    }
  }

  return { applicationStatusLower, accessToken, refreshToken };
}
