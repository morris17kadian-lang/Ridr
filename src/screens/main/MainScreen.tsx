import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { authEnabled, firebaseApp, firebaseReady, missingFirebaseConfig } from '../../lib/firebase';
import {
  migrateLegacyNational,
  releaseE164,
  reserveE164,
  validateToE164,
} from '../../lib/phone';
import { greyCarAsset } from '../../assets/images';
import {
  ACTIVE_TRIP_STORAGE_KEY,
  BOOKED_RIDES_STORAGE_KEY,
  PROFILE_ME_CACHE_KEY,
  clearAppCache,
} from '../../lib/appCacheStorage';
import { AUTH_SESSION_KEY, useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/ThemeProvider';
import { ProfileEditScreen } from './profile/ProfileEditScreen';
import { ProfileScreen } from './profile/ProfileScreen';
import type { ProfileCard } from './profile/profileTypes';
import { SettingsAppearanceScreen } from './settings/SettingsAppearanceScreen';
import { NotificationsScreen } from './notifications/NotificationsScreen';
import { SettingsHelpScreen } from './settings/SettingsHelpScreen';
import { SettingsLanguageScreen } from './settings/SettingsLanguageScreen';
import { SettingsNotificationsScreen } from './settings/SettingsNotificationsScreen';
import { SettingsPasswordScreen } from './settings/SettingsPasswordScreen';
import { SettingsSupportScreen } from './settings/SettingsSupportScreen';
import { SettingsTermsScreen } from './settings/SettingsTermsScreen';
import {
  fetchPlaceDetailsCoordinate,
  isInJamaicaServiceArea,
  KSA_MAP_CENTER,
  parseLatLngFromString,
  resolveLocationQuery,
  reverseGeocodeMapPin,
  type LatLng,
} from './locationResolve';
import {
  PROFILE_HEADER_ICON_GLYPH,
} from './mainScreenLayoutConstants';
import { styles } from './styles/mainScreenStyles';
import { ActivityTabScreen } from './tabs/ActivityTabScreen';
import { FavouritesTabScreen } from './tabs/FavouritesTabScreen';
import { SettingsTabScreen } from './tabs/SettingsTabScreen';
import { usePushToken } from '../../hooks/usePushToken';
import { ActiveRideScreen } from './ride/ActiveRideScreen';
import type {
  ActiveTripState,
  TripRecord,
  TripStatus,
} from './ride/activeTripTypes';
import { FindingDriverModal } from './ride/FindingDriverModal';
import { estimateFareUsd } from './ride/rideFare';
import { interpolateRoutePoint } from './ride/routeGeometry';
import {
  countDriversInNearbyResponse,
  createPaymentMethod,
  getNearbyDrivers,
  listPaymentMethods,
  paymentMethodToDisplay,
  updatePaymentMethod,
} from '../../api';
import {
  buildKingstonZoneFareEstimateBody,
  createImmediateRide,
  getRideRequestById,
  postFareEstimate,
} from '../../api/rides';
import { buildActiveTripFromCreateResponse, mergePollRideRequest } from '../../api/mapRideRequest';

const mockRideHistory = [
  { id: 'r1', from: 'Half-Way Tree', to: 'Norman Manley Airport', date: 'Today, 9:14 AM', price: '$12.40', driver: 'Marcus W.', rating: 5 },
  { id: 'r2', from: 'New Kingston', to: 'Portmore Mall', date: 'Yesterday, 3:45 PM', price: '$8.20', driver: 'Diana R.', rating: 4 },
  { id: 'r3', from: 'Liguanea', to: 'Half-Way Tree', date: 'Apr 7, 11:30 AM', price: '$5.10', driver: 'Trevor A.', rating: 5 },
  { id: 'r4', from: 'Downtown Kingston', to: 'New Kingston', date: 'Apr 6, 8:00 AM', price: '$6.80', driver: 'Sandra M.', rating: 4 },
  { id: 'r5', from: 'Constant Spring', to: 'Liguanea', date: 'Apr 5, 7:20 PM', price: '$4.90', driver: 'Devon P.', rating: 5 },
];

const mockTopDrivers = [
  { id: 'd1', name: 'Marcus Williams', trips: 14, rating: 4.9, initials: 'MW', color: '#4a90e2' },
  { id: 'd2', name: 'Diana Reid', trips: 8, rating: 5.0, initials: 'DR', color: '#e2844a' },
  { id: 'd3', name: 'Trevor Allen', trips: 11, rating: 4.8, initials: 'TA', color: '#52b788' },
  { id: 'd4', name: 'Sandra Morris', trips: 6, rating: 4.7, initials: 'SM', color: '#9b72cf' },
];

const DRIVER_AVATAR_COLORS = ['#4a90e2', '#e2844a', '#52b788', '#9b72cf', '#e25c6a', '#3bbfa3'];
function driverAvatar(name: string): { initials: string; color: string } {
  const parts = name.trim().split(/\s+/);
  const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const color = DRIVER_AVATAR_COLORS[Math.abs(hash) % DRIVER_AVATAR_COLORS.length];
  return { initials, color };
}

const rideOptions = [
  {
    id: 'go',
    name: 'Ridr Go',
    eta: '2 min',
    price: '$12.40',
    detail: 'Affordable everyday ride',
    carType: 'sedan',
  },
  {
    id: 'plus',
    name: 'Ridr Plus',
    eta: '4 min',
    price: '$18.90',
    detail: 'Extra legroom and top drivers',
    carType: 'suv',
  },
  {
    id: 'xl',
    name: 'Ridr XL',
    eta: '6 min',
    price: '$24.10',
    detail: 'For groups and large bags',
    carType: 'van',
  },
];

const quickActions = ['Home', 'Work', 'Airport'];
type DestinationSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  icon: 'airplane' | 'business' | 'location' | 'cafe' | 'storefront' | 'home';
  coordinate: LatLng;
};

type SearchSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  icon: 'airplane' | 'business' | 'location' | 'cafe' | 'storefront' | 'home' | 'briefcase';
  fullText?: string;
  /** Google Places place_id — use Place Details for an exact pin (not geocoded text). */
  placeId?: string;
  /** Curated / known coordinate (quick picks). */
  coordinate?: LatLng;
};

type SavedPlace = {
  id?: string;
  label?: string;
  type?: string;
  address?: string;
  title?: string;
};

type MeResponse = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  savedPlaces?: SavedPlace[];
};

type BookedRideRecord = TripRecord;

const ACTIVE_TRIP_TTL_MS = 5 * 60 * 1000;

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, '');

  const fromExpoConfig = Constants.expoConfig?.extra?.baseUrl;
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) {
    return fromExpoConfig.trim().replace(/\/+$/, '');
  }

  const fromManifest = ((Constants as unknown as { manifest?: { extra?: { baseUrl?: string } } }).manifest
    ?.extra?.baseUrl ?? '');
  if (typeof fromManifest === 'string' && fromManifest.trim()) {
    return fromManifest.trim().replace(/\/+$/, '');
  }

  const fromManifest2 = ((Constants as unknown as {
    manifest2?: { extra?: { expoClient?: { extra?: { baseUrl?: string } } } };
  }).manifest2?.extra?.expoClient?.extra?.baseUrl ?? '');
  if (typeof fromManifest2 === 'string' && fromManifest2.trim()) {
    return fromManifest2.trim().replace(/\/+$/, '');
  }

  return '';
}

function resolveGoogleMapsApiKey(): { key: string | null; source: string } {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return { key: fromEnv.trim(), source: 'process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY' };
  }

  const fromExpoConfig = (Constants.expoConfig?.extra?.googleMapsApiKey as string | undefined) ?? '';
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) {
    return { key: fromExpoConfig.trim(), source: 'Constants.expoConfig.extra.googleMapsApiKey' };
  }

  const fromManifest = ((Constants as unknown as { manifest?: { extra?: { googleMapsApiKey?: string } } })
    .manifest?.extra?.googleMapsApiKey ?? '');
  if (typeof fromManifest === 'string' && fromManifest.trim()) {
    return { key: fromManifest.trim(), source: 'Constants.manifest.extra.googleMapsApiKey' };
  }

  const fromManifest2 =
    ((Constants as unknown as {
      manifest2?: { extra?: { expoClient?: { extra?: { googleMapsApiKey?: string } } } };
    }).manifest2?.extra?.expoClient?.extra?.googleMapsApiKey ?? '');
  if (typeof fromManifest2 === 'string' && fromManifest2.trim()) {
    return { key: fromManifest2.trim(), source: 'Constants.manifest2.extra.expoClient.extra.googleMapsApiKey' };
  }

  const fromExpoConfigIOS = (Constants.expoConfig?.ios?.config as { googleMapsApiKey?: string } | undefined)
    ?.googleMapsApiKey;
  if (typeof fromExpoConfigIOS === 'string' && fromExpoConfigIOS.trim()) {
    return { key: fromExpoConfigIOS.trim(), source: 'Constants.expoConfig.ios.config.googleMapsApiKey' };
  }

  const fromExpoConfigAndroid = (
    Constants.expoConfig?.android?.config as { googleMaps?: { apiKey?: string } } | undefined
  )?.googleMaps?.apiKey;
  if (typeof fromExpoConfigAndroid === 'string' && fromExpoConfigAndroid.trim()) {
    return { key: fromExpoConfigAndroid.trim(), source: 'Constants.expoConfig.android.config.googleMaps.apiKey' };
  }

  const fromManifestIOS = (
    (Constants as unknown as { manifest?: { ios?: { config?: { googleMapsApiKey?: string } } } }).manifest?.ios
      ?.config?.googleMapsApiKey ?? ''
  );
  if (typeof fromManifestIOS === 'string' && fromManifestIOS.trim()) {
    return { key: fromManifestIOS.trim(), source: 'Constants.manifest.ios.config.googleMapsApiKey' };
  }

  const fromManifestAndroid = (
    (Constants as unknown as {
      manifest?: { android?: { config?: { googleMaps?: { apiKey?: string } } } };
    }).manifest?.android?.config?.googleMaps?.apiKey ?? ''
  );
  if (typeof fromManifestAndroid === 'string' && fromManifestAndroid.trim()) {
    return { key: fromManifestAndroid.trim(), source: 'Constants.manifest.android.config.googleMaps.apiKey' };
  }

  const fromGenericEnv = process.env.GOOGLE_MAPS_API_KEY;
  if (typeof fromGenericEnv === 'string' && fromGenericEnv.trim()) {
    return { key: fromGenericEnv.trim(), source: 'process.env.GOOGLE_MAPS_API_KEY' };
  }

  return { key: null, source: 'none' };
}
const destinationSuggestions = [
  {
    id: 'airport',
    title: 'Norman Manley Airport',
    subtitle: 'Palisadoes, Kingston',
    icon: 'airplane' as const,
    coordinate: { latitude: 17.9360, longitude: -76.7875 },
  },
  {
    id: 'half-way-tree',
    title: 'Half-Way Tree',
    subtitle: 'St. Andrew, Kingston',
    icon: 'business' as const,
    coordinate: { latitude: 18.0057, longitude: -76.7936 },
  },
  {
    id: 'new-kingston',
    title: 'New Kingston',
    subtitle: 'Knutsford Blvd, Kingston',
    icon: 'location' as const,
    coordinate: { latitude: 18.0081, longitude: -76.7832 },
  },
  {
    id: 'liguanea',
    title: 'Liguanea',
    subtitle: 'Hope Rd, Kingston',
    icon: 'cafe' as const,
    coordinate: { latitude: 18.0137, longitude: -76.7474 },
  },
  {
    id: 'downtown',
    title: 'Downtown Kingston',
    subtitle: 'King Street, Kingston',
    icon: 'storefront' as const,
    coordinate: { latitude: 17.9770, longitude: -76.7915 },
  },
  {
    id: 'constant-spring',
    title: 'Constant Spring',
    subtitle: 'St. Andrew, Kingston',
    icon: 'home' as const,
    coordinate: { latitude: 18.0392, longitude: -76.7938 },
  },
] satisfies DestinationSuggestion[];

// Default centre: Kingston, Jamaica
const JAMAICA_KINGSTON = { latitude: 17.9970, longitude: -76.7936 };

function decodeGooglePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  } catch {
    return [];
  }

  return points;
}

const MAP_HEIGHT = 400;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
/** Pinterest-style long-press: circular actions around the map point (angles in radians). */
const MAP_RADIAL_BTN = 54;
const MAP_RADIAL_R = 74;
const MAP_RADIAL_FROM_DX = MAP_RADIAL_R * Math.cos((168 * Math.PI) / 180);
const MAP_RADIAL_FROM_DY = MAP_RADIAL_R * Math.sin((168 * Math.PI) / 180);
const MAP_RADIAL_TO_DX = MAP_RADIAL_R * Math.cos((-34 * Math.PI) / 180);
const MAP_RADIAL_TO_DY = MAP_RADIAL_R * Math.sin((-34 * Math.PI) / 180);
/** Finger must start within this radius of the anchor to drag toward From/To. */
const MAP_RADIAL_DRAG_ANCHOR_RADIUS = 56;
/** Drag this far from the start to reveal the From/To icons. */
const MAP_RADIAL_REVEAL_DISTANCE = 22;
const MAP_RADIAL_HIT_EXTRA = 10;

function clampMapRadialFab(left: number, top: number, size: number) {
  const pad = 10;
  const topPad = 52;
  const bottomPad = 100;
  return {
    left: Math.max(pad, Math.min(SCREEN_WIDTH - size - pad, left)),
    top: Math.max(topPad, Math.min(SCREEN_HEIGHT - size - bottomPad, top)),
  };
}

function getRadialFabCenters(anchor: { x: number; y: number }) {
  const ax = anchor.x;
  const ay = anchor.y;
  const fromRect = clampMapRadialFab(
    ax + MAP_RADIAL_FROM_DX - MAP_RADIAL_BTN / 2,
    ay + MAP_RADIAL_FROM_DY - MAP_RADIAL_BTN / 2,
    MAP_RADIAL_BTN
  );
  const toRect = clampMapRadialFab(
    ax + MAP_RADIAL_TO_DX - MAP_RADIAL_BTN / 2,
    ay + MAP_RADIAL_TO_DY - MAP_RADIAL_BTN / 2,
    MAP_RADIAL_BTN
  );
  return {
    fromCenter: { x: fromRect.left + MAP_RADIAL_BTN / 2, y: fromRect.top + MAP_RADIAL_BTN / 2 },
    toCenter: { x: toRect.left + MAP_RADIAL_BTN / 2, y: toRect.top + MAP_RADIAL_BTN / 2 },
  };
}

