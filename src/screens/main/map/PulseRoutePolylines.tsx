import React, { memo, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Polyline } from 'react-native-maps';

import type { LatLng } from '../locationResolve';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

export type PulseRoutePolylinesProps = {
  coordinates: LatLng[];
  baseOuter: string;
  baseInner: string;
  pulseTint: string;
  geodesic?: boolean;
};

/**
 * Soft base route + layered dashed “energy” strokes with animated opacity (all platforms)
 * and dash phase on iOS Apple Maps when applicable.
 */
function PulseRoutePolylinesInner({
  coordinates,
  baseOuter,
  baseInner,
  pulseTint,
  geodesic = false,
}: PulseRoutePolylinesProps) {
  const [pulse01, setPulse01] = useState(0);
  const [dashPhase, setDashPhase] = useState(0);

  useEffect(() => {
    if (coordinates.length < 2) return;

    let raf = 0;
    const t0 = Date.now();

    const tick = () => {
      const t = (Date.now() - t0) / 1000;
      setPulse01(0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.15));
      setDashPhase((prev) => (prev + 1) % 48);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [coordinates]);

  const glowStroke = useMemo(() => rgba(pulseTint, 0.22 + pulse01 * 0.38), [pulseTint, pulse01]);
  const pulseStroke = useMemo(() => rgba(pulseTint, 0.48 + pulse01 * 0.45), [pulseTint, pulse01]);

  const appleDashPhase = Platform.OS === 'ios' ? dashPhase : undefined;

  if (coordinates.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={baseOuter}
        strokeWidth={11}
        lineCap="round"
        lineJoin="round"
        geodesic={geodesic}
        zIndex={1}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={baseInner}
        strokeWidth={7}
        lineCap="round"
        lineJoin="round"
        geodesic={geodesic}
        zIndex={2}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={glowStroke}
        strokeWidth={8}
        lineCap="round"
        lineJoin="round"
        geodesic={geodesic}
        lineDashPattern={[18, 22]}
        lineDashPhase={appleDashPhase}
        zIndex={3}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={pulseStroke}
        strokeWidth={4}
        lineCap="round"
        lineJoin="round"
        geodesic={geodesic}
        lineDashPattern={[12, 16]}
        lineDashPhase={appleDashPhase}
        zIndex={4}
      />
    </>
  );
}

export const PulseRoutePolylines = memo(PulseRoutePolylinesInner);
