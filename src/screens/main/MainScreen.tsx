import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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
  formatE164International,
  migrateLegacyNational,
  releaseE164,
  reserveE164,
  validateToE164,
} from '../../lib/phone';
import { addCardPreviewAsset, greyCarAsset } from '../../assets/images';
import { AUTH_SESSION_KEY, useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/ThemeProvider';
import SupportTicketScreen from './SupportTicketScreen';
import { usePushToken } from '../../hooks/usePushToken';

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

const mockFavouritePlaces = [
  { id: 'f1', title: 'Norman Manley Airport', subtitle: 'Palisadoes, Kingston', icon: 'airplane' as const },
  { id: 'f2', title: 'Sovereign Centre', subtitle: 'Hope Road, Kingston', icon: 'storefront' as const },
  { id: 'f3', title: 'University of the West Indies', subtitle: 'Mona, Kingston', icon: 'business' as const },
];

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
type LatLng = { latitude: number; longitude: number };
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

const PROFILE_ME_CACHE_KEY = 'profile_me_cache_v1';

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
    id: 'portmore',
    title: 'Portmore',
    subtitle: 'St. Catherine, Jamaica',
    icon: 'home' as const,
    coordinate: { latitude: 17.9509, longitude: -76.8821 },
  },
] satisfies DestinationSuggestion[];

// Default centre: Kingston, Jamaica
const JAMAICA_KINGSTON = { latitude: 17.9970, longitude: -76.7936 };

function decodeGooglePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

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

  return points;
}

function interpolateRoutePoint(route: LatLng[], progress: number): LatLng | null {
  if (route.length < 2) return route[0] ?? null;
  const clamped = Math.max(0, Math.min(1, progress));

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const len = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(len);
    total += len;
  }
  if (total <= 0) return route[0];

  const target = clamped * total;
  let traversed = 0;

  for (let i = 0; i < segmentLengths.length; i += 1) {
    const seg = segmentLengths[i];
    const next = traversed + seg;
    if (target <= next) {
      const local = seg > 0 ? (target - traversed) / seg : 0;
      const start = route[i];
      const end = route[i + 1];
      return {
        latitude: start.latitude + (end.latitude - start.latitude) * local,
        longitude: start.longitude + (end.longitude - start.longitude) * local,
      };
    }
    traversed = next;
  }

  return route[route.length - 1];
}

