import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GOOGLE_MAP_STYLE_DARK } from '../map/googleMapStyles';
import { SolidBlackRoutePolylines } from '../map/SolidBlackRoutePolylines';
import {
  UberDestinationEtaMarker,
  UberDriverCarMarker,
  UberPickupMarker,
} from '../map/uberRiderMapMarkers';
import type { MainScreenUi } from '../mainScreenUi';
import type { ActiveTripState } from './activeTripTypes';
import { routeBearingAtProgress } from './routeGeometry';
import { RideDetailsBottomSheet } from './RideDetailsBottomSheet';

/** Visible strip when the sheet is collapsed — enough to drag back up */
const SHEET_PEEK_PX = 56;
const MAP_PAD_EXPANDED = 280;
const MAP_PAD_COLLAPSED = 88;

type Props = {
  trip: ActiveTripState;
  ui: MainScreenUi;
  isDark: boolean;
  onEndTrip: () => void;
  onCancelRide?: (reason: import('./activeTripTypes').TripCancelReason, fee: number) => void;
};

function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = (b.latitude - a.latitude) * 111320;
  const avgLat = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLng = (b.longitude - a.longitude) * 111320 * Math.cos(avgLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

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

export function ActiveRideScreen({ trip, ui, isDark, onEndTrip, onCancelRide }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const maxTranslateRef = useRef(0);
  const dragStartY = useRef(0);
  const totalEtaSec = Math.max(60, trip.etaMinutes * 60);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [mapBottomPad, setMapBottomPad] = useState(MAP_PAD_EXPANDED);

  // ── Safety state ──
  const [showVehicleConfirm, setShowVehicleConfirm] = useState(
    trip.status === 'matched' || trip.status === 'driver_arriving'
  );
  const stationaryRef = useRef<{ step: number; frozenSince: number }>({ step: -1, frozenSince: Date.now() });
  const [stationaryAlerted, setStationaryAlerted] = useState(false);
  const deviationAlertedRef = useRef(false);

  const etaCountdownSec = Math.max(0, totalEtaSec - elapsedSec);

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

  const driverProgress01 =
    tripPath.length > 1 ? Math.min(1, driverStep / Math.max(1, tripPath.length - 1)) : 0;
  const driverBearingDeg = useMemo(
    () => routeBearingAtProgress(tripPath, driverProgress01),
    [tripPath, driverProgress01]
  );

  const fitMapToRoute = useCallback(
    (bottomPad: number) => {
      mapRef.current?.fitToCoordinates(
        [trip.pickup, trip.dropoff, liveDriverCoordinate],
        { edgePadding: { top: 100, right: 48, bottom: bottomPad, left: 48 }, animated: true }
      );
    },
    [trip.pickup, trip.dropoff, liveDriverCoordinate]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't capture taps; only capture when user drags.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          maxTranslateRef.current > 8 && Math.abs(g.dy) > Math.abs(g.dx) && Math.abs(g.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((v) => {
            dragStartY.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const maxT = maxTranslateRef.current;
          const next = Math.max(0, Math.min(maxT, dragStartY.current + g.dy));
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          sheetTranslateY.stopAnimation((val) => {
            const maxT = maxTranslateRef.current;
            if (maxT <= 0) return;
            const threshold = maxT * 0.28;
            let snapTo = val > threshold ? maxT : 0;
            if (g.vy > 1.1) snapTo = maxT;
            if (g.vy < -1.1) snapTo = 0;
            const bottomPad = snapTo > maxT * 0.5 ? MAP_PAD_COLLAPSED : MAP_PAD_EXPANDED;
            Animated.spring(sheetTranslateY, {
              toValue: snapTo,
              useNativeDriver: false,
              friction: 9,
              tension: 68,
            }).start(({ finished }) => {
              if (finished) {
                setMapBottomPad(bottomPad);
                fitMapToRoute(bottomPad);
              }
            });
          });
        },
      }),
    [fitMapToRoute, sheetTranslateY]
  );

  useEffect(() => {
    sheetTranslateY.setValue(0);
    maxTranslateRef.current = 0;
    setMapBottomPad(MAP_PAD_EXPANDED);
  }, [trip.id, sheetTranslateY]);

  useEffect(() => {
    setElapsedSec(0);
  }, [trip.id, trip.etaMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec((prev) => Math.min(totalEtaSec, prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [totalEtaSec, trip.id]);

  // Stationary alert — if driver hasn't advanced during in_trip for ≥5 min
  useEffect(() => {
    if (trip.status !== 'in_trip' || isStopWindow(elapsedSec)) {
      if (stationaryRef.current.step !== driverStep) {
        stationaryRef.current = { step: driverStep, frozenSince: Date.now() };
      }
      return;
    }
    if (driverStep !== stationaryRef.current.step) {
      stationaryRef.current = { step: driverStep, frozenSince: Date.now() };
      return;
    }
    if (!stationaryAlerted && Date.now() - stationaryRef.current.frozenSince >= 5 * 60 * 1000) {
      setStationaryAlerted(true);
      Alert.alert(
        'Driver Not Moving',
        'Your driver has been stationary for over 5 minutes. Would you like to contact them or get help?',
        [
          { text: 'Call driver', onPress: () => { if (trip.driverPhone) Linking.openURL(`tel:${trip.driverPhone}`); } },
          { text: 'Emergency (119)', style: 'destructive', onPress: () => Linking.openURL('tel:119') },
          { text: 'Dismiss', style: 'cancel' },
        ]
      );
    }
  }, [driverStep, elapsedSec, trip.status, trip.driverPhone, stationaryAlerted]);

  // Route deviation alert — if driver strays >300m from the expected route
  useEffect(() => {
    if (trip.status !== 'in_trip' || deviationAlertedRef.current || trip.routeCoords.length < 2) return;
    const minDist = trip.routeCoords.reduce((min, coord) => {
      const d = metersBetween(liveDriverCoordinate, coord);
      return d < min ? d : min;
    }, Infinity);
    if (minDist > 300) {
      deviationAlertedRef.current = true;
      Alert.alert(
        'Route Deviation Detected',
        'Your driver appears to have left the expected route. Stay alert and contact your driver if needed.',
        [
          { text: 'Call driver', onPress: () => { if (trip.driverPhone) Linking.openURL(`tel:${trip.driverPhone}`); } },
          { text: 'Emergency SOS', style: 'destructive', onPress: () => Linking.openURL('tel:119') },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  }, [liveDriverCoordinate, trip.status, trip.routeCoords, trip.driverPhone]);

  const remainingSec = Math.max(0, totalEtaSec - elapsedSec);
  const liveEtaMin = Math.max(0, Math.ceil(remainingSec / 60));

  const etaMarkerCoord = trip.status === 'in_trip' ? trip.dropoff : trip.pickup;
  const etaCaption = trip.status === 'in_trip' ? 'Arrival' : 'Pickup';
  const etaLineText =
    liveEtaMin <= 0 ? '< 1 min' : liveEtaMin === 1 ? '1 min' : `${liveEtaMin} min`;

  const mapCustomStyle = isDark ? GOOGLE_MAP_STYLE_DARK : [];

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

  const bannerTitle =
    trip.status === 'driver_arriving'
      ? 'Your driver is arriving now'
      : trip.status === 'arrived'
        ? 'Your driver has arrived'
        : trip.status === 'in_trip'
          ? 'Heading to your destination'
          : trip.status === 'completed'
            ? 'Trip completed'
            : trip.status === 'cancelled'
              ? 'Trip cancelled'
              : trip.status === 'matched'
                ? 'Driver matched'
                : 'Your ride';

  const bannerSubtitle =
    trip.status === 'driver_arriving'
      ? `Meet outside · ${trip.fromLabel || 'Pickup'}`
      : trip.status === 'in_trip'
        ? trip.toLabel || 'Destination'
        : trip.status === 'arrived'
          ? trip.fromLabel || 'Pickup'
          : trip.status === 'matched'
            ? trip.carDetails || 'Driver en route'
            : '';

  return (
    <View style={[styles.root, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={mapCustomStyle}
        onMapReady={() => {
          mapRef.current?.fitToCoordinates(
            [trip.pickup, trip.dropoff, liveDriverCoordinate],
            { edgePadding: { top: 120, right: 48, bottom: mapBottomPad, left: 48 }, animated: false }
          );
        }}
        showsUserLocation={false}
      >
        {trip.routeCoords.length > 1 ? (
          <SolidBlackRoutePolylines coordinates={trip.routeCoords} geodesic={false} />
        ) : null}

        <Marker coordinate={etaMarkerCoord} anchor={{ x: 0.5, y: 1 }}>
          <UberDestinationEtaMarker caption={etaCaption} etaLine={etaLineText} />
        </Marker>

        {trip.status === 'in_trip' ? (
          <Marker coordinate={trip.pickup} anchor={{ x: 0.5, y: 0.5 }}>
            <UberPickupMarker />
          </Marker>
        ) : null}

        <Marker coordinate={liveDriverCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
          <UberDriverCarMarker rotationDeg={driverBearingDeg - 90} />
        </Marker>
      </MapView>

      <View style={styles.headerOverlay}>
        <Pressable style={styles.backFab} onPress={onEndTrip} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </Pressable>
        <View style={styles.uberTopBanner}>
          <View style={styles.uberBannerIconWrap}>
            <Ionicons name="location" size={20} color="#ffffff" />
          </View>
          <View style={styles.uberBannerTextCol}>
            <Text style={styles.uberBannerTitle} numberOfLines={2}>
              {bannerTitle}
            </Text>
            {bannerSubtitle ? (
              <Text style={styles.uberBannerSubtitle} numberOfLines={2}>
                {bannerSubtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* SOS floating button */}
      {trip.status !== 'completed' && trip.status !== 'cancelled' ? (
        <Pressable
          style={securityStyles.sosFloat}
          onPress={() =>
            Alert.alert(
              'Emergency SOS',
              'This will call Jamaica Emergency Services (119). Continue?',
              [
                { text: 'Call 119', style: 'destructive', onPress: () => Linking.openURL('tel:119') },
                { text: 'Cancel', style: 'cancel' },
              ]
            )
          }
        >
          <Ionicons name="warning" size={18} color="#ffffff" />
          <Text style={securityStyles.sosBtnText}>SOS</Text>
        </Pressable>
      ) : null}

      {/* Vehicle confirmation modal */}
      <Modal
        visible={showVehicleConfirm}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowVehicleConfirm(false)}
      >
        <View style={securityStyles.overlay}>
          <View style={[securityStyles.vehicleModal, { backgroundColor: ui.cardBg }]}>
            <Ionicons name="shield-checkmark-outline" size={40} color="#22c55e" style={{ marginBottom: 10 }} />
            <Text style={[securityStyles.vehicleTitle, { color: ui.text }]}>Verify Your Driver</Text>
            <Text style={[securityStyles.vehicleSub, { color: ui.textMuted }]}>
              Before entering the vehicle, confirm these details match the car that has arrived:
            </Text>
            <View style={[securityStyles.vehicleDetail, { backgroundColor: isDark ? '#1b1c20' : '#f5f5f7' }]}>
              <Text style={[securityStyles.vehiclePlate, { color: ui.text }]}>{trip.plate}</Text>
              <Text style={[securityStyles.vehicleModel, { color: ui.textMuted }]}>{trip.carDetails}</Text>
            </View>
            <Pressable style={securityStyles.confirmBtn} onPress={() => setShowVehicleConfirm(false)}>
              <Text style={securityStyles.confirmBtnText}>✓ This is my driver</Text>
            </Pressable>
            <Pressable
              style={securityStyles.wrongBtn}
              onPress={() => {
                setShowVehicleConfirm(false);
                Alert.alert(
                  'Wrong Vehicle?',
                  'Do not enter the vehicle. Contact support or call emergency services.',
                  [
                    { text: 'Call Support', onPress: () => Linking.openURL('tel:18761234567') },
                    { text: 'Call 119', style: 'destructive', onPress: () => Linking.openURL('tel:119') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={securityStyles.wrongBtnText}>✗ Wrong vehicle or driver</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Animated.View
        style={[
          styles.rideSheet,
          {
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          maxTranslateRef.current = Math.max(0, h - SHEET_PEEK_PX);
        }}
      >
        <RideDetailsBottomSheet
          trip={trip}
          ui={ui}
          isDark={isDark}
          etaCountdownSec={etaCountdownSec}
          headerPanHandlers={panResponder.panHandlers}
          onToggleCollapse={onEndTrip}
          onCancelRide={onCancelRide}
        />
      </Animated.View>
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  backFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  uberTopBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  uberBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberBannerTextCol: {
    flex: 1,
    gap: 3,
  },
  uberBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  uberBannerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 17,
  },
  map: {
    flex: 1,
  },
  rideSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});

const securityStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  vehicleModal: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  vehicleTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  vehicleSub: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  vehicleDetail: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  vehiclePlate: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  vehicleModel: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  wrongBtn: {
    width: '100%',
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  wrongBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  sosFloat: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 108 : 70,
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 10,
  },
  sosBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
