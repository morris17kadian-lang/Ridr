import React, { memo } from 'react';
import { Polyline } from 'react-native-maps';

import type { LatLng } from '../locationResolve';

export type SolidBlackRoutePolylinesProps = {
  coordinates: LatLng[];
  geodesic?: boolean;
};

/**
 * Rider map route — thick solid black line (Uber-style), rounded caps/joins.
 */
function SolidBlackRoutePolylinesInner({ coordinates, geodesic = false }: SolidBlackRoutePolylinesProps) {
  if (coordinates.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor="#171717"
        strokeWidth={11}
        lineCap="round"
        lineJoin="round"
        geodesic={geodesic}
        zIndex={1}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor="#000000"
        strokeWidth={6}
        lineCap="round"
        lineJoin="round"
        geodesic={geodesic}
        zIndex={2}
      />
    </>
  );
}

export const SolidBlackRoutePolylines = memo(SolidBlackRoutePolylinesInner);
