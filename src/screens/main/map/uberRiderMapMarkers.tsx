import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Destination: white ETA bubble + tail + black ring with white center (Uber-style). */
export function UberDestinationEtaMarker({
  etaLine,
  caption = 'Arrival',
}: {
  /** e.g. "1 min" */
  etaLine: string;
  caption?: string;
}) {
  return (
    <View style={styles.destCluster} pointerEvents="none">
      <View style={styles.etaBubble}>
        <Text style={styles.etaCaption}>{caption}</Text>
        <Text style={styles.etaTime}>{etaLine}</Text>
      </View>
      <View style={styles.etaTail} />
      <View style={styles.destOuterDot}>
        <View style={styles.destInnerDot} />
      </View>
    </View>
  );
}

/** Pickup: subtle ring so focus stays on destination + driver. */
export function UberPickupMarker() {
  return (
    <View style={styles.pickupRing} pointerEvents="none">
      <View style={styles.pickupInner} />
    </View>
  );
}

type UberDriverCarMarkerProps = {
  /** Degrees; 0 = north/up in default icon orientation */
  rotationDeg?: number;
};

/** White vehicle chip + car icon (top-down style). */
export function UberDriverCarMarker({ rotationDeg = 0 }: UberDriverCarMarkerProps) {
  return (
    <View style={styles.driverRotateWrap} pointerEvents="none">
      <View style={[styles.driverChip, { transform: [{ rotate: `${rotationDeg}deg` }] }]}>
        <View style={styles.driverCarBody}>
          <Ionicons name="car-sport" size={22} color="#171717" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  destCluster: {
    alignItems: 'center',
  },
  etaBubble: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  etaCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 2,
  },
  etaTime: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  etaTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  destOuterDot: {
    marginTop: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  pickupRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#171717',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#171717',
  },
  driverRotateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCarBody: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
});
