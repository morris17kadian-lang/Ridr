import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native';
import { greyCarAsset } from '../../../assets/images';
import type { MainScreenUi } from '../mainScreenUi';
import type { ActiveTripState } from './activeTripTypes';

const ACCENT = '#FFD000';
const SIZE_PILL_BLUE = '#2563eb';

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
  isDark: boolean;
  etaCountdownSec: number;
  headerPanHandlers?: GestureResponderHandlers;
  onToggleCollapse?: () => void;
};

export function RideDetailsBottomSheet({
  trip,
  ui,
  isDark,
  etaCountdownSec,
  headerPanHandlers,
  onToggleCollapse,
}: Props) {
  const name = trip.driverName ?? 'Driver';
  const initials = getInitials(name);
  const avatarBg = avatarColor(name);
  const driverRating = trip.rating != null && trip.rating > 0 ? trip.rating : 4.5;
  const etaLabel = `${formatMinSec(etaCountdownSec)} Mins`;

  return (
    <View style={[styles.card, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
      {/* Black arrival bar */}
      <Pressable
        style={styles.arrivalBar}
        onPress={onToggleCollapse}
        accessibilityRole="button"
        accessibilityLabel="Toggle ride details"
        {...(headerPanHandlers ?? {})}
      >
        <Ionicons name="hourglass-outline" size={18} color="#ffffff" />
        <Text style={styles.arrivalBarText} numberOfLines={1}>
          The driver will arrive in
        </Text>
        <View style={styles.arrivalBarPill}>
          <Text style={styles.arrivalBarPillText}>{etaLabel}</Text>
        </View>
      </Pressable>

      {/* Sheet surface */}
      <View style={styles.surfaceShadow}>
        <View style={[styles.surface, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          {/* Vehicle */}
          <View style={styles.vehicleRow}>
            <View style={styles.vehicleLeft}>
              <Text style={[styles.plateNumber, { color: ui.text }]}>{trip.plate || '—'}</Text>
              <Text style={[styles.vehicleSub, { color: ui.textMuted }]} numberOfLines={1}>
                {trip.carDetails || 'Vehicle'}
              </Text>
            </View>
            <View style={styles.vehicleRight}>
              <Image source={greyCarAsset} style={styles.carImg} resizeMode="contain" />
              <View style={[styles.sizePill, { backgroundColor: SIZE_PILL_BLUE }]}>
                <Text style={styles.sizePillText}>Medium Size</Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.divider }]} />

          {/* Driver */}
          <View style={styles.driverRow}>
            <View style={styles.avatarWrap}>
              <View style={[styles.driverAvatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.driverAvatarText}>{initials}</Text>
              </View>
              <View style={styles.ratingOverlay}>
                <Text style={styles.ratingOverlayText}>{driverRating.toFixed(1)}</Text>
                <Ionicons name="star" size={12} color={ACCENT} />
              </View>
            </View>

            <View style={styles.driverMeta}>
              <Text style={[styles.driverName, { color: ui.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.driverSub, { color: ui.textMuted }]} numberOfLines={1}>
                Top Rated Driver 🏆
              </Text>
            </View>

            <View style={styles.driverActions}>
              <View style={styles.actionBtn}>
                <Ionicons name="call" size={18} color={ACCENT} />
              </View>
              <View style={styles.actionBtn}>
                <Ionicons name="chatbubble-ellipses" size={16} color={ACCENT} />
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.divider }]} />

          {/* Route */}
          <View style={styles.routeWrap}>
            <View style={styles.routeTimeline}>
              <View style={[styles.routeDotStart, { backgroundColor: ui.textMuted }]} />
              <View style={[styles.routeLine, { backgroundColor: ui.divider }]} />
              <View style={[styles.routeDotEnd, { backgroundColor: ui.text }]} />
            </View>
            <View style={styles.routeTexts}>
              <View style={styles.routeItem}>
                <Text style={[styles.routeLabel, { color: ui.textMuted }]}>Start Location</Text>
                <Text style={[styles.routeValue, { color: ui.text }]} numberOfLines={1}>
                  {trip.fromLabel || 'Your Current Location'}
                </Text>
              </View>
              <View style={[styles.routeMidDivider, { backgroundColor: ui.divider }]} />
              <View style={styles.routeItem}>
                <Text style={[styles.routeLabel, { color: ui.textMuted }]}>Your Destination</Text>
                <Text style={[styles.routeValue, { color: ui.text }]} numberOfLines={1}>
                  {trip.toLabel || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const shadowLift = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.22,
  shadowRadius: 22,
  elevation: 16,
} as const;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.35,
  },

  // Black arrival bar
  arrivalBar: {
    ...shadowLift,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 10,
  },
  arrivalBarText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  arrivalBarPill: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  arrivalBarPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Surface
  surfaceShadow: {
    ...shadowLift,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  surface: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },

  // Vehicle
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vehicleLeft: {
    flex: 1,
    gap: 4,
    paddingLeft: 28,
  },
  plateNumber: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  vehicleSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  vehicleRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
  },
  carImg: {
    width: 120,
    height: 64,
  },
  sizePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sizePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Driver
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  ratingOverlay: {
    position: 'absolute',
    left: 0,
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  ratingOverlayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#171717',
  },
  driverMeta: {
    flex: 1,
    gap: 3,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  driverSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 10,
    flexShrink: 0,
  },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Route
  routeWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  routeTimeline: {
    width: 16,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  routeDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    flex: 1,
    width: 2,
    minHeight: 16,
    marginVertical: 4,
    borderRadius: 1,
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeTexts: {
    flex: 1,
    gap: 0,
  },
  routeItem: {
    paddingVertical: 6,
  },
  routeMidDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
