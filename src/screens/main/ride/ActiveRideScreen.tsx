import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MainScreenUi } from '../mainScreenUi';
import type { ActiveTripState } from './activeTripTypes';
import { RideDetailsBottomSheet } from './RideDetailsBottomSheet';

type Props = {
  trip: ActiveTripState;
  ui: MainScreenUi;
  isDark: boolean;
  onEndTrip: () => void;
};

function nearestRouteIndex(
  route: ActiveTripState['routeCoords'],
  point: ActiveTripState['driverCoordinate']
): number {
  if (route.length === 0) return 0;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length; i += 1) {
    const r = route[i];
    const dLat = r.latitude - point.latitude;
    const dLng = r.longitude - point.longitude;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function ActiveRideScreen({ trip, ui, isDark, onEndTrip }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const totalEtaSec = Math.max(60, trip.etaMinutes * 60);
  const [elapsedSec, setElapsedSec] = useState(0);

  const tripPath = useMemo(() => {
    if (trip.routeCoords.length < 2) return [trip.pickup, trip.dropoff];
    const pickupIdx = nearestRouteIndex(trip.routeCoords, trip.pickup);
    const dropoffIdx = nearestRouteIndex(trip.routeCoords, trip.dropoff);
    const from = Math.min(pickupIdx, dropoffIdx);
    const to = Math.max(pickupIdx, dropoffIdx);
    const segment = trip.routeCoords.slice(from, to + 1);
    if (segment.length < 2) return [trip.pickup, trip.dropoff];
    const targetPoints = Math.min(Math.max(30, totalEtaSec), 420);
    const step = Math.max(1, Math.floor((segment.length - 1) / targetPoints));
    const points = [segment[0]];
    for (let i = step; i < segment.length - 1; i += step) points.push(segment[i]);
    points.push(segment[segment.length - 1]);
    return points;
  }, [totalEtaSec, trip.dropoff, trip.pickup, trip.routeCoords]);

  const hold1Sec = Math.max(5, Math.min(16, Math.floor(totalEtaSec * 0.08)));
  const hold2Sec = Math.max(4, Math.min(14, Math.floor(totalEtaSec * 0.06)));
  const hold1StartSec = Math.max(2, Math.floor(totalEtaSec * 0.35));
  const hold2StartSec = Math.max(hold1StartSec + hold1Sec + 4, Math.floor(totalEtaSec * 0.72));
  const isStopWindow = (sec: number) =>
    (sec >= hold1StartSec && sec < hold1StartSec + hold1Sec) ||
    (sec >= hold2StartSec && sec < hold2StartSec + hold2Sec);

  const movingBudgetSec = Math.max(1, totalEtaSec - hold1Sec - hold2Sec);
  const movingElapsedSec = useMemo(() => {
    let moved = 0;
    for (let s = 0; s < elapsedSec; s += 1) {
      if (!isStopWindow(s)) moved += 1;
    }
    return moved;
  }, [elapsedSec, hold1Sec, hold1StartSec, hold2Sec, hold2StartSec, totalEtaSec]);

  const progress = Math.max(0, Math.min(1, movingElapsedSec / movingBudgetSec));
  const maxStep = Math.max(0, tripPath.length - 1);
  const driverStep = Math.min(maxStep, Math.floor(progress * maxStep));
  const liveDriverCoordinate = tripPath[Math.min(driverStep, tripPath.length - 1)] ?? trip.pickup;

  useEffect(() => {
    setElapsedSec(0);
  }, [trip.id, trip.etaMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec((prev) => Math.min(totalEtaSec, prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [totalEtaSec, trip.id]);

  const remainingSec = Math.max(0, totalEtaSec - elapsedSec);
  const liveEtaMin = Math.max(0, Math.ceil(remainingSec / 60));
  const driverStatus =
    trip.status === 'arrived'
      ? 'Driver has arrived at pickup'
      : trip.status === 'driver_arriving'
        ? 'Driver is heading to pickup'
        : driverStep >= tripPath.length - 1
      ? 'You have arrived'
      : isStopWindow(elapsedSec)
        ? 'Trip paused briefly'
        : 'Trip in progress';
  const headerTitle =
    trip.status === 'driver_arriving'
      ? 'Driver arriving'
      : trip.status === 'arrived'
        ? 'Driver at pickup'
        : trip.status === 'in_trip'
          ? 'Ride in progress'
          : trip.status === 'completed'
            ? 'Trip completed'
            : trip.status === 'cancelled'
              ? 'Trip cancelled'
              : 'Ride';
  const initialRegion = useMemo(() => {
    const { pickup, dropoff } = trip;
    const minLat = Math.min(pickup.latitude, dropoff.latitude, liveDriverCoordinate.latitude);
    const maxLat = Math.max(pickup.latitude, dropoff.latitude, liveDriverCoordinate.latitude);
    const minLng = Math.min(pickup.longitude, dropoff.longitude, liveDriverCoordinate.longitude);
    const maxLng = Math.max(pickup.longitude, dropoff.longitude, liveDriverCoordinate.longitude);
    const latPad = Math.max(0.01, (maxLat - minLat) * 0.35);
    const lngPad = Math.max(0.01, (maxLng - minLng) * 0.35);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + latPad * 2 || 0.04,
      longitudeDelta: maxLng - minLng + lngPad * 2 || 0.04,
    };
  }, [trip, liveDriverCoordinate]);

  return (
    <View style={[styles.root, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={() => {
          mapRef.current?.fitToCoordinates(
            [trip.pickup, trip.dropoff, liveDriverCoordinate],
            { edgePadding: { top: 100, right: 48, bottom: 280, left: 48 }, animated: false }
          );
        }}
        showsUserLocation={false}
      >
        {trip.routeCoords.length > 1 ? (
          <>
            <Polyline
              coordinates={trip.routeCoords}
              strokeColor="rgba(255,255,255,0.95)"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={trip.routeCoords}
              strokeColor="#171717"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          </>
        ) : null}
        <Marker coordinate={trip.pickup} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
        </Marker>
        <Marker coordinate={trip.dropoff} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
        </Marker>
        <Marker coordinate={liveDriverCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverPin}>
            <Ionicons name="car-sport" size={22} color="#ffffff" />
          </View>
        </Marker>
      </MapView>

      <View style={[styles.headerOverlay, { backgroundColor: isDark ? 'rgba(20,20,24,0.88)' : 'rgba(255,255,255,0.92)', borderBottomColor: ui.divider }]}>
        <Pressable style={styles.backBtn} onPress={onEndTrip} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: ui.text }]}>{headerTitle}</Text>
          <Text style={[styles.headerSub, { color: ui.textMuted }]} numberOfLines={1}>{driverStatus}</Text>
        </View>
        <View style={[styles.etaChip, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
          <Text style={[styles.etaChipText, { color: ui.text }]}>
            ETA {liveEtaMin} min
          </Text>
        </View>
      </View>

      <RideDetailsBottomSheet
        trip={trip}
        ui={ui}
        liveEtaMin={liveEtaMin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: Platform.OS === 'ios' ? 50 : 14,
    paddingBottom: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaChip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  etaChipText: {
    fontWeight: '700',
    fontSize: 12,
  },
  map: {
    flex: 1,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  driverPin: {
    backgroundColor: '#171717',
    padding: 8,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
