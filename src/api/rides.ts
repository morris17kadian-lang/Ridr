import { getApiBaseUrl, getDefaultRideTypeSlug } from './config';
import { apiRequest } from './http';

export type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
  address?: string;
  placeId?: string;
};

export type RideRequestDto = {
  id: string;
  riderId?: string;
  sessionId?: string;
  status: string;
  searchPhase?: string | null;
  serviceArea?: string;
  bookedFor?: string;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  route?: {
    encodedPolyline?: string;
    distanceMeters?: number;
    durationSeconds?: number;
  };
  pricing?: {
    currency?: string;
    estimatedFare?: number;
    surgeMultiplier?: number;
    breakdown?: Record<string, number>;
  };
  payment?: { method?: string; paymentMethodId?: string; label?: string };
  driverSearch?: unknown;
  driver?: unknown;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

/** Matches backend fare estimate — includes Kingston zone labels (urban, airport, etc.) */
export type FareEstimateResponse = {
  currency?: string;
  estimatedFare?: number;
  total?: number;
  subtotal?: number;
  discountAmount?: number;
  baseTariff?: number;
  pickupZone?: string;
  dropoffZone?: string;
  zonePremium?: number;
  zoneSummary?: string;
  /** e.g. `{ pickup: "urban", dropoff: "airport", pickupLabel: "...", dropoffLabel: "..." }` */
  zones?: {
    pickup?: string;
    dropoff?: string;
    pickupLabel?: string;
    dropoffLabel?: string;
  };
  pricing?: RideRequestDto['pricing'];
  rideType?: { slug?: string; name?: string };
};

/**
 * Body for `POST /rides/estimate` — Postman folder **Ride requests → Fare estimate**
 * (Kingston zone pricing: server resolves `pickup`/`dropoff` into urban / airport / etc.).
 */
export type KingstonZoneFareEstimateRequest = {
  rideTypeSlug: string;
  distanceKm: number;
  durationMinutes: number;
  insurance: boolean;
  pickup: { address: string; lat: number; lng: number; placeId?: string };
  dropoff: { address: string; lat: number; lng: number; placeId?: string };
};

export function buildKingstonZoneFareEstimateBody(params: {
  pickup: { address: string; lat: number; lng: number; placeId?: string };
  dropoff: { address: string; lat: number; lng: number; placeId?: string };
  distanceKm: number;
  durationMinutes: number;
  insurance?: boolean;
  rideTypeSlug?: string;
}): KingstonZoneFareEstimateRequest {
  return {
    rideTypeSlug: params.rideTypeSlug ?? getDefaultRideTypeSlug(),
    distanceKm: params.distanceKm,
    durationMinutes: params.durationMinutes,
    insurance: params.insurance ?? false,
    pickup: params.pickup,
    dropoff: params.dropoff,
  };
}

export type CreateImmediateRideInput = {
  rideTypeSlug?: string;
  serviceCategory?: string;
  sessionId?: string;
  serviceArea?: string;
  bookedFor: 'self' | 'friend';
  pickup: { address: string; lat: number; lng: number; placeId?: string };
  dropoff: { address: string; lat: number; lng: number; placeId?: string };
  route?: {
    encodedPolyline: string;
    distanceMeters: number;
    durationSeconds: number;
  };
  distanceKm: number;
  durationMinutes: number;
  immediate: boolean;
  preferences?: { womanDriver?: boolean; wheelchair?: boolean; babySeat?: boolean };
  addons?: { rideInsurance?: boolean };
  payment: { method: 'card' | 'cash'; paymentMethodId?: string; label: string };
  metadata?: { platform?: string; appVersion?: string };
};

export async function postFareEstimate(body: KingstonZoneFareEstimateRequest): Promise<FareEstimateResponse> {
  if (__DEV__) {
    const url = `${getApiBaseUrl()}/rides/estimate`;
    console.log(
      '[Kingston zone pricing] Postman: Ride requests → Fare estimate\n',
      `→ POST ${url}\n`,
      '[Kingston zone pricing] exact request JSON (wire body):\n',
      JSON.stringify(body, null, 2)
    );
  }
  const res = await apiRequest<FareEstimateResponse>('/rides/estimate', {
    method: 'POST',
    json: body,
    auth: true,
  });
  if (__DEV__) {
    console.log(
      '[Kingston zone pricing] response (zones + fare):\n',
      body,
    );
  }
  return res;
}

/** Exact JSON body sent to `POST /rides` (use for logging or tests). */
export function getCreateRideRequestBody(input: CreateImmediateRideInput): Record<string, unknown> {
  const slug = input.rideTypeSlug ?? getDefaultRideTypeSlug();
  const body: Record<string, unknown> = {
    rideTypeSlug: slug,
    serviceCategory: input.serviceCategory ?? 'ride',
    serviceArea: input.serviceArea ?? 'JM',
    bookedFor: input.bookedFor,
    pickup: input.pickup,
    dropoff: input.dropoff,
    distanceKm: input.distanceKm,
    durationMinutes: input.durationMinutes,
    immediate: input.immediate,
    payment: input.payment,
  };
  if (input.sessionId) body.sessionId = input.sessionId;
  if (input.route) body.route = input.route;
  if (input.preferences) body.preferences = input.preferences;
  if (input.addons) body.addons = input.addons;
  if (input.metadata) body.metadata = input.metadata;
  return body;
}

/** Same as wire payload but shortens `route.encodedPolyline` for readable Metro logs. */
export function getCreateRideRequestBodyForLog(input: CreateImmediateRideInput): Record<string, unknown> {
  const body = getCreateRideRequestBody(input);
  const route = body.route;
  if (route && typeof route === 'object' && route !== null && 'encodedPolyline' in route) {
    const r = route as { encodedPolyline?: string; distanceMeters?: number; durationSeconds?: number };
    const poly = r.encodedPolyline;
    if (typeof poly === 'string' && poly.length > 100) {
      return {
        ...body,
        route: {
          ...r,
          encodedPolyline: `${poly.slice(0, 72)}… (truncated, ${poly.length} chars total)`,
        },
      };
    }
  }
  return body;
}

export async function createImmediateRide(
  input: CreateImmediateRideInput
): Promise<{ rideRequest: RideRequestDto }> {
  const json = getCreateRideRequestBody(input);
  if (__DEV__) {
    const url = `${getApiBaseUrl()}/rides`;
    console.log(
      '[Kingston zone pricing] Postman: Ride requests → Create ride (immediate)\n',
      `→ POST ${url}\n`,
      '[Kingston zone pricing] exact request JSON (wire body, includes full polyline):\n',
      JSON.stringify(json, null, 2)
    );
  }
  return apiRequest<{ rideRequest: RideRequestDto }>('/rides', {
    method: 'POST',
    json,
    auth: true,
  });
}

export async function getRideRequestById(id: string): Promise<{ rideRequest: RideRequestDto }> {
  return apiRequest<{ rideRequest: RideRequestDto }>(`/rides/${encodeURIComponent(id)}`, {
    method: 'GET',
    auth: true,
  });
}

export async function listMyRideRequests(): Promise<{ rideRequests: RideRequestDto[] }> {
  return apiRequest<{ rideRequests: RideRequestDto[] }>('/rides', {
    method: 'GET',
    auth: true,
  });
}

export async function cancelRideRequest(id: string): Promise<{ rideRequest: RideRequestDto }> {
  return apiRequest<{ rideRequest: RideRequestDto }>(`/rides/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    auth: true,
  });
}

export async function rateRideRequest(
  id: string,
  body: { rating: number; review?: string }
): Promise<{ rideRequest: RideRequestDto }> {
  return apiRequest<{ rideRequest: RideRequestDto }>(`/rides/${encodeURIComponent(id)}/rate`, {
    method: 'POST',
    json: body,
    auth: true,
  });
}
