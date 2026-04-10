import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MainScreenUi } from '../mainScreenUi';
import type { ActiveTripState } from './activeTripTypes';

type Props = {
  trip: ActiveTripState;
  ui: MainScreenUi;
  liveEtaMin: number;
};

export function RideDetailsBottomSheet({
  trip,
  ui,
  liveEtaMin,
}: Props) {
  const statusLabel =
    trip.status === 'driver_arriving'
      ? 'Driver arriving'
      : trip.status === 'arrived'
        ? 'At pickup'
        : trip.status === 'in_trip'
          ? 'On trip'
          : trip.status === 'completed'
            ? 'Completed'
            : trip.status === 'cancelled'
              ? 'Cancelled'
              : 'Matched';
  const roleLabel = trip.bookedFor === 'friend' ? 'Booked for friend' : 'Booked for you';
  const cancelReasonText =
    trip.cancelReason === 'change_of_plans'
      ? 'Change of plans'
      : trip.cancelReason === 'driver_too_far'
        ? 'Driver too far'
        : trip.cancelReason === 'wrong_pickup'
          ? 'Wrong pickup'
          : trip.cancelReason === 'booked_by_mistake'
            ? 'Booked by mistake'
            : trip.cancelReason === 'other'
              ? 'Driver unavailable'
              : 'Not provided';
  return (
    <View style={[styles.card, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
      <View style={styles.sheetHeaderRow}>
        <View>
          <Text style={[styles.sheetEyebrow, { color: ui.textMuted }]}>Ride details</Text>
          <Text style={[styles.driverName, { color: ui.text }]}>{trip.driverName}</Text>
          <Text style={[styles.roleText, { color: ui.textMuted }]}>{roleLabel}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
          <Text style={[styles.statusChipText, { color: ui.text }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={[styles.carLine, { color: ui.textMuted }]}>{trip.carDetails}</Text>

      <View style={styles.metaRow}>
        <View style={[styles.metaPill, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
          <Text style={[styles.metaPillLabel, { color: ui.textMuted }]}>Fare</Text>
          <Text style={[styles.metaPillValue, { color: ui.text }]}>${trip.fareUsd.toFixed(2)}</Text>
        </View>
        <View style={[styles.metaPill, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
          <Text style={[styles.metaPillLabel, { color: ui.textMuted }]}>Est. time</Text>
          <Text style={[styles.metaPillValue, { color: ui.text }]}>{liveEtaMin} min</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Vehicle</Text>
        <View style={[styles.plate, { borderColor: ui.divider, backgroundColor: ui.softBg }]}>
          <Text style={[styles.plateText, { color: ui.text }]}>{trip.plate}</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Payment</Text>
        <Text style={[styles.routeSmall, { color: ui.text }]}>{trip.paymentLabel ?? 'Card'}</Text>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.pinIntro, { color: ui.textMuted }]}>Tell your driver this PIN</Text>
        <View style={[styles.pinBox, { backgroundColor: ui.softBg }]}>
          <Text style={[styles.pinDigits, { color: ui.text }]}>{trip.driverPin}</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Route</Text>
        <Text style={[styles.routeSmall, { color: ui.text }]} numberOfLines={1}>
          {trip.fromLabel} → {trip.toLabel}
        </Text>
      </View>
      {trip.status === 'completed' ? (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Receipt</Text>
          <Text style={[styles.receiptLine, { color: ui.text }]}>
            Base ${((trip.baseFare ?? trip.fareUsd)).toFixed(2)} + Fees ${(trip.fees ?? 0).toFixed(2)} + Tip ${(trip.tipAmount ?? 0).toFixed(2)}
          </Text>
          <Text style={[styles.receiptLine, { color: ui.text }]}>
            Total ${(trip.totalFare ?? trip.fareUsd).toFixed(2)} · Rating {trip.rating ?? 0}/5
          </Text>
        </View>
      ) : null}
      {trip.status === 'cancelled' ? (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Cancellation reason</Text>
          <Text style={[styles.routeSmall, { color: ui.text }]}>{cancelReasonText}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {trip.status === 'driver_arriving' ? (
          <View style={[styles.infoPill, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
            <Ionicons name="time-outline" size={16} color={ui.textMuted} />
            <Text style={[styles.infoPillText, { color: ui.textMuted }]}>Waiting for driver to arrive</Text>
          </View>
        ) : null}
        {trip.status === 'arrived' ? (
          <View style={[styles.infoPill, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
            <Ionicons name="car-outline" size={16} color={ui.textMuted} />
            <Text style={[styles.infoPillText, { color: ui.textMuted }]}>Driver is starting the trip</Text>
          </View>
        ) : null}
        {(trip.status === 'in_trip' || trip.status === 'arrived' || trip.status === 'driver_arriving') ? (
          <View style={[styles.infoPill, { backgroundColor: ui.softBg, borderColor: ui.divider }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={ui.textMuted} />
            <Text style={[styles.infoPillText, { color: ui.textMuted }]}>Only driver can update trip status</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  roleText: {
    fontSize: 12,
  },
  carLine: {
    fontSize: 15,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metaPill: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaPillLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaPillValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionBlock: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  plate: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plateText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pinIntro: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  pinBox: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pinDigits: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 8,
  },
  routeSmall: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptLine: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoPill: {
    width: '100%',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