const mapRadialStyles = StyleSheet.create({
  fabLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  fab: {
    position: 'absolute',
    width: MAP_RADIAL_BTN,
    height: MAP_RADIAL_BTN,
    borderRadius: MAP_RADIAL_BTN / 2,
    backgroundColor: 'rgba(28,28,30,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 24,
  },
  fabDisabled: {
    opacity: 0.42,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
  anchorLoader: {
    position: 'absolute',
    zIndex: 19,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  anchorDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(28,28,30,0.85)',
    zIndex: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
});

/** Visual only — selection is handled by pan release hit-testing on the map pick overlay. */
function MapRadialFabs({
  anchor,
  radialRevealed,
  resolving,
}: {
  anchor: { x: number; y: number };
  radialRevealed: boolean;
  resolving: boolean;
}) {
  const ax = anchor.x;
  const ay = anchor.y;
  const fromPos = clampMapRadialFab(
    ax + MAP_RADIAL_FROM_DX - MAP_RADIAL_BTN / 2,
    ay + MAP_RADIAL_FROM_DY - MAP_RADIAL_BTN / 2,
    MAP_RADIAL_BTN
  );
  const toPos = clampMapRadialFab(
    ax + MAP_RADIAL_TO_DX - MAP_RADIAL_BTN / 2,
    ay + MAP_RADIAL_TO_DY - MAP_RADIAL_BTN / 2,
    MAP_RADIAL_BTN
  );
  const show = radialRevealed && !resolving;
  return (
    <View style={mapRadialStyles.fabLayer} pointerEvents="none">
      <View style={[mapRadialStyles.anchorDot, { left: ax - 8, top: ay - 8 }]} />
      {resolving ? (
        <View style={[mapRadialStyles.anchorLoader, { left: ax - 14, top: ay - 14 }]}>
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : null}
      {show ? (
        <>
          <View
            accessibilityLabel="From"
            style={[mapRadialStyles.fab, { left: fromPos.left, top: fromPos.top }]}
          >
            <Ionicons name="location" size={24} color="#ffffff" />
          </View>
          <View
            accessibilityLabel="To"
            style={[mapRadialStyles.fab, { left: toPos.left, top: toPos.top }]}
          >
            <Ionicons name="flag" size={24} color="#ffffff" />
          </View>
        </>
      ) : null}
    </View>
  );
}
/** Height of the home bottom sheet (from `contentScroll` top inset to bottom of screen). */
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT - (MAP_HEIGHT - 30);
/** Top inset when the sheet is expanded for search (status bar + breathing room). */
const SHEET_FOCUS_TOP = Math.max(0, (Constants.statusBarHeight ?? StatusBar.currentHeight ?? 0) + 8);
/** Visible height of the bottom sheet when minimized (handle + peek). */
const MINIMIZED_SHEET_PEEK = 88;
/** `translateY` to leave ~`MINIMIZED_SHEET_PEEK` of the sheet visible when minimized. */
const SHEET_MINIMIZED_OFFSET = Math.max(0, BOTTOM_SHEET_HEIGHT - MINIMIZED_SHEET_PEEK);
/** Matches `tabBar`: bottom inset + height — float controls just above it. */
const TAB_BAR_BOTTOM_OFFSET = 16 + 68;
/** Sheet height when search fields are focused (stops above floating tab bar). */
const BOTTOM_SHEET_FULLSCREEN_HEIGHT = SCREEN_HEIGHT - SHEET_FOCUS_TOP - TAB_BAR_BOTTOM_OFFSET;
const SHEET_RESTORE_BTN_BOTTOM = TAB_BAR_BOTTOM_OFFSET + 14;
const ANIMATION_TREE_KEY = 'animation-tree-v2';

/** Line heights for header greeting + name — profile avatar matches this total height. */

// Header notifications icon
function SupportIcon({ color = '#ffffff' }: { color?: string }) {
  return (
    <Ionicons name="notifications-outline" size={22} color={color} />
  );
}

function ProfileIcon({ size, color = '#171717' }: { size: number; color?: string }) {
  return <Ionicons name="person" size={size} color={color} />;
}

// Tab icons use Ionicons (from @expo/vector-icons)

export default function MainScreen() {
  const { signOut, user } = useAuth();
  const { colors, isDark, themeOverride, setThemeOverride } = useAppTheme();
  usePushToken();
  const [selectedRide, setSelectedRide] = useState('ride');
  const [activeTab, setActiveTab] = useState('home');
  const [activitySearch, setActivitySearch] = useState('');
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'month'>('all');
  const [favSearch, setFavSearch] = useState('');
  const [favSearchOpen, setFavSearchOpen] = useState(false);
  const [selectedRideDetail, setSelectedRideDetail] = useState<typeof mockRideHistory[0] | null>(null);
  const [screen, setScreen] = useState<
    'home' | 'activeRide' | 'profile' | 'profileEdit' | 'notifications' |
    'settingsNotifications' | 'settingsPassword' | 'settingsLanguage' |
    'settingsAppearance' | 'settingsHelp' | 'settingsTerms' | 'settingsSupport'
  >('home');
  const [sheetMinimized, setSheetMinimized] = useState(false);
  /** Long-press on map → choose whether to fill From or To. */
  const mapViewRef = useRef<MapView | null>(null);
  const mapMeasureRef = useRef<View | null>(null);
  const [mapLocationAction, setMapLocationAction] = useState<{
    coordinate: LatLng;
    label: string;
    resolving: boolean;
    radialRevealed: boolean;
    anchorScreen: { x: number; y: number } | null;
  } | null>(null);
  const mapLocationActionRef = useRef(mapLocationAction);
  mapLocationActionRef.current = mapLocationAction;
  const applyMapFromRef = useRef<(label: string) => void>(() => {});
  const applyMapToRef = useRef<(label: string) => void>(() => {});
  const mapRadialStartNearAnchor = useRef(false);
  const sheetMinimizedRef = useRef(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Profile
  const [userFirstName, setUserFirstName] = useState('Sarah');
  const [userLastName, setUserLastName] = useState('');
  const [userId, setUserId] = useState('');
  const [editingFirstName, setEditingFirstName] = useState('');
  const [editingLastName, setEditingLastName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPhoneE164, setUserPhoneE164] = useState<string | null>(null);
  const [userCountryCode, setUserCountryCode] = useState('+1');
  const [userEmail, setUserEmail] = useState('');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [userUsername, setUserUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('+1');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // Addresses
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [addressModal, setAddressModal] = useState<'home' | 'work' | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [bookAddressModal, setBookAddressModal] = useState<'home' | 'work' | null>(null);
  const [favBookModal, setFavBookModal] = useState<
    | { type: 'place'; title: string; subtitle: string }
    | { type: 'route'; from: string; to: string }
    | null
  >(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationFocused, setDestinationFocused] = useState(false);
  const destinationInputRef = useRef<TextInput>(null);
  const [toQuery, setToQuery] = useState('');
  const [toFocused, setToFocused] = useState(false);
  const [toUserEdited, setToUserEdited] = useState(false);
  const [toApiSuggestions, setToApiSuggestions] = useState<SearchSuggestion[]>([]);
  const [destinationApiSuggestions, setDestinationApiSuggestions] = useState<SearchSuggestion[]>([]);
  const [destinationPreviewCoordinate, setDestinationPreviewCoordinate] = useState<LatLng | null>(null);
  const [originPreviewCoordinate, setOriginPreviewCoordinate] = useState<LatLng | null>(null);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('Current location');
  const [roadRouteCoords, setRoadRouteCoords] = useState<LatLng[]>([]);
  const [routeEncodedPolyline, setRouteEncodedPolyline] = useState<string | null>(null);
  const [routeAnimatorPoint, setRouteAnimatorPoint] = useState<LatLng | null>(null);
  const [routeIssue, setRouteIssue] = useState<string | null>(null);
  const [routeDurationSec, setRouteDurationSec] = useState(0);
  const [routeDistanceM, setRouteDistanceM] = useState(0);
  const [backendFareLabel, setBackendFareLabel] = useState<string | null>(null);
  const [rideRequestSubmitting, setRideRequestSubmitting] = useState(false);
  const [bookingFor, setBookingFor] = useState<'self' | 'friend'>('self');
  const [selectedPaymentLabel, setSelectedPaymentLabel] = useState<'Card' | 'Cash'>('Card');
  const [findingDriverVisible, setFindingDriverVisible] = useState(false);
  const [findingDriverPhase, setFindingDriverPhase] = useState<'searching' | 'readySwipe' | 'no_driver_found'>('searching');
  const [activeTrip, setActiveTrip] = useState<ActiveTripState | null>(null);
  const [bookedRides, setBookedRides] = useState<BookedRideRecord[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [refreshingMain, setRefreshingMain] = useState(false);
  /** Bumps when user clears cache so `/users/me` is refetched */
  const [profileCacheNonce, setProfileCacheNonce] = useState(0);
  const toInputRef = useRef<TextInput>(null);
  const toFocusedRef = useRef(false);
  const destinationFocusedRef = useRef(false);
  const toBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noDriversNearbyDialogShownRef = useRef(false);

  // Support modal
  const [supportVisible, setSupportVisible] = useState(false);

  // Settings modals
  const [notifRideUpdates, setNotifRideUpdates] = useState(true);
  const [notifDriverArrival, setNotifDriverArrival] = useState(true);
  const [notifTripReceipt, setNotifTripReceipt] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [notifNewFeatures, setNotifNewFeatures] = useState(true);
  const [notifSurveys, setNotifSurveys] = useState(false);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [notifPayments, setNotifPayments] = useState(true);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [changePwModalVisible, setChangePwModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  // Payment cards (shown on profile)
  const [cards, setCards] = useState<ProfileCard[]>([]);
  const [defaultCard, setDefaultCard] = useState<string | null>(null);
  const [addCardVisible, setAddCardVisible] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');

  const refreshPaymentMethods = useCallback(async () => {
    if (!user) {
      setCards([]);
      setDefaultCard(null);
      return;
    }
    try {
      const { paymentMethods } = await listPaymentMethods();
      if (paymentMethods.length === 0) {
        setCards([]);
        setDefaultCard(null);
        await AsyncStorage.removeItem('profile_cards');
        await AsyncStorage.removeItem('profile_default_card');
        return;
      }
      const mapped: ProfileCard[] = paymentMethods.map((pm) => paymentMethodToDisplay(pm) as ProfileCard);
      setCards(mapped);
      const def = paymentMethods.find((p) => p.isDefault) ?? paymentMethods[0];
      setDefaultCard(def?.id ?? null);
      await AsyncStorage.setItem('profile_cards', JSON.stringify(mapped));
      if (def?.id) await AsyncStorage.setItem('profile_default_card', def.id);
    } catch {
      /* offline / session */
    }
  }, [user]);

  const selectDefaultCard = useCallback(
    async (id: string) => {
      try {
        await updatePaymentMethod(id, { isDefault: true });
        setDefaultCard(id);
        await AsyncStorage.setItem('profile_default_card', id);
        await refreshPaymentMethods();
      } catch (e) {
        Alert.alert('Could not set default card', e instanceof Error ? e.message : 'Try again.');
      }
    },
    [refreshPaymentMethods]
  );

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear cache?',
      'Removes cached trips, ride history, profile snapshot, and local payment-method copy. You stay signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearAppCache();
                setActiveTrip(null);
                setBookedRides([]);
                setCards([]);
                setDefaultCard(null);
                setSelectedPaymentLabel('Cash');
                setScreen((s) => (s === 'activeRide' ? 'home' : s));
                setProfileCacheNonce((n) => n + 1);
                await refreshPaymentMethods();
                Alert.alert('Cache cleared');
              } catch (e) {
                Alert.alert('Could not clear cache', e instanceof Error ? e.message : 'Try again.');
              }
            })();
          },
        },
      ]
    );
  }, [refreshPaymentMethods]);

  useEffect(() => {
    void refreshPaymentMethods();
  }, [refreshPaymentMethods]);

  useEffect(() => {
    const can =
      cards.length > 0 &&
      defaultCard != null &&
      cards.some((c) => c.id === defaultCard);
    if (selectedPaymentLabel === 'Card' && !can) {
      setSelectedPaymentLabel('Cash');
    }
  }, [selectedPaymentLabel, cards, defaultCard]);

  useEffect(() => {
    (async () => {
      const [
        savedFirst,
        savedLast,
        savedHome,
        savedWork,
        savedPhone,
        savedE164FromStorage,
        savedEmail,
        savedUsername,
        savedCountry,
      ] = await Promise.all([
        AsyncStorage.getItem('profile_first_name'),
        AsyncStorage.getItem('profile_last_name'),
        AsyncStorage.getItem('address_home'),
        AsyncStorage.getItem('address_work'),
        AsyncStorage.getItem('profile_phone'),
        AsyncStorage.getItem('profile_phone_e164'),
        AsyncStorage.getItem('profile_email'),
        AsyncStorage.getItem('profile_username'),
        AsyncStorage.getItem('profile_country_code'),
      ]);
      if (savedFirst !== null) {
        setUserFirstName(savedFirst);
      } else {
        setUserFirstName('Sarah');
      }
      if (savedLast !== null) {
        setUserLastName(savedLast);
      } else {
        setUserLastName('');
      }
      if (savedHome) setHomeAddress(savedHome);
      if (savedWork) setWorkAddress(savedWork);
      const country = savedCountry === '+1876' ? '+1' : (savedCountry || '+1');
      setCountryCode(country);
      setUserCountryCode(country);
      if (savedPhone) {
        const nat = migrateLegacyNational(savedPhone, country);
        setUserPhone(nat);
      }
      if (savedEmail) setUserEmail(savedEmail);
      if (savedUsername) setUserUsername(savedUsername);

      if (savedE164FromStorage) {
        setUserPhoneE164(savedE164FromStorage);
      } else if (savedPhone) {
        const nat = migrateLegacyNational(savedPhone, country);
        const v = validateToE164(country, nat);
        if (v.ok) {
          setUserPhoneE164(v.e164);
          await AsyncStorage.setItem('profile_phone_e164', v.e164);
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const label = [geo.name, geo.street, geo.city, geo.region]
            .filter(Boolean)
            .slice(0, 2)
            .join(', ');
          if (label) setCurrentLocationLabel(label);
        }
      } catch {
        /* Keep fallback label */
      }
    })();
  }, []);

  useEffect(() => {
    const applyMeToProfile = async (me: MeResponse, persistCache: boolean) => {
      const nextFirst = (me.firstName ?? '').trim();
      const nextLast = (me.lastName ?? '').trim();
      const nextEmail = (me.email ?? '').trim().toLowerCase();
      const nextPhone = (me.phone ?? '').trim();
      const nextSavedPlaces = Array.isArray(me.savedPlaces) ? me.savedPlaces : [];

      if (nextFirst) {
        setUserFirstName(nextFirst);
        await AsyncStorage.setItem('profile_first_name', nextFirst);
      }
      setUserLastName(nextLast);
      await AsyncStorage.setItem('profile_last_name', nextLast);
      setUserId(typeof me.id === 'string' ? me.id : '');
      setUserEmail(nextEmail);
      await AsyncStorage.setItem('profile_email', nextEmail);
      setSavedPlaces(nextSavedPlaces);

      if (nextPhone) {
        setUserPhoneE164(nextPhone);
        await AsyncStorage.setItem('profile_phone_e164', nextPhone);
        const parsed = parsePhoneNumberFromString(nextPhone);
        const derivedCountry = parsed?.countryCallingCode ? `+${parsed.countryCallingCode}` : '';
        const country = derivedCountry || userCountryCode || '+1';
        if (country === '+1') {
          setCountryCode('+1');
          setUserCountryCode('+1');
          await AsyncStorage.setItem('profile_country_code', '+1');
        }
        const nat = parsed ? parsed.nationalNumber : migrateLegacyNational(nextPhone, country);
        setUserPhone(nat);
        await AsyncStorage.setItem('profile_phone', nat);
      }

      const home = nextSavedPlaces.find((p) => (p.type ?? p.label ?? '').toLowerCase() === 'home');
      const work = nextSavedPlaces.find((p) => (p.type ?? p.label ?? '').toLowerCase() === 'work');
      const homeAddr = (home?.address ?? home?.title ?? '').trim();
      const workAddr = (work?.address ?? work?.title ?? '').trim();
      if (homeAddr) {
        setHomeAddress(homeAddr);
        await AsyncStorage.setItem('address_home', homeAddr);
      }
      if (workAddr) {
        setWorkAddress(workAddr);
        await AsyncStorage.setItem('address_work', workAddr);
      }

      if (persistCache) {
        await AsyncStorage.setItem(PROFILE_ME_CACHE_KEY, JSON.stringify(me));
      }
    };

    const fetchMe = async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem(PROFILE_ME_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as MeResponse;
            if (cached && typeof cached === 'object' && typeof cached.id === 'string') {
              await applyMeToProfile(cached, false);
            }
          } catch {
            await AsyncStorage.removeItem(PROFILE_ME_CACHE_KEY);
          }
        }

        const sessionRaw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
        if (!sessionRaw) return;
        const session = JSON.parse(sessionRaw) as {
          accessToken?: string;
          refreshToken?: string;
          user?: { id?: string; email?: string; firstName?: string; lastName?: string; phone?: string };
        };
        const baseUrl = resolveBaseUrl();
        if (!baseUrl || !session?.accessToken) return;

        let token = session.accessToken;
        let res = await fetch(`${baseUrl}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401 && typeof session.refreshToken === 'string' && session.refreshToken) {
          const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: session.refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshed = (await refreshRes.json()) as {
              accessToken?: string;
              refreshToken?: string;
            };
            if (typeof refreshed.accessToken === 'string' && typeof refreshed.refreshToken === 'string') {
              token = refreshed.accessToken;
              await AsyncStorage.setItem(
                AUTH_SESSION_KEY,
                JSON.stringify({
                  ...session,
                  accessToken: refreshed.accessToken,
                  refreshToken: refreshed.refreshToken,
                })
              );
              res = await fetch(`${baseUrl}/users/me`, {
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          }
        }

        if (!res.ok) return;
        const me = (await res.json()) as MeResponse;
        if (!me || typeof me.id !== 'string' || typeof me.email !== 'string') return;
        await applyMeToProfile(me, true);
      } catch {
        /* keep local cached profile */
      }
    };

    void fetchMe();
  }, [userCountryCode, profileCacheNonce]);

  useEffect(() => {
    sheetMinimizedRef.current = sheetMinimized;
  }, [sheetMinimized]);

  useEffect(() => {
    if (selectedRide === 'rental' || selectedRide === 'outstation') setSelectedRide('ride');
  }, [selectedRide]);

  useEffect(() => {
    if (userLocation && !toUserEdited) {
      setToQuery(currentLocationLabel);
    }
  }, [userLocation, toUserEdited, currentLocationLabel]);

  useEffect(() => {
    const q = destinationQuery.trim();
    if (!q) {
      setDestinationPreviewCoordinate(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const { key: mapsApiKey } = resolveGoogleMapsApiKey();
        const destination = await resolveLocationQuery(q, mapsApiKey ?? undefined);
        if (!cancelled) setDestinationPreviewCoordinate(destination.coordinate);
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [destinationQuery]);

  useEffect(() => {
    const q = toQuery.trim();
    const normalized = q.toLowerCase();
    const isCurrentFrom =
      !!userLocation &&
      (normalized === 'current location' || normalized === currentLocationLabel.toLowerCase());
    if (!q || isCurrentFrom) {
      setOriginPreviewCoordinate(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const { key: mapsApiKey } = resolveGoogleMapsApiKey();
        const hit = destinationSuggestions.find((s) => s.title.toLowerCase() === normalized)?.coordinate;
        if (hit) {
          if (!cancelled) setOriginPreviewCoordinate(hit);
          return;
        }
        const origin = await resolveLocationQuery(q, mapsApiKey ?? undefined);
        if (!cancelled) setOriginPreviewCoordinate(origin.coordinate);
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [toQuery, userLocation, currentLocationLabel]);

  useEffect(() => {
    const normalizedFrom = toQuery.trim().toLowerCase();
    const isCurrentFrom =
      !!userLocation &&
      (normalizedFrom === 'current location' || normalizedFrom === currentLocationLabel.toLowerCase());
    const destinationNormalized = destinationQuery.trim().toLowerCase();
    const hasBothInputs = !!toQuery.trim() && !!destinationQuery.trim();
    const { key: mapsApiKey, source: mapsApiKeySource } = resolveGoogleMapsApiKey();

    if (!hasBothInputs) {
      setRoadRouteCoords([]);
      setRouteIssue(null);
      setRouteDurationSec(0);
      setRouteDistanceM(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const originResult =
          destinationSuggestions.find(
            s => s.title.toLowerCase() === normalizedFrom,
          )?.coordinate
            ? { coordinate: destinationSuggestions.find(s => s.title.toLowerCase() === normalizedFrom)?.coordinate ?? null }
            : await resolveLocationQuery(toQuery, mapsApiKey ?? undefined);

        const origin =
          (isCurrentFrom ? userLocation : null) ??
          originResult.coordinate;

        const destinationResult =
          destinationSuggestions.find(
            s => s.title.toLowerCase() === destinationNormalized,
          )?.coordinate
            ? {
                coordinate:
                  destinationSuggestions.find(
                    s => s.title.toLowerCase() === destinationNormalized,
                  )?.coordinate ?? null,
              }
            : await resolveLocationQuery(destinationQuery, mapsApiKey ?? undefined);

        const destination = destinationResult.coordinate;

        if (!origin || !destination) {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteEncodedPolyline(null);
            setRouteDurationSec(0);
            setRouteDistanceM(0);
            setRouteIssue(
              `Could not resolve origin/destination. ${originResult.issue ?? ''} ${destinationResult.issue ?? ''}`.trim()
            );
          }
          return;
        }

        if (!mapsApiKey) {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteEncodedPolyline(null);
            setRouteDurationSec(0);
            setRouteDistanceM(0);
            setRouteIssue(
              `Missing Google Maps key for road routing. Checked: env/expoConfig/manifest/manifest2 (found: ${mapsApiKeySource}).`
            );
          }
          return;
        }

        const originParam = `${origin.latitude},${origin.longitude}`;
        const destinationParam = `${destination.latitude},${destination.longitude}`;
        const url =
          `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}` +
          `&destination=${destinationParam}&mode=driving&key=${mapsApiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteEncodedPolyline(null);
            setRouteDurationSec(0);
            setRouteDistanceM(0);
            setRouteIssue(`Directions HTTP ${response.status}`);
          }
          return;
        }
        let data: {
          status?: string;
          error_message?: string;
          routes?: Array<{
            overview_polyline?: { points?: string };
            legs?: Array<{ duration?: { value?: number }; distance?: { value?: number } }>;
          }>;
        };
        try {
          data = (await response.json()) as typeof data;
        } catch {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteEncodedPolyline(null);
            setRouteDurationSec(0);
            setRouteDistanceM(0);
            setRouteIssue('Could not read directions response.');
          }
          return;
        }
        if (data.status !== 'OK') {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteEncodedPolyline(null);
            setRouteDurationSec(0);
            setRouteDistanceM(0);
            setRouteIssue(
              `Directions unavailable (${data.status ?? 'unknown'})${data.error_message ? `: ${data.error_message}` : ''}.`
            );
          }
          return;
        }
        const leg = data.routes?.[0]?.legs?.[0];
        const durationSec = typeof leg?.duration?.value === 'number' ? leg.duration.value : 0;
        const distanceM = typeof leg?.distance?.value === 'number' ? leg.distance.value : 0;
        const encoded = data.routes?.[0]?.overview_polyline?.points;
        if (!cancelled && encoded) {
          const decoded = decodeGooglePolyline(encoded);
          if (decoded.length > 1) {
            setRoadRouteCoords(decoded);
            setRouteEncodedPolyline(encoded);
            setRouteIssue(null);
            setRouteDurationSec(durationSec);
            setRouteDistanceM(distanceM);
          } else if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteEncodedPolyline(null);
            setRouteDurationSec(0);
            setRouteDistanceM(0);
            setRouteIssue('No route geometry returned.');
          }
        } else if (!cancelled) {
          setRoadRouteCoords([]);
          setRouteEncodedPolyline(null);
          setRouteDurationSec(0);
          setRouteDistanceM(0);
          setRouteIssue('No route geometry returned.');
        }
      } catch (err) {
        if (!cancelled) {
          setRoadRouteCoords([]);
          setRouteEncodedPolyline(null);
          setRouteDurationSec(0);
          setRouteDistanceM(0);
          setRouteIssue(`Failed to fetch road directions: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toQuery, destinationQuery, userLocation, currentLocationLabel]);

  useEffect(() => {
    if (!findingDriverVisible || findingDriverPhase !== 'searching') return;
    const timeoutT = setTimeout(() => setFindingDriverPhase('no_driver_found'), 11000);
    return () => clearTimeout(timeoutT);
  }, [findingDriverVisible, findingDriverPhase]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(ACTIVE_TRIP_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsedRaw = JSON.parse(raw) as ActiveTripState & { bookedFor?: 'self' | 'friend'; status?: TripStatus };
        const parsed: ActiveTripState = {
          ...parsedRaw,
          bookedFor: parsedRaw.bookedFor === 'friend' ? 'friend' : 'self',
          status: parsedRaw.status ?? 'in_trip',
        };
        if (parsed.expiresAtMs > Date.now()) {
          setActiveTrip(parsed);
        } else {
          await AsyncStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
        }
      } catch {
        await AsyncStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(BOOKED_RIDES_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Array<BookedRideRecord & { bookedFor?: 'self' | 'friend'; status?: TripStatus }>;
        if (!Array.isArray(parsed)) return;
        setBookedRides(
          parsed
            .filter((r) => !!r?.id)
            .map((r) => ({
              ...r,
              bookedFor: r.bookedFor === 'friend' ? 'friend' : 'self',
              status: r.status ?? (r.completedAtMs ? 'completed' : r.cancelledAtMs ? 'cancelled' : 'in_trip'),
            }))
        );
      } catch {
        await AsyncStorage.removeItem(BOOKED_RIDES_STORAGE_KEY);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeTrip) return;
    if (activeTrip.expiresAtMs > nowMs) return;
    setActiveTrip(null);
    if (screen === 'activeRide') setScreen('home');
    void AsyncStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
  }, [activeTrip, nowMs, screen]);

  const onRefreshMain = useCallback(() => {
    setRefreshingMain(true);
    void (async () => {
      try {
        const [tripRaw, bookedRaw] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_TRIP_STORAGE_KEY),
          AsyncStorage.getItem(BOOKED_RIDES_STORAGE_KEY),
        ]);
        if (tripRaw) {
          const parsedRaw = JSON.parse(tripRaw) as ActiveTripState & { bookedFor?: 'self' | 'friend'; status?: TripStatus };
          const parsed: ActiveTripState = {
            ...parsedRaw,
            bookedFor: parsedRaw.bookedFor === 'friend' ? 'friend' : 'self',
            status: parsedRaw.status ?? 'in_trip',
          };
          if (parsed.expiresAtMs > Date.now()) setActiveTrip(parsed);
        }
        if (bookedRaw) {
          const parsed = JSON.parse(bookedRaw) as Array<BookedRideRecord & { bookedFor?: 'self' | 'friend'; status?: TripStatus }>;
          if (Array.isArray(parsed)) {
            setBookedRides(
              parsed
                .filter((r) => !!r?.id)
                .map((r) => ({
                  ...r,
                  bookedFor: r.bookedFor === 'friend' ? 'friend' : 'self',
                  status: r.status ?? (r.completedAtMs ? 'completed' : r.cancelledAtMs ? 'cancelled' : 'in_trip'),
                }))
            );
          }
        }
      } catch {
        // no-op refresh fallback
      } finally {
        setTimeout(() => setRefreshingMain(false), 500);
      }
    })();
  }, []);

  const saveAddress = async () => {
    if (!addressModal) return;
    if (addressModal === 'home') {
      setHomeAddress(addressInput);
      await AsyncStorage.setItem('address_home', addressInput);
    } else {
      setWorkAddress(addressInput);
      await AsyncStorage.setItem('address_work', addressInput);
    }
    setAddressModal(null);
    setAddressInput('');
  };

  const displayName = userFirstName.trim() || 'Ridr';
  const shortUserId = userId.trim() ? userId.trim().slice(0, 5) : '';
  const ui = useMemo(
    () => ({
      screenBg: colors.background,
      panelBg: colors.surface,
      cardBg: colors.card,
      softBg: colors.softBg,
      text: colors.text,
      textMuted: colors.textMuted,
      divider: colors.border,
      placeholder: colors.textPlaceholder,
      headerOverlay: colors.headerOverlay,
      tabActive: colors.tabActive,
      tabInactive: colors.tabInactive,
      ctaBg: colors.primary,
      ctaText: colors.textOnPrimary,
      success: colors.success,
      successContainer: colors.successContainer,
      danger: colors.danger,
      buttonDisabled: colors.buttonDisabled,
    }),
    [colors]
  );
  const estimatedFareUsd = useMemo(
    () => estimateFareUsd(routeDistanceM, routeDurationSec),
    [routeDistanceM, routeDurationSec]
  );
  const rideEtaLabel =
    routeDurationSec > 0 ? `${Math.max(1, Math.round(routeDurationSec / 60))} min` : '—';
  const rideFareLabel = backendFareLabel ?? `$${estimatedFareUsd.toFixed(2)}`;
  const savedPlacesSummary =
    savedPlaces.length > 0
      ? savedPlaces
          .map((p) => (p.title ?? p.address ?? p.label ?? p.type ?? '').trim())
          .filter(Boolean)
          .join(', ')
      : '—';

  const saveProfile = async () => {
    const first = editingFirstName.trim();
    const last = editingLastName.trim();
    const natDigits = editingPhone.replace(/\D/g, '');
    const email = editingEmail.trim();
    const username = editingUsername.trim();

    setUserFirstName(first);
    setUserLastName(last);
    await AsyncStorage.setItem('profile_first_name', first);
    await AsyncStorage.setItem('profile_last_name', last);
    await AsyncStorage.removeItem('profile_name');

    if (!natDigits) {
      if (userPhoneE164) await releaseE164(userPhoneE164);
      setUserPhone('');
      setUserPhoneE164(null);
      setUserCountryCode(countryCode);
      await AsyncStorage.removeItem('profile_phone_e164');
      await AsyncStorage.setItem('profile_phone', '');
      await AsyncStorage.setItem('profile_country_code', countryCode);
    } else {
      const phoneResult = validateToE164(countryCode, natDigits);
      if (!phoneResult.ok) {
        Alert.alert('Phone number', phoneResult.error);
        return;
      }

      const reserved = await reserveE164(phoneResult.e164, userPhoneE164);
      if (!reserved.ok) {
        Alert.alert('Phone number', reserved.error);
        return;
      }

      setUserPhone(natDigits);
      setUserPhoneE164(phoneResult.e164);
      setUserCountryCode(countryCode);
      await AsyncStorage.setItem('profile_phone', natDigits);
      await AsyncStorage.setItem('profile_phone_e164', phoneResult.e164);
      await AsyncStorage.setItem('profile_country_code', countryCode);
    }

    setUserEmail(email);
    await AsyncStorage.setItem('profile_email', email);
    setUserUsername(username);
    await AsyncStorage.setItem('profile_username', username);
    setEditingPassword('');
    setScreen('profile');
  };

  const phoneDirty = (() => {
    const natEdit = editingPhone.replace(/\D/g, '');
    const natUser = userPhone.replace(/\D/g, '');
    if (countryCode !== userCountryCode) return true;
    if (natEdit !== natUser) return true;
    if (!natEdit && !userPhoneE164) return false;
    if (!natEdit && userPhoneE164) return true;
    const r = validateToE164(countryCode, natEdit);
    if (!r.ok) return natEdit.length > 0;
    return r.e164 !== userPhoneE164;
  })();

  const profileDirty =
    editingFirstName.trim() !== userFirstName ||
    editingLastName.trim() !== userLastName ||
    phoneDirty ||
    editingEmail.trim() !== userEmail ||
    editingUsername.trim() !== userUsername ||
    editingPassword.length > 0;

  const syncEditingFromUser = () => {
    setEditingFirstName(userFirstName);
    setEditingLastName(userLastName);
    setEditingPhone(userPhone);
    setCountryCode(userCountryCode);
    setEditingEmail(userEmail);
    setEditingUsername(userUsername);
    setEditingPassword('');
  };

  const openProfile = () => {
    syncEditingFromUser();
    setScreen('profile');
  };

  const openProfileEdit = () => {
    syncEditingFromUser();
    setScreen('profileEdit');
  };

  const onConfirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ]
    );
  };

  const openAddress = (type: 'home' | 'work') => {
    setAddressInput(type === 'home' ? homeAddress : workAddress);
    setAddressModal(type);
  };

  const handleAddressTap = (type: 'home' | 'work') => {
    const addr = type === 'home' ? homeAddress : workAddress;
    if (addr) {
      setBookAddressModal(type);
    } else {
      openAddress(type);
    }
  };

  const closeAddCardSheet = () => {
    setAddCardVisible(false);
    setNewCardNumber('');
    setNewCardName('');
    setNewCardExpiry('');
    setNewCardCvv('');
  };

  const saveNewCard = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save a payment method.');
      return;
    }
    const digits = newCardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      Alert.alert('Invalid card number', 'Enter the full number on your card.');
      return;
    }
    const exp = newCardExpiry.trim();
    if (!/^\d{2}\/\d{2}$/.test(exp)) {
      Alert.alert('Invalid expiry', 'Use MM/YY (e.g. 08/27).');
      return;
    }
    const cvv = newCardCvv.replace(/\D/g, '');
    if (cvv.length < 3 || cvv.length > 4) {
      Alert.alert('Invalid CVV', 'Enter the 3 or 4 digit security code.');
      return;
    }
    const [mm, yy] = exp.split('/');
    const expiryMonth = mm.padStart(2, '0');
    const expiryYear = `20${yy}`;
    const first = digits[0];
    const brand = first === '5' ? 'Mastercard' : 'Visa';
    const token =
      (typeof process.env.EXPO_PUBLIC_PAYMENT_DEV_TOKEN === 'string' &&
        process.env.EXPO_PUBLIC_PAYMENT_DEV_TOKEN.trim()) ||
      'dev_powertranz_spi_placeholder';
    try {
      await createPaymentMethod({
        provider: 'powertranz',
        token,
        last4: digits.slice(-4),
        brand,
        expiryMonth,
        expiryYear,
        isDefault: cards.length === 0,
      });
      await refreshPaymentMethods();
      closeAddCardSheet();
    } catch (e) {
      Alert.alert('Could not save card', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const toNormalized = toQuery.trim().toLowerCase();
  const isCurrentLocationQuery =
    !!userLocation &&
    (toNormalized === 'current location' || toNormalized === currentLocationLabel.toLowerCase());
  const pickupCoordinate = roadRouteCoords.length > 0 ? roadRouteCoords[0] : null;
  const dropoffCoordinate =
    roadRouteCoords.length > 0 ? roadRouteCoords[roadRouteCoords.length - 1] : null;
  const hasRouteInputs = !!toQuery.trim() && !!destinationQuery.trim();
  const hasRoute = hasRouteInputs && roadRouteCoords.length > 1;

  useEffect(() => {
    if (!user || !hasRoute || !pickupCoordinate || !dropoffCoordinate || routeDistanceM < 1 || routeDurationSec < 1) {
      setBackendFareLabel(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const distanceKm = Math.max(0.01, routeDistanceM / 1000);
          const durationMinutes = Math.max(1, Math.round(routeDurationSec / 60));
          const estimateRequestBody = buildKingstonZoneFareEstimateBody({
            pickup: {
              address: toQuery.trim(),
              lat: pickupCoordinate.latitude,
              lng: pickupCoordinate.longitude,
            },
            dropoff: {
              address: destinationQuery.trim(),
              lat: dropoffCoordinate.latitude,
              lng: dropoffCoordinate.longitude,
            },
            distanceKm,
            durationMinutes,
            insurance: false,
          });
          const res = await postFareEstimate(estimateRequestBody);
          if (cancelled) return;
          const fare = res.estimatedFare ?? res.total ?? res.pricing?.estimatedFare ?? 0;
          const cur = res.currency ?? res.pricing?.currency ?? 'JMD';
          if (cur === 'JMD') {
            setBackendFareLabel(
              `J$${Number(fare).toLocaleString('en-JM', { maximumFractionDigits: 0 })}`
            );
          } else {
            setBackendFareLabel(`$${Number(fare).toFixed(2)}`);
          }
        } catch {
          if (!cancelled) setBackendFareLabel(null);
        }
      })();
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    user,
    hasRoute,
    pickupCoordinate,
    dropoffCoordinate,
    routeDistanceM,
    routeDurationSec,
    toQuery,
    destinationQuery,
  ]);

  const latestBookedRide =
    bookedRides.find(
      (r) =>
        r.expiresAtMs > nowMs &&
        r.status !== 'completed' &&
        r.status !== 'cancelled'
    ) ?? null;
  const presentRide =
    (activeTrip && activeTrip.expiresAtMs > nowMs ? activeTrip : null) ??
    latestBookedRide;
  const startFindingDriver = (forWhom: 'self' | 'friend') => {
    if (!hasRoute || routeIssue) {
      Alert.alert('Route required', 'Enter pickup and destination and wait for the route to load.');
      return;
    }
    if (!pickupCoordinate || !dropoffCoordinate) {
      Alert.alert('Route required', 'Could not determine pickup and drop-off points.');
      return;
    }
    noDriversNearbyDialogShownRef.current = false;
    setBookingFor(forWhom);
    setFindingDriverPhase('searching');
    setFindingDriverVisible(true);
  };
  const openFindingDriver = () => {
    if (presentRide) {
      Alert.alert(
        'Existing ride found',
        'Book this next ride for yourself or a friend?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Myself', onPress: () => startFindingDriver('self') },
          { text: 'A friend', onPress: () => startFindingDriver('friend') },
        ]
      );
      return;
    }
    startFindingDriver('self');
  };
  const confirmRideRequest = async () => {
    if (!pickupCoordinate || !dropoffCoordinate || roadRouteCoords.length < 2) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to request a ride.');
      return;
    }

    setRideRequestSubmitting(true);
    try {
      const bookedAtMs = Date.now();
      const sessionId = `sess_${bookedAtMs.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      const distanceKm = Math.max(0.1, routeDistanceM / 1000);
      const durationMinutes = Math.max(1, Math.round(routeDurationSec / 60) || 1);
      const driverCoord = interpolateRoutePoint(roadRouteCoords, 0.22) ?? pickupCoordinate;

      const createRideInput = {
        sessionId,
        serviceArea: 'JM',
        bookedFor: bookingFor,
        pickup: {
          address: toQuery.trim(),
          lat: pickupCoordinate.latitude,
          lng: pickupCoordinate.longitude,
        },
        dropoff: {
          address: destinationQuery.trim(),
          lat: dropoffCoordinate.latitude,
          lng: dropoffCoordinate.longitude,
        },
        route: routeEncodedPolyline
          ? {
              encodedPolyline: routeEncodedPolyline,
              distanceMeters: routeDistanceM,
              durationSeconds: routeDurationSec,
            }
          : undefined,
        distanceKm,
        durationMinutes,
        immediate: true,
        payment: {
          method: (selectedPaymentLabel === 'Cash' ? 'cash' : 'card') as 'card' | 'cash',
          label: selectedPaymentLabel,
          ...(selectedPaymentLabel === 'Card' && defaultCard
            ? { paymentMethodId: defaultCard }
            : {}),
        },
        metadata: {
          platform: Platform.OS,
          appVersion: Constants.expoConfig?.version ?? '1.0.0',
        },
      };
      const { rideRequest } = await createImmediateRide(createRideInput);

      const nextTrip = buildActiveTripFromCreateResponse(rideRequest, {
        bookedFor: bookingFor,
        routeCoords: roadRouteCoords,
        driverCoordinate: driverCoord,
        etaMinutes: durationMinutes,
        bookedAtMs,
        ttlMs: ACTIVE_TRIP_TTL_MS,
        paymentLabel: selectedPaymentLabel,
      });

      setActiveTrip(nextTrip);
      setBookedRides((prev) => {
        const next = [nextTrip, ...prev.filter((r) => r.id !== nextTrip.id)].slice(0, 30);
        void AsyncStorage.setItem(BOOKED_RIDES_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      void AsyncStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify(nextTrip));
      setFindingDriverVisible(false);
      setFindingDriverPhase('searching');
      setBookingFor('self');
      {
        const canCard =
          cards.length > 0 &&
          defaultCard != null &&
          cards.some((c) => c.id === defaultCard);
        setSelectedPaymentLabel(canCard ? 'Card' : 'Cash');
      }
      setScreen('activeRide');
    } catch (e) {
      Alert.alert('Could not request ride', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRideRequestSubmitting(false);
    }
  };
  const closeFindingDriver = useCallback(() => {
    setFindingDriverVisible(false);
    setFindingDriverPhase('searching');
    setBookingFor('self');
    const canCard =
      cards.length > 0 &&
      defaultCard != null &&
      cards.some((c) => c.id === defaultCard);
    setSelectedPaymentLabel(canCard ? 'Card' : 'Cash');
  }, [cards, defaultCard]);
  const retryFindingDriver = () => {
    noDriversNearbyDialogShownRef.current = false;
    setFindingDriverPhase('searching');
  };

  useEffect(() => {
    if (!findingDriverVisible || findingDriverPhase !== 'searching' || !pickupCoordinate) return;

    let cancelled = false;
    const runNearbyCheck = async () => {
      if (cancelled) return;
      try {
        const raw = await getNearbyDrivers({
          lat: pickupCoordinate.latitude,
          lng: pickupCoordinate.longitude,
          radiusKm: 5,
        });
        if (cancelled) return;
        const n = countDriversInNearbyResponse(raw);
        if (n === null) return;
        if (n > 0) {
          setFindingDriverPhase('readySwipe');
          return;
        }
        if (n === 0 && !noDriversNearbyDialogShownRef.current) {
          noDriversNearbyDialogShownRef.current = true;
          Alert.alert(
            'No drivers nearby',
            'No drivers found in your area. Keep searching?',
            [
              { text: 'No', style: 'cancel', onPress: () => closeFindingDriver() },
              { text: 'Yes', style: 'default', onPress: () => {} },
            ]
          );
        }
      } catch {
        /* signed out, network, or API error — do not block matching */
      }
    };

    const initial = setTimeout(runNearbyCheck, 1000);
    const interval = setInterval(runNearbyCheck, 6000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [findingDriverVisible, findingDriverPhase, pickupCoordinate, closeFindingDriver]);

  const persistTripRecord = (trip: ActiveTripState) => {
    setBookedRides((prev) => {
      const next = [trip, ...prev.filter((r) => r.id !== trip.id)].slice(0, 40);
      void AsyncStorage.setItem(BOOKED_RIDES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      setActiveTrip(null);
      void AsyncStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
    } else {
      setActiveTrip(trip);
      void AsyncStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify(trip));
    }
  };
  const updateActiveTripStatus = (status: TripStatus) => {
    if (!activeTrip) return;
    const now = Date.now();
    const next: ActiveTripState = {
      ...activeTrip,
      status,
      startedAtMs: status === 'in_trip' ? (activeTrip.startedAtMs ?? now) : activeTrip.startedAtMs,
      completedAtMs: status === 'completed' ? now : activeTrip.completedAtMs,
    };
    persistTripRecord(next);
  };
  const completeActiveTrip = (rating: number, tipAmount: number) => {
    if (!activeTrip) return;
    const now = Date.now();
    const durationMin = Math.max(1, Math.round((activeTrip.etaMinutes * 60) / 60));
    const distanceKm = Math.max(1, routeDistanceM / 1000 || 1);
    const baseFare = Number(activeTrip.fareUsd.toFixed(2));
    const fees = Number((baseFare * 0.08).toFixed(2));
    const totalFare = Number((baseFare + fees + tipAmount).toFixed(2));
    const next: ActiveTripState = {
      ...activeTrip,
      status: 'completed',
      completedAtMs: now,
      durationMin,
      distanceKm,
      baseFare,
      fees,
      totalFare,
      rating,
      tipAmount,
    };
    persistTripRecord(next);
    Alert.alert(
      'Trip completed',
      `Fare: $${totalFare.toFixed(2)}\nRating: ${rating}/5\nTip: $${tipAmount.toFixed(2)}`
    );
    setScreen('home');
  };
  const leaveActiveRideScreen = () => {
    setScreen('home');
  };
  const openBookedRideFromActivity = (ride: BookedRideRecord) => {
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      Alert.alert(
        ride.status === 'completed' ? 'Trip completed' : 'Trip cancelled',
        `${ride.fromLabel} → ${ride.toLabel}\nFare: $${(ride.totalFare ?? ride.fareUsd).toFixed(2)}`
      );
      return;
    }
    if (ride.expiresAtMs <= Date.now()) {
      Alert.alert('Ride expired', 'This booked ride is no longer active.');
      return;
    }
    setActiveTrip(ride);
    setScreen('activeRide');
  };
  const showCurrentLocationPin = !hasRoute && isCurrentLocationQuery && !!userLocation;

  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'driver_arriving') return;
    const tArrived = setTimeout(() => updateActiveTripStatus('arrived'), 15000);
    return () => clearTimeout(tArrived);
  }, [activeTrip?.id, activeTrip?.status]);
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'arrived') return;
    const tInTrip = setTimeout(() => updateActiveTripStatus('in_trip'), 8000);
    return () => clearTimeout(tInTrip);
  }, [activeTrip?.id, activeTrip?.status]);
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'in_trip') return;
    const autoCompleteMs = Math.max(30000, activeTrip.etaMinutes * 1000);
    const tComplete = setTimeout(() => {
      completeActiveTrip(5, 0);
    }, autoCompleteMs);
    return () => clearTimeout(tComplete);
  }, [activeTrip?.id, activeTrip?.status, activeTrip?.etaMinutes]);

  useEffect(() => {
    const id = activeTrip?.serverRideRequestId;
    if (
      !id ||
      activeTrip?.status === 'completed' ||
      activeTrip?.status === 'cancelled'
    ) {
      return;
    }

    const poll = async () => {
      try {
        const { rideRequest } = await getRideRequestById(id);
        setActiveTrip((prev) => {
          if (!prev || prev.serverRideRequestId !== id) return prev;
          const merged = mergePollRideRequest(prev, rideRequest);
          void AsyncStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      } catch {
        /* transient network errors */
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, 10000);
    void poll();
    return () => clearInterval(interval);
  }, [activeTrip?.serverRideRequestId, activeTrip?.status]);

  const showOriginTextPin = !hasRoute && !isCurrentLocationQuery && !!originPreviewCoordinate;
  const showDestPreviewPin = !hasRoute && !!destinationPreviewCoordinate;

  useEffect(() => {
    if (!hasRoute) {
      setRouteAnimatorPoint(null);
      return;
    }

    let raf = 0;
    const startedAt = Date.now();
    const durationMs = 6000;

    const tick = () => {
      const elapsed = (Date.now() - startedAt) % durationMs;
      const progress = elapsed / durationMs;
      setRouteAnimatorPoint(interpolateRoutePoint(roadRouteCoords, progress));
      raf = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasRoute, roadRouteCoords]);

  const MAP_ANIMATE_DELTA = { latitudeDelta: 0.022, longitudeDelta: 0.022 };

  useEffect(() => {
    const map = mapViewRef.current;
    if (!map) return;

    if (hasRoute && roadRouteCoords.length > 1) {
      const rafId = requestAnimationFrame(() => {
        try {
          map.fitToCoordinates(roadRouteCoords, {
            edgePadding: { top: 90, right: 44, bottom: 300, left: 44 },
            animated: true,
          });
        } catch {
          /* fitToCoordinates can throw if coords invalid */
        }
      });
      return () => cancelAnimationFrame(rafId);
    }

    const target =
      destinationPreviewCoordinate ??
      originPreviewCoordinate ??
      (isCurrentLocationQuery ? userLocation : null) ??
      userLocation;

    if (!target) return;

    const rafId = requestAnimationFrame(() => {
      try {
        map.animateToRegion(
          {
            latitude: target.latitude,
            longitude: target.longitude,
            ...MAP_ANIMATE_DELTA,
          },
          400
        );
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    destinationPreviewCoordinate?.latitude,
    destinationPreviewCoordinate?.longitude,
    originPreviewCoordinate?.latitude,
    originPreviewCoordinate?.longitude,
    hasRoute,
    roadRouteCoords,
    isCurrentLocationQuery,
    userLocation?.latitude,
    userLocation?.longitude,
  ]);

  const fetchPlaceSuggestions = useCallback(
    async (input: string): Promise<SearchSuggestion[]> => {
      const query = input.trim();
      if (!query) return [];
      if (parseLatLngFromString(query)) return [];

      const { key } = resolveGoogleMapsApiKey();
      if (!key) return [];

      const ksaBias =
        `&location=${KSA_MAP_CENTER.latitude},${KSA_MAP_CENTER.longitude}` +
        `&radius=22000&strictbounds=true`;
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}` +
        `&key=${key}&language=en&components=country:jm${ksaBias}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      let data: {
        status?: string;
        predictions?: Array<{
          place_id?: string;
          description?: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }>;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        return [];
      }
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
      const rows = Array.isArray(data.predictions) ? data.predictions : [];

      return rows.slice(0, 8).map((p, i) => {
        const title = p.structured_formatting?.main_text?.trim() || p.description?.split(',')[0]?.trim() || query;
        const subtitle = p.structured_formatting?.secondary_text?.trim() || p.description?.trim() || '';
        return {
          id: p.place_id || `place-${title}-${i}`,
          placeId: p.place_id,
          title,
          subtitle,
          icon: 'location',
          fullText: p.description?.trim() || `${title}${subtitle ? `, ${subtitle}` : ''}`,
        };
      });
    },
    []
  );

  useEffect(() => {
    if (!toFocused || !toQuery.trim()) {
      setToApiSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchPlaceSuggestions(toQuery)
        .then((rows) => {
          if (!cancelled) setToApiSuggestions(rows);
        })
        .catch(() => {
          if (!cancelled) setToApiSuggestions([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [toFocused, toQuery, fetchPlaceSuggestions]);

  useEffect(() => {
    if (!destinationFocused || !destinationQuery.trim()) {
      setDestinationApiSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchPlaceSuggestions(destinationQuery)
        .then((rows) => {
          if (!cancelled) setDestinationApiSuggestions(rows);
        })
        .catch(() => {
          if (!cancelled) setDestinationApiSuggestions([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [destinationFocused, destinationQuery, fetchPlaceSuggestions]);

  const panValue = useRef(new Animated.Value(0)).current;
  const minimizedTranslateY = useRef(new Animated.Value(0)).current;
  /** 1 = From/Where-to focused — sheet expands to cover the map. */
  const sheetFocusAnim = useRef(new Animated.Value(0)).current;
  const driverPosAnim = useRef(new Animated.Value(0)).current;
  const driverPosRef = useRef(0);
  const driverRafRef = useRef<number | null>(null);
  const driverDragStartPos = useRef(0);
  const scrollOffsetRef = useRef(0);

  const DRIVER_CARD_WIDTH = 162;
  const DRIVER_TOTAL = mockTopDrivers.length * DRIVER_CARD_WIDTH;

  const stopDriverRaf = useCallback(() => {
    if (driverRafRef.current !== null) {
      cancelAnimationFrame(driverRafRef.current);
      driverRafRef.current = null;
    }
  }, []);

  const startDriverRaf = useCallback(() => {
    stopDriverRaf();
    const tick = () => {
      driverPosRef.current -= 0.5;
      if (driverPosRef.current <= -DRIVER_TOTAL) driverPosRef.current = 0;
      driverPosAnim.setValue(driverPosRef.current);
      driverRafRef.current = requestAnimationFrame(tick);
    };
    driverRafRef.current = requestAnimationFrame(tick);
  }, []);

  const driverPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        stopDriverRaf();
        driverDragStartPos.current = driverPosRef.current;
      },
      onPanResponderMove: (_, g) => {
        let next = driverDragStartPos.current + g.dx;
        if (next > 0) next = 0;
        if (next < -DRIVER_TOTAL * 2) next = -DRIVER_TOTAL * 2;
        driverPosRef.current = next;
        driverPosAnim.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        let pos = driverPosRef.current;
        // add a bit of momentum
        pos += g.vx * 80;
        if (pos > 0) pos = 0;
        if (pos <= -DRIVER_TOTAL) pos = pos % -DRIVER_TOTAL;
        driverPosRef.current = pos;
        driverPosAnim.setValue(pos);
        setTimeout(startDriverRaf, 1500);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  useEffect(() => {
    startDriverRaf();
    return stopDriverRaf;
  }, []);
  const searchSuggestions: SearchSuggestion[] = useMemo(
    () =>
      [
        ...(homeAddress ? [{ id: 'saved-home', title: 'Home', subtitle: homeAddress, icon: 'home' as const }] : []),
        ...(workAddress ? [{ id: 'saved-work', title: 'Work', subtitle: workAddress, icon: 'briefcase' as const }] : []),
        ...destinationSuggestions.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          icon: s.icon,
          fullText: `${s.title}, ${s.subtitle}`,
          coordinate: s.coordinate,
        })),
      ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index),
    [homeAddress, workAddress]
  );

  const fallbackDestinationSuggestions = searchSuggestions
    .filter((item) => {
      if (!destinationQuery.trim()) return true;
      const query = destinationQuery.trim().toLowerCase();
      return item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query);
    })
    .slice(0, destinationQuery.trim() ? 5 : 4);

  const fallbackToSuggestions = searchSuggestions
    .filter((item) => {
      if (!toQuery.trim()) return true;
      const query = toQuery.trim().toLowerCase();
      return item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query);
    })
    .slice(0, toQuery.trim() ? 5 : 4);

  const filteredSuggestions =
    destinationFocused && destinationQuery.trim() && destinationApiSuggestions.length > 0
      ? destinationApiSuggestions
      : fallbackDestinationSuggestions;

  const filteredToSuggestions =
    toFocused && toQuery.trim() && toApiSuggestions.length > 0
      ? toApiSuggestions
      : fallbackToSuggestions;

  const sheetMinimizeRange = Math.max(SHEET_MINIMIZED_OFFSET, 1);
  /** Sheet up → shorter map; sheet lowered → map uses full window (no dead strip). */
  /** Map height tracks sheet minimize/expand only. Do not multiply by search-focus — that breaks MapView tiles when the sheet moves. The fullscreen search sheet covers the map instead. */
  const minimizedMapH = useMemo(
    () =>
      minimizedTranslateY.interpolate({
        inputRange: [0, sheetMinimizeRange],
        outputRange: [MAP_HEIGHT, SCREEN_HEIGHT],
        extrapolate: 'clamp',
      }),
    [minimizedTranslateY, sheetMinimizeRange]
  );
  const sheetTopAnim = sheetFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [MAP_HEIGHT - 30, SHEET_FOCUS_TOP],
  });
  const sheetMaxHeightAnim = sheetFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BOTTOM_SHEET_HEIGHT, BOTTOM_SHEET_FULLSCREEN_HEIGHT],
  });
  const sheetTopRadiusAnim = sheetFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  /** Hides the floating app bar when the bottom sheet is dragged down (minimized). */
  const headerAppBarOpacity = minimizedTranslateY.interpolate({
    inputRange: [0, sheetMinimizeRange],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const expandSheetFromMinimized = () => {
    setSheetMinimized(false);
    Animated.spring(minimizedTranslateY, {
      toValue: 0,
      useNativeDriver: false,
      friction: 9,
      tension: 70,
    }).start();
  };

  const collapseSearchMode = () => {
    destinationFocusedRef.current = false;
    toFocusedRef.current = false;
    setDestinationFocused(false);
    setToFocused(false);
    destinationInputRef.current?.blur();
    toInputRef.current?.blur();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (sheetMinimizedRef.current) {
          return gs.dy < -8 && Math.abs(gs.dy) > Math.abs(gs.dx);
        }
        return scrollOffsetRef.current <= 0 && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      // Capture must stay false so taps reach Pressables inside the sheet (e.g. place suggestions).
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gs) => {
        if (sheetMinimizedRef.current) return;
        if (gs.dy > 0) panValue.setValue(gs.dy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gs) => {
        if (sheetMinimizedRef.current) {
          if (gs.dy < -40 || gs.vy < -0.35) {
            expandSheetFromMinimized();
          }
          return;
        }
        if (gs.dy > 120 || gs.vy > 0.5) {
          panValue.setValue(0);
          setDestinationFocused(false);
          destinationFocusedRef.current = false;
          setToFocused(false);
          toFocusedRef.current = false;
          toInputRef.current?.blur();
          destinationInputRef.current?.blur();
          setSheetMinimized(true);
          Animated.spring(minimizedTranslateY, {
            toValue: SHEET_MINIMIZED_OFFSET,
            useNativeDriver: false,
            friction: 9,
            tension: 70,
          }).start();
        } else {
          Animated.spring(panValue, {
            toValue: 0,
            useNativeDriver: false,
            friction: 9,
            tension: 70,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    const focused = toFocused || destinationFocused;
    Animated.spring(sheetFocusAnim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: false,
      friction: 9,
      tension: 70,
    }).start();
  }, [toFocused, destinationFocused, sheetFocusAnim]);

  const handleDestinationFocus = () => {
    if (sheetMinimized) {
      expandSheetFromMinimized();
    }
    Animated.spring(panValue, {
      toValue: 0,
      useNativeDriver: false,
      friction: 9,
      tension: 70,
    }).start();
    destinationFocusedRef.current = true;
    setDestinationFocused(true);
  };

  const handleDestinationBlur = () => {
    if (destinationBlurTimerRef.current) clearTimeout(destinationBlurTimerRef.current);
    destinationBlurTimerRef.current = setTimeout(() => {
      destinationBlurTimerRef.current = null;
      destinationFocusedRef.current = false;
      setDestinationFocused(false);
    }, 220);
  };

  const handleToFocus = () => {
    if (sheetMinimized) {
      expandSheetFromMinimized();
    }
    Animated.spring(panValue, {
      toValue: 0,
      useNativeDriver: false,
      friction: 9,
      tension: 70,
    }).start();
    toFocusedRef.current = true;
    setToFocused(true);
  };

  const handleToBlur = () => {
    if (toBlurTimerRef.current) clearTimeout(toBlurTimerRef.current);
    toBlurTimerRef.current = setTimeout(() => {
      toBlurTimerRef.current = null;
      toFocusedRef.current = false;
      setToFocused(false);
    }, 220);
  };

  const selectDestination = (item: SearchSuggestion) => {
    if (destinationBlurTimerRef.current) {
      clearTimeout(destinationBlurTimerRef.current);
      destinationBlurTimerRef.current = null;
    }
    const v = (item.fullText ?? [item.title, item.subtitle].filter(Boolean).join(', ')).trim();
    if (v) setDestinationQuery(v);
    destinationFocusedRef.current = false;
    setDestinationFocused(false);
    destinationInputRef.current?.blur();

    if (item.coordinate && isInJamaicaServiceArea(item.coordinate)) {
      setDestinationPreviewCoordinate(item.coordinate);
      return;
    }
    const { key } = resolveGoogleMapsApiKey();
    if (item.placeId && key) {
      void fetchPlaceDetailsCoordinate(item.placeId, key).then((res) => {
        if (res.coordinate && isInJamaicaServiceArea(res.coordinate)) {
          setDestinationPreviewCoordinate(res.coordinate);
        }
      });
    }
  };

  const selectTo = (item: SearchSuggestion) => {
    if (toBlurTimerRef.current) {
      clearTimeout(toBlurTimerRef.current);
      toBlurTimerRef.current = null;
    }
    const v = (item.fullText ?? [item.title, item.subtitle].filter(Boolean).join(', ')).trim();
    if (v) {
      setToUserEdited(true);
      setToQuery(v);
    }
    toFocusedRef.current = false;
    setToFocused(false);
    toInputRef.current?.blur();

    if (item.coordinate && isInJamaicaServiceArea(item.coordinate)) {
      setOriginPreviewCoordinate(item.coordinate);
      return;
    }
    const { key } = resolveGoogleMapsApiKey();
    if (item.placeId && key) {
      void fetchPlaceDetailsCoordinate(item.placeId, key).then((res) => {
        if (res.coordinate && isInJamaicaServiceArea(res.coordinate)) {
          setOriginPreviewCoordinate(res.coordinate);
        }
      });
    }
  };

  const applyMapLocationAsFrom = (label: string) => {
    const coord = mapLocationActionRef.current?.coordinate;
    setToUserEdited(true);
    setToQuery(label);
    if (coord && isInJamaicaServiceArea(coord)) {
      setOriginPreviewCoordinate(coord);
    }
    setMapLocationAction(null);
  };

  const applyMapLocationAsTo = (label: string) => {
    const coord = mapLocationActionRef.current?.coordinate;
    setDestinationQuery(label);
    if (coord && isInJamaicaServiceArea(coord)) {
      setDestinationPreviewCoordinate(coord);
    }
    setMapLocationAction(null);
  };

  applyMapFromRef.current = applyMapLocationAsFrom;
  applyMapToRef.current = applyMapLocationAsTo;

  const mapRadialPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => mapLocationActionRef.current !== null,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const a = mapLocationActionRef.current?.anchorScreen;
          if (!a) {
            mapRadialStartNearAnchor.current = false;
            return;
          }
          const { pageX, pageY } = e.nativeEvent;
          mapRadialStartNearAnchor.current =
            Math.hypot(pageX - a.x, pageY - a.y) < MAP_RADIAL_DRAG_ANCHOR_RADIUS;
        },
        onPanResponderMove: (_, g) => {
          if (!mapRadialStartNearAnchor.current) return;
          if (Math.hypot(g.dx, g.dy) >= MAP_RADIAL_REVEAL_DISTANCE) {
            setMapLocationAction((prev) =>
              prev && !prev.radialRevealed ? { ...prev, radialRevealed: true } : prev
            );
          }
        },
        onPanResponderRelease: (e) => {
          const prev = mapLocationActionRef.current;
          if (!prev?.anchorScreen) return;
          const { pageX, pageY } = e.nativeEvent;
          // Before icons are shown, a tap away from the pin dismisses. After they are shown, taps on
          // From/To start far from the pin — do not require "start near anchor" or a tap would dismiss.
          if (!mapRadialStartNearAnchor.current && !prev.radialRevealed) {
            setMapLocationAction(null);
            return;
          }
          if (prev.resolving) {
            mapRadialStartNearAnchor.current = false;
            return;
          }
          const { fromCenter, toCenter } = getRadialFabCenters(prev.anchorScreen);
          const hitR = MAP_RADIAL_BTN / 2 + MAP_RADIAL_HIT_EXTRA;
          if (prev.radialRevealed) {
            if (Math.hypot(pageX - fromCenter.x, pageY - fromCenter.y) <= hitR) {
              applyMapFromRef.current(prev.label);
              mapRadialStartNearAnchor.current = false;
              return;
            }
            if (Math.hypot(pageX - toCenter.x, pageY - toCenter.y) <= hitR) {
              applyMapToRef.current(prev.label);
              mapRadialStartNearAnchor.current = false;
              return;
            }
          }
          setMapLocationAction(null);
          mapRadialStartNearAnchor.current = false;
        },
      }),
    []
  );

  // ── Profile & settings sub-screens (see profile/, settings/) ─────
  if (screen === 'profile') {
    return (
      <ProfileScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('home')}
        onEdit={openProfileEdit}
        userFirstName={userFirstName}
        userLastName={userLastName}
        userEmail={userEmail}
        userPhoneE164={userPhoneE164}
        cards={cards}
        defaultCard={defaultCard}
        selectDefaultCard={selectDefaultCard}
        addCardVisible={addCardVisible}
        setAddCardVisible={setAddCardVisible}
        newCardNumber={newCardNumber}
        setNewCardNumber={setNewCardNumber}
        newCardName={newCardName}
        setNewCardName={setNewCardName}
        newCardExpiry={newCardExpiry}
        setNewCardExpiry={setNewCardExpiry}
        newCardCvv={newCardCvv}
        setNewCardCvv={setNewCardCvv}
        closeAddCardSheet={closeAddCardSheet}
        saveNewCard={saveNewCard}
        onConfirmSignOut={onConfirmSignOut}
      />
    );
  }

  if (screen === 'profileEdit') {
    return (
      <ProfileEditScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('profile')}
        onSave={saveProfile}
        profileDirty={profileDirty}
        editingFirstName={editingFirstName}
        setEditingFirstName={setEditingFirstName}
        editingLastName={editingLastName}
        setEditingLastName={setEditingLastName}
        editingEmail={editingEmail}
        setEditingEmail={setEditingEmail}
        editingUsername={editingUsername}
        setEditingUsername={setEditingUsername}
        editingPassword={editingPassword}
        setEditingPassword={setEditingPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        editingPhone={editingPhone}
        setEditingPhone={setEditingPhone}
        countryCode={countryCode}
        setCountryCode={setCountryCode}
        countryPickerVisible={countryPickerVisible}
        setCountryPickerVisible={setCountryPickerVisible}
        addressModal={addressModal}
        addressInput={addressInput}
        setAddressInput={setAddressInput}
        saveAddress={saveAddress}
        closeAddressModal={() => { setAddressModal(null); setAddressInput(''); }}
      />
    );
  }

  if (screen === 'settingsNotifications') {
    return (
      <SettingsNotificationsScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('home')}
        notifRideUpdates={notifRideUpdates}
        setNotifRideUpdates={setNotifRideUpdates}
        notifDriverArrival={notifDriverArrival}
        setNotifDriverArrival={setNotifDriverArrival}
        notifTripReceipt={notifTripReceipt}
        setNotifTripReceipt={setNotifTripReceipt}
        notifPromos={notifPromos}
        setNotifPromos={setNotifPromos}
        notifNewFeatures={notifNewFeatures}
        setNotifNewFeatures={setNotifNewFeatures}
        notifSurveys={notifSurveys}
        setNotifSurveys={setNotifSurveys}
        notifSecurity={notifSecurity}
        setNotifSecurity={setNotifSecurity}
        notifPayments={notifPayments}
        setNotifPayments={setNotifPayments}
      />
    );
  }

  if (screen === 'settingsPassword') {
    return (
      <SettingsPasswordScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('home')}
        onUpdated={() => setScreen('home')}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
      />
    );
  }

  if (screen === 'settingsLanguage') {
    return (
      <SettingsLanguageScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('home')}
        selectedLang={selectedLang}
        onSelectLang={(lang) => { setSelectedLang(lang); setScreen('home'); }}
      />
    );
  }

  if (screen === 'settingsAppearance') {
    return (
      <SettingsAppearanceScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('home')}
        themeOverride={themeOverride}
        setThemeOverride={setThemeOverride}
      />
    );
  }

  if (screen === 'settingsHelp') {
    return (
      <SettingsHelpScreen
        ui={ui}
        isDark={isDark}
        onBack={() => setScreen('home')}
        onContactSupport={() => setScreen('settingsSupport')}
      />
    );
  }

  if (screen === 'settingsSupport') {
    return (
      <SettingsSupportScreen
        userEmail={userEmail}
        userFirstName={userFirstName}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'notifications') {
    return <NotificationsScreen ui={ui} isDark={isDark} onBack={() => setScreen('home')} />;
  }

  if (screen === 'settingsTerms') {
    return <SettingsTermsScreen ui={ui} isDark={isDark} onBack={() => setScreen('home')} />;
  }

  if (screen === 'activeRide' && presentRide) {
    return (
      <ActiveRideScreen
        trip={presentRide}
        ui={ui}
        isDark={isDark}
        onEndTrip={leaveActiveRideScreen}
      />
    );
  }

  // ────────────────────────────────────────────────────────────────

  return (
      <View key={ANIMATION_TREE_KEY} style={[styles.safeArea, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent={Platform.OS === 'android'} />

      <FindingDriverModal
        visible={findingDriverVisible}
        phase={findingDriverPhase}
        ui={ui}
        isDark={isDark}
        fromLabel={toQuery.trim()}
        toLabel={destinationQuery.trim()}
        fareFormatted={rideFareLabel}
        etaLabel={rideEtaLabel}
        paymentLabel={selectedPaymentLabel}
        onChangePayment={setSelectedPaymentLabel}
        onClose={closeFindingDriver}
        onSwipeConfirm={confirmRideRequest}
        onRetry={retryFindingDriver}
        confirming={rideRequestSubmitting}
        onDevSkipWait={__DEV__ ? () => setFindingDriverPhase('readySwipe') : undefined}
        canPayWithCard={
          cards.length > 0 &&
          defaultCard != null &&
          cards.some((c) => c.id === defaultCard)
        }
      />

      {/* Map: short when sheet is up, full window when sheet is minimized */}
      <Animated.View style={[styles.mapWrapper, { height: minimizedMapH }]}>
        <View ref={mapMeasureRef} style={StyleSheet.absoluteFillObject} collapsable={false}>
        <MapView
          ref={mapViewRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            setMapLocationAction(null);
            if (destinationFocused || toFocused) {
              collapseSearchMode();
            }
          }}
          onLongPress={async (e) => {
            const coordinate = e.nativeEvent.coordinate;
            if (!isInJamaicaServiceArea(coordinate)) {
              Alert.alert(
                'Outside service area',
                'Ridr serves Jamaica. Long-press the map within Jamaica to set a location.'
              );
              return;
            }
            const { key: mapsApiKey } = resolveGoogleMapsApiKey();
            let anchorScreen: { x: number; y: number } | null = null;
            try {
              const map = mapViewRef.current;
              const shell = mapMeasureRef.current;
              if (map && shell) {
                const pt = await map.pointForCoordinate(coordinate);
                anchorScreen = await new Promise<{ x: number; y: number }>((resolve) => {
                  shell.measureInWindow((x: number, y: number) => {
                    resolve({ x: x + pt.x, y: y + pt.y });
                  });
                });
              }
            } catch {
              anchorScreen = { x: SCREEN_WIDTH * 0.52, y: SCREEN_HEIGHT * 0.34 };
            }
            if (!anchorScreen) {
              anchorScreen = { x: SCREEN_WIDTH * 0.52, y: SCREEN_HEIGHT * 0.34 };
            }
            setMapLocationAction({
              coordinate,
              label: '',
              resolving: true,
              radialRevealed: false,
              anchorScreen,
            });
            const label = await reverseGeocodeMapPin(coordinate, mapsApiKey);
            setMapLocationAction((prev) =>
              prev &&
              prev.coordinate.latitude === coordinate.latitude &&
              prev.coordinate.longitude === coordinate.longitude
                ? { ...prev, label, resolving: false, radialRevealed: true }
                : prev
            );
          }}
          initialRegion={{
            latitude: JAMAICA_KINGSTON.latitude,
            longitude: JAMAICA_KINGSTON.longitude,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          rotateEnabled={true}
          pitchEnabled={true}
        >
          {hasRoute ? (
            <>
              <Polyline
                coordinates={roadRouteCoords}
                strokeColor="rgba(255,255,255,0.95)"
                strokeWidth={9}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                coordinates={roadRouteCoords}
                strokeColor="#171717"
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
              <Marker coordinate={pickupCoordinate!} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.mapMarkerPickup} />
              </Marker>
              <Marker coordinate={dropoffCoordinate!} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.mapMarkerDropoff} />
              </Marker>
              {routeAnimatorPoint ? (
                <Marker coordinate={routeAnimatorPoint} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.routeAnimatorOuter}>
                    <View style={styles.routeAnimatorInner} />
                  </View>
                </Marker>
              ) : null}
            </>
          ) : (
            <>
              {showCurrentLocationPin ? (
                <Marker coordinate={userLocation!} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.mapMarkerPickup} />
                </Marker>
              ) : null}
              {showOriginTextPin ? (
                <Marker coordinate={originPreviewCoordinate!} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.mapMarkerPickup} />
                </Marker>
              ) : null}
              {showDestPreviewPin ? (
                <Marker coordinate={destinationPreviewCoordinate!} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.mapMarkerDropoff} />
                </Marker>
              ) : null}
            </>
          )}
        </MapView>
        </View>
      </Animated.View>

      {/* Header — floats over map; hides when bottom sheet is minimized (home only); hidden while search fields are focused */}
      {activeTab === 'home' && !toFocused && !destinationFocused ? (
      <Animated.View
        style={[styles.fixedHeader, { backgroundColor: ui.headerOverlay, opacity: headerAppBarOpacity }]}
        pointerEvents={sheetMinimized ? 'none' : 'auto'}
      >
        <View style={styles.headerRow}>
          <View style={styles.profileBlock}>
            <Pressable style={[styles.profileIconShell, { backgroundColor: ui.softBg }]} onPress={openProfile}>
              <ProfileIcon size={PROFILE_HEADER_ICON_GLYPH} color={ui.text} />
            </Pressable>
            <View style={styles.profileLabels}>
              <Text style={[styles.greeting, { color: ui.textMuted }]}>Good morning</Text>
              <Text style={[styles.userName, { color: ui.text }]}>{displayName}</Text>
            </View>
          </View>
          <Pressable style={[styles.supportButton, { backgroundColor: '#FFD000' }]} onPress={() => setScreen('notifications')}>
            <Ionicons name="notifications" size={20} color="#171717" />
          </Pressable>
        </View>
      </Animated.View>
      ) : null}

      {/* Profile Modal — replaced by full screen, block removed */}

      {/* Ride Detail Modal */}
      <Modal visible={selectedRideDetail !== null} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setSelectedRideDetail(null)}>
        <Pressable style={styles.rideDetailOverlay} onPress={() => setSelectedRideDetail(null)}>
          <Pressable style={[styles.rideDetailSheet, { backgroundColor: ui.cardBg }]} onPress={() => {}}>
            <View style={styles.rideDetailHandle} />
            <View style={[styles.rideDetailIconWrap, { backgroundColor: driverAvatar(selectedRideDetail?.driver ?? '').color }]}>
              <Text style={styles.rideDetailAvatarText}>{driverAvatar(selectedRideDetail?.driver ?? '').initials}</Text>
            </View>
            <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{selectedRideDetail?.from}</Text>
            <View style={styles.rideDetailArrowRow}>
              <View style={[styles.rideDetailLine, { backgroundColor: ui.divider }]} />
              <Ionicons name="arrow-down" size={16} color={ui.textMuted} />
              <View style={[styles.rideDetailLine, { backgroundColor: ui.divider }]} />
            </View>
            <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{selectedRideDetail?.to}</Text>
            <View style={[styles.rideDetailDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.rideDetailMeta}>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Driver</Text>
                <Text style={[styles.rideDetailMetaValue, { color: ui.text }]}>{selectedRideDetail?.driver}</Text>
              </View>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Date</Text>
                <Text style={[styles.rideDetailMetaValue, { color: ui.text }]}>{selectedRideDetail?.date}</Text>
              </View>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Fare</Text>
                <Text style={[styles.rideDetailMetaValue, { color: ui.text }]}>{selectedRideDetail?.price}</Text>
              </View>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Rating</Text>
                <View style={styles.rideDetailStars}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Ionicons key={s} name={s < (selectedRideDetail?.rating ?? 0) ? 'star' : 'star-outline'} size={14} color="#ffd54a" />
                  ))}
                </View>
              </View>
            </View>
            <Pressable style={styles.rideDetailBookBtn} onPress={() => {
              if (selectedRideDetail) {
                setToQuery(selectedRideDetail.from);
                setDestinationQuery(selectedRideDetail.to);
                setActiveTab('home');
              }
              setSelectedRideDetail(null);
            }}>
              <Text style={styles.rideDetailBookBtnText}>Book Again</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Address Modal */}
      <Modal visible={addressModal !== null} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {addressModal === 'home' ? 'Home Address' : 'Work Address'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={addressInput}
              onChangeText={setAddressInput}
              placeholder={addressModal === 'home' ? 'e.g. 12 Constant Spring Rd' : 'e.g. 6 Ocean Blvd, Kingston'}
              placeholderTextColor="#aaa"
              autoCapitalize="words"
              autoFocus
            />
            <Pressable style={styles.modalSaveBtn} onPress={saveAddress}>
              <Text style={styles.modalSaveBtnText}>Save Address</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => { setAddressModal(null); setAddressInput(''); }}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Book Address Modal */}
      <Modal visible={bookAddressModal !== null} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setBookAddressModal(null)}>
        <Pressable style={styles.rideDetailOverlay} onPress={() => setBookAddressModal(null)}>
          <Pressable style={[styles.rideDetailSheet, { backgroundColor: ui.cardBg }]} onPress={() => {}}>
            <View style={styles.rideDetailHandle} />
            <View style={[styles.rideDetailIconWrap, { backgroundColor: bookAddressModal === 'home' ? '#fff8e1' : '#e8f4fd' }]}>
              <Ionicons name={bookAddressModal === 'home' ? 'home' : 'briefcase'} size={26} color={bookAddressModal === 'home' ? '#f59e0b' : '#3b82f6'} />
            </View>
            <Text style={[styles.rideDetailRoute, { color: ui.text }]}>
              {bookAddressModal === 'home' ? 'Home' : 'Work'}
            </Text>
            <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted, textAlign: 'center' }]} numberOfLines={2}>
              {bookAddressModal === 'home' ? homeAddress : workAddress}
            </Text>
            <View style={[styles.rideDetailDivider, { backgroundColor: ui.divider }]} />
            <Pressable style={styles.rideDetailBookBtn} onPress={() => {
              const addr = bookAddressModal === 'home' ? homeAddress : workAddress;
              setDestinationQuery(addr);
              setBookAddressModal(null);
              setActiveTab('home');
            }}>
              <Text style={styles.rideDetailBookBtnText}>Go to this location</Text>
            </Pressable>
            <Pressable style={[styles.rideDetailBookBtn, { backgroundColor: isDark ? '#2b2b31' : '#171717', marginTop: 8 }]} onPress={() => {
              const addr = bookAddressModal === 'home' ? homeAddress : workAddress;
              setToQuery(addr);
              setToUserEdited(true);
              setBookAddressModal(null);
              setActiveTab('home');
            }}>
              <Text style={[styles.rideDetailBookBtnText, { color: '#ffffff' }]}>Go from this location</Text>
            </Pressable>
            <Pressable style={[styles.modalCancelBtn, { marginTop: 4, width: '100%' }]} onPress={() => {
              const type = bookAddressModal!;
              setBookAddressModal(null);
              openAddress(type);
            }}>
              <Text style={styles.modalCancelBtnText}>Edit address</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Favourite Book Modal */}
      <Modal visible={favBookModal !== null} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setFavBookModal(null)}>
        <Pressable style={styles.rideDetailOverlay} onPress={() => setFavBookModal(null)}>
          <Pressable style={[styles.rideDetailSheet, { backgroundColor: ui.cardBg }]} onPress={() => {}}>
            <View style={styles.rideDetailHandle} />
            <View style={[styles.rideDetailIconWrap, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}>
              <Ionicons
                name={favBookModal?.type === 'route' ? 'repeat' : 'heart'}
                size={26}
                color={favBookModal?.type === 'route' ? ui.text : '#ef4444'}
              />
            </View>
            {favBookModal?.type === 'route' ? (
              <>
                <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{favBookModal.from}</Text>
                <View style={styles.rideDetailArrowRow}>
                  <View style={[styles.rideDetailLine, { backgroundColor: ui.divider }]} />
                  <Ionicons name="arrow-down" size={16} color={ui.textMuted} />
                  <View style={[styles.rideDetailLine, { backgroundColor: ui.divider }]} />
                </View>
                <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{favBookModal.to}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{favBookModal?.title}</Text>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted, textAlign: 'center' }]}>{favBookModal?.subtitle}</Text>
              </>
            )}
            <View style={[styles.rideDetailDivider, { backgroundColor: ui.divider }]} />
            {favBookModal?.type === 'route' ? (
              <Pressable style={styles.rideDetailBookBtn} onPress={() => {
                if (favBookModal.type === 'route') {
                  setToQuery(favBookModal.from);
                  setToUserEdited(true);
                  setDestinationQuery(favBookModal.to);
                }
                setFavBookModal(null);
                setActiveTab('home');
              }}>
                <Text style={styles.rideDetailBookBtnText}>Book this route</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.rideDetailBookBtn} onPress={() => {
                  if (favBookModal?.type === 'place') setDestinationQuery(favBookModal.title);
                  setFavBookModal(null);
                  setActiveTab('home');
                }}>
                  <Text style={styles.rideDetailBookBtnText}>Go to this location</Text>
                </Pressable>
                <Pressable style={[styles.rideDetailBookBtn, { backgroundColor: isDark ? '#2b2b31' : '#171717', marginTop: 8 }]} onPress={() => {
                  if (favBookModal?.type === 'place') {
                    setToQuery(favBookModal.title);
                    setToUserEdited(true);
                  }
                  setFavBookModal(null);
                  setActiveTab('home');
                }}>
                  <Text style={[styles.rideDetailBookBtnText, { color: '#ffffff' }]}>Go from this location</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={mapLocationAction !== null && mapLocationAction.anchorScreen !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setMapLocationAction(null)}
      >
        <View style={styles.mapRadialRoot} {...mapRadialPanResponder.panHandlers}>
          <BlurView intensity={Platform.OS === 'ios' ? 38 : 24} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, styles.mapRadialDim]} />
          {mapLocationAction?.resolving ? (
            <Text style={[styles.mapRadialHint, styles.mapRadialHintLoading]} pointerEvents="none">
              Finding address…
            </Text>
          ) : mapLocationAction ? (
            <Text style={styles.mapRadialHint} pointerEvents="none">
              {mapLocationAction.radialRevealed
                ? 'Tap From or To to fill that field.'
                : 'Drag slightly from the pin to show From and To.'}
            </Text>
          ) : null}
          {mapLocationAction?.anchorScreen ? (
            <MapRadialFabs
              anchor={mapLocationAction.anchorScreen}
              radialRevealed={mapLocationAction.radialRevealed}
              resolving={mapLocationAction.resolving}
            />
          ) : null}
        </View>
      </Modal>

      {/* Bottom sheet — scrollable cards */}
      <Animated.View
        style={[
          styles.contentScroll,
          {
            backgroundColor: 'transparent',
            overflow: 'hidden',
            top: sheetTopAnim,
            maxHeight: sheetMaxHeightAnim,
            borderTopLeftRadius: sheetTopRadiusAnim,
            borderTopRightRadius: sheetTopRadiusAnim,
            zIndex: toFocused || destinationFocused ? 10 : 2,
          },
          {
            transform: [
              {
                translateY: Animated.add(panValue, minimizedTranslateY),
              },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: ui.panelBg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}
        />
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          presentRide ? { paddingTop: 112 } : null,
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={true}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshingMain}
            onRefresh={onRefreshMain}
            tintColor={ui.textMuted}
            colors={[ui.ctaBg]}
          />
        }
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        {/* Drag handle */}
        <View style={styles.dragHandleZone}>
          <View style={styles.dragHandle} />
        </View>

        {presentRide ? (
        <View style={{ position: 'absolute', left: 12, right: 12, top: 14, zIndex: 12 }}>
          <Pressable
            style={{
              backgroundColor: '#fde68a',
              borderColor: '#f59e0b',
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
            onPress={() => {
              setActiveTrip(presentRide);
              setScreen('activeRide');
            }}
          >
            <Text style={{ color: '#713f12', fontWeight: '800', fontSize: 13 }}>
              Current ride · {presentRide.bookedFor === 'friend' ? 'Booked for friend' : 'Booked for you'}
            </Text>
            <Text style={{ color: '#78350f', marginTop: 2 }} numberOfLines={1}>
              {presentRide.driverName} · {presentRide.carDetails} · PIN {presentRide.driverPin}
            </Text>
            <Text style={{ color: '#78350f', marginTop: 2 }} numberOfLines={1}>
              {presentRide.fromLabel} → {presentRide.toLabel}
            </Text>
            <Text style={{ color: '#78350f', marginTop: 4, fontWeight: '600' }} numberOfLines={1}>
              Tap to open live trip details
            </Text>
          </Pressable>
        </View>
      ) : null}

        {/* Destination Input Card */}
        <View style={[styles.destinationCard, { backgroundColor: ui.cardBg }]}>
          <View style={[styles.destinationSearchGroup, { backgroundColor: ui.softBg }]}>
            <View
              style={[
                styles.whereToRow,
                styles.whereToRowTop,
                toFocused ? styles.whereToRowActive : null,
                { backgroundColor: isDark ? '#22242a' : '#f2f2f2' },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={18}
                color={toFocused ? ui.text : ui.placeholder}
              />
              <TextInput
                ref={toInputRef}
                style={[styles.whereToInput, { color: ui.text }]}
                value={toQuery}
                onChangeText={(t) => {
                  setToUserEdited(true);
                  setToQuery(t);
                }}
                onFocus={handleToFocus}
                onBlur={handleToBlur}
                placeholder="From where? (address, place, or lat, lng)"
                placeholderTextColor={ui.placeholder}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <View
              style={[
                styles.whereToRow,
                styles.whereToRowBottom,
                destinationFocused ? styles.whereToRowActive : null,
                { backgroundColor: isDark ? '#22242a' : '#f2f2f2' },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={destinationFocused ? ui.text : ui.placeholder}
              />
              <TextInput
                ref={destinationInputRef}
                style={[styles.whereToInput, { color: ui.text }]}
                value={destinationQuery}
                onChangeText={setDestinationQuery}
                onFocus={handleDestinationFocus}
                onBlur={handleDestinationBlur}
                placeholder="Where to? (address, place, or lat, lng)"
                placeholderTextColor={ui.placeholder}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.nowBadge, { backgroundColor: '#FFD000' }]}
                onPress={openFindingDriver}
                accessibilityRole="button"
                accessibilityLabel="Find driver and request ride"
              >
                <Text style={[styles.nowText, { color: '#171717' }]}>Go ▾</Text>
              </Pressable>
            </View>
          </View>

          {hasRouteInputs && routeIssue ? (
            <Text style={styles.routeIssueText}>{routeIssue}</Text>
          ) : null}

          {toFocused && filteredToSuggestions.length > 0 ? (
            <View style={[styles.suggestionList, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
              {filteredToSuggestions.map((item, index) => (
                <View key={item.id}>
                  <Pressable style={styles.suggestionItem} onPress={() => selectTo(item)}>
                    <View style={[styles.suggestionIconWrap, { backgroundColor: ui.softBg }]}>
                      <Ionicons name={item.icon} size={16} color={ui.text} />
                    </View>
                    <View style={styles.suggestionTextBlock}>
                      <Text style={[styles.suggestionTitle, { color: ui.text }]}>{item.title}</Text>
                      <Text style={[styles.suggestionSubtitle, { color: ui.textMuted }]} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="arrow-up-outline" size={16} color={ui.placeholder} style={styles.suggestionActionIcon} />
                  </Pressable>
                  {index < filteredToSuggestions.length - 1 ? <View style={[styles.suggestionDivider, { backgroundColor: ui.divider }]} /> : null}
                </View>
              ))}
            </View>
          ) : null}

          {destinationFocused && filteredSuggestions.length > 0 ? (
            <View style={[styles.suggestionList, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
              {filteredSuggestions.map((item, index) => (
                <View key={item.id}>
                  <Pressable style={styles.suggestionItem} onPress={() => selectDestination(item)}>
                    <View style={[styles.suggestionIconWrap, { backgroundColor: ui.softBg }]}>
                      <Ionicons name={item.icon} size={16} color={ui.text} />
                    </View>
                    <View style={styles.suggestionTextBlock}>
                      <Text style={[styles.suggestionTitle, { color: ui.text }]}>{item.title}</Text>
                      <Text style={[styles.suggestionSubtitle, { color: ui.textMuted }]} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="arrow-up-outline" size={16} color={ui.placeholder} style={styles.suggestionActionIcon} />
                  </Pressable>
                  {index < filteredSuggestions.length - 1 ? <View style={[styles.suggestionDivider, { backgroundColor: ui.divider }]} /> : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.addressList, { backgroundColor: ui.cardBg }]}>
            <Pressable style={styles.addressItem} onPress={() => handleAddressTap('home')}>
              <View style={[styles.addressIconHome, { backgroundColor: isDark ? '#2b2b31' : undefined }]}>
                <Ionicons name="home" size={14} color={ui.text} />
              </View>
              <View style={styles.addressTextBlock}>
                <Text style={[styles.addressLabel, { color: ui.text }]}>Home</Text>
                <Text style={[styles.addressSub, { color: ui.textMuted }]} numberOfLines={1}>{homeAddress || 'Add address'}</Text>
              </View>
              <Ionicons name={homeAddress ? 'chevron-forward' : 'add-circle-outline'} size={18} color={ui.placeholder} />
            </Pressable>
            <View style={[styles.addressDivider, { backgroundColor: ui.divider }]} />
            <Pressable style={styles.addressItem} onPress={() => handleAddressTap('work')}>
              <View style={[styles.addressIconWork, { backgroundColor: isDark ? '#2b2b31' : undefined }]}>
                <Ionicons name="briefcase" size={14} color={ui.text} />
              </View>
              <View style={styles.addressTextBlock}>
                <Text style={[styles.addressLabel, { color: ui.text }]}>Work</Text>
                <Text style={[styles.addressSub, { color: ui.textMuted }]} numberOfLines={1}>{workAddress || 'Add address'}</Text>
              </View>
              <Ionicons name={workAddress ? 'chevron-forward' : 'add-circle-outline'} size={18} color={ui.placeholder} />
            </Pressable>
          </View>
        </View>

        {/* Service Type Cards */}
        <Text style={[styles.serviceRowHeader, { color: ui.text }]}>Ready to ride?</Text>
        <View style={styles.serviceRow}>
          {(
            [
              { id: 'ride', label: 'Ride', sub: '2 min away', discount: '10%' },
              { id: 'rental', label: 'Rental', sub: 'By the hour', discount: '15%' },
              { id: 'outstation', label: 'Outstation', sub: 'Long trips', discount: '25%' },
            ] as { id: string; label: string; sub: string; discount: string }[]
          ).map(({ id, label, sub, discount }) => {
            const disabled = id === 'rental' || id === 'outstation';
            const active = !disabled && selectedRide === id;
            return (
              <Pressable
                key={id}
                disabled={disabled}
                style={[
                  styles.serviceCard,
                  active && styles.serviceCardActive,
                  disabled && styles.serviceCardDisabled,
                ]}
                onPress={() => {
                  if (!disabled) setSelectedRide(id);
                }}
              >
                <View style={styles.serviceCarImageWrap}>
                  <Image source={greyCarAsset} style={styles.serviceCarImage} resizeMode="contain" />
                </View>
                <View style={[styles.serviceDiscountPill, active && styles.serviceDiscountPillActive, disabled && styles.serviceDiscountPillDisabled]}>
                  <Text
                    style={[
                      styles.serviceDiscountText,
                      active && styles.serviceDiscountTextActive,
                      disabled && styles.serviceDiscountTextDisabled,
                      disabled && styles.serviceDiscountTextComingSoon,
                    ]}
                    numberOfLines={2}
                  >
                    {disabled ? 'Coming soon' : `${discount} OFF`}
                  </Text>
                </View>
                <Text style={[styles.serviceTitle, active && styles.serviceTitleActive, disabled && styles.serviceTitleDisabled]}>{label}</Text>
                <Text style={[styles.serviceSubLabel, active && styles.serviceSubLabelActive, disabled && styles.serviceSubLabelDisabled]}>{sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Promotional Card */}
        <View style={[styles.promoCard, { backgroundColor: isDark ? '#151517' : undefined }]}>
          <View style={styles.promoContent}>
            <Text style={[styles.promoTitle, { color: isDark ? ui.text : undefined }]}>Invest today. Secure a{'\n'}healthy tomorrow &{'\n'}every day.</Text>
            <Pressable style={styles.promoButton}>
              <Text style={styles.promoButtonText}>Invest Now!</Text>
            </Pressable>
          </View>
          <View style={styles.promoIllustration}>
            <View style={styles.promoBox1} />
            <View style={styles.promoBox2} />
            <View style={styles.promoBox3} />
          </View>
        </View>

        {/* Top Drivers */}
        <View style={styles.topDriversSection}>
          <View style={styles.topDriversHeader}>
            <Text style={[styles.topDriversTitle, { color: ui.text }]}>Your Top Drivers</Text>
            <Text style={[styles.topDriversSub, { color: ui.textMuted }]}>Based on your rides</Text>
          </View>
          <View style={styles.topDriversOverflow} {...driverPanResponder.panHandlers}>
            <Animated.View
              style={[styles.topDriversScroll, { transform: [{ translateX: driverPosAnim }] }]}
            >
              {[...mockTopDrivers, ...mockTopDrivers].map((driver, i) => (
                <View
                  key={`${driver.id}-${i}`}
                  style={[styles.driverCard, { backgroundColor: isDark ? '#1b1c20' : '#ffffff' }]}
                >
                  <View style={[styles.driverAvatar, { backgroundColor: driver.color }]}>
                    <Ionicons name="person" size={34} color="#ffffff" />
                  </View>
                  <Text style={[styles.driverName, { color: ui.text }]} numberOfLines={1}>{driver.name}</Text>
                  <View style={styles.driverRatingRow}>
                    <Ionicons name="star" size={13} color="#FFD000" />
                    <Text style={[styles.driverRatingText, { color: ui.text }]}>{driver.rating.toFixed(1)}</Text>
                  </View>
                  <View style={[styles.driverTripsBadge, { backgroundColor: isDark ? '#2b2b31' : '#f5f5f5' }]}>
                    <Text style={[styles.driverTripsText, { color: ui.textMuted }]}>{driver.trips} trips</Text>
                  </View>
                  <Pressable style={styles.driverBookBtn}>
                    <Text style={styles.driverBookBtnText}>Book Again</Text>
                  </Pressable>
                </View>
              ))}
            </Animated.View>
          </View>
        </View>
      </ScrollView>
      </Animated.View>

      {activeTab === 'activity' ? (
        <ActivityTabScreen
          ui={ui}
          isDark={isDark}
          activitySearch={activitySearch}
          setActivitySearch={setActivitySearch}
          activitySearchOpen={activitySearchOpen}
          setActivitySearchOpen={setActivitySearchOpen}
          activityFilter={activityFilter}
          setActivityFilter={setActivityFilter}
          onSelectRideDetail={(ride) => setSelectedRideDetail(ride)}
          presentRide={presentRide}
          onOpenPresentRide={() => setScreen('activeRide')}
          recentBookedRides={bookedRides}
          onOpenBookedRide={openBookedRideFromActivity}
          refreshing={refreshingMain}
          onRefresh={onRefreshMain}
          homeAddress={homeAddress}
          workAddress={workAddress}
          onBookAddress={(type) => setBookAddressModal(type)}
        />
      ) : null}

      {activeTab === 'notifications' ? (
        <FavouritesTabScreen
          ui={ui}
          isDark={isDark}
          favSearch={favSearch}
          setFavSearch={setFavSearch}
          favSearchOpen={favSearchOpen}
          setFavSearchOpen={setFavSearchOpen}
          refreshing={refreshingMain}
          onRefresh={onRefreshMain}
          onBookFavPlace={(title, subtitle) => setFavBookModal({ type: 'place', title, subtitle })}
          onBookFavRoute={(from, to) => setFavBookModal({ type: 'route', from, to })}
        />
      ) : null}

      {activeTab === 'settings' ? (
        <SettingsTabScreen
          ui={ui}
          openProfile={openProfile}
          setScreen={setScreen}
          selectedLang={selectedLang}
          themeOverride={themeOverride}
          refreshing={refreshingMain}
          onRefresh={onRefreshMain}
          onClearCache={handleClearCache}
        />
      ) : null}

      {sheetMinimized && activeTab === 'home' ? (
        <View style={[styles.sheetRestoreWrap, { bottom: SHEET_RESTORE_BTN_BOTTOM }]} pointerEvents="box-none">
          <Pressable
            style={[styles.sheetRestoreBtn, { backgroundColor: isDark ? 'rgba(48,48,52,0.95)' : 'rgba(23,23,23,0.88)' }]}
            onPress={expandSheetFromMinimized}
            accessibilityRole="button"
            accessibilityLabel="Open trip sheet"
          >
            <Ionicons name="chevron-up" size={22} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}

      {/* Bottom Navigation Tab Bar */}
      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(24,24,28,0.88)' : 'rgba(255,255,255,0.82)' }]}>
        <Pressable style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={24} color={activeTab === 'home' ? ui.tabActive : ui.tabInactive} />
          <Text style={[styles.tabLabel, { color: ui.tabInactive }, activeTab === 'home' && styles.tabLabelActive, activeTab === 'home' ? { color: ui.tabActive } : null]}>Home</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('activity')}>
          <Ionicons name={activeTab === 'activity' ? 'time' : 'time-outline'} size={24} color={activeTab === 'activity' ? ui.tabActive : ui.tabInactive} />
          <Text style={[styles.tabLabel, { color: ui.tabInactive }, activeTab === 'activity' && styles.tabLabelActive, activeTab === 'activity' ? { color: ui.tabActive } : null]}>Activity</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('notifications')}>
          <Ionicons name={activeTab === 'notifications' ? 'heart' : 'heart-outline'} size={24} color={activeTab === 'notifications' ? ui.tabActive : ui.tabInactive} />
          <Text style={[styles.tabLabel, { color: ui.tabInactive }, activeTab === 'notifications' && styles.tabLabelActive, activeTab === 'notifications' ? { color: ui.tabActive } : null]}>Favourites</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <Ionicons name={activeTab === 'settings' ? 'settings' : 'settings-outline'} size={24} color={activeTab === 'settings' ? ui.tabActive : ui.tabInactive} />
          <Text style={[styles.tabLabel, { color: ui.tabInactive }, activeTab === 'settings' && styles.tabLabelActive, activeTab === 'settings' ? { color: ui.tabActive } : null]}>Settings</Text>
        </Pressable>
      </BlurView>
    </View>
  );
}



