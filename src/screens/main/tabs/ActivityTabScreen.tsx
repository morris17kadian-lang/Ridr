import React, { type JSX } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ACTIVITY_FILTERS, mockActivityFeed, type ActivityItem } from '../data/mainTabData';
import { mainTabStyles as styles } from '../styles/mainTabStyles';
import type { ActiveTripState } from '../ride/activeTripTypes';

export type TabUi = {
  screenBg: string;
  panelBg: string;
  cardBg: string;
  text: string;
  textMuted: string;
  divider: string;
  placeholder: string;
};

type Props = {
  ui: TabUi;
  isDark: boolean;
  activitySearch: string;
  setActivitySearch: (s: string) => void;
  activitySearchOpen: boolean;
  setActivitySearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activityFilter: 'all' | 'today' | 'yesterday' | '7days' | 'month';
  setActivityFilter: (f: 'all' | 'today' | 'yesterday' | '7days' | 'month') => void;
  onSelectRideDetail: (ride: NonNullable<ActivityItem['rideData']>) => void;
  presentRide: ActiveTripState | null;
  onOpenPresentRide: () => void;
  recentBookedRides: ActiveTripState[];
  onOpenBookedRide: (ride: ActiveTripState) => void;
  refreshing: boolean;
  onRefresh: () => void;
  homeAddress: string;
  workAddress: string;
  onBookAddress: (type: 'home' | 'work') => void;
};

