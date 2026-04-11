import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import type { ActiveTripState } from './activeTripTypes';

const ACCENT = '#FFD000';

function formatMinSec(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${mm}:${ss}`;
}

type Props = {
  trip: ActiveTripState;
  ui: MainScreenUi;
  onPress: () => void;
};

export function PresentRideTimerBar({ trip, ui, onPress }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const etaLabel = useMemo(() => {
    const totalEtaSec = Math.max(60, trip.etaMinutes * 60);
    const elapsedSec = (Date.now() - (trip.bookedAtMs || Date.now())) / 1000;
    const remainingSec = Math.max(0, totalEtaSec - elapsedSec);
    return `${formatMinSec(remainingSec)} Mins`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, trip.bookedAtMs, trip.etaMinutes]);

  return (
    <Pressable
      style={[styles.wrap, { borderColor: ui.divider }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open live trip details"
    >
      <Ionicons name="hourglass-outline" size={18} color="#ffffff" />
      <Text style={styles.label} numberOfLines={1}>
        The driver will arrive in
      </Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{etaLabel}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 16,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  pill: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
