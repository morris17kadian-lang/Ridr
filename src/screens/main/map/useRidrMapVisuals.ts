import { useMemo } from 'react';

import { styles } from '../styles/mainScreenStyles';

export type RidrMapMarkerThemeColors = {
  accent: string;
  background: string;
  card: string;
  text: string;
};

/** Pickup / dropoff / nearby-driver / route animator marker views — same as MainScreen. */
export function useRidrMapMarkerStyles(isDark: boolean, colors: RidrMapMarkerThemeColors) {
  return useMemo(
    () => ({
      pickup: [
        styles.mapMarkerPickup,
        {
          backgroundColor: isDark ? colors.accent : '#171717',
          borderColor: isDark ? colors.background : colors.accent,
        },
      ],
      dropoff: [
        styles.mapMarkerDropoff,
        {
          backgroundColor: isDark ? colors.background : colors.accent,
          borderColor: isDark ? colors.accent : colors.text,
        },
      ],
      nearbyDriver: [
        styles.mapMarkerNearbyDriver,
        {
          backgroundColor: isDark ? colors.card : '#171717',
          borderColor: colors.accent,
        },
      ],
      routeAnimatorOuter: [
        styles.routeAnimatorOuter,
        {
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? colors.accent : '#171717',
        },
      ],
      routeAnimatorInner: [
        styles.routeAnimatorInner,
        { backgroundColor: isDark ? colors.accent : '#171717' },
      ],
    }),
    [isDark, colors.accent, colors.background, colors.card, colors.text]
  );
}

/** Base route stroke (outer halo + inner core) — softer outer for pulse-route overlays. */
export function useRidrMapRouteStroke(isDark: boolean, accent: string, text: string) {
  return useMemo(
    () => ({
      outer: isDark ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.78)',
      inner: isDark ? accent : text,
    }),
    [isDark, accent, text]
  );
}
