import type { LatLng } from '../locationResolve';

export type TripStatus =
  | 'searching'
  | 'matched'
  | 'driver_arriving'
  | 'arrived'
  | 'in_trip'
  | 'completed'
  | 'cancelled';

export type TripCancelReason =
  | 'change_of_plans'
  | 'driver_too_far'
  | 'wrong_pickup'
  | 'booked_by_mistake'
  | 'other';

export type ActiveTripState = {
  id: string;
  bookedAtMs: number;
  expiresAtMs: number;
  bookedFor: 'self' | 'friend';
  status: TripStatus;
  pickup: LatLng;
  dropoff: LatLng;
  routeCoords: LatLng[];
  fromLabel: string;
  toLabel: string;
  /** Display string from backend (e.g. J$1,520) or local mock */
  fareLabel?: string;
  fareCurrency?: string;
  /** Server `ride_requests` id when created via API */
  serverRideRequestId?: string;
  fareUsd: number;
  etaMinutes: number;
  driverPin: string;
  plate: string;
  carDetails: string;
  /** Vehicle seating (4 or 6) — shown on driver match UI. */
  seatingCapacity?: 4 | 6;
  driverName: string;
  driverCoordinate: LatLng;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  cancelReason?: TripCancelReason;
  distanceKm?: number;
  durationMin?: number;
  baseFare?: number;
  fees?: number;
  totalFare?: number;
  paymentLabel?: string;
  rating?: number;
  tipAmount?: number;
};

export type TripRecord = ActiveTripState;
