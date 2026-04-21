import { apiRequest } from './http';
import { getApiBaseUrl } from './config';
import type {
  ActivityItem,
  FavouritePlaceRow,
  FrequentRouteRow,
} from '../screens/main/data/mainTabData';

export type ApiActivityRideData = {
  id: string;
  serverRideRequestId?: string;
  from: string;
  to: string;
  date: string;
  price: string;
  driver: string;
  rating: number | null;
  status?: string;
};

export type ApiActivityItem = {
  id: string;
  type: ActivityItem['type'];
  title: string;
  subtitle: string;
  occurredAt: string;
  time: string;
  icon: string;
  emoji?: string | null;
  iconBg?: string | null;
  rideData?: ApiActivityRideData;
};

export type ActivityFeedResponse = {
  items: ApiActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ApiSavedPlaceFavourite = {
  id: string;
  label?: string;
  type?: string;
  name?: string | null;
  title?: string;
  subtitle?: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string | null;
  isFavourite?: boolean;
  sortOrder?: number;
  iconKey?: string | null;
};

export type FrequentRouteEndpoint = {
  label: string;
  address: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
};

export type ApiFrequentRoute = {
  id: string;
  from: FrequentRouteEndpoint;
  to: FrequentRouteEndpoint;
  rideCount: number;
  lastUsedAt: string | null;
};

export type FavouritesResponse = {
  savedPlaces: ApiSavedPlaceFavourite[];
  frequentRoutes: ApiFrequentRoute[];
};

export function canFetchAuthenticatedApi(): boolean {
  return Boolean(getApiBaseUrl()?.trim());
}

export async function getActivityFeed(params?: {
  limit?: number;
  cursor?: string;
  q?: string;
}): Promise<ActivityFeedResponse> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.q?.trim()) search.set('q', params.q.trim());
  const qs = search.toString();
  const path = `/users/me/activity${qs ? `?${qs}` : ''}`;
  return apiRequest<ActivityFeedResponse>(path, { method: 'GET', auth: true });
}

export async function getFavourites(params?: { routeLimit?: number }): Promise<FavouritesResponse> {
  const search = new URLSearchParams();
  if (params?.routeLimit != null) search.set('routeLimit', String(params.routeLimit));
  const qs = search.toString();
  const path = `/users/me/favourites${qs ? `?${qs}` : ''}`;
  return apiRequest<FavouritesResponse>(path, { method: 'GET', auth: true });
}

/** Maps `/users/me/activity` items into UI `ActivityItem` (adds `daysAgo` from `occurredAt`). */
export function apiActivityToActivityItem(raw: ApiActivityItem): ActivityItem {
  let daysAgo = 0;
  if (raw.occurredAt) {
    const d = new Date(raw.occurredAt);
    if (!Number.isNaN(d.getTime())) {
      daysAgo = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    }
  }

  const rideData = raw.rideData
    ? {
        id: raw.rideData.id,
        from: raw.rideData.from,
        to: raw.rideData.to,
        date: raw.rideData.date,
        price: raw.rideData.price,
        driver: raw.rideData.driver,
        rating: raw.rideData.rating ?? 0,
      }
    : undefined;

  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    subtitle: raw.subtitle,
    time: raw.time,
    daysAgo,
    occurredAt: raw.occurredAt,
    icon: raw.icon,
    emoji: raw.emoji ?? undefined,
    iconBg: raw.iconBg ?? undefined,
    rideData,
  };
}

function iconKeyToIonicon(key: string | null | undefined): string {
  const k = (key ?? '').toLowerCase();
  if (k === 'airplane' || k === 'airport') return 'airplane';
  if (k === 'storefront' || k === 'mall' || k === 'shop') return 'storefront';
  if (k === 'business' || k === 'school' || k === 'university') return 'business';
  if (k === 'home') return 'home';
  if (k === 'work' || k === 'briefcase') return 'briefcase';
  if (k === 'cafe' || k === 'restaurant') return 'cafe';
  return 'location';
}

export function mapApiSavedPlacesToFavouriteRows(places: ApiSavedPlaceFavourite[]): FavouritePlaceRow[] {
  return places.map((p) => {
    const label = (p.label ?? p.type ?? '').toLowerCase();
    let icon = iconKeyToIonicon(p.iconKey);
    if (label === 'home') icon = 'home';
    else if (label === 'work') icon = 'briefcase';
    return {
      id: p.id,
      title: (p.title ?? p.name ?? p.address ?? 'Saved place').trim(),
      subtitle: (p.subtitle ?? p.address ?? '').trim(),
      icon,
    };
  });
}

export function mapApiFrequentRoutesToRows(routes: ApiFrequentRoute[]): FrequentRouteRow[] {
  return routes.map((r) => ({
    id: r.id,
    from: r.from.label,
    to: r.to.label,
    count: r.rideCount,
  }));
}