export function ActivityTabScreen({
  ui,
  isDark,
  activitySearch,
  setActivitySearch,
  activitySearchOpen,
  setActivitySearchOpen,
  activityFilter,
  setActivityFilter,
  onSelectRideDetail,
  presentRide,
  onOpenPresentRide,
  recentBookedRides,
  onOpenBookedRide,
  refreshing,
  onRefresh,
  homeAddress,
  workAddress,
  onBookAddress,
}: Props) {
  const presentRideMinutesLeft =
    presentRide ? Math.max(0, Math.ceil((presentRide.expiresAtMs - Date.now()) / 60000)) : 0;

  return (
    <View style={[styles.tabScreen, { backgroundColor: ui.screenBg }]}>
      <View style={[styles.tabScreenHeader, { backgroundColor: ui.panelBg, borderBottomColor: ui.divider }]}>
        <View style={styles.tabScreenHeaderRow}>
          <Text style={[styles.tabScreenTitle, { color: ui.text }]}>Activity</Text>
          <Pressable
            style={[styles.tabSearchIconBtn, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}
            onPress={() => {
              setActivitySearchOpen((v) => !v);
              setActivitySearch('');
            }}
          >
            <Ionicons name={activitySearchOpen ? 'close' : 'search'} size={18} color={ui.text} />
          </Pressable>
        </View>
        {activitySearchOpen ? (
          <View style={[styles.tabSearchBar, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0', borderColor: ui.divider }]}>
            <Ionicons name="search" size={15} color={ui.textMuted} />
            <TextInput
              style={[styles.tabSearchInput, { color: ui.text }]}
              value={activitySearch}
              onChangeText={setActivitySearch}
              placeholder="Search activity..."
              placeholderTextColor={ui.placeholder}
              autoFocus
              autoCorrect={false}
            />
          </View>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={styles.tabScreenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ui.textMuted}
            colors={[isDark ? '#f5f5f5' : '#171717']}
          />
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activityFilterRow} contentContainerStyle={styles.activityFilterContent}>
          {ACTIVITY_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.activityFilterPill, activityFilter === f.key && styles.activityFilterPillActive]}
              onPress={() => setActivityFilter(f.key)}
            >
              <Text style={[styles.activityFilterPillText, activityFilter === f.key && styles.activityFilterPillTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {(homeAddress || workAddress) ? (
          <>
            <Text style={[styles.activityGroupHeader, { color: ui.textMuted }]}>Saved places</Text>
            {homeAddress ? (
              <Pressable
                style={[styles.tabCard, { backgroundColor: ui.cardBg }]}
                onPress={() => onBookAddress('home')}
              >
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Ionicons name="home" size={16} color={ui.text} />
                      <Text style={[styles.activityCardTitle, { color: ui.text }]}>Home</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                  </View>
                  <Text style={[styles.activityCardSub, { color: ui.textMuted }]} numberOfLines={1}>
                    {homeAddress}
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {workAddress ? (
              <Pressable
                style={[styles.tabCard, { backgroundColor: ui.cardBg }]}
                onPress={() => onBookAddress('work')}
              >
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Ionicons name="briefcase" size={16} color={ui.text} />
                      <Text style={[styles.activityCardTitle, { color: ui.text }]}>Work</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                  </View>
                  <Text style={[styles.activityCardSub, { color: ui.textMuted }]} numberOfLines={1}>
                    {workAddress}
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {recentBookedRides.length > 0 ? (
          <>
            <Text style={[styles.activityGroupHeader, { color: ui.textMuted }]}>Booked rides</Text>
            {recentBookedRides.slice(0, 6).map((ride) => (
              <Pressable
                key={`booked-${ride.id}`}
                style={[styles.tabCard, { backgroundColor: ui.cardBg }]}
                onPress={() => onOpenBookedRide(ride)}
              >
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardRow}>
                    <Text style={[styles.activityCardTitle, { color: ui.text }]} numberOfLines={1}>
                      {ride.fromLabel} → {ride.toLabel}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                  </View>
                  <Text style={[styles.activityCardSub, { color: ui.textMuted }]}>
                    {ride.driverName} · {ride.carDetails} · ${ride.fareUsd.toFixed(2)}
                  </Text>
                  <Text style={[styles.activityCardSub, { color: ui.textMuted, marginTop: 2 }]}>
                    {ride.status.replace('_', ' ')} · PIN {ride.driverPin} · ETA {ride.etaMinutes} min · {ride.bookedFor === 'friend' ? 'Friend' : 'You'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {presentRide ? (
          <Pressable
            style={[
              styles.tabCard,
              {
                backgroundColor: '#fde68a',
                borderColor: '#f59e0b',
                borderWidth: 1,
              },
            ]}
            onPress={onOpenPresentRide}
          >
            <View style={styles.activityCardContent}>
              <View style={styles.activityCardRow}>
                <Text style={[styles.activityCardTitle, { color: '#713f12' }]} numberOfLines={1}>
                  PRESENT RIDE BOOKED
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#92400e" />
              </View>
              <Text style={[styles.activityCardSub, { color: '#78350f' }]}>
                {presentRide.driverName} · {presentRide.carDetails} · ${presentRide.fareUsd.toFixed(2)} · ETA {presentRide.etaMinutes} min
              </Text>
              <Text style={[styles.activityCardSub, { color: '#78350f', marginTop: 2 }]}>
                PIN {presentRide.driverPin} · Expires in {presentRideMinutesLeft} min
              </Text>
            </View>
          </Pressable>
        ) : null}

        {(() => {
          const filtered = mockActivityFeed.filter((item) => {
            const s = activitySearch.trim().toLowerCase();
            if (s && ![item.title, item.subtitle].some((t) => t.toLowerCase().includes(s))) return false;
            if (activityFilter === 'today') return item.daysAgo === 0;
            if (activityFilter === 'yesterday') return item.daysAgo === 1;
            if (activityFilter === '7days') return item.daysAgo <= 6;
            if (activityFilter === 'month') return item.daysAgo <= 30;
            return true;
          });
          if (filtered.length === 0) {
            return <Text style={[styles.activityEmpty, { color: ui.textMuted }]}>No activity found</Text>;
          }
          const nodes: JSX.Element[] = [];
          let lastGroup = '';
          filtered.forEach((item) => {
            const group =
              item.daysAgo === 0
                ? 'Today'
                : item.daysAgo === 1
                  ? 'Yesterday'
                  : item.daysAgo <= 6
                    ? 'Earlier This Week'
                    : 'Last Month';
            if (group !== lastGroup) {
              nodes.push(
                <Text key={`grp-${group}-${item.id}`} style={[styles.activityGroupHeader, { color: ui.textMuted }]}>
                  {group}
                </Text>
              );
              lastGroup = group;
            }
            nodes.push(
              <Pressable
                key={item.id}
                style={[styles.tabCard, { backgroundColor: ui.cardBg }]}
                onPress={() => (item.rideData ? onSelectRideDetail(item.rideData) : null)}
              >
                <View style={styles.activityCardContent}>
                  <View style={styles.activityCardRow}>
                    <Text style={[styles.activityCardTitle, { color: ui.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.type === 'ride' ? <Ionicons name="chevron-forward" size={16} color={ui.textMuted} /> : null}
                  </View>
                  <Text style={[styles.activityCardSub, { color: ui.textMuted }]}>
                    {item.subtitle} · {item.time}
                  </Text>
                </View>
              </Pressable>
            );
          });
          return nodes;
        })()}
      </ScrollView>
    </View>
  );
}