async function geocodeAddress(
  address: string,
  apiKey?: string
): Promise<{ coordinate: LatLng | null; issue?: string }> {
  const q = address.trim();
  if (!q) return { coordinate: null, issue: 'Empty address' };
  if (apiKey) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}` +
        `&key=${apiKey}`;
      const response = await fetch(url);
      const data = (await response.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
      };
      const loc = data.results?.[0]?.geometry?.location;
      if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
        return { coordinate: { latitude: loc.lat, longitude: loc.lng } };
      }
      if (data.status && data.status !== 'OK') {
        return {
          coordinate: null,
          issue: `Geocode(${q}) ${data.status}${data.error_message ? `: ${data.error_message}` : ''}`,
        };
      }
    } catch {
      /* fall through to device geocoder */
    }
  }

  try {
    const local = await Location.geocodeAsync(q);
    if (local[0]) {
      return { coordinate: { latitude: local[0].latitude, longitude: local[0].longitude } };
    }
  } catch {
    /* noop */
  }
  return { coordinate: null, issue: `Could not geocode "${q}"` };
}

const MAP_HEIGHT = 400;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
/** Height of the home bottom sheet (from `contentScroll` top inset to bottom of screen). */
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT - (MAP_HEIGHT - 30);
/** Visible height of the bottom sheet when minimized (handle + peek). */
const MINIMIZED_SHEET_PEEK = 88;
/** `translateY` to leave ~`MINIMIZED_SHEET_PEEK` of the sheet visible when minimized. */
const SHEET_MINIMIZED_OFFSET = Math.max(0, BOTTOM_SHEET_HEIGHT - MINIMIZED_SHEET_PEEK);
/** Tab bar `bottom` + `height` from styles — used to float controls above the tab bar. */
const TAB_BAR_RESERVED_BOTTOM = 16 + 68;
const ANIMATION_TREE_KEY = 'animation-tree-v2';

/** Line heights for header greeting + name — profile avatar matches this total height. */
const PROFILE_GREETING_LINE_HEIGHT = 18;
const PROFILE_NAME_LINE_HEIGHT = 30;
const PROFILE_HEADER_TEXT_HEIGHT = PROFILE_GREETING_LINE_HEIGHT + PROFILE_NAME_LINE_HEIGHT;
const PROFILE_HEADER_ICON_GLYPH = Math.round(PROFILE_HEADER_TEXT_HEIGHT * 0.62);

type ProfileCard = {
  id: string;
  type: 'visa' | 'mastercard';
  last4: string;
  label: string;
};

const DEFAULT_PROFILE_CARDS: ProfileCard[] = [
  { id: '1', type: 'visa', last4: '4242', label: 'Prepaid Visa' },
  { id: '2', type: 'mastercard', last4: '8888', label: 'Ridr Mastercard' },
];

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
  const { signOut } = useAuth();
  const { colors, isDark, themeOverride, setThemeOverride } = useAppTheme();
  usePushToken();
  const [selectedRide, setSelectedRide] = useState('ride');
  const [activeTab, setActiveTab] = useState('home');
  const [activitySearch, setActivitySearch] = useState('');
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [favSearch, setFavSearch] = useState('');
  const [favSearchOpen, setFavSearchOpen] = useState(false);
  const [selectedRideDetail, setSelectedRideDetail] = useState<typeof mockRideHistory[0] | null>(null);
  const [screen, setScreen] = useState<
    'home' | 'profile' | 'profileEdit' |
    'settingsNotifications' | 'settingsPassword' | 'settingsLanguage' |
    'settingsAppearance' | 'settingsHelp' | 'settingsTerms' | 'settingsSupport'
  >('home');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [sheetMinimized, setSheetMinimized] = useState(false);
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
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationFocused, setDestinationFocused] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const destinationInputRef = useRef<TextInput>(null);
  const [toQuery, setToQuery] = useState('');
  const [toFocused, setToFocused] = useState(false);
  const [toUserEdited, setToUserEdited] = useState(false);
  const [toApiSuggestions, setToApiSuggestions] = useState<SearchSuggestion[]>([]);
  const [destinationApiSuggestions, setDestinationApiSuggestions] = useState<SearchSuggestion[]>([]);
  const [destinationPreviewCoordinate, setDestinationPreviewCoordinate] = useState<LatLng | null>(null);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('Current location');
  const [roadRouteCoords, setRoadRouteCoords] = useState<LatLng[]>([]);
  const [routeAnimatorPoint, setRouteAnimatorPoint] = useState<LatLng | null>(null);
  const [routeIssue, setRouteIssue] = useState<string | null>(null);
  const toInputRef = useRef<TextInput>(null);
  const toFocusedRef = useRef(false);
  const destinationFocusedRef = useRef(false);

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
  const [cards, setCards] = useState<ProfileCard[]>(DEFAULT_PROFILE_CARDS);
  const [defaultCard, setDefaultCard] = useState('1');
  const [addCardVisible, setAddCardVisible] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');

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
        savedCardsJson,
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
        AsyncStorage.getItem('profile_cards'),
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

      if (savedCardsJson) {
        try {
          const parsed = JSON.parse(savedCardsJson) as ProfileCard[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCards(parsed);
            const defId = await AsyncStorage.getItem('profile_default_card');
            setDefaultCard(defId && parsed.some(c => c.id === defId) ? defId : parsed[0].id);
          }
        } catch {
          /* keep default */
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
  }, [userCountryCode]);

  useEffect(() => {
    sheetMinimizedRef.current = sheetMinimized;
  }, [sheetMinimized]);

  useEffect(() => {
    if (selectedRide === 'rental') setSelectedRide('ride');
  }, [selectedRide]);

  useEffect(() => {
    if (userLocation && !toUserEdited) {
      setToQuery(currentLocationLabel);
    }
  }, [userLocation, toUserEdited, currentLocationLabel]);

  useEffect(() => {
    const hasFrom = !!toQuery.trim();
    const hasTo = !!destinationQuery.trim();
    if (hasFrom || !hasTo || userLocation) {
      setDestinationPreviewCoordinate(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { key: mapsApiKey } = resolveGoogleMapsApiKey();
      const destination = await geocodeAddress(destinationQuery, mapsApiKey ?? undefined);
      if (!cancelled) setDestinationPreviewCoordinate(destination.coordinate);
    })();

    return () => {
      cancelled = true;
    };
  }, [toQuery, destinationQuery, userLocation]);

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
            : await geocodeAddress(toQuery, mapsApiKey ?? undefined);

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
            : await geocodeAddress(destinationQuery, mapsApiKey ?? undefined);

        const destination = destinationResult.coordinate;

        if (!origin || !destination) {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteIssue(
              `Could not resolve origin/destination. ${originResult.issue ?? ''} ${destinationResult.issue ?? ''}`.trim()
            );
          }
          return;
        }

        if (!mapsApiKey) {
          if (!cancelled) {
            setRoadRouteCoords([]);
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
            setRouteIssue(`Directions HTTP ${response.status}`);
          }
          return;
        }
        const data = (await response.json()) as {
          status?: string;
          error_message?: string;
          routes?: Array<{ overview_polyline?: { points?: string } }>;
        };
        if (data.status !== 'OK') {
          if (!cancelled) {
            setRoadRouteCoords([]);
            setRouteIssue(
              `Directions unavailable (${data.status ?? 'unknown'})${data.error_message ? `: ${data.error_message}` : ''}.`
            );
          }
          return;
        }
        const encoded = data.routes?.[0]?.overview_polyline?.points;
        if (!cancelled && encoded) {
          const decoded = decodeGooglePolyline(encoded);
          setRoadRouteCoords(decoded.length > 1 ? decoded : []);
          setRouteIssue(decoded.length > 1 ? null : 'No route geometry returned.');
        } else if (!cancelled) {
          setRoadRouteCoords([]);
          setRouteIssue('No route geometry returned.');
        }
      } catch (err) {
        if (!cancelled) {
          setRoadRouteCoords([]);
          setRouteIssue(`Failed to fetch road directions: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toQuery, destinationQuery, userLocation, currentLocationLabel]);

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
  const ui = {
    screenBg: isDark ? '#0c0c0d' : '#f5f5f5',
    panelBg: isDark ? '#151517' : '#ffffff',
    cardBg: isDark ? '#1b1c20' : '#ffffff',
    softBg: isDark ? '#202227' : '#f7f7f7',
    text: isDark ? '#f5f5f5' : '#171717',
    textMuted: isDark ? '#a1a1aa' : '#666666',
    divider: isDark ? '#2b2b31' : '#e9e9e9',
    placeholder: isDark ? '#7b7b85' : '#aaaaaa',
    headerOverlay: isDark ? 'rgba(12,12,13,0.88)' : 'rgba(255,255,255,0.82)',
    tabActive: isDark ? '#f5f5f5' : '#1a1a1a',
    tabInactive: isDark ? '#b3b3c2' : '#aaaaaa',
    ctaBg: isDark ? '#ffd54a' : '#171717',
    ctaText: isDark ? '#171717' : '#ffffff',
  } as const;
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

  const countryCodes = [
    { code: '+1', label: 'US / CA' },
    { code: '+44', label: 'UK' },
    { code: '+91', label: 'India' },
  ];

  const openAddress = (type: 'home' | 'work') => {
    setAddressInput(type === 'home' ? homeAddress : workAddress);
    setAddressModal(type);
  };

  const closeAddCardSheet = () => {
    setAddCardVisible(false);
    setNewCardNumber('');
    setNewCardName('');
    setNewCardExpiry('');
    setNewCardCvv('');
  };

  const saveNewCard = async () => {
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
    const last4 = digits.slice(-4);
    const first = digits[0];
    const type: 'visa' | 'mastercard' = first === '5' ? 'mastercard' : 'visa';
    const label = newCardName.trim() || `Card •••• ${last4}`;
    const id = `c_${Date.now()}`;
    const next: ProfileCard[] = [...cards, { id, type, last4, label }];
    setCards(next);
    setDefaultCard(id);
    await AsyncStorage.setItem('profile_cards', JSON.stringify(next));
    await AsyncStorage.setItem('profile_default_card', id);
    closeAddCardSheet();
  };

  const mapCenter = destinationPreviewCoordinate ?? userLocation ?? JAMAICA_KINGSTON;
  const toNormalized = toQuery.trim().toLowerCase();
  const isCurrentLocationQuery =
    !!userLocation &&
    (toNormalized === 'current location' || toNormalized === currentLocationLabel.toLowerCase());
  const pickupCoordinate = roadRouteCoords.length > 0 ? roadRouteCoords[0] : null;
  const dropoffCoordinate =
    roadRouteCoords.length > 0 ? roadRouteCoords[roadRouteCoords.length - 1] : null;
  const hasRouteInputs = !!toQuery.trim() && !!destinationQuery.trim();
  const hasRoute = hasRouteInputs && roadRouteCoords.length > 1;
  const showPickupPoint = !!userLocation && isCurrentLocationQuery && !hasRoute;
  const showDestinationOnlyPoint = !hasRoute && !showPickupPoint && !!destinationPreviewCoordinate;

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

  const fetchPlaceSuggestions = useCallback(
    async (input: string): Promise<SearchSuggestion[]> => {
      const query = input.trim();
      if (!query) return [];

      const { key } = resolveGoogleMapsApiKey();
      if (!key) return [];

      const locationBias = userLocation
        ? `&location=${userLocation.latitude},${userLocation.longitude}&radius=35000`
        : '';
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}` +
        `&key=${key}&language=en&components=country:jm${locationBias}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const data = (await res.json()) as {
        status?: string;
        predictions?: Array<{
          place_id?: string;
          description?: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        }>;
      };
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
      const rows = Array.isArray(data.predictions) ? data.predictions : [];

      return rows.slice(0, 8).map((p, i) => {
        const title = p.structured_formatting?.main_text?.trim() || p.description?.split(',')[0]?.trim() || query;
        const subtitle = p.structured_formatting?.secondary_text?.trim() || p.description?.trim() || '';
        return {
          id: p.place_id || `place-${title}-${i}`,
          title,
          subtitle,
          icon: 'location',
          fullText: p.description?.trim() || `${title}${subtitle ? `, ${subtitle}` : ''}`,
        };
      });
    },
    [userLocation]
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

  // Animated drag-to-expand-map
  const panValue = useRef(new Animated.Value(0)).current;
  const minimizedTranslateY = useRef(new Animated.Value(0)).current;
  const destinationLiftAnim = useRef(new Animated.Value(0)).current;
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
  const searchSuggestions: SearchSuggestion[] = [
    ...(homeAddress ? [{ id: 'saved-home', title: 'Home', subtitle: homeAddress, icon: 'home' as const }] : []),
    ...(workAddress ? [{ id: 'saved-work', title: 'Work', subtitle: workAddress, icon: 'briefcase' as const }] : []),
    ...destinationSuggestions,
  ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);

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
  const minimizedMapH = minimizedTranslateY.interpolate({
    inputRange: [0, sheetMinimizeRange],
    outputRange: [MAP_HEIGHT, SCREEN_HEIGHT],
    extrapolate: 'clamp',
  });
  /** Expand map to full screen while search is focused so it shows behind the sheet */
  const searchMapExpansion = destinationLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT - MAP_HEIGHT],
    extrapolate: 'clamp',
  });
  const mapHeightAnim = Animated.add(minimizedMapH, searchMapExpansion);
  /** Clip the sheet height when searching so the map is visible below the search card */
  const searchSheetMaxHeight = destinationLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BOTTOM_SHEET_HEIGHT, 420],
    extrapolate: 'clamp',
  });
  /** Fade the sheet panel background out when search is focused so map shows through */
  const sheetBgOpacity = destinationLiftAnim.interpolate({
    inputRange: [0, 0.6],
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
    setSearchExpanded(false);
    destinationInputRef.current?.blur();
    toInputRef.current?.blur();
    Animated.spring(destinationLiftAnim, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
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
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        if (sheetMinimizedRef.current) {
          return gs.dy < -8 && Math.abs(gs.dy) > Math.abs(gs.dx);
        }
        return scrollOffsetRef.current <= 0 && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
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
          destinationLiftAnim.setValue(0);
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

  const handleDestinationFocus = () => {
    if (sheetMinimized) {
      expandSheetFromMinimized();
    }
    destinationFocusedRef.current = true;
    setDestinationFocused(true);
    setSearchExpanded(true);
    Animated.spring(destinationLiftAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const handleDestinationBlur = () => {
    setTimeout(() => {
      destinationFocusedRef.current = false;
      setDestinationFocused(false);
    }, 220);
  };

  const handleToFocus = () => {
    if (sheetMinimized) {
      expandSheetFromMinimized();
    }
    toFocusedRef.current = true;
    setToFocused(true);
    setSearchExpanded(true);
    Animated.spring(destinationLiftAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const handleToBlur = () => {
    setTimeout(() => {
      toFocusedRef.current = false;
      setToFocused(false);
    }, 220);
  };

  const selectDestination = (value: string) => {
    setDestinationQuery(value);
    destinationInputRef.current?.blur();
    destinationFocusedRef.current = false;
    setDestinationFocused(false);
  };

  const selectTo = (value: string) => {
    setToUserEdited(true);
    setToQuery(value);
    toInputRef.current?.blur();
    toFocusedRef.current = false;
    setToFocused(false);
  };

  const searchSheetTranslateY = destinationLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(MAP_HEIGHT - 128)],
  });

  // ── Profile (read-only) ─────────────────────────────────────────
  if (screen === 'profile') {
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.screenBg, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Profile</Text>
          <Pressable style={styles.editProfileHeaderSide} onPress={openProfileEdit} hitSlop={8}>
            <Ionicons name="pencil" size={22} color={ui.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.editProfileScroll}
          contentContainerStyle={styles.profileViewScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.editProfileAvatarWrap}>
            <View style={[styles.editProfileAvatarImage, { backgroundColor: ui.softBg }]}>
              <Ionicons name="person" size={56} color={ui.textMuted} />
            </View>
          </View>

          <View style={styles.profileViewSectionHeadingWrap}>
            <Text style={[styles.profileViewSectionTitle, { color: ui.text }]}>Personal information</Text>
          </View>
          <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg }]}>
            <View style={styles.profileViewRow}>
              <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>First name</Text>
              <Text style={[styles.profileViewValue, { color: ui.text }]}>{userFirstName.trim() ? userFirstName : '—'}</Text>
            </View>
            <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.profileViewRow}>
              <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>Last name</Text>
              <Text style={[styles.profileViewValue, { color: ui.text }]}>{userLastName.trim() ? userLastName : '—'}</Text>
            </View>
            <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
            <View style={[styles.profileViewRow, styles.profileViewRowTop]}>
              <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>Email</Text>
              <Text style={[styles.profileViewValue, styles.profileViewValueMultiline, { color: ui.text }]} numberOfLines={4}>
                {userEmail.trim() ? userEmail : '—'}
              </Text>
            </View>
            <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
            <View style={[styles.profileViewRow, styles.profileViewRowTop]}>
              <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>Phone</Text>
              <Text style={[styles.profileViewValue, styles.profileViewValueMultiline, { color: ui.text }]} numberOfLines={3}>
                {userPhoneE164 ? formatE164International(userPhoneE164) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.profilePaymentSectionHeader}>
            <Text style={[styles.profileViewSectionTitle, styles.profileViewSectionTitleFlex, { color: ui.text }]}>Payment methods</Text>
            <Pressable
              style={styles.profileAddCardIconBtn}
              onPress={() => {
                setNewCardNumber('');
                setNewCardName('');
                setNewCardExpiry('');
                setNewCardCvv('');
                setAddCardVisible(true);
              }}
              hitSlop={8}
              accessibilityLabel="Add card"
            >
              <Ionicons name="add" size={20} color={ui.text} />
            </Pressable>
          </View>
          <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg }]}>
            {cards.map((card, i) => (
              <View key={card.id}>
                <Pressable
                  style={styles.profilePaymentRow}
                  onPress={() => {
                    setDefaultCard(card.id);
                    void AsyncStorage.setItem('profile_default_card', card.id);
                  }}
                >
                  <View style={[styles.profilePaymentCardIcon, card.type === 'visa' ? styles.profilePaymentVisa : styles.profilePaymentMc]}>
                    <Text style={styles.profilePaymentCardIconText}>{card.type === 'visa' ? 'VISA' : 'MC'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profilePaymentLabel, { color: ui.text }]}>{card.label}</Text>
                    <Text style={[styles.profilePaymentSub, { color: ui.textMuted }]}>•••• {card.last4}</Text>
                  </View>
                  {defaultCard === card.id && (
                    <View style={styles.profilePaymentDefaultBadge}>
                      <Text style={styles.profilePaymentDefaultText}>Default</Text>
                    </View>
                  )}
                  <Ionicons
                    name={defaultCard === card.id ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={defaultCard === card.id ? '#ffd54a' : ui.textMuted}
                  />
                </Pressable>
                {i < cards.length - 1 ? <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} /> : null}
              </View>
            ))}
          </View>

          <Pressable
            style={[
              styles.signOutButton,
              { backgroundColor: isDark ? '#7f1d1d' : '#fee2e2', borderColor: isDark ? '#b91c1c' : '#ef4444' },
            ]}
            onPress={onConfirmSignOut}
          >
            <Text style={[styles.signOutButtonText, { color: isDark ? '#fecaca' : '#b91c1c' }]}>Sign out</Text>
          </Pressable>
        </ScrollView>

        <Modal visible={addCardVisible} animationType="slide" transparent statusBarTranslucent>
          <KeyboardAvoidingView
            style={styles.addCardKb}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={closeAddCardSheet} />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.addCardScrollContent}
              >
                <View style={styles.addCardSheet}>
                  <View style={styles.modalHandle} />
                  <View style={styles.addCardPreview}>
                    <Image
                      source={addCardPreviewAsset}
                      style={styles.addCardPreviewImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.modalTitle}>Add card</Text>
                  <Text style={styles.modalLabel}>Card number</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newCardNumber}
                    onChangeText={setNewCardNumber}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor="#aaa"
                    keyboardType="number-pad"
                    autoComplete="cc-number"
                  />
                  <Text style={styles.modalLabel}>Name on card</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newCardName}
                    onChangeText={setNewCardName}
                    placeholder="As printed on card"
                    placeholderTextColor="#aaa"
                    autoCapitalize="characters"
                  />
                  <View style={styles.addCardRow}>
                    <View style={styles.addCardRowField}>
                      <Text style={styles.modalLabel}>Expiry</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={newCardExpiry}
                        onChangeText={setNewCardExpiry}
                        placeholder="MM/YY"
                        placeholderTextColor="#aaa"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.addCardRowField}>
                      <Text style={styles.modalLabel}>CVV</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={newCardCvv}
                        onChangeText={setNewCardCvv}
                        placeholder="•••"
                        placeholderTextColor="#aaa"
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                    </View>
                  </View>
                  <Pressable style={styles.modalSaveBtn} onPress={() => { void saveNewCard(); }}>
                    <Text style={styles.modalSaveBtnText}>Add card</Text>
                  </Pressable>
                  <Pressable style={styles.modalCancelBtn} onPress={closeAddCardSheet}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // ── Edit Profile ────────────────────────────────────────────────
  if (screen === 'profileEdit') {
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.screenBg, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('profile')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Edit Profile</Text>
          <Pressable
            style={styles.editProfileHeaderSide}
            onPress={() => { void saveProfile(); }}
            hitSlop={8}
          >
            <Ionicons
              name="checkmark"
              size={28}
              color={profileDirty ? '#22c55e' : '#c8c8c8'}
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.editProfileScroll}
          contentContainerStyle={styles.editProfileScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.editProfileAvatarWrap}>
            <View style={[styles.editProfileAvatarImage, { backgroundColor: ui.softBg }]}>
              <Ionicons name="person" size={56} color={ui.textMuted} />
            </View>
            <Pressable style={[styles.editProfileAvatarCamera, { backgroundColor: ui.cardBg }]} hitSlop={6}>
              <Ionicons name="camera" size={18} color={ui.text} />
            </Pressable>
          </View>

          <View style={styles.editProfileField}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>First name</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={editingFirstName}
              onChangeText={setEditingFirstName}
              placeholder="Charlotte"
              placeholderTextColor={ui.placeholder}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Last name</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={editingLastName}
              onChangeText={setEditingLastName}
              placeholder="King"
              placeholderTextColor={ui.placeholder}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>E mail address</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={editingEmail}
              onChangeText={setEditingEmail}
              placeholder="johnkinggraphics@gmail.com"
              placeholderTextColor={ui.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>User name</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={editingUsername}
              onChangeText={setEditingUsername}
              placeholder="@johnkinggraphics"
              placeholderTextColor={ui.placeholder}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Password</Text>
            <View style={[styles.editProfilePasswordRow, { backgroundColor: ui.softBg }]}>
              <TextInput
                style={[styles.editProfileInput, styles.editProfilePasswordInput, { backgroundColor: 'transparent', color: ui.text }]}
                value={editingPassword}
                onChangeText={setEditingPassword}
                placeholder="••••••••••"
                placeholderTextColor={ui.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable style={styles.editProfileEyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color={ui.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.editProfileField}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Phone number</Text>
            <View style={styles.editProfilePhoneRow}>
              <Pressable style={[styles.editProfileCountryBtn, { backgroundColor: ui.softBg }]} onPress={() => setCountryPickerVisible(true)}>
                <Text style={[styles.editProfileCountryText, { color: ui.text }]}>{countryCode}</Text>
                <Ionicons name="chevron-down" size={16} color={ui.text} />
              </Pressable>
              <TextInput
                style={[styles.editProfileInput, styles.editProfilePhoneInput, { backgroundColor: ui.softBg, color: ui.text }]}
                value={editingPhone}
                onChangeText={setEditingPhone}
                placeholder="6895312"
                placeholderTextColor={ui.placeholder}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={[styles.editProfileHint, { color: ui.textMuted }]}>
              Valid mobile or landline for your country. Saved as E.164. Each number can only be linked once on this device.
            </Text>
          </View>
        </ScrollView>

        <Modal visible={countryPickerVisible} animationType="fade" transparent statusBarTranslucent>
          <View style={styles.editProfilePickerOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCountryPickerVisible(false)} />
            <View style={[styles.editProfilePickerSheet, { backgroundColor: ui.cardBg }]}>
              <Text style={[styles.editProfilePickerTitle, { color: ui.text }]}>Country code</Text>
              {countryCodes.map(({ code, label }) => (
                <Pressable
                  key={code}
                  style={[styles.editProfilePickerRow, { borderBottomColor: ui.divider }]}
                  onPress={() => { setCountryCode(code); setCountryPickerVisible(false); }}
                >
                  <Text style={[styles.editProfilePickerCode, { color: ui.text }]}>{code}</Text>
                  <Text style={[styles.editProfilePickerLabel, { color: ui.textMuted }]}>{label}</Text>
                  {countryCode === code ? <Ionicons name="checkmark" size={20} color="#22c55e" /> : <View style={{ width: 20 }} />}
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>

        <Modal visible={addressModal !== null} animationType="slide" transparent statusBarTranslucent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
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
      </View>
    );
  }

  // ── Settings sub-screens ─────────────────────────────────────────

  if (screen === 'settingsNotifications') {
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Notifications</Text>
          <View style={styles.editProfileHeaderSide} />
        </View>
        <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>

          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Trips</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Ride updates</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Status changes & driver info</Text>
              </View>
              <Switch value={notifRideUpdates} onValueChange={setNotifRideUpdates} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
            <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Driver arrival</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Alert when your driver is nearby</Text>
              </View>
              <Switch value={notifDriverArrival} onValueChange={setNotifDriverArrival} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
            <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Trip receipts</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Email & in-app receipt after each trip</Text>
              </View>
              <Switch value={notifTripReceipt} onValueChange={setNotifTripReceipt} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
          </View>

          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Promotions</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Deals & offers</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Discounts and promo codes</Text>
              </View>
              <Switch value={notifPromos} onValueChange={setNotifPromos} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
            <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>New features</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Product updates and announcements</Text>
              </View>
              <Switch value={notifNewFeatures} onValueChange={setNotifNewFeatures} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
            <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Surveys & feedback</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Help us improve Ridr</Text>
              </View>
              <Switch value={notifSurveys} onValueChange={setNotifSurveys} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
          </View>

          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Account</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Security alerts</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Sign-ins and password changes</Text>
              </View>
              <Switch value={notifSecurity} onValueChange={setNotifSecurity} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
            <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: ui.text }]}>Payment activity</Text>
                <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Charges, refunds & payment issues</Text>
              </View>
              <Switch value={notifPayments} onValueChange={setNotifPayments} trackColor={{ true: isDark ? '#ffffff' : '#171717', false: ui.softBg }} thumbColor={isDark ? '#171717' : '#fff'} />
            </View>
          </View>

        </ScrollView>
      </View>
    );
  }

  if (screen === 'settingsPassword') {
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Change Password</Text>
          <View style={styles.editProfileHeaderSide} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, marginTop: 20, padding: 16, gap: 12 }]}>
              <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>New password</Text>
              <TextInput
                style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={ui.placeholder}
                secureTextEntry
                autoComplete="password-new"
              />
              <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Confirm password</Text>
              <TextInput
                style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor={ui.placeholder}
                secureTextEntry
              />
            </View>
            <Pressable
              style={[styles.modalSaveBtn, { marginTop: 24, backgroundColor: ui.text }]}
              onPress={() => {
                if (!newPassword || newPassword.length < 6) { Alert.alert('Password', 'Use at least 6 characters.'); return; }
                if (newPassword !== confirmPassword) { Alert.alert('Password', 'Passwords do not match.'); return; }
                Alert.alert('Password', 'Password updated successfully.');
                setNewPassword('');
                setConfirmPassword('');
                setScreen('home');
              }}
            >
              <Text style={[styles.modalSaveBtnText, { color: ui.screenBg }]}>Update Password</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  if (screen === 'settingsLanguage') {
    const langs = ['English', 'Spanish', 'French', 'Patois'];
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Language</Text>
          <View style={styles.editProfileHeaderSide} />
        </View>
        <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, marginTop: 20 }]}>
            {langs.map((lang, i) => (
              <View key={lang}>
                <Pressable
                  style={[styles.settingsRow, { paddingVertical: 16 }]}
                  onPress={() => { setSelectedLang(lang); setScreen('home'); }}
                >
                  <Text style={[styles.settingsRowLabel, { color: ui.text }]}>{lang}</Text>
                  {selectedLang === lang
                    ? <Ionicons name="checkmark-circle" size={22} color={ui.ctaBg} />
                    : <Ionicons name="ellipse-outline" size={22} color={ui.textMuted} />}
                </Pressable>
                {i < langs.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'settingsAppearance') {
    const options: Array<{ label: string; value: import('../../theme/ThemeProvider').ThemeOverride; icon: string }> = [
      { label: 'System default', value: 'system', icon: 'phone-portrait-outline' },
      { label: 'Light', value: 'light', icon: 'sunny-outline' },
      { label: 'Dark', value: 'dark', icon: 'moon-outline' },
    ];
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Appearance</Text>
          <View style={styles.editProfileHeaderSide} />
        </View>
        <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Theme</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
            {options.map((opt, i) => (
              <View key={opt.value}>
                <Pressable
                  style={[styles.settingsRow, { paddingVertical: 16 }]}
                  onPress={() => setThemeOverride(opt.value)}
                >
                  <Ionicons name={opt.icon as never} size={20} color={ui.text} />
                  <Text style={[styles.settingsRowLabel, { color: ui.text }]}>{opt.label}</Text>
                  {themeOverride === opt.value
                    ? <Ionicons name="checkmark-circle" size={22} color={ui.ctaBg} />
                    : <Ionicons name="ellipse-outline" size={22} color={ui.textMuted} />}
                </Pressable>
                {i < options.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'settingsHelp') {
    const faqs = [
      'How do I book a ride?',
      'How do I cancel a trip?',
      'How do I update my payment method?',
      'I have a complaint about a driver.',
    ];
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Help Centre</Text>
          <View style={styles.editProfileHeaderSide} />
        </View>
        <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Frequently asked questions</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
            {faqs.map((q, i) => (
              <View key={q}>
                <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => Alert.alert('Help', q)}>
                  <Ionicons name="chatbubble-outline" size={20} color={ui.text} />
                  <Text style={[styles.settingsRowLabel, { color: ui.text, fontWeight: '500' }]}>{q}</Text>
                  <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                </Pressable>
                {i < faqs.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
              </View>
            ))}
          </View>
          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Still need help?</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
            <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => setScreen('settingsSupport')}>
              <Ionicons name="headset-outline" size={20} color={ui.text} />
              <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Contact Support</Text>
              <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'settingsSupport') {
    return <SupportTicketScreen ui={ui} isDark={isDark} userEmail={userEmail} userFirstName={userFirstName} onBack={() => setScreen('home')} />;
  }

  if (screen === 'settingsTerms') {
    return (
      <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={ui.text} />
          </Pressable>
          <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Terms & Privacy</Text>
          <View style={styles.editProfileHeaderSide} />
        </View>
        <ScrollView style={styles.editProfileScroll} contentContainerStyle={[styles.editProfileScrollContent, { paddingTop: 20 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Terms of Service</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16 }]}>
            <Text style={[styles.notifRowSub, { color: ui.text, lineHeight: 22 }]}>
              {`By using Ridr, you agree to our Terms of Service. We collect location data to provide ride services and improve the app experience.\n\nRidr reserves the right to update these terms. Continued use of the app constitutes acceptance of any changes.`}
            </Text>
          </View>
          <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Privacy Policy</Text>
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16 }]}>
            <Text style={[styles.notifRowSub, { color: ui.text, lineHeight: 22 }]}>
              {`Your personal data is never sold to third parties. You may request deletion of your data at any time by contacting support@ridr.app.`}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────

  return (
      <View key={ANIMATION_TREE_KEY} style={[styles.safeArea, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent={Platform.OS === 'android'} />

      {/* Map: short when sheet is up, full screen when sheet is lowered */}
      <Animated.View style={[styles.mapWrapper, { height: mapHeightAnim }]}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            if (searchExpanded) {
              collapseSearchMode();
            }
          }}
          region={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
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
          ) : showPickupPoint ? (
            <Marker coordinate={userLocation!} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.mapMarkerPickup} />
            </Marker>
          ) : showDestinationOnlyPoint ? (
            <Marker coordinate={destinationPreviewCoordinate!} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.mapMarkerDropoff} />
            </Marker>
          ) : null}
        </MapView>
        <Pressable
          style={styles.mapExpandBtn}
          onPress={() => {
            if (sheetMinimized) {
              expandSheetFromMinimized();
            } else {
              setMapExpanded(true);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={sheetMinimized ? 'Show bottom sheet' : 'Full screen map'}
        >
          <Ionicons name={sheetMinimized ? 'chevron-up' : 'expand'} size={16} color="#ffffff" />
        </Pressable>
      </Animated.View>

      {/* Full-screen map modal */}
      <Modal visible={mapExpanded} animationType="fade" statusBarTranslucent>
        <View style={styles.expandedMapWrap}>
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFillObject}
            region={{
              latitude: mapCenter.latitude,
              longitude: mapCenter.longitude,
              latitudeDelta: 0.018,
              longitudeDelta: 0.018,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={true}
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
            ) : showPickupPoint ? (
              <Marker coordinate={userLocation!} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.mapMarkerPickup} />
              </Marker>
            ) : showDestinationOnlyPoint ? (
              <Marker coordinate={destinationPreviewCoordinate!} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.mapMarkerDropoff} />
              </Marker>
            ) : null}
          </MapView>
          <Pressable style={styles.mapCollapseBtn} onPress={() => setMapExpanded(false)}>
            <Ionicons name="contract" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </Modal>

      {/* Header — floats over map, fades out when searching */}
      {activeTab === 'home' ? <Animated.View style={[styles.fixedHeader, { backgroundColor: ui.headerOverlay, opacity: sheetBgOpacity }]} pointerEvents={searchExpanded ? 'none' : 'auto'}>
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
          <Pressable style={[styles.supportButton, { backgroundColor: isDark ? '#2b2b31' : '#171717' }]} onPress={() => setScreen('settingsSupport')}>
            <SupportIcon color={isDark ? ui.text : '#ffffff'} />
          </Pressable>
        </View>
      </Animated.View> : null}

      {/* Profile Modal — replaced by full screen, block removed */}

      {/* Ride Detail Modal */}
      <Modal visible={selectedRideDetail !== null} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setSelectedRideDetail(null)}>
        <Pressable style={styles.rideDetailOverlay} onPress={() => setSelectedRideDetail(null)}>
          <Pressable style={[styles.rideDetailSheet, { backgroundColor: ui.cardBg }]} onPress={() => {}}>
            <View style={styles.rideDetailHandle} />
            <View style={[styles.rideDetailIconWrap, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}>
              <Ionicons name="car" size={32} color={ui.text} />
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
            <Pressable style={styles.rideDetailBookBtn} onPress={() => setSelectedRideDetail(null)}>
              <Text style={styles.rideDetailBookBtnText}>Book Again</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Address Modal */}
      <Modal visible={addressModal !== null} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
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

      {/* Bottom sheet — scrollable cards */}
      <Animated.View
        style={[
          styles.contentScroll,
          { backgroundColor: 'transparent', maxHeight: searchSheetMaxHeight, overflow: 'hidden' },
          {
            transform: [
              {
                translateY: Animated.add(Animated.add(panValue, searchSheetTranslateY), minimizedTranslateY),
              },
            ],
          },
        ]}
        {...(!searchExpanded ? panResponder.panHandlers : {})}
      >
        {/* Panel background — fades out when search is focused so map shows through */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: ui.panelBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, opacity: sheetBgOpacity }]}
        />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={true}
        scrollEnabled={!searchExpanded}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        {/* Drag handle */}
        {!searchExpanded ? (
          <View style={styles.dragHandleZone}>
            <View style={styles.dragHandle} />
          </View>
        ) : null}

        {/* Destination Input Card */}
        <View style={[
          styles.destinationCard, 
          { backgroundColor: searchExpanded ? 'transparent' : ui.cardBg },
          searchExpanded
            ? {
                shadowOpacity: 0,
                elevation: 0,
                paddingHorizontal: 0,
                paddingVertical: 0,
                marginBottom: 0,
                position: 'absolute',
                top: -10,
                left: 0,
                right: 0,
                zIndex: 8,
              }
            : {}
        ]}>
          <View style={[
            styles.destinationSearchGroup, 
            { backgroundColor: searchExpanded ? 'transparent' : ui.softBg },
            searchExpanded ? { gap: 10, overflow: 'visible' } : {}
          ]}>
            <View pointerEvents="none" style={styles.searchConnector}>
              <View style={styles.searchConnectorTopDot} />
              <View style={styles.searchConnectorLine} />
              <View style={styles.searchConnectorBottomPinOuter}>
                <View style={styles.searchConnectorBottomPinInner} />
              </View>
            </View>

            <View
              style={[
                styles.whereToRow,
                !searchExpanded && styles.whereToRowTop,
                searchExpanded
                  && {
                    borderRadius: 0,
                    borderWidth: 0,
                    borderTopWidth: 0,
                    borderBottomWidth: 2.5,
                    borderBottomColor: '#171717',
                    marginLeft: 28,
                    marginRight: 14,
                  },
                toFocused ? styles.whereToRowActive : null,
                { backgroundColor: searchExpanded ? (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.66)') : (isDark ? '#22242a' : undefined) },
              ]}
            >
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
                placeholder="From where?"
                placeholderTextColor={ui.placeholder}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {!searchExpanded ? <View style={styles.whereToBottomLine} /> : null}
            </View>

            <View
              style={[
                styles.whereToRow,
                !searchExpanded && styles.whereToRowBottom,
                searchExpanded
                  && {
                    borderRadius: 0,
                    borderTopWidth: 0,
                    borderWidth: 0,
                    borderBottomWidth: 2.5,
                    borderBottomColor: '#171717',
                    marginLeft: 28,
                    marginRight: 14,
                  },
                destinationFocused ? styles.whereToRowActive : null,
                { backgroundColor: searchExpanded ? (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.66)') : (isDark ? '#22242a' : undefined) },
              ]}
            >
              <TextInput
                ref={destinationInputRef}
                style={[styles.whereToInput, { color: ui.text }]}
                value={destinationQuery}
                onChangeText={setDestinationQuery}
                onFocus={handleDestinationFocus}
                onBlur={handleDestinationBlur}
                placeholder="Where to?"
                placeholderTextColor={ui.placeholder}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {!searchExpanded ? <View style={[styles.whereToBottomLine, styles.whereToBottomLineFocused]} /> : null}
            </View>
          </View>

          {searchExpanded ? (
            <View style={styles.searchActionRow}>
              <Pressable style={[styles.nowBadge, styles.searchActionBadge, { backgroundColor: ui.ctaBg }]}>
                <Text style={[styles.nowText, { color: ui.ctaText }]}>Go ▾</Text>
              </Pressable>
            </View>
          ) : null}

          {hasRouteInputs && routeIssue ? (
            <Text style={styles.routeIssueText}>{routeIssue}</Text>
          ) : null}

          {toFocused && filteredToSuggestions.length > 0 ? (
            <View style={[styles.suggestionList, { backgroundColor: 'transparent', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }]}>
              <BlurView intensity={isDark ? 65 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
              {filteredToSuggestions.map((item, index) => (
                <View key={item.id}>
                  <Pressable style={styles.suggestionItem} onPressIn={() => selectTo(item.fullText ?? item.title)}>
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
            <View style={[styles.suggestionList, { backgroundColor: 'transparent', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }]}>
              <BlurView intensity={isDark ? 65 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
              {filteredSuggestions.map((item, index) => (
                <View key={item.id}>
                  <Pressable style={styles.suggestionItem} onPressIn={() => selectDestination(item.fullText ?? item.title)}>
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

          {!searchExpanded ? <View style={[styles.addressList, { backgroundColor: ui.cardBg }]}>
            <Pressable style={styles.addressItem} onPress={() => openAddress('home')}>
              <View style={[styles.addressIconHome, { backgroundColor: isDark ? '#2b2b31' : undefined }]}>
                <Ionicons name="home" size={14} color={ui.text} />
              </View>
              <View style={styles.addressTextBlock}>
                <Text style={[styles.addressLabel, { color: ui.text }]}>Home</Text>
                <Text style={[styles.addressSub, { color: ui.textMuted }]} numberOfLines={1}>{homeAddress || 'Add address'}</Text>
              </View>
              <Ionicons name={homeAddress ? 'pencil' : 'add-circle-outline'} size={18} color={ui.placeholder} />
            </Pressable>
            <View style={[styles.addressDivider, { backgroundColor: ui.divider }]} />
            <Pressable style={styles.addressItem} onPress={() => openAddress('work')}>
              <View style={[styles.addressIconWork, { backgroundColor: isDark ? '#2b2b31' : undefined }]}>
                <Ionicons name="briefcase" size={14} color={ui.text} />
              </View>
              <View style={styles.addressTextBlock}>
                <Text style={[styles.addressLabel, { color: ui.text }]}>Work</Text>
                <Text style={[styles.addressSub, { color: ui.textMuted }]} numberOfLines={1}>{workAddress || 'Add address'}</Text>
              </View>
              <Ionicons name={workAddress ? 'pencil' : 'add-circle-outline'} size={18} color={ui.placeholder} />
            </Pressable>
          </View> : null}
        </View>

        {/* Service Type Cards */}
        {!searchExpanded ? <Text style={[styles.serviceRowHeader, { color: ui.text }]}>Ready to ride?</Text> : null}
        {!searchExpanded ? <View style={styles.serviceRow}>
          {(
            [
              { id: 'ride', label: 'Ride', sub: '2 min away', discount: '10%' },
              { id: 'rental', label: 'Rental', sub: 'By the hour', discount: '15%' },
              { id: 'outstation', label: 'Outstation', sub: 'Long trips', discount: '25%' },
            ] as { id: string; label: string; sub: string; discount: string }[]
          ).map(({ id, label, sub, discount }) => {
            const disabled = id === 'rental';
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
                  <Text style={[styles.serviceDiscountText, active && styles.serviceDiscountTextActive, disabled && styles.serviceDiscountTextDisabled]}>
                    {discount} OFF
                  </Text>
                </View>
                <Text style={[styles.serviceTitle, active && styles.serviceTitleActive, disabled && styles.serviceTitleDisabled]}>{label}</Text>
                <Text style={[styles.serviceSubLabel, active && styles.serviceSubLabelActive, disabled && styles.serviceSubLabelDisabled]}>{sub}</Text>
              </Pressable>
            );
          })}
        </View> : null}

        {/* Top Drivers */}
        {!searchExpanded ? (
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
        ) : null}
      </ScrollView>
      </Animated.View>

      {/* ── Activity Tab ────────────────────────────────────── */}
      {activeTab === 'activity' ? (
        <View style={[styles.tabScreen, { backgroundColor: ui.screenBg }]}>
          <View style={[styles.tabScreenHeader, { backgroundColor: ui.panelBg, borderBottomColor: ui.divider }]}>
            <View style={styles.tabScreenHeaderRow}>
              <Text style={[styles.tabScreenTitle, { color: ui.text }]}>Activity</Text>
              <Pressable
                style={[styles.tabSearchIconBtn, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}
                onPress={() => { setActivitySearchOpen(v => !v); setActivitySearch(''); }}
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
                  placeholder="Search rides..."
                  placeholderTextColor={ui.placeholder}
                  autoFocus
                  autoCorrect={false}
                />
              </View>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={styles.tabScreenContent} showsVerticalScrollIndicator={false}>
            {mockRideHistory
              .filter(ride => !activitySearch.trim() || [ride.from, ride.to, ride.driver].some(s => s.toLowerCase().includes(activitySearch.toLowerCase())))
              .map((ride, i, arr) => (
              <View key={ride.id} style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
                <Pressable style={styles.rideHistoryItem} onPress={() => setSelectedRideDetail(ride)}>
                  <View style={[styles.rideHistoryIconWrap, { backgroundColor: driverAvatar(ride.driver).color }]}>
                    <Text style={styles.rideHistoryAvatarText}>{driverAvatar(ride.driver).initials}</Text>
                  </View>
                  <View style={styles.rideHistoryBody}>
                    <Text style={[styles.rideHistoryRoute, { color: ui.text }]} numberOfLines={1}>
                      {ride.from} → {ride.to}
                    </Text>
                    <Text style={[styles.rideHistoryMeta, { color: ui.textMuted }]}>{ride.date} · {ride.driver}</Text>
                    <View style={styles.rideHistoryStars}>
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Ionicons key={s} name={s < ride.rating ? 'star' : 'star-outline'} size={12} color="#ffd54a" />
                      ))}
                    </View>
                  </View>
                  <LinearGradient
                    colors={['#FFE033', '#FFB800']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.rideViewPill}
                  >
                    <Text style={styles.rideViewPillText}>View</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Favourites Tab ──────────────────────────────────── */}
      {activeTab === 'notifications' ? (
        <View style={[styles.tabScreen, { backgroundColor: ui.screenBg }]}>
          <View style={[styles.tabScreenHeader, { backgroundColor: ui.panelBg, borderBottomColor: ui.divider }]}>
            <View style={styles.tabScreenHeaderRow}>
              <Text style={[styles.tabScreenTitle, { color: ui.text }]}>Favourites</Text>
              <Pressable
                style={[styles.tabSearchIconBtn, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}
                onPress={() => { setFavSearchOpen(v => !v); setFavSearch(''); }}
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
          <ScrollView contentContainerStyle={styles.tabScreenContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Saved places</Text>
              {mockFavouritePlaces
                .filter(p => !favSearch.trim() || [p.title, p.subtitle].some(s => s.toLowerCase().includes(favSearch.toLowerCase())))
                .map((place) => (
                <View key={place.id} style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
                  <View style={styles.favItem}>
                    <View style={[styles.favIconWrap, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}>
                      <Ionicons name={place.icon} size={18} color={ui.text} />
                    </View>
                    <View style={styles.favBody}>
                      <Text style={[styles.favTitle, { color: ui.text }]}>{place.title}</Text>
                      <Text style={[styles.favSubtitle, { color: ui.textMuted }]}>{place.subtitle}</Text>
                    </View>
                    <Ionicons name="heart" size={18} color="#ef4444" />
                  </View>
                </View>
              ))}

            <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Frequent routes</Text>
              {[
                { from: 'Half-Way Tree', to: 'Norman Manley Airport', count: 6 },
                { from: 'New Kingston', to: 'Portmore Mall', count: 3 },
              ].map((route, i) => (
                <View key={i} style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
                  <View style={styles.favItem}>
                    <View style={[styles.favIconWrap, { backgroundColor: isDark ? '#2b2b31' : '#f0f0f0' }]}>
                      <Ionicons name="repeat" size={18} color={ui.text} />
                    </View>
                    <View style={styles.favBody}>
                      <Text style={[styles.favTitle, { color: ui.text }]}>{route.from} → {route.to}</Text>
                      <Text style={[styles.favSubtitle, { color: ui.textMuted }]}>{route.count} rides</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                  </View>
                </View>
              ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Settings Tab ────────────────────────────────────── */}
      {activeTab === 'settings' ? (
        <View style={[styles.tabScreen, { backgroundColor: ui.screenBg }]}>
          <View style={[styles.tabScreenHeader, { backgroundColor: ui.panelBg, borderBottomColor: ui.divider }]}>
            <Text style={[styles.tabScreenTitle, { color: ui.text }]}>Settings</Text>
          </View>
          <ScrollView contentContainerStyle={styles.tabScreenContent} showsVerticalScrollIndicator={false}>

            <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Account</Text>
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
              <Pressable style={styles.settingsRow} onPress={openProfile}>
                <Ionicons name="person-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Edit Profile</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
              <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsPassword')}>
                <Ionicons name="lock-closed-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Change Password</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
              <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsNotifications')}>
                <Ionicons name="notifications-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Notifications</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Preferences</Text>
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
              <Pressable style={styles.settingsRow} onPress={openProfile}>
                <Ionicons name="card-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Payment Methods</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
              <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsLanguage')}>
                <Ionicons name="language-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Language</Text>
                <View style={styles.settingsRowRight}>
                  <Text style={[styles.settingsRowValue, { color: ui.textMuted }]}>{selectedLang}</Text>
                  <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                </View>
              </Pressable>
              <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsAppearance')}>
                <Ionicons name="color-palette-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Appearance</Text>
                <View style={styles.settingsRowRight}>
                  <Text style={[styles.settingsRowValue, { color: ui.textMuted }]}>
                    {themeOverride === 'system' ? 'System' : themeOverride === 'light' ? 'Light' : 'Dark'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
                </View>
              </Pressable>
            </View>

            <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Support</Text>
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsHelp')}>
                <Ionicons name="help-circle-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Help Centre</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
              <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsSupport')}>
                <Ionicons name="headset-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Contact Support</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
              <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
              <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsTerms')}>
                <Ionicons name="document-text-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Terms & Privacy</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
            </View>
          </ScrollView>
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


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  contentScroll: {
    position: 'absolute',
    top: MAP_HEIGHT - 30,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 2,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 20,
    paddingTop: 68,
    paddingBottom: 15,
    zIndex: 5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 18,
  },
  dragHandleZone: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  profileLabels: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  profileIconShell: {
    width: PROFILE_HEADER_TEXT_HEIGHT,
    height: PROFILE_HEADER_TEXT_HEIGHT,
    borderRadius: PROFILE_HEADER_TEXT_HEIGHT / 2,
    backgroundColor: '#d8d8d8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: PROFILE_GREETING_LINE_HEIGHT,
  },
  userName: {
    color: '#171717',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: PROFILE_NAME_LINE_HEIGHT,
  },
  supportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#171717',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    backgroundColor: '#171717',
    borderRadius: 30,
    padding: 18,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  heroEyebrow: {
    color: '#ffd54a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.8,
  },
  heroBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#ffd54a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadgeLabel: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '900',
  },
  mapCard: {
    height: 240,
    borderRadius: 24,
    backgroundColor: '#dfe7ef',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  mapTopShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 54,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  mapMarkerPickup: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#171717',
    borderWidth: 5,
    borderColor: '#ffd54a',
  },
  mapMarkerDropoff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffd54a',
    borderWidth: 5,
    borderColor: '#171717',
  },
  routeAnimatorOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#171717',
  },
  routeAnimatorInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#171717',
  },
  mapTiltLayer: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 20,
    bottom: 20,
    borderRadius: 28,
    backgroundColor: '#f8fbff',
    transform: [{ rotate: '-8deg' }],
  },
  mapBlockLarge: {
    position: 'absolute',
    left: 26,
    top: 26,
    width: 92,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#dde7f0',
    transform: [{ rotate: '-11deg' }],
  },
  mapBlockMedium: {
    position: 'absolute',
    right: 28,
    top: 54,
    width: 78,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#d6e1eb',
    transform: [{ rotate: '10deg' }],
  },
  mapBlockSmall: {
    position: 'absolute',
    left: 54,
    bottom: 34,
    width: 120,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#dfe9f2',
    transform: [{ rotate: '7deg' }],
  },
  mapRouteShadow: {
    position: 'absolute',
    left: 76,
    right: 58,
    top: 74,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(42, 93, 160, 0.18)',
    transform: [{ rotate: '16deg' }],
  },
  mapRouteLine: {
    position: 'absolute',
    left: 72,
    right: 56,
    top: 70,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#3c79bf',
    transform: [{ rotate: '16deg' }],
  },
  mapRoadHorizontal: {
    position: 'absolute',
    top: 94,
    left: -24,
    right: 12,
    height: 26,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-14deg' }],
  },
  mapRoadVertical: {
    position: 'absolute',
    right: 88,
    top: -16,
    bottom: -24,
    width: 30,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '18deg' }],
  },
  mapPinPrimary: {
    position: 'absolute',
    left: 132,
    top: 92,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#171717',
    borderWidth: 5,
    borderColor: '#ffd54a',
  },
  mapPinSecondary: {
    position: 'absolute',
    right: 46,
    top: 68,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffd54a',
    borderWidth: 5,
    borderColor: '#171717',
  },
  driverChip: {
    position: 'absolute',
    right: 16,
    top: 20,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  driverChipText: {
    color: '#171717',
    fontSize: 12,
    fontWeight: '700',
  },
  mapCarMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -30,
    marginTop: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCarMarkerShadow: {
    position: 'absolute',
    bottom: -2,
    width: 54,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  mapCarMarkerBubble: {
    width: 76,
    height: 56,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  mapMiniCarLeft: {
    position: 'absolute',
    left: 34,
    top: 126,
    transform: [{ rotate: '-12deg' }, { scale: 0.72 }],
    opacity: 0.9,
  },
  mapMiniCarRight: {
    position: 'absolute',
    right: 18,
    bottom: 38,
    transform: [{ rotate: '10deg' }, { scale: 0.68 }],
    opacity: 0.85,
  },
  mapExpandBtn: {
    position: 'absolute',
    bottom: TAB_BAR_RESERVED_BOTTOM + 14,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(23,23,23,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  expandedMapWrap: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    backgroundColor: '#000',
  },
  mapCollapseBtn: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(23,23,23,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#171717',
    textAlign: 'center',
  },
  modalAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffd54a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
    backgroundColor: '#fafafa',
  },
  modalAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#555555',
    fontWeight: '500',
  },
  modalSaveBtn: {
    backgroundColor: '#171717',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalSaveBtnText: {
    color: '#ffd54a',
    fontSize: 16,
    fontWeight: '800',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '600',
  },
  supportModalIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  supportModalSubtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f7f7f7',
    borderRadius: 16,
  },
  supportOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#171717',
  },
  // Destination Card
  destinationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  destinationOverlay: {
    position: 'absolute',
    top: 108,
    left: 20,
    right: 20,
    zIndex: 7,
  },
  destinationOverlayInner: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 10,
  },
  destinationOverlaySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  destinationSearchGroup: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  whereToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f2f2f2',
    height: 52,
    paddingVertical: 0,
    paddingLeft: 54,
    paddingRight: 16,
    position: 'relative',
  },
  whereToRowTop: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  whereToRowBottom: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dcdcdc',
  },
  whereToRowActive: {
    backgroundColor: '#eef3f8',
  },
  whereToTriggerText: {
    color: '#aaaaaa',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  whereToTriggerTextFilled: {
    color: '#171717',
  },
  whereToInput: {
    color: '#171717',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  whereToBottomLine: {
    position: 'absolute',
    left: 44,
    right: 14,
    bottom: 7,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#171717',
    opacity: 0.9,
  },
  whereToBottomLineFocused: {
    left: 0,
    right: 0,
  },
  searchConnector: {
    position: 'absolute',
    left: 17,
    top: 16,
    bottom: 16,
    width: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  searchConnectorTopDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#f4c430',
    borderWidth: 2,
    borderColor: '#171717',
  },
  searchConnectorLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    backgroundColor: '#171717',
    borderRadius: 999,
  },
  searchConnectorBottomPinOuter: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  searchConnectorBottomPinInner: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#f4c430',
  },
  searchActionRow: {
    marginTop: 10,
    marginLeft: 28,
    marginRight: 14,
    alignItems: 'flex-end',
  },
  nowBadge: {
    backgroundColor: '#171717',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  searchActionBadge: {
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  routeIssueText: {
    color: '#9a6b00',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginHorizontal: 6,
  },
  suggestionList: {
    borderRadius: 20,
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#f2f2f2',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  suggestionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f7f7f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTextBlock: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSubtitle: {
    color: '#9b9b9b',
    fontSize: 12,
    fontWeight: '500',
  },
  suggestionActionIcon: {
    transform: [{ rotate: '45deg' }],
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: '#f1f1f1',
    marginLeft: 60,
    marginRight: 12,
  },
  addressList: {
    gap: 0,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  addressIconHome: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff8e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressIconWork: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f4fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressTextBlock: {
    flex: 1,
    gap: 1,
  },
  addressLabel: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '700',
  },
  addressSub: {
    color: '#aaaaaa',
    fontSize: 12,
    fontWeight: '400',
  },
  addressAddButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eef2f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressPlusHorizontal: {
    position: 'absolute',
    width: 12,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#65707d',
  },
  addressPlusVertical: {
    position: 'absolute',
    width: 2,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#65707d',
  },
  addressText: {
    color: '#171717',
    fontSize: 15,
    fontWeight: '600',
  },
  addressDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 48,
  },
  // Service Cards
  serviceRowHeader: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 4,
  },
  serviceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#FFD000',
    minHeight: 148,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceCardActive: {
    backgroundColor: '#FFD000',
    borderWidth: 0,
    shadowColor: '#c8880a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  serviceCardDisabled: {
    backgroundColor: '#fafafa',
    borderColor: '#e8e8e8',
    shadowOpacity: 0.04,
    elevation: 1,
    opacity: 0.6,
  },
  serviceCarImageWrap: {
    width: 76,
    height: 52,
    marginBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceCarImage: {
    width: '100%',
    height: '100%',
  },
  serviceDiscountPill: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  serviceDiscountPillActive: {
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  serviceDiscountPillDisabled: {
    backgroundColor: '#ececec',
  },
  serviceDiscountText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
  },
  serviceDiscountTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  serviceDiscountTextDisabled: {
    color: '#aaaaaa',
  },
  serviceTitle: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '800',
  },
  serviceTitleActive: {
    color: '#000000',
    fontWeight: '900',
  },
  serviceTitleDisabled: {
    color: '#aaaaaa',
  },
  serviceSubLabel: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  serviceSubLabelActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  serviceSubLabelDisabled: {
    color: '#cccccc',
  },
  // Top Drivers Section
  topDriversSection: {
    marginBottom: 24,
  },
  topDriversHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  topDriversTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  topDriversSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  topDriversOverflow: {
    overflow: 'hidden',
    marginHorizontal: -20,
    paddingHorizontal: 0,
  },
  topDriversScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  driverCard: {
    width: 150,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  driverAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  driverRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverRatingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  driverTripsBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  driverTripsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  driverBookBtn: {
    marginTop: 4,
    backgroundColor: '#FFD000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  driverBookBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  // Tab Bar Styles with Notch
  tabBar: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    height: 68,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
    zIndex: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabItemCenter: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaaaaa',
  },
  tabLabelActive: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  // ── Tab full-screen panels ─────────────────────────────
  tabScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  tabScreenHeader: {
    paddingTop: 68,
    paddingBottom: 15,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    gap: 10,
  },
  tabScreenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabSearchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
  },
  tabSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  tabScreenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  tabScreenContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 6,
  },
  tabSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
    marginLeft: 4,
  },
  // Ride Detail Modal
  rideDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  rideDetailSheet: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  rideDetailHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 8,
  },
  rideDetailIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  rideDetailRoute: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  rideDetailArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '60%',
    marginVertical: 2,
  },
  rideDetailLine: {
    flex: 1,
    height: 1,
  },
  rideDetailDivider: {
    height: 1,
    width: '100%',
    marginVertical: 12,
  },
  rideDetailMeta: {
    width: '100%',
    gap: 12,
  },
  rideDetailMetaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideDetailMetaLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  rideDetailMetaValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  rideDetailStars: {
    flexDirection: 'row',
    gap: 2,
  },
  rideDetailBookBtn: {
    marginTop: 16,
    backgroundColor: '#FFD000',
    borderRadius: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  rideDetailBookBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  tabCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  tabDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  // Ride history
  rideHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rideHistoryIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideHistoryAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rideHistoryBody: {
    flex: 1,
    gap: 2,
  },
  rideHistoryRoute: {
    fontSize: 14,
    fontWeight: '700',
  },
  rideHistoryMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  rideHistoryStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  rideHistoryPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  rideViewPill: {
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  rideViewPillText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Favourites
  favItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  favIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBody: {
    flex: 1,
    gap: 2,
  },
  favTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  favSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Settings
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  settingsRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsRowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  notifRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  notifRowSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  settingsSignOut: {
    marginTop: 20,
    marginHorizontal: 0,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  settingsSignOutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Edit Profile screen (reference layout)
  editProfileRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  editProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 4,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  editProfileHeaderSide: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#171717',
  },
  editProfileScroll: {
    flex: 1,
  },
  editProfileScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    paddingTop: 4,
  },
  profileViewScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    paddingTop: 4,
  },
  profileViewSectionHeadingWrap: {
    marginBottom: 10,
    marginTop: 4,
  },
  profilePaymentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  profileViewSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  profileViewSectionTitleFlex: {
    flex: 1,
  },
  profileAddCardIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileViewCard: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eeeeee',
  },
  profileViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  profileViewRowTop: {
    alignItems: 'flex-start',
  },
  profileViewLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
    flexShrink: 0,
    width: 100,
  },
  profileViewValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#555555',
    textAlign: 'right',
  },
  profileViewValueMultiline: {
    textAlign: 'right',
  },
  profileViewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8e8e8',
  },
  profilePaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  profilePaymentCardIcon: {
    width: 44,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePaymentVisa: {
    backgroundColor: '#1a1f71',
  },
  profilePaymentMc: {
    backgroundColor: '#eb001b',
  },
  profilePaymentCardIconText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profilePaymentLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171717',
  },
  profilePaymentSub: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  profilePaymentDefaultBadge: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  profilePaymentDefaultText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b8860b',
  },
  resetPasswordButton: {
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#171717',
    paddingVertical: 16,
    alignItems: 'center',
  },
  resetPasswordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
  },
  signOutButton: {
    marginBottom: 32,
    borderRadius: 16,
    backgroundColor: '#171717',
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  addCardKb: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  addCardScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  addCardSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    gap: 10,
    maxHeight: '88%',
  },
  addCardPreview: {
    alignSelf: 'center',
    width: '92%',
    maxWidth: 400,
    aspectRatio: 1.586,
    maxHeight: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCardPreviewImage: {
    width: '100%',
    height: '100%',
  },
  addCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addCardRowField: {
    flex: 1,
  },
  editProfileAvatarWrap: {
    alignSelf: 'center',
    marginBottom: 28,
    width: 120,
    height: 120,
    position: 'relative',
  },
  editProfileAvatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editProfileAvatarCamera: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  editProfileField: {
    marginBottom: 20,
  },
  editProfileHint: {
    fontSize: 12,
    lineHeight: 17,
    color: '#888888',
    marginTop: 8,
  },
  editProfileLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 8,
  },
  editProfileInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#4a4a4a',
  },
  editProfilePasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 4,
  },
  editProfilePasswordInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 14,
  },
  editProfileEyeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfilePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editProfileCountryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  editProfileCountryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a4a4a',
  },
  editProfilePhoneInput: {
    flex: 1,
  },
  editProfilePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  editProfilePickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  editProfilePickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171717',
    marginBottom: 8,
  },
  editProfilePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  editProfilePickerCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
    width: 56,
  },
  editProfilePickerLabel: {
    flex: 1,
    fontSize: 15,
    color: '#666666',
  },
  fabHalo: {
    display: 'none',
    position: 'absolute',
    bottom: 36,
    left: '50%',
    marginLeft: -34,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ffffff',
    zIndex: 8,
  },
  floatingButton: { display: 'none', position: 'absolute', bottom: 0, width: 0, height: 0, zIndex: 0 },
  plusButton: { width: 0, height: 0 },
  plusHorizontal: { width: 0, height: 0 },
  plusVertical: { width: 0, height: 0 },
});

