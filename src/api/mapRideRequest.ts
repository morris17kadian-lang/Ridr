import type { LatLng } from '../screens/main/locationResolve';
import type { ActiveTripState, TripStatus } from '../screens/main/ride/activeTripTypes';
import type { RideRequestDto } from './rides';

export function geoPointToLatLng(p: RideRequestDto['pickup']): LatLng {
  const [lng, lat] = p.coordinates;
  return { latitude: lat, longitude: lng };
}

export function mapApiRideStatusToLocal(api: string): TripStatus {
  switch (api) {
    case 'searching':
      return 'driver_arriving';
    case 'scheduled':
      return 'searching';
    case 'matched':
      return 'matched';
    case 'arrived':
      return 'arrived';
    case 'in_trip':
    case 'in_progress':
      return 'in_trip';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'driver_arriving';
  }
}

export function formatFareFromRideDto(dto: RideRequestDto): { fareLabel: string; fareUsd: number } {
  const fare = dto.pricing?.estimatedFare ?? 0;
  const currency = dto.pricing?.currency ?? 'JMD';
  if (currency === 'JMD') {
    return {
      fareLabel: `J$${fare.toLocaleString('en-JM', { maximumFractionDigits: 0 })}`,
      fareUsd: Math.max(0.01, fare / 150),
    };
  }
  return {
    fareLabel: `$${fare.toFixed(2)}`,
    fareUsd: fare,
  };
}

export function mergePollRideRequest(prev: ActiveTripState, dto: RideRequestDto): ActiveTripState {
  const status = mapApiRideStatusToLocal(dto.status);
  const { fareLabel, fareUsd } = formatFareFromRideDto(dto);
  return {
    ...prev,
    status,
    fareLabel,
    fareUsd,
    fareCurrency: dto.pricing?.currency,
    fromLabel: dto.pickup.address ?? prev.fromLabel,
    toLabel: dto.dropoff.address ?? prev.toLabel,
  };
}

export function buildActiveTripFromCreateResponse(
  dto: RideRequestDto,
  opts: {
    bookedFor: 'self' | 'friend';
    routeCoords: LatLng[];
    driverCoordinate: LatLng;
    etaMinutes: number;
    bookedAtMs: number;
    ttlMs: number;
    paymentLabel: string;
  }
): ActiveTripState {
  const pickup = geoPointToLatLng(dto.pickup);
  const dropoff = geoPointToLatLng(dto.dropoff);
  const { fareLabel, fareUsd } = formatFareFromRideDto(dto);
  const pin = String(Math.floor(1000 + Math.random() * 9000));

  return {
    id: dto.id,
    serverRideRequestId: dto.id,
    bookedAtMs: opts.bookedAtMs,
    expiresAtMs: opts.bookedAtMs + opts.ttlMs,
    bookedFor: opts.bookedFor,
    status: mapApiRideStatusToLocal(dto.status),
    pickup,
    dropoff,
    routeCoords: opts.routeCoords.length > 1 ? opts.routeCoords : [pickup, dropoff],
    fromLabel: dto.pickup.address ?? '',
    toLabel: dto.dropoff.address ?? '',
    fareUsd,
    fareLabel,
    fareCurrency: dto.pricing?.currency,
    etaMinutes: opts.etaMinutes,
    driverPin: pin,
    plate: `P ${Math.floor(1000 + Math.random() * 9000)}`,
    carDetails: 'Toyota Corolla · Silver',
    driverName: 'Marcus W.',
    driverCoordinate: opts.driverCoordinate,
    paymentLabel: opts.paymentLabel,
  };
}
