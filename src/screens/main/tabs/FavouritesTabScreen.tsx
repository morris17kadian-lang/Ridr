import React, { type ComponentProps } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { FavouritePlaceRow, FrequentRouteRow } from '../data/mainTabData';
import { mainTabStyles as styles } from '../styles/mainTabStyles';
import type { TabUi } from './ActivityTabScreen';

type Props = {
  ui: TabUi;
  isDark: boolean;
  favSearch: string;
  setFavSearch: (s: string) => void;
  favSearchOpen: boolean;
  setFavSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  refreshing: boolean;
  onRefresh: () => void;
  onBookFavPlace: (title: string, subtitle: string) => void;
  onBookFavRoute: (from: string, to: string) => void;
  favouritePlaces: FavouritePlaceRow[];
  frequentRoutes: FrequentRouteRow[];
};

export function FavouritesTabScreen({
  ui,
  isDark,
  favSearch,
  setFavSearch,
  favSearchOpen,
  setFavSearchOpen,
  refreshing,
  onRefresh,
  onBookFavPlace,
  onBookFavRoute,
  favouritePlaces,
  frequentRoutes,
}: Props) {
  return (
    <View style={[styles.tabScreen, { backgroundColor: ui.screenBg }]}>
      <View style={[styles.tabScreenHeader, { backgroundColor: ui.panelBg, borderBottomColor: ui.divider }]}>
        <View style={styles.tabScreenHeaderRow}>
          <Text style={[styles.tabScreenTitle, { color: ui.text }]}>Favourites</Text>
          <Pressable
            style={[styles.tabSearchIconBtn, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}
            onPress={() => {
              setFavSearchOpen((v) => !v);
              setFavSearch('');
            }}
          >
            <Ionicons name={favSearchOpen ? 'close' : 'search'} size={18} color={ui.text} />
          </Pressable>
        </View>
        {favSearchOpen ? (
          <View style={[styles.tabSearchBar, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0', borderColor: ui.divider }]}>
            <Ionicons name="search" size={15} color={ui.textMuted} />
            <TextInput
              style={[styles.tabSearchInput, { color: ui.text }]}
              value={favSearch}
              onChangeText={setFavSearch}
              placeholder="Search places..."
              placeholderTextColor={ui.placeholder}
              autoFocus
              autoCorrect={false}
            />
          </View>
        ) : null}
      </View>
      <ScrollView
        nestedScrollEnabled={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        contentContainerStyle={[styles.tabScreenContent, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ui.textMuted}
            colors={[isDark ? '#f5f5f5' : '#171717']}
            progressViewOffset={Platform.OS === 'android' ? 8 : undefined}
          />
        }
      >
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Saved places</Text>
        {favouritePlaces
          .filter(
            (p) =>
              !favSearch.trim() ||
              [p.title, p.subtitle].some((s) => s.toLowerCase().includes(favSearch.toLowerCase()))
          )
          .map((place) => (
            <Pressable key={place.id} style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]} onPress={() => onBookFavPlace(place.title, place.subtitle)}>
              <View style={styles.favItem}>
                <View style={[styles.favIconWrap, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}>
                  <Ionicons name={place.icon as ComponentProps<typeof Ionicons>['name']} size={18} color={ui.text} />
                </View>
                <View style={styles.favBody}>
                  <Text style={[styles.favTitle, { color: ui.text }]}>{place.title}</Text>
                  <Text style={[styles.favSubtitle, { color: ui.textMuted }]}>{place.subtitle}</Text>
                </View>
                <Ionicons name="heart" size={18} color="#ef4444" />
              </View>
            </Pressable>
          ))}

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Frequent routes</Text>
        {frequentRoutes.map((route) => (
          <Pressable
            key={route.id}
            style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}
            onPress={() => onBookFavRoute(route.from, route.to)}
          >
            <View style={styles.favItem}>
              <View style={[styles.favIconWrap, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}>
                <Ionicons name="repeat" size={18} color={ui.text} />
              </View>
              <View style={styles.favBody}>
                <Text style={[styles.favTitle, { color: ui.text }]}>
                  {route.from} → {route.to}
                </Text>
                <Text style={[styles.favSubtitle, { color: ui.textMuted }]}>{route.count} rides</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
