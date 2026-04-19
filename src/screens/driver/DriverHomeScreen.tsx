import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  paymentMethodToDisplay,
  updatePaymentMethod,
} from '../../api';
import { ensureDriverLocationReady } from '../../lib/driverLocationRequirement';
import { fetchDrivingRouteCoords } from '../../lib/directionsRoute';
import { clearAppCache } from '../../lib/appCacheStorage';
import { incomingRequestChimeUri } from '../../lib/incomingRequestChime';
import { useAuth } from '../../context/AuthContext';
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess } from '../../lib/haptics';
import { useAppTheme, type ThemeOverride } from '../../theme/ThemeProvider';
import { KSA_MAP_CENTER, type LatLng } from '../main/locationResolve';
import { RidrMapView } from '../main/map/RidrMapView';
import { useRidrMapMarkerStyles, useRidrMapRouteStroke } from '../main/map/useRidrMapVisuals';
import type { MainScreenUi } from '../main/mainScreenUi';
import { ProfileEditScreen } from '../main/profile/screens/ProfileEditScreen';
import type { ProfileCard } from '../main/profile/profileTypes';
import { AddPayoutModal, type PayoutAccount } from './AddPayoutModal';
import { DriverProfileScreen } from './DriverProfileScreen';
import type { TripStatus } from '../main/ride/activeTripTypes';
import { SettingsAppearanceScreen } from '../main/settings/screens/SettingsAppearanceScreen';
import { SettingsHelpScreen } from '../main/settings/screens/SettingsHelpScreen';
import { SettingsLanguageScreen } from '../main/settings/screens/SettingsLanguageScreen';
import { SettingsNotificationsScreen } from '../main/settings/screens/SettingsNotificationsScreen';
import { SettingsPasswordScreen } from '../main/settings/screens/SettingsPasswordScreen';
import { SettingsPaymentScreen } from '../main/settings/screens/SettingsPaymentScreen';
import { SettingsSupportScreen } from '../main/settings/screens/SettingsSupportScreen';
import { SettingsTermsScreen } from '../main/settings/screens/SettingsTermsScreen';
import { SettingsTabScreen, type TabUi } from '../main/tabs/SettingsTabScreen';
import { NotificationsScreen } from '../main/notifications/NotificationsScreen';
import { DriverHomeTabContent } from './components/DriverHomeTabContent';
import { DriverTripsTabContent } from './components/DriverTripsTabContent';

type DriverTab = 'home' | 'trips' | 'settings';
type DriverSubScreen =
  | null
  | 'profile'
  | 'profileEdit'
  | 'notifications'
  | 'cashOut'
  | 'allTrips'
  | 'settingsPassword'
  | 'settingsPayment'
  | 'settingsNotifications'
  | 'settingsLanguage'
  | 'settingsAppearance'
  | 'settingsHelp'
  | 'settingsSupport'
  | 'settingsTerms';

type IncomingRequest = {
  id: string;
  riderName: string;
  riderPhone?: string;
  pickup: string;
  pickupCoordinate: LatLng;
  dropoff: string;
  dropoffCoordinate: LatLng;
  fare: string;
  eta: string;
  distance: string;
  paymentLabel: 'Card' | 'Cash';
};

type DriverTripStatus = Extract<TripStatus, 'matched' | 'arrived' | 'in_trip' | 'completed' | 'cancelled'>;

type DriverTrip = IncomingRequest & {
  status: DriverTripStatus;
  startPin: string;
  acceptedAtMs: number;
  arrivedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
};

const DRIVER_PROGRESS_STEPS: Array<{ key: DriverTripStatus; label: string }> = [
  { key: 'matched', label: 'Accepted' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'in_trip', label: 'En Route' },
  { key: 'completed', label: 'Completed' },
];

const incomingRequestsSeed: IncomingRequest[] = [
  {
    id: 'req-1',
    riderName: 'Alicia R.',
    riderPhone: '+18761234567',
    pickup: 'Half-Way Tree Transport Centre',
    pickupCoordinate: { latitude: 18.0062, longitude: -76.7971 },
    dropoff: 'Norman Manley Airport',
    dropoffCoordinate: { latitude: 17.936, longitude: -76.7875 },
    fare: 'J$3,450',
    eta: '4 min away',
    distance: '12.4 km',
    paymentLabel: 'Card',
  },
  {
    id: 'req-2',
    riderName: 'Devon P.',
    riderPhone: '+18767654321',
    pickup: 'New Kingston',
    pickupCoordinate: { latitude: 18.0081, longitude: -76.7832 },
    dropoff: 'Portmore Mall',
    dropoffCoordinate: { latitude: 17.9505, longitude: -76.8828 },
    fare: 'J$2,180',
    eta: '7 min away',
    distance: '8.1 km',
    paymentLabel: 'Cash',
  },
  {
    id: 'req-3',
    riderName: 'Melissa W.',
    riderPhone: '+18769876543',
    pickup: 'Liguanea',
    pickupCoordinate: { latitude: 18.0137, longitude: -76.7474 },
    dropoff: 'Downtown Kingston',
    dropoffCoordinate: { latitude: 17.977, longitude: -76.7915 },
    fare: 'J$1,760',
    eta: '3 min away',
    distance: '5.6 km',
    paymentLabel: 'Card',
  },
];

type DemandLevel = 'critical' | 'high' | 'medium' | 'low';

const completedTripsSeed = [
  { id: 'done-1', riderName: 'Marsha B.', route: 'New Kingston to Barbican', fare: 'J$1,540', when: 'Today, 9:10 AM' },
  { id: 'done-2', riderName: 'Kevin T.', route: 'Half-Way Tree to Portmore', fare: 'J$2,980', when: 'Today, 7:35 AM' },
  { id: 'done-3', riderName: 'Alana P.', route: 'Liguanea to Downtown Kingston', fare: 'J$1,880', when: 'Yesterday, 6:20 PM' },
];
type CompletedTrip = (typeof completedTripsSeed)[number];

function splitTripRoute(route: string): { from: string; to: string | null } {
  const parts = route.split(' to ');
  if (parts.length >= 2) {
    const [from, ...rest] = parts;
    return { from: from.trim(), to: rest.join(' to ').trim() };
  }
  return { from: route, to: null };
}

function getTripBadge(status: DriverTripStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'matched':
      return { label: 'Accepted', bg: '#fef3c7', text: '#92400e' };
    case 'arrived':
      return { label: 'At pickup', bg: '#ede9fe', text: '#6d28d9' };
    case 'in_trip':
      return { label: 'En Route', bg: '#dbeafe', text: '#1e40af' };
    case 'completed':
      return { label: 'Completed', bg: '#dcfce7', text: '#166534' };
    case 'cancelled':
      return { label: 'Cancelled', bg: '#fee2e2', text: '#b91c1c' };
  }
}

function getPrimaryAction(status: DriverTripStatus): { label: string; icon: keyof typeof Ionicons.glyphMap } | null {
  switch (status) {
    case 'matched':
      return { label: 'Mark arrived', icon: 'location-outline' };
    case 'arrived':
      return { label: 'Start trip', icon: 'play-outline' };
    case 'in_trip':
      return { label: 'Complete trip', icon: 'checkmark-circle-outline' };
    default:
      return null;
  }
}

function getStatusSummary(status: DriverTripStatus, paymentLabel: 'Card' | 'Cash'): string {
  switch (status) {
    case 'matched':
      return 'Trip accepted. Pickup point confirmed.';
    case 'arrived':
      return 'You are at pickup. Start the trip when the rider is onboard.';
    case 'in_trip':
      return 'En route to drop off.';
    case 'completed':
      return 'Trip is complete and ready to be archived.';
    case 'cancelled':
      return 'This trip has been cancelled.';
  }
}

function parseEtaMinutes(etaLabel: string): number {
  const match = etaLabel.match(/(\d+)/);
  return match ? Math.max(1, Number(match[1])) : 4;
}

function formatMinSec(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function generateTripStartPin(): string {
  return String(10000 + Math.floor(Math.random() * 90000));
}

function getTripBarCopy(trip: DriverTrip, tick: number): { title: string; pill: string; icon: keyof typeof Ionicons.glyphMap } {
  const etaMinutes = parseEtaMinutes(trip.eta);
  const etaCountdownSec = Math.max(0, etaMinutes * 60 - ((Date.now() - trip.acceptedAtMs) / 1000));

  switch (trip.status) {
    case 'matched':
      return { title: 'Ride accepted. Pickup confirmed', pill: `${formatMinSec(etaCountdownSec)} Mins`, icon: 'checkmark-circle-outline' };
    case 'arrived':
      return { title: 'You have arrived at pickup', pill: 'Arrived', icon: 'location-outline' };
    case 'in_trip':
      return { title: 'En route to drop off', pill: 'In Trip', icon: 'navigate-outline' };
    case 'completed':
      return { title: 'Trip completed', pill: 'Done', icon: 'checkmark-done-outline' };
    case 'cancelled':
      return { title: 'Trip cancelled', pill: 'Closed', icon: 'close-circle-outline' };
  }
}

const DRIVER_TRACK_H = 52;
const DRIVER_THUMB_W = 50;
const SCREEN_HEIGHT = Dimensions.get('window').height;
/** Baseline home map height when the sheet is docked; must match `sheetHome.marginTop`. */
const DRIVER_MAP_HEIGHT = 410;
const DRIVER_SHEET_PEEK = 148;
const DRIVER_SHEET_MINIMIZED_OFFSET = Math.max(0, SCREEN_HEIGHT - DRIVER_MAP_HEIGHT - DRIVER_SHEET_PEEK);
/** Upper bound of sheet translate used for map height interpolation (avoid [0,0] inputRange). */
const DRIVER_SHEET_SLIDE_RANGE = Math.max(1, DRIVER_SHEET_MINIMIZED_OFFSET);

type SwipeToActionProps = {
  onAccept: () => void;
  onDecline: () => void;
  disabled: boolean;
  isDark: boolean;
  borderColor: string;
};
function SwipeToAction({ onAccept, onDecline, disabled, isDark, borderColor }: SwipeToActionProps) {
  const [drag, setDrag] = useState(0);
  const [halfTrack, setHalfTrack] = useState(0);

  // Stable refs so the panResponder (created once) always sees fresh values
  const halfTrackRef  = useRef(0);
  const disabledRef   = useRef(disabled);
  const onAcceptRef   = useRef(onAccept);
  const onDeclineRef  = useRef(onDecline);
  disabledRef.current  = disabled;
  onAcceptRef.current  = onAccept;
  onDeclineRef.current = onDecline;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onStartShouldSetPanResponderCapture: () => !disabledRef.current,
      onMoveShouldSetPanResponder: (_, gs) => !disabledRef.current && Math.abs(gs.dx) > 3,
      onMoveShouldSetPanResponderCapture: (_, gs) => !disabledRef.current && Math.abs(gs.dx) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        const half = halfTrackRef.current;
        setDrag(Math.max(-half, Math.min(half, gs.dx)));
      },
      onPanResponderRelease: (_, gs) => {
        const half = halfTrackRef.current;
        if (half > 0 && gs.dx >= half * 0.65) {
          setDrag(half);
          hapticSuccess();
          setTimeout(() => { setDrag(0); onAcceptRef.current(); }, 180);
        } else if (half > 0 && gs.dx <= -half * 0.65) {
          setDrag(-half);
          hapticMedium();
          setTimeout(() => { setDrag(0); onDeclineRef.current(); }, 180);
        } else {
          setDrag(0);
        }
      },
    })
  ).current;

  const thumbLeft = halfTrack + drag;
  const redFillWidth   = drag < 0 ? -drag : 0;
  const greenFillWidth = drag > 0  ?  drag : 0;
  const declineFraction = halfTrack > 0 ? Math.min(1, Math.max(0, (-drag) / halfTrack)) : 0;
  const acceptFraction  = halfTrack > 0 ? Math.min(1, Math.max(0,   drag  / halfTrack)) : 0;
  const lerpColor = (t: number, r0: number, g0: number, b0: number) => `rgb(${Math.round(r0+(255-r0)*t)},${Math.round(g0+(255-g0)*t)},${Math.round(b0+(255-b0)*t)})`;
  const declineColor = lerpColor(declineFraction, 220, 38, 38);   // red → white
  const acceptColor  = lerpColor(acceptFraction,  22, 163, 74);   // green → white

  return (
    <View
      style={[styles.swipeTrack, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderColor,
      }]}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        const h = Math.max(0, (w - DRIVER_THUMB_W) / 2);
        halfTrackRef.current = h;
        setHalfTrack(h);
      }}
    >
      {/* Red (decline) fill — grows leftward from centre */}
      <View
        pointerEvents="none"
        style={[styles.swipeFill, { backgroundColor: '#dc2626', right: halfTrack + DRIVER_THUMB_W / 2, width: redFillWidth, opacity: redFillWidth > 0 ? 1 : 0 }]}
      />
      {/* Green (accept) fill — grows rightward from centre */}
      <View
        pointerEvents="none"
        style={[styles.swipeFill, { backgroundColor: '#16a34a', left: halfTrack + DRIVER_THUMB_W / 2, width: greenFillWidth, opacity: greenFillWidth > 0 ? 1 : 0 }]}
      />
      <Text style={[styles.swipeDeclineLabel, { color: declineColor }]} pointerEvents="none">← Decline</Text>
      <Text style={[styles.swipeAcceptLabel, { color: acceptColor }]} pointerEvents="none">Accept →</Text>
      <View
        style={[styles.swipeThumb, { backgroundColor: '#171717', transform: [{ translateX: thumbLeft }] }]}
        pointerEvents="none"
      >
        <Ionicons name="swap-horizontal-outline" size={22} color="#FFD000" />
      </View>
    </View>
  );
}

export default function DriverHomeScreen() {
  const { colors, isDark, themeOverride, setThemeOverride } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [headerLayoutHeight, setHeaderLayoutHeight] = useState(0);
  const { user, setAppMode, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const [subScreen, setSubScreen] = useState<DriverSubScreen>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [surgeMultiplier] = useState(2.1); // reserved for future use
  type EarningsModal = null | 'earnings' | 'trips' | 'rating';
  const [earningsModal, setEarningsModal] = useState<EarningsModal>(null);
  const [selectedTripDetail, setSelectedTripDetail] = useState<CompletedTrip | null>(null);
  const [completedTrips, setCompletedTrips] = useState<CompletedTrip[]>(completedTripsSeed);
  const [availableCashOutAmount, setAvailableCashOutAmount] = useState(12430);
  const [cashOutAmountInput, setCashOutAmountInput] = useState<string>(() => (12430).toLocaleString());
  const [incomingRequests, setIncomingRequests] = useState(incomingRequestsSeed);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<DriverTrip | null>(null);
  const [currentTripExpanded, setCurrentTripExpanded] = useState(true);
  const [tripUiTick, setTripUiTick] = useState(0);
  const [tripPinModalVisible, setTripPinModalVisible] = useState(false);
  const [tripPinInput, setTripPinInput] = useState('');
  const [tripPinError, setTripPinError] = useState('');
  const mainMapRef = useRef<MapView | null>(null);
  const enrouteBarAnim = useRef(new Animated.Value(0)).current;
  const enrouteMapAnim = useRef(new Animated.Value(0)).current;
  const [enrouteNowMs, setEnrouteNowMs] = useState(() => Date.now());
  const [enrouteExpanded, setEnrouteExpanded] = useState(true);
  const enrouteDropdownAnim = useRef(new Animated.Value(0)).current;
  const enrouteEntranceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestModalPulse = useRef(new Animated.Value(1)).current;
  const requestModalPan = useRef(new Animated.ValueXY()).current;
  const driverHomeScrollRef = useRef<ScrollView | null>(null);
  const allTripsSlideAnim = useRef(new Animated.Value(800)).current;
  const requestSoundRef = useRef<Audio.Sound | null>(null);
  const pinInputRef = useRef<TextInput>(null);
  const driverSheetPan = useRef(new Animated.Value(0)).current;
  // Safety refs
  const speedAlertShownRef = useRef(false);
  const tripTimeoutShownRef = useRef(false);
  const driverSheetOffset = useRef(new Animated.Value(0)).current;
  const driverSheetTranslateY = useMemo(
    () => Animated.add(driverSheetPan, driverSheetOffset),
    [driverSheetPan, driverSheetOffset]
  );
  const homeMapHeightAnim = useMemo(
    () =>
      driverSheetTranslateY.interpolate({
        inputRange: [0, DRIVER_SHEET_SLIDE_RANGE],
        outputRange: [DRIVER_MAP_HEIGHT, SCREEN_HEIGHT],
        extrapolate: 'clamp',
      }),
    [driverSheetTranslateY]
  );
  const [driverSheetMinimized, setDriverSheetMinimized] = useState(false);
  const driverSheetMinimizedRef = useRef(false);
  const driverSheetEnabledRef = useRef(false);
  const driverScrollOffsetRef = useRef(0);
  const [profileFirstName, setProfileFirstName] = useState(user?.firstName?.trim() || 'Driver');
  const [profileLastName, setProfileLastName] = useState(user?.lastName?.trim() || '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? 'driver@ridr.app');
  const [profileUsername, setProfileUsername] = useState(user?.staffCode ?? 'R001');
  const [profilePhone, setProfilePhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [addressModal, setAddressModal] = useState<'home' | 'work' | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cards, setCards] = useState<ProfileCard[]>([]);
  const [defaultCard, setDefaultCard] = useState<string | null>(null);
  const [addCardVisible, setAddCardVisible] = useState(false);
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [addPayoutVisible, setAddPayoutVisible] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');
  const [editExpiryVisible, setEditExpiryVisible] = useState(false);
  const [editExpiryCardId, setEditExpiryCardId] = useState<string | null>(null);
  const [editExpiryLast4, setEditExpiryLast4] = useState('');
  const [editExpiryMonth, setEditExpiryMonth] = useState('');
  const [editExpiryYear, setEditExpiryYear] = useState('');
  const [editingFirstName, setEditingFirstName] = useState(profileFirstName);
  const [editingLastName, setEditingLastName] = useState(profileLastName);
  const [editingEmail, setEditingEmail] = useState(profileEmail);
  const [editingUsername, setEditingUsername] = useState(profileUsername);
  const [editingPassword, setEditingPassword] = useState('');
  const [editingPhone, setEditingPhone] = useState(profilePhone);
  const [notifRideUpdates, setNotifRideUpdates] = useState(true);
  const [notifDriverArrival, setNotifDriverArrival] = useState(true);
  const [notifTripReceipt, setNotifTripReceipt] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [notifNewFeatures, setNotifNewFeatures] = useState(true);
  const [notifSurveys, setNotifSurveys] = useState(false);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [notifPayments, setNotifPayments] = useState(true);
  const [selectedLang, setSelectedLang] = useState('English');
  const [settingsRefreshing, setSettingsRefreshing] = useState(false);
  const [homeMapRouteCoords, setHomeMapRouteCoords] = useState<LatLng[]>([]);
  const [requestModalRouteCoords, setRequestModalRouteCoords] = useState<LatLng[]>([]);
  const [driverLiveLocation, setDriverLiveLocation] = useState<LatLng | null>(null);

  type ChatMessage = { id: string; text: string; sender: 'me' | 'them'; ts: number };
  const RIDER_AUTO_REPLIES = ["On my way!", "Thanks, I'll be right there.", "Okay, I can see you.", "Got it, thanks!"];
  const [showRiderChat, setShowRiderChat] = useState(false);
  const [riderChatInput, setRiderChatInput] = useState('');
  const [riderChatMessages, setRiderChatMessages] = useState<ChatMessage[]>([]);
  const riderChatScrollRef = useRef<ScrollView | null>(null);

  const ui = useMemo(
    () => ({
      bg: colors.background,
      panelBg: colors.card,
      card: colors.card,
      soft: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
      text: colors.text,
      textMuted: colors.textMuted,
      border: colors.border,
      accent: colors.accent,
      tabActive: isDark ? '#ffffff' : '#171717',
      tabInactive: isDark ? '#8b8b92' : '#9a9aa0',
      headerOverlay: isDark ? 'rgba(18,18,22,0.78)' : 'rgba(255,255,255,0.82)',
      hero: isDark ? '#111318' : '#171717',
      heroText: '#ffffff',
    }),
    [colors, isDark]
  );

  const ridrMapMarkerStyles = useRidrMapMarkerStyles(isDark, {
    accent: colors.accent,
    background: colors.background,
    card: colors.card,
    text: colors.text,
  });
  const ridrMapRouteStroke = useRidrMapRouteStroke(isDark, colors.accent, colors.text);

  const driverHomeInitialRegion = useMemo(
    () => ({
      latitude: KSA_MAP_CENTER.latitude,
      longitude: KSA_MAP_CENTER.longitude,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }),
    []
  );

  const riderUi = useMemo<MainScreenUi>(
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

  const formatJmd = (value: number) => `J$${value.toLocaleString()}`;
  const parseJmd = (value: string) => {
    const n = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const settingsUi = useMemo<TabUi>(
    () => ({
      screenBg: colors.background,
      panelBg: colors.surface,
      cardBg: colors.card,
      softBg: colors.softBg,
      text: colors.text,
      textMuted: colors.textMuted,
      divider: colors.border,
      placeholder: colors.textPlaceholder,
      accent: colors.accent,
      onAccentText: '#171717',
    }),
    [colors]
  );

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
        hapticSelection();
      } catch (e) {
        Alert.alert('Could not set default card', e instanceof Error ? e.message : 'Try again.');
      }
    },
    [refreshPaymentMethods]
  );

  const deleteCard = useCallback(
    (id: string) => {
      Alert.alert(
        'Remove card?',
        'This card will be removed from your account. You can add a new card anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () =>
              void (async () => {
                try {
                  await deletePaymentMethod(id);
                  await refreshPaymentMethods();
                } catch (e) {
                  Alert.alert('Could not remove card', e instanceof Error ? e.message : 'Try again.');
                }
              })(),
          },
        ]
      );
    },
    [refreshPaymentMethods]
  );

  const openEditCardExpiry = useCallback((card: ProfileCard) => {
    setEditExpiryCardId(card.id);
    setEditExpiryLast4(card.last4);
    const mm = card.expiryMonth?.replace(/\D/g, '') ?? '';
    setEditExpiryMonth(mm.length === 0 ? '' : mm.length <= 2 ? mm.padStart(2, '0').slice(0, 2) : mm.slice(0, 2));
    const y = card.expiryYear?.replace(/\D/g, '') ?? '';
    setEditExpiryYear(y.length === 0 ? '' : y.length >= 4 ? y.slice(-2) : y.slice(0, 2));
    setEditExpiryVisible(true);
  }, []);

  useEffect(() => {
    void refreshPaymentMethods();
  }, [refreshPaymentMethods]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const loc = await ensureDriverLocationReady();
        if (cancelled || loc.ok) return;
        Alert.alert('Location required', loc.message, [
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          {
            text: 'Exit Driver mode',
            style: 'destructive',
            onPress: () => {
              void setAppMode('rider');
            },
          },
        ]);
      })();
      return () => {
        cancelled = true;
      };
    }, [setAppMode])
  );

  useEffect(() => {
    setProfileFirstName(user?.firstName?.trim() || 'Driver');
    setProfileLastName(user?.lastName?.trim() || '');
    setProfileEmail(user?.email ?? 'driver@ridr.app');
    setProfileUsername(user?.staffCode ?? 'R001');
  }, [user?.email, user?.firstName, user?.lastName, user?.staffCode]);

  useEffect(() => {
    setEditingFirstName(profileFirstName);
    setEditingLastName(profileLastName);
    setEditingEmail(profileEmail);
    setEditingUsername(profileUsername);
    setEditingPhone(profilePhone);
  }, [profileEmail, profileFirstName, profileLastName, profilePhone, profileUsername]);

  useEffect(() => {
    if (!currentTrip || currentTrip.status === 'completed' || currentTrip.status === 'cancelled') {
      return;
    }

    const interval = setInterval(() => {
      setTripUiTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTrip]);

  useEffect(() => {
    if (currentTrip) {
      setCurrentTripExpanded(true);
    }
  }, [currentTrip?.id, currentTrip?.status]);

  useEffect(() => {
    if (!currentTrip || currentTrip.status === 'cancelled' || currentTrip.status === 'completed') {
      setTripPinModalVisible(false);
      setTripPinInput('');
      setTripPinError('');
    }
  }, [currentTrip]);

  const name = profileFirstName || user?.staffCode || 'Driver';
  const progressIndex = currentTrip ? DRIVER_PROGRESS_STEPS.findIndex((step) => step.key === currentTrip.status) : -1;
  const currentTripPrimaryAction = currentTrip ? getPrimaryAction(currentTrip.status) : null;
  const showHomeChrome = activeTab === 'home' && subScreen === null;
  const driverSheetGesturesEnabled = showHomeChrome && currentTrip?.status !== 'in_trip';
  const isBusy = !!(currentTrip && currentTrip.status !== 'completed' && currentTrip.status !== 'cancelled');
  const hasCurrentTrip = currentTrip != null;
  const profileDirty =
    editingFirstName.trim() !== profileFirstName.trim() ||
    editingLastName.trim() !== profileLastName.trim() ||
    editingEmail.trim() !== profileEmail.trim() ||
    editingUsername.trim() !== profileUsername.trim() ||
    editingPhone.trim() !== profilePhone.trim() ||
    editingPassword.trim().length > 0;

  const mapPickup = currentTrip?.pickupCoordinate ?? incomingRequests[0]?.pickupCoordinate ?? KSA_MAP_CENTER;
  const mapDropoff = currentTrip?.dropoffCoordinate ?? incomingRequests[0]?.dropoffCoordinate ?? KSA_MAP_CENTER;
  const driverMarker =
    (driverLiveLocation ?? currentTrip?.pickupCoordinate) ?? {
      latitude: KSA_MAP_CENTER.latitude + 0.008,
      longitude: KSA_MAP_CENTER.longitude - 0.006,
    };

  /** Google Directions origin/destination by trip phase; live GPS reroutes while driving. */
  const drivingRouteContext = useMemo(() => {
    const live = driverLiveLocation;
    if (!currentTrip) {
      return {
        from: mapPickup,
        to: mapDropoff,
        useTraffic: false,
      };
    }
    switch (currentTrip.status) {
      case 'matched':
        if (!live) {
          return { from: mapPickup, to: mapDropoff, useTraffic: false };
        }
        return {
          from: live,
          to: currentTrip.pickupCoordinate,
          useTraffic: true,
        };
      case 'arrived':
        return {
          from: live ?? currentTrip.pickupCoordinate,
          to: currentTrip.dropoffCoordinate,
          useTraffic: true,
        };
      case 'in_trip':
        return {
          from: live ?? currentTrip.pickupCoordinate,
          to: currentTrip.dropoffCoordinate,
          useTraffic: true,
        };
      default:
        return { from: mapPickup, to: mapDropoff, useTraffic: false };
    }
  }, [currentTrip, driverLiveLocation, mapPickup, mapDropoff]);

  const routeRound5 = (c: LatLng) => `${Math.round(c.latitude * 1e5) / 1e5},${Math.round(c.longitude * 1e5) / 1e5}`;
  const routeFetchKeyFrom = routeRound5(drivingRouteContext.from);
  const routeFetchKeyTo = routeRound5(drivingRouteContext.to);
  const hasDrivingRouteLeg =
    Math.abs(drivingRouteContext.from.latitude - drivingRouteContext.to.latitude) > 1e-6 ||
    Math.abs(drivingRouteContext.from.longitude - drivingRouteContext.to.longitude) > 1e-6;

  const homeRoutePolylineCoords =
    homeMapRouteCoords.length > 1 ? homeMapRouteCoords : [drivingRouteContext.from, drivingRouteContext.to];
  const hasDistinctPickupDrop =
    Math.abs(mapPickup.latitude - mapDropoff.latitude) > 1e-6 ||
    Math.abs(mapPickup.longitude - mapDropoff.longitude) > 1e-6;

  useEffect(() => {
    if (!showHomeChrome) {
      setDriverLiveLocation(null);
      return;
    }
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const fg = await Location.getForegroundPermissionsAsync();
        if (!fg.granted || cancelled) return;
        const seed = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setDriverLiveLocation({
            latitude: seed.coords.latitude,
            longitude: seed.coords.longitude,
          });
        }
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 25,
          },
          (loc) => {
            setDriverLiveLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            // Speed alert — >120 km/h (33.3 m/s)
            const speed = loc.coords.speed ?? -1;
            if (speed > 33.3 && !speedAlertShownRef.current) {
              speedAlertShownRef.current = true;
              Alert.alert(
                'Speed Warning',
                'You are travelling over 120 km/h. Please slow down for passenger safety.',
                [{ text: 'Got it' }]
              );
            }
          }
        );
      } catch {
        // ignore — map still works with static fallback
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [showHomeChrome]);

  // Reset speed alert when a new trip starts
  useEffect(() => {
    speedAlertShownRef.current = false;
  }, [currentTrip?.id]);

  // Trip timeout guard — alert if in_trip for >60 minutes
  useEffect(() => {
    tripTimeoutShownRef.current = false;
    const interval = setInterval(() => {
      if (tripTimeoutShownRef.current) return;
      const elapsedMin = (Date.now() - currentTrip.startedAtMs!) / 60000;
      if (elapsedMin >= 60) {
        tripTimeoutShownRef.current = true;
        Alert.alert(
          'Long Trip Alert',
          `This trip has been active for over ${Math.floor(elapsedMin)} minutes. Is everything okay?`,
          [
            { text: 'All good', style: 'cancel' },
            { text: 'Emergency (119)', style: 'destructive', onPress: () => Linking.openURL('tel:119') },
          ]
        );
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [currentTrip?.id, currentTrip?.status, currentTrip?.startedAtMs]);

  useEffect(() => {
    let cancelled = false;
    if (!hasDrivingRouteLeg) {
      setHomeMapRouteCoords([]);
      return;
    }
    const debounceMs = drivingRouteContext.useTraffic ? 900 : 0;
    const timer = setTimeout(() => {
      void fetchDrivingRouteCoords(drivingRouteContext.from, drivingRouteContext.to, {
        useTraffic: drivingRouteContext.useTraffic,
      }).then((coords) => {
        if (!cancelled) setHomeMapRouteCoords(coords);
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    hasDrivingRouteLeg,
    routeFetchKeyFrom,
    routeFetchKeyTo,
    drivingRouteContext.useTraffic,
    currentTrip?.id,
    currentTrip?.status,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!requestModalVisible || incomingRequests.length === 0) {
      setRequestModalRouteCoords([]);
      return;
    }
    const req = incomingRequests[0];
    void fetchDrivingRouteCoords(req.pickupCoordinate, req.dropoffCoordinate).then((coords) => {
      if (!cancelled) setRequestModalRouteCoords(coords);
    });
    return () => {
      cancelled = true;
    };
  }, [requestModalVisible, incomingRequests[0]?.id]);

  useEffect(() => {
    if (!showHomeChrome || currentTrip?.status === 'in_trip' || !hasDistinctPickupDrop) return;
    if (homeMapRouteCoords.length < 2) return;
    const raf = requestAnimationFrame(() => {
      try {
        mainMapRef.current?.fitToCoordinates(homeMapRouteCoords, {
          edgePadding: {
            top: Platform.OS === 'ios' ? 200 : 170,
            right: 48,
            bottom: 340,
            left: 48,
          },
          animated: true,
        });
      } catch {
        // ignore
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [currentTrip?.status, hasDistinctPickupDrop, homeMapRouteCoords, showHomeChrome]);

  useEffect(() => {
    if (!currentTrip || currentTrip.status !== 'in_trip' || !hasDistinctPickupDrop) return;
    if (homeMapRouteCoords.length < 2) return;
    const raf = requestAnimationFrame(() => {
      try {
        mainMapRef.current?.fitToCoordinates(homeMapRouteCoords, {
          edgePadding: {
            top: Platform.OS === 'ios' ? 160 : 140,
            right: 52,
            bottom: 140,
            left: 52,
          },
          animated: true,
        });
      } catch {
        // ignore
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [currentTrip?.id, currentTrip?.status, hasDistinctPickupDrop, homeMapRouteCoords]);

  const getEnrouteTotalSec = (trip: DriverTrip) => {
    const kmMatch = trip.distance.match(/([0-9]+(?:\.[0-9]+)?)/);
    const km = kmMatch ? Number(kmMatch[1]) : 8;
    const avgKmh = 28;
    const minutes = (km / avgKmh) * 60;
    return Math.max(240, Math.min(2400, Math.round(minutes * 60)));
  };

  useEffect(() => {
    if (!currentTrip || currentTrip.status !== 'in_trip') {
      if (enrouteEntranceTimeoutRef.current) {
        clearTimeout(enrouteEntranceTimeoutRef.current);
        enrouteEntranceTimeoutRef.current = null;
      }
      Animated.timing(enrouteBarAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      Animated.timing(enrouteMapAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
      setEnrouteExpanded(true);
      return;
    }

    // Map fills full screen; dropdown card floats over it.
    setEnrouteExpanded(true);
    setCurrentTripExpanded(true);
    enrouteMapAnim.setValue(0);
    enrouteBarAnim.setValue(0);
    Animated.timing(enrouteBarAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    Animated.timing(enrouteMapAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();

    const rafId = requestAnimationFrame(() => {
      try {
        mainMapRef.current?.fitToCoordinates(
          [currentTrip.pickupCoordinate, currentTrip.dropoffCoordinate],
          {
            edgePadding: {
              top: Platform.OS === 'ios' ? 220 : 200,
              right: 52,
              bottom: 280,
              left: 52,
            },
            animated: true,
          }
        );
      } catch {
        // ignore
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (enrouteEntranceTimeoutRef.current) {
        clearTimeout(enrouteEntranceTimeoutRef.current);
        enrouteEntranceTimeoutRef.current = null;
      }
    };
  }, [currentTrip?.status]);

  useEffect(() => {
    if (currentTrip?.status !== 'in_trip') {
      enrouteDropdownAnim.setValue(0);
      return;
    }
    Animated.timing(enrouteDropdownAnim, {
      toValue: currentTripExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentTripExpanded, currentTrip?.status]);

  const toggleEnrouteExpanded = () => {
    if (!currentTrip || currentTrip.status !== 'in_trip') return;
    if (enrouteEntranceTimeoutRef.current) {
      clearTimeout(enrouteEntranceTimeoutRef.current);
      enrouteEntranceTimeoutRef.current = null;
    }
    const next = !enrouteExpanded;
    setEnrouteExpanded(next);
    Animated.timing(enrouteMapAnim, {
      toValue: next ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
    // Minimize sheet when map expands, restore when map collapses.
    if (next) {
      minimizeDriverSheet();
    } else {
      expandDriverSheet();
    }
  };

  useEffect(() => {
    if (!currentTrip || currentTrip.status !== 'in_trip') return;
    const id = setInterval(() => setEnrouteNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [currentTrip?.status]);

  const enrouteRemainingSec = (() => {
    if (!currentTrip || currentTrip.status !== 'in_trip') return 0;
    const total = getEnrouteTotalSec(currentTrip);
    const tripStartMs = currentTrip.startedAtMs ?? currentTrip.acceptedAtMs;
    const elapsed = Math.max(0, Math.floor((enrouteNowMs - tripStartMs) / 1000));
    return Math.max(0, total - elapsed);
  })();

  const minimizeDriverSheet = () => {
    driverSheetPan.setValue(0);
    driverSheetMinimizedRef.current = true;
    setDriverSheetMinimized(true);
    Animated.spring(driverSheetOffset, {
      toValue: DRIVER_SHEET_MINIMIZED_OFFSET,
      useNativeDriver: false,
      friction: 9,
      tension: 70,
    }).start();
  };

  const expandDriverSheet = () => {
    driverSheetMinimizedRef.current = false;
    setDriverSheetMinimized(false);
    Animated.parallel([
      Animated.spring(driverSheetPan, {
        toValue: 0,
        useNativeDriver: false,
        friction: 9,
        tension: 70,
      }),
      Animated.spring(driverSheetOffset, {
        toValue: 0,
        useNativeDriver: false,
        friction: 9,
        tension: 70,
      }),
    ]).start();
  };

  useEffect(() => {
    if (subScreen || !showHomeChrome) return;

    // When leaving in_trip, always restore the sheet and collapse the map.
    if (currentTrip?.status !== 'in_trip' && driverSheetMinimizedRef.current) {
      expandDriverSheet();
    }
  }, [currentTrip?.status, showHomeChrome, subScreen]);

  useEffect(() => {
    if (subScreen || !showHomeChrome) return;
    if (currentTrip?.status !== 'in_trip') return;

    const rafId = requestAnimationFrame(() => {
      try {
        driverHomeScrollRef.current?.scrollTo({ y: 0, animated: false });
        driverScrollOffsetRef.current = 0;
      } catch {
        // ignore
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentTrip?.status, showHomeChrome, subScreen]);

  const requestModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        requestModalPan.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: requestModalPan.x, dy: requestModalPan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        requestModalPan.extractOffset();
      },
    })
  ).current;

  const driverSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (!driverSheetEnabledRef.current) return false;
        if (driverSheetMinimizedRef.current) {
          return gs.dy < -5 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.1;
        }
        return driverScrollOffsetRef.current <= 2 && gs.dy > 5 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.1;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        if (driverSheetMinimizedRef.current) {
          if (gs.dy < 0) {
            driverSheetPan.setValue(Math.max(gs.dy, -DRIVER_SHEET_MINIMIZED_OFFSET));
          }
          return;
        }
        if (gs.dy > 0) {
          driverSheetPan.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (driverSheetMinimizedRef.current) {
          if (gs.dy < -28 || gs.vy < -0.28) {
            expandDriverSheet();
          } else {
            Animated.spring(driverSheetPan, {
              toValue: 0,
              useNativeDriver: false,
              friction: 8,
              tension: 78,
            }).start();
          }
          return;
        }

        if (gs.dy > 72 || gs.vy > 0.38) {
          minimizeDriverSheet();
        } else {
          Animated.spring(driverSheetPan, {
            toValue: 0,
            useNativeDriver: false,
            friction: 8,
            tension: 78,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!showHomeChrome || !isOnline || hasCurrentTrip || incomingRequests.length === 0) {
      setRequestModalVisible(false);
      return;
    }

    const timeout = setTimeout(() => {
      setRequestModalVisible(true);
    }, 600);

    return () => clearTimeout(timeout);
  }, [hasCurrentTrip, incomingRequests.length, isOnline, showHomeChrome]);

  useEffect(() => {
    // Lock the bottom sheet while the trip is active (after correct PIN -> in_trip).
    driverSheetEnabledRef.current = driverSheetGesturesEnabled;
  }, [driverSheetGesturesEnabled]);

  useEffect(() => {
    if (showHomeChrome) return;
    driverSheetMinimizedRef.current = false;
    setDriverSheetMinimized(false);
    driverScrollOffsetRef.current = 0;
    driverSheetPan.setValue(0);
    driverSheetOffset.setValue(0);
  }, [driverSheetOffset, driverSheetPan, showHomeChrome]);

  useEffect(() => {
    if (!requestModalVisible || !showHomeChrome || incomingRequests.length === 0) {
      requestModalPulse.stopAnimation();
      requestModalPulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(requestModalPulse, { toValue: 1.02, duration: 1100, useNativeDriver: true }),
        Animated.timing(requestModalPulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      requestModalPulse.setValue(1);
    };
  }, [incomingRequests.length, requestModalPulse, requestModalVisible, showHomeChrome]);

  useEffect(() => {
    if (!requestModalVisible || !showHomeChrome || incomingRequests.length === 0) {
      return;
    }

    let cancelled = false;

    const playIncomingSound = async () => {
      try {
        if (requestSoundRef.current) {
          await requestSoundRef.current.stopAsync();
          await requestSoundRef.current.unloadAsync();
          requestSoundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: incomingRequestChimeUri },
          { shouldPlay: true, volume: 0.55 }
        );

        if (cancelled) {
          await sound.unloadAsync();
          return;
        }

        requestSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            void sound.unloadAsync();
            if (requestSoundRef.current === sound) {
              requestSoundRef.current = null;
            }
          }
        });
      } catch {
        // Non-fatal: request UI should still work even if audio playback fails.
      }
    };

    void playIncomingSound();

    return () => {
      cancelled = true;
    };
  }, [incomingRequests[0]?.id, incomingRequests.length, requestModalVisible, showHomeChrome]);

  useEffect(() => {
    if (requestModalVisible) {
      requestModalPan.setValue({ x: 0, y: 0 });
      requestModalPan.setOffset({ x: 0, y: 0 });
    }
  }, [requestModalVisible]);

  useEffect(() => {
    if (requestModalVisible) return;
    if (!requestSoundRef.current) return;

    const sound = requestSoundRef.current;
    requestSoundRef.current = null;
    void sound.stopAsync().catch(() => undefined);
    void sound.unloadAsync().catch(() => undefined);
  }, [requestModalVisible]);

  useEffect(() => {
    return () => {
      if (!requestSoundRef.current) return;
      const sound = requestSoundRef.current;
      requestSoundRef.current = null;
      void sound.stopAsync().catch(() => undefined);
      void sound.unloadAsync().catch(() => undefined);
    };
  }, []);

  const handleAccept = (requestId: string) => {
    const request = incomingRequests.find((item) => item.id === requestId);
    if (!request || (currentTrip && currentTrip.status !== 'completed' && currentTrip.status !== 'cancelled')) {
      return;
    }
    hapticMedium();
    setRequestModalVisible(false);
    setCurrentTripExpanded(true);
    setCurrentTrip({
      ...request,
      status: 'matched',
      startPin: '12345',
      acceptedAtMs: Date.now(),
    });
    setIncomingRequests((prev) => prev.filter((item) => item.id !== requestId));
  };

  const handleDecline = (requestId: string) => {
    hapticLight();
    setRequestModalVisible(false);
    setIncomingRequests((prev) => prev.filter((request) => request.id !== requestId));
  };

  const advanceTrip = () => {
    if (!currentTrip) return;

    if (currentTrip.status === 'arrived') {
      hapticSelection();
      setTripPinInput('');
      setTripPinError('');
      setTripPinModalVisible(true);
      return;
    }

    if (currentTrip.status === 'in_trip') {
      const fareAmount = parseJmd(currentTrip.fare);
      const route = `${currentTrip.pickup} to ${currentTrip.dropoff}`;
      const now = new Date();
      const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const when = `Today, ${time}`;

      const completeAndArchive = () => {
        hapticSuccess();
        setCompletedTrips((prev) => [
          {
            id: `done-${Date.now()}`,
            riderName: currentTrip.riderName,
            route,
            fare: currentTrip.fare,
            when,
          },
          ...prev,
        ]);
        setAvailableCashOutAmount((prev) => prev + fareAmount);
        setCurrentTrip(null);
        setCurrentTripExpanded(true);
        Alert.alert('Trip completed', 'Trip added to your earnings and trips. You’re ready for more trips.');
      };

      if (currentTrip.paymentLabel === 'Cash') {
        hapticMedium();
        Alert.alert(
          'Confirm cash payment',
          `Has ${currentTrip.riderName} paid ${formatJmd(fareAmount)} in cash?`,
          [
            { text: 'Not yet', style: 'cancel' },
            { text: 'Yes, paid', onPress: completeAndArchive },
          ]
        );
        return;
      }

      hapticMedium();
      Alert.alert(
        'Complete trip',
        `Complete this trip for ${currentTrip.riderName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', onPress: completeAndArchive },
        ]
      );
      return;
    }

    hapticMedium();
    setCurrentTrip((prev) => {
      if (!prev) return prev;
      if (prev.status === 'matched') return { ...prev, status: 'arrived', arrivedAtMs: Date.now() };
      return prev;
    });
  };

  const confirmTripStartPin = () => {
    if (!currentTrip) return;

    const normalizedPin = tripPinInput.replace(/\D/g, '').slice(0, 5);
    if (normalizedPin.length !== 5) {
      setTripPinError('Enter the 5-digit rider PIN to start the trip.');
      return;
    }

    if (normalizedPin !== currentTrip.startPin) {
      hapticLight();
      setTripPinError('That PIN does not match the rider confirmation code.');
      return;
    }

    hapticSuccess();
    setTripPinModalVisible(false);
    setTripPinInput('');
    setTripPinError('');
    // Immediately dock the sheet to map mode once trip starts.
    minimizeDriverSheet();
    setCurrentTrip((prev) => (prev ? { ...prev, status: 'in_trip', startedAtMs: Date.now() } : prev));
  };

  const cancelCurrentTrip = () => {
    if (!currentTrip || currentTrip.status === 'completed' || currentTrip.status === 'cancelled') return;
    Alert.alert(
      'Cancel trip?',
      'This will remove the current driver trip from your active queue.',
      [
        { text: 'Keep trip', style: 'cancel' },
        {
          text: 'Cancel trip',
          style: 'destructive',
          onPress: () => {
            hapticLight();
            setTripPinModalVisible(false);
            setCurrentTrip((prev) => (prev ? { ...prev, status: 'cancelled', cancelledAtMs: Date.now() } : prev));
          },
        },
      ]
    );
  };

  const clearResolvedTrip = () => {
    hapticSelection();
    setTripPinModalVisible(false);
    setCurrentTrip(null);
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

  const closeEditCardExpiry = () => {
    setEditExpiryVisible(false);
    setEditExpiryCardId(null);
    setEditExpiryLast4('');
    setEditExpiryMonth('');
    setEditExpiryYear('');
  };

  const saveEditCardExpiry = async () => {
    if (!editExpiryCardId) return;
    const mm = editExpiryMonth.replace(/\D/g, '').slice(0, 2);
    const yy = editExpiryYear.replace(/\D/g, '').slice(-2);
    if (mm.length !== 2) {
      Alert.alert('Expiry', 'Enter month as MM (01–12).');
      return;
    }
    const mNum = parseInt(mm, 10);
    if (mNum < 1 || mNum > 12) {
      Alert.alert('Expiry', 'Month must be between 01 and 12.');
      return;
    }
    if (yy.length !== 2) {
      Alert.alert('Expiry', 'Enter year as YY.');
      return;
    }
    try {
      await updatePaymentMethod(editExpiryCardId, { expiryMonth: mm, expiryYear: yy });
      closeEditCardExpiry();
      await refreshPaymentMethods();
    } catch (e) {
      Alert.alert('Could not update card', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const onPaymentMethodLongPress = (card: ProfileCard) => {
    hapticMedium();
    Alert.alert('Payment method', 'Update expiry or remove this card.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Update expiry', onPress: () => openEditCardExpiry(card) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCard(card.id) },
    ]);
  };

  const saveProfile = async () => {
    setProfileFirstName(editingFirstName.trim() || 'Driver');
    setProfileLastName(editingLastName.trim());
    setProfileEmail(editingEmail.trim() || profileEmail);
    setProfileUsername(editingUsername.trim() || profileUsername);
    setProfilePhone(editingPhone.trim());
    setEditingPassword('');
    setSubScreen('profile');
  };

  const onRefreshSettings = () => {
    setSettingsRefreshing(true);
    void (async () => {
      try {
        await refreshPaymentMethods();
      } finally {
        setSettingsRefreshing(false);
      }
    })();
  };

  const onClearDriverCache = () => {
    Alert.alert(
      'Clear cache?',
      'Removes cached data on this device, including your local copy of payment methods. You stay signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearAppCache();
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
  };

  const renderSubScreen = () => {
    switch (subScreen) {
      case 'cashOut': {
        const parsedAmount = Number.parseInt(cashOutAmountInput.replace(/[^0-9]/g, ''), 10);
        const amountToCashOut = Number.isFinite(parsedAmount) ? parsedAmount : 0;
        const clampedAmountToCashOut = Math.min(Math.max(amountToCashOut, 0), availableCashOutAmount);
        const cashOutFee = Math.round(clampedAmountToCashOut * 0.01);
        const cashOutNet = clampedAmountToCashOut - cashOutFee;
        const cashOutAmountInvalid = amountToCashOut > availableCashOutAmount;
        const fmtJmd = (value: number) => `J$${value.toLocaleString()}`;
        const fullName = `${profileFirstName} ${profileLastName}`.trim();
        const staffCodeRaw = (user?.staffCode ?? profileUsername ?? '').trim();
        const staffCodeMasked = (() => {
          if (!staffCodeRaw) return '';
          const keepStart = 1;
          const keepEnd = staffCodeRaw.length <= 4 ? 1 : 2;
          const middleLen = Math.max(0, staffCodeRaw.length - keepStart - keepEnd);
          const stars = middleLen > 0 ? '*'.repeat(middleLen) : '';
          return `${staffCodeRaw.slice(0, keepStart)}${stars}${staffCodeRaw.slice(staffCodeRaw.length - keepEnd)}`;
        })();

        return (
          <View style={[styles.editProfileRoot, { backgroundColor: riderUi.screenBg }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <View style={[styles.editProfileHeader, { backgroundColor: riderUi.screenBg, borderBottomColor: riderUi.divider }]}>
              <Pressable style={styles.editProfileHeaderSide} onPress={() => setSubScreen(null)} hitSlop={8}>
                <Ionicons name="arrow-back" size={24} color={riderUi.text} />
              </Pressable>
              <Text style={[styles.editProfileHeaderTitle, { color: riderUi.text }]}>Cash Out</Text>
              <View style={styles.editProfileHeaderSide} />
            </View>
            <ScrollView
              style={styles.editProfileScroll}
              contentContainerStyle={styles.profileViewScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Available */}
              <BlurView
                intensity={isDark ? 22 : 32}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.cashOutAvailableCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)',
                    borderColor: isDark ? 'rgba(255,208,0,0.55)' : 'rgba(255,208,0,0.65)',
                  },
                ]}
              >
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <View style={[styles.cashOutFrostRadial, styles.cashOutFrostRadialTopLeft, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.45)' }]} />
                  <View style={[styles.cashOutFrostRadial, styles.cashOutFrostRadialBottomRight, { backgroundColor: isDark ? 'rgba(255,208,0,0.18)' : 'rgba(255,208,0,0.22)' }]} />
                  <View style={[styles.cashOutFrostRadial, styles.cashOutFrostRadialCenter, { backgroundColor: isDark ? 'rgba(255,208,0,0.08)' : 'rgba(255,208,0,0.10)' }]} />
                </View>
                <View style={styles.cashOutAvailableHeaderRow}>
                  <Text style={[styles.cashOutAvailableName, { color: isDark ? 'rgba(255,255,255,0.96)' : '#171717' }]} numberOfLines={1}>
                    {fullName || 'Driver'}
                  </Text>
                  {staffCodeMasked ? (
                    <Text
                      style={[styles.cashOutAvailableStaffCode, { color: isDark ? 'rgba(255,255,255,0.88)' : '#171717' }]}
                      numberOfLines={1}
                    >
                      • {staffCodeMasked}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.cashOutAvailableLabel, { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(23,23,23,0.72)' }]}>Available to cash out</Text>
                <Text style={[styles.cashOutAvailableValue, { color: isDark ? 'rgba(255,255,255,0.96)' : '#171717' }]}>
                  {fmtJmd(availableCashOutAmount)}
                </Text>
              </BlurView>

              {/* Amount input */}
              <View style={[styles.profileViewSectionHeadingWrap, { marginTop: 24 }]}> 
                <Text style={[styles.profileViewSectionTitle, { color: riderUi.textMuted }]}>Amount</Text>
              </View>
              <View style={[styles.profileViewCard, { backgroundColor: riderUi.cardBg, borderColor: riderUi.divider }]}>
                <View style={[styles.cashOutBreakdownWrap, { paddingTop: 4 }]}> 
                  <View style={styles.cashOutBreakdownRow}>
                    <Text style={[styles.cashOutBreakdownLabel, { color: riderUi.textMuted }]}>Cash out amount</Text>
                    <Text style={[styles.cashOutBreakdownValue, { color: riderUi.text }]}>{fmtJmd(clampedAmountToCashOut)}</Text>
                  </View>
                  <View style={styles.cashOutBreakdownRow}>
                    <Text style={[styles.cashOutBreakdownLabel, { color: riderUi.textMuted }]}>App fee (1%)</Text>
                    <Text style={[styles.cashOutBreakdownValue, { color: riderUi.textMuted }]}>−{fmtJmd(cashOutFee)}</Text>
                  </View>
                  <View style={[styles.profileViewDivider, { backgroundColor: riderUi.divider, marginTop: 10, marginBottom: 10 }]} />
                  <View style={styles.cashOutAmountRow}>
                    <Text style={[styles.cashOutAmountRowLabel, { color: riderUi.textMuted }]}>How much do you want to cash out?</Text>
                    <View style={[styles.cashOutInlineInputWrap, { borderColor: riderUi.divider, backgroundColor: riderUi.screenBg }]}>
                      <Text style={[styles.cashOutAmountCurrency, { color: riderUi.textMuted }]}>J$</Text>
                      <TextInput
                        value={cashOutAmountInput}
                        onChangeText={(text) => {
                          const digits = text.replace(/[^0-9]/g, '');
                          if (!digits) {
                            setCashOutAmountInput('');
                            return;
                          }
                          const n = Number.parseInt(digits, 10);
                          setCashOutAmountInput(Number.isFinite(n) ? n.toLocaleString() : '');
                        }}
                        placeholder="0"
                        placeholderTextColor={riderUi.textMuted}
                        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                        style={[styles.cashOutInlineAmountInput, { color: riderUi.text }]}
                        textAlign="right"
                      />
                    </View>
                  </View>
                </View>

                <View style={[styles.profileViewDivider, { backgroundColor: riderUi.divider, marginTop: 12 }]} />
                <View style={[styles.cashOutBreakdownRow, { paddingVertical: 14 }]}>
                  <Text style={[styles.cashOutBreakdownNetLabel, { color: riderUi.text }]}>You receive</Text>
                  <Text style={[styles.cashOutBreakdownNetValue, { color: '#16a34a' }]}>{fmtJmd(cashOutNet)}</Text>
                </View>
                {cashOutAmountInvalid ? (
                  <Text style={styles.cashOutAmountError}>Amount exceeds available balance.</Text>
                ) : null}
              </View>

              {/* Payout methods */}
              <View style={[styles.profileViewSectionHeadingWrap, { marginTop: 24 }]}>
                <Text style={[styles.profileViewSectionTitle, { color: riderUi.textMuted }]}>Send to</Text>
              </View>

              {payoutAccounts.length === 0 ? (
                <View style={[styles.profileViewCard, { backgroundColor: riderUi.cardBg, borderColor: riderUi.divider }]}>
                  <Text style={[styles.profileViewValue, { color: riderUi.textMuted, paddingVertical: 14, paddingHorizontal: 4, textAlign: 'left' }]}>
                    No payout method linked. Go to Profile → Payout methods to add one.
                  </Text>
                </View>
              ) : (
                <View style={[styles.profileViewCard, { backgroundColor: riderUi.cardBg, borderColor: riderUi.divider }]}>
                  {payoutAccounts.map((account, i) => (
                    <View key={account.id}>
                      <Pressable
                        style={styles.profilePaymentRow}
                        onPress={() => {
                          hapticMedium();

                          if (clampedAmountToCashOut <= 0) {
                            Alert.alert('Enter amount', 'Please enter an amount greater than J$0.');
                            return;
                          }
                          if (amountToCashOut > availableCashOutAmount) {
                            Alert.alert('Amount too high', `You only have ${fmtJmd(availableCashOutAmount)} available to cash out.`);
                            return;
                          }

                          Alert.alert(
                            'Confirm cash out',
                            `Send ${fmtJmd(cashOutNet)} to ${account.label}?\n\nApp fee (1%): −${fmtJmd(cashOutFee)}\nThis action cannot be undone.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Cash out',
                                onPress: () => {
                                  hapticSuccess();
                                  setSubScreen(null);
                                  Alert.alert('Cash out requested', `${fmtJmd(cashOutNet)} will be sent to ${account.label} within 1–2 business days.`);
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <View style={[
                          styles.profilePaymentCardIcon,
                          account.type === 'bank'
                            ? { backgroundColor: '#1a5276' }
                            : (account.label.toLowerCase().includes('visa') ? styles.profilePaymentVisa : styles.profilePaymentMc),
                        ]}>
                          <Text style={styles.profilePaymentCardIconText}>
                            {account.type === 'bank' ? 'BANK' : (account.label.toLowerCase().includes('visa') ? 'VISA' : 'MC')}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.profilePaymentLabel, { color: riderUi.text }]} numberOfLines={1}>{account.label}</Text>
                          <Text style={[styles.profilePaymentSub, { color: riderUi.textMuted }]}>
                            {account.type === 'bank' ? `Account •••• ${account.last4}` : `•••• ${account.last4}`}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={riderUi.textMuted} />
                      </Pressable>
                      {i < payoutAccounts.length - 1 && (
                        <View style={[styles.profileViewDivider, { backgroundColor: riderUi.divider }]} />
                      )}
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.cashOutFootnote, { color: riderUi.textMuted }]}>
                Funds are typically received within 1–2 business days depending on your bank.
              </Text>
            </ScrollView>
          </View>
        );
      }
      case 'notifications':
        return (
          <NotificationsScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
          />
        );
      case 'profile':
        return (
          <DriverProfileScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
            onEdit={() => setSubScreen('profileEdit')}
            userFirstName={profileFirstName}
            userLastName={profileLastName}
            userEmail={profileEmail}
            userPhoneE164={profilePhone || null}
            payoutAccounts={payoutAccounts}
            addPayoutVisible={addPayoutVisible}
            setAddPayoutVisible={setAddPayoutVisible}
            onAddPayoutSave={(account) => {
              setPayoutAccounts((prev) => [
                ...prev,
                { ...account, id: `payout-${Date.now()}` },
              ]);
            }}
            onPayoutLongPress={(account) => {
              Alert.alert('Remove payout method', `Remove ${account.label}?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    setPayoutAccounts((prev) => prev.filter((a) => a.id !== account.id)),
                },
              ]);
            }}
            onConfirmSignOut={() => {
              void signOut();
            }}
          />
        );
      case 'profileEdit':
        return (
          <ProfileEditScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen('profile')}
            onSave={() => {
              void saveProfile();
            }}
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
            saveAddress={() => setAddressModal(null)}
            closeAddressModal={() => setAddressModal(null)}
          />
        );
      case 'settingsNotifications':
        return (
          <SettingsNotificationsScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
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
      case 'settingsPassword':
        return <SettingsPasswordScreen ui={riderUi} isDark={isDark} onBack={() => setSubScreen(null)} />;
      case 'settingsPayment':
        return (
          <SettingsPaymentScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
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
            onPaymentMethodLongPress={onPaymentMethodLongPress}
            editExpiryVisible={editExpiryVisible}
            editExpiryLast4={editExpiryLast4}
            editExpiryMonth={editExpiryMonth}
            setEditExpiryMonth={setEditExpiryMonth}
            editExpiryYear={editExpiryYear}
            setEditExpiryYear={setEditExpiryYear}
            closeEditCardExpiry={closeEditCardExpiry}
            saveEditCardExpiry={saveEditCardExpiry}
          />
        );
      case 'settingsLanguage':
        return (
          <SettingsLanguageScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
            selectedLang={selectedLang}
            onSelectLang={(lang) => {
              setSelectedLang(lang);
              setSubScreen(null);
            }}
          />
        );
      case 'settingsAppearance':
        return (
          <SettingsAppearanceScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
            themeOverride={themeOverride}
            setThemeOverride={setThemeOverride}
          />
        );
      case 'settingsHelp':
        return (
          <SettingsHelpScreen
            ui={riderUi}
            isDark={isDark}
            onBack={() => setSubScreen(null)}
            onContactSupport={() => setSubScreen('settingsSupport')}
          />
        );
      case 'settingsSupport':
        return <SettingsSupportScreen userEmail={profileEmail} userFirstName={profileFirstName} onBack={() => setSubScreen(null)} />;
      case 'settingsTerms':
        return <SettingsTermsScreen ui={riderUi} isDark={isDark} onBack={() => setSubScreen(null)} />;
      case 'allTrips':
        return (
          <Animated.View
            style={[
              styles.editProfileRoot,
              { backgroundColor: riderUi.screenBg, transform: [{ translateY: allTripsSlideAnim }] },
            ]}
          >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <View style={[styles.editProfileHeader, { backgroundColor: riderUi.screenBg, borderBottomColor: riderUi.divider }]}>
              <Pressable
                style={styles.editProfileHeaderSide}
                onPress={() => {
                  hapticLight();
                  Animated.timing(allTripsSlideAnim, {
                    toValue: 800,
                    duration: 280,
                    useNativeDriver: true,
                  }).start(() => setSubScreen(null));
                }}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={24} color={riderUi.text} />
              </Pressable>
              <Text style={[styles.editProfileHeaderTitle, { color: riderUi.text }]}>All Trips</Text>
              <View style={styles.editProfileHeaderSide} />
            </View>
            <ScrollView
              style={styles.editProfileScroll}
              contentContainerStyle={[styles.profileViewScrollContent, { gap: 12 }]}
              showsVerticalScrollIndicator={false}
            >
              {completedTrips.map((trip) => (
                <Pressable
                  key={trip.id}
                  style={[styles.tripHistoryCard, { borderColor: riderUi.divider, backgroundColor: riderUi.cardBg }]}
                  onPress={() => {
                    hapticLight();
                    setSelectedTripDetail(trip);
                  }}
                >
                  <View style={styles.tripHistoryTopRow}>
                    <Text style={[styles.tripHistoryRoute, { color: riderUi.text }]}>{trip.route}</Text>
                    <Text style={[styles.tripHistoryFare, { color: riderUi.text }]}>{trip.fare}</Text>
                  </View>
                  <Text style={[styles.tripHistoryMeta, { color: riderUi.textMuted }]}>Rider {trip.riderName} • {trip.when}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  const renderSettingsTab = () => (
    <SettingsTabScreen
      ui={settingsUi}
      openProfile={() => setSubScreen('profile')}
      setScreen={(screen) => setSubScreen(screen)}
      selectedLang={selectedLang}
      themeOverride={themeOverride}
      refreshing={settingsRefreshing}
      onRefresh={onRefreshSettings}
      onClearCache={onClearDriverCache}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: ui.bg }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {subScreen ? renderSubScreen() : null}

      {!subScreen && showHomeChrome ? (
        <Animated.View style={[styles.mapWrapper, { backgroundColor: ui.bg, height: homeMapHeightAnim }]}>
          <RidrMapView
            ref={(ref) => {
              mainMapRef.current = ref;
            }}
            isDark={isDark}
            loadingBackgroundColor={ui.bg}
            initialRegion={driverHomeInitialRegion}
            showsCompass={false}
            toolbarEnabled={false}
            onMapReady={() => {
              if (!currentTrip || currentTrip.status !== 'in_trip') return;
              try {
                const coords =
                  homeRoutePolylineCoords.length >= 2 ? homeRoutePolylineCoords : [mapPickup, mapDropoff];
                mainMapRef.current?.fitToCoordinates(coords, {
                  edgePadding: {
                    top: Platform.OS === 'ios' ? 160 : 140,
                    right: 52,
                    bottom: 140,
                    left: 52,
                  },
                  animated: true,
                });
              } catch {
                // ignore
              }
            }}
          >
            {hasDistinctPickupDrop ? (
              <>
                <Polyline
                  coordinates={homeRoutePolylineCoords}
                  strokeColor={ridrMapRouteStroke.outer}
                  strokeWidth={9}
                  lineCap="round"
                  lineJoin="round"
                  geodesic={false}
                />
                <Polyline
                  coordinates={homeRoutePolylineCoords}
                  strokeColor={ridrMapRouteStroke.inner}
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                  geodesic={false}
                />
              </>
            ) : null}
            <Marker coordinate={mapPickup} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={ridrMapMarkerStyles.pickup} />
            </Marker>
            <Marker coordinate={mapDropoff} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={ridrMapMarkerStyles.dropoff} />
            </Marker>
            <Marker coordinate={driverMarker} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={ridrMapMarkerStyles.nearbyDriver}>
                <Ionicons name="car-sport" size={18} color={colors.accent} />
              </View>
            </Marker>
          </RidrMapView>
        </Animated.View>
      ) : null}

      {!subScreen && showHomeChrome ? (
        <View
          style={[styles.fixedHeader, { backgroundColor: ui.headerOverlay }]}
          onLayout={(e) => setHeaderLayoutHeight(e.nativeEvent.layout.height)}
        > 
          <View style={styles.headerRow}>
            <View style={styles.profileBlock}>
              <Pressable
                style={[styles.profileIconShell, { backgroundColor: ui.soft, borderColor: ui.border }]}
                onPress={() => {
                  hapticLight();
                  setSubScreen('profile');
                }}
                accessibilityRole="button"
                accessibilityLabel="Open driver profile"
              >
                <Ionicons name="person" size={18} color={ui.text} />
              </Pressable>
              <View style={styles.profileLabels}>
                <Text style={[styles.userName, { color: ui.text }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.notifIconShell}
              onPress={() => {
                hapticLight();
                setSubScreen('notifications');
              }}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications" size={18} color="#ffffff" />
            </Pressable>
          </View>

          {currentTrip?.status === 'in_trip' ? (
            <Animated.View
              style={[
                styles.enrouteHeaderBar,
                {
                  opacity: enrouteBarAnim,
                  transform: [
                    {
                      translateY: enrouteBarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.enrouteHeaderBarInner}>
                <View style={styles.enrouteHeaderBarTextBlock}>
                  <Text style={styles.enrouteHeaderBarTitle}>En route</Text>
                  <Text style={styles.enrouteHeaderBarTime}>{formatMinSec(enrouteRemainingSec)}</Text>
                </View>
                <Pressable
                  onPress={() => { hapticLight(); setCurrentTripExpanded((prev) => !prev); }}
                  hitSlop={10}
                  style={styles.enrouteHeaderDropdownBtn}
                  accessibilityRole="button"
                  accessibilityLabel={currentTripExpanded ? 'Hide trip details' : 'Show trip details'}
                >
                  <Ionicons
                    name={currentTripExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#ffffff"
                  />
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {!subScreen && showHomeChrome && currentTrip && currentTrip.status === 'in_trip' && headerLayoutHeight > 0 ? (
        <Animated.View
          pointerEvents={currentTripExpanded ? 'box-none' : 'none'}
          style={[
            styles.enrouteDropdownPanel,
            {
              top: headerLayoutHeight,
              opacity: enrouteDropdownAnim,
              transform: [{
                translateY: enrouteDropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              }],
            },
          ]}
        >
          <View style={[styles.currentTripSurface, { backgroundColor: ui.panelBg, borderColor: ui.border }]}>
            <View style={styles.currentTripTopRow}>
              <View style={styles.currentTripRiderMeta}>
                <Text style={[styles.currentTripRiderName, { color: ui.text }]}>{currentTrip.riderName}</Text>
                <Text style={[styles.currentTripMeta, { color: ui.textMuted }]}>{currentTrip.distance} • {currentTrip.fare} • {currentTrip.paymentLabel}</Text>
              </View>
              <View style={styles.currentTripContactActions}>
                <Pressable
                  style={[styles.currentTripContactBtn, { backgroundColor: '#171717' }]}
                  onPress={() => {
                    hapticLight();
                    if (currentTrip.riderPhone) {
                      Linking.openURL(`tel:${currentTrip.riderPhone}`);
                    } else {
                      Alert.alert('No number', 'Rider phone number is not available.');
                    }
                  }}
                >
                  <Ionicons name="call" size={17} color="#ffffff" />
                </Pressable>
                <Pressable
                  style={[styles.currentTripContactBtn, { backgroundColor: '#171717' }]}
                  onPress={() => { hapticLight(); setShowRiderChat(true); }}
                >
                  <Ionicons name="chatbubble-ellipses" size={16} color="#ffffff" />
                </Pressable>
              </View>
            </View>
            <View style={[styles.routePill, { backgroundColor: ui.card }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 10, alignItems: 'center' }}>
                  <View style={[styles.routeDot, { backgroundColor: '#171717' }]} />
                </View>
                <Text style={[styles.routePillText, { color: ui.text, flex: 1 }]} numberOfLines={1}>{currentTrip.pickup}</Text>
              </View>
              <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
                <View style={{ width: 10, alignItems: 'center' }}>
                  <View style={[styles.routeConnector, { backgroundColor: ui.textMuted, height: 22, opacity: 0.4 }]} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 10, alignItems: 'center' }}>
                  <View style={[styles.routeDot, { backgroundColor: '#FFD000' }]} />
                </View>
                <Text style={[styles.routePillText, { color: ui.text, flex: 1 }]} numberOfLines={1}>{currentTrip.dropoff}</Text>
              </View>
            </View>
            <View style={styles.currentTripStageRow}>
              {DRIVER_PROGRESS_STEPS.map((step, index) => {
                const isActive = index <= progressIndex;
                const isCurrent = currentTrip.status === step.key;
                const isCompletedPill = step.key === 'completed';
                return (
                  <Pressable
                    key={step.key}
                    style={[styles.tripPhasePill, {
                      backgroundColor: isCurrent ? '#FFD000' : isActive ? '#171717' : ui.card,
                      borderColor: isCurrent ? '#FFD000' : isActive ? '#171717' : ui.border,
                      opacity: isCompletedPill ? 1 : 1,
                    }]}
                    onPress={() => {
                      if (isCompletedPill) { hapticMedium(); advanceTrip(); }
                    }}
                  >
                    <Text style={[styles.tripPhasePillText, {
                      color: isCurrent ? '#171717' : isActive ? '#FFD000' : ui.textMuted,
                    }]} numberOfLines={1}>{step.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      ) : null}

      {!subScreen && currentTrip?.status !== 'in_trip' ? (
        <SafeAreaView edges={['bottom']} style={styles.overlaySafeArea} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            styles.sheetBase,
            showHomeChrome ? styles.sheetHome : styles.sheetFlat,
            {
              backgroundColor: ui.panelBg,
              transform: [{ translateY: Animated.add(driverSheetPan, driverSheetOffset) }],
            },
          ]}
        > 
          {showHomeChrome ? (
            <View
              style={styles.sheetDragHandleHit}
              {...(driverSheetGesturesEnabled ? driverSheetPanResponder.panHandlers : {})}
            >
              <View style={[styles.sheetDragHandle, { backgroundColor: ui.border }]} />
            </View>
          ) : null}
          {activeTab === 'settings' ? renderSettingsTab() : (
            <ScrollView
              ref={driverHomeScrollRef}
              contentContainerStyle={[
                styles.content,
                showHomeChrome
                  ? styles.contentHome
                  : styles.contentFlat,
              ]}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!driverSheetMinimized}
              onScroll={(event) => {
                driverScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {activeTab === 'home' ? (
                <DriverHomeTabContent
                  styles={styles}
                  ui={ui}
                  availableCashOutAmount={availableCashOutAmount}
                  currentTrip={currentTrip}
                  currentTripExpanded={currentTripExpanded}
                  tripUiTick={tripUiTick}
                  progressIndex={progressIndex}
                  completedTrips={completedTrips}
                  allTripsSlideAnim={allTripsSlideAnim}
                  driverProgressSteps={DRIVER_PROGRESS_STEPS}
                  formatJmd={formatJmd}
                  getTripBarCopy={getTripBarCopy}
                  setEarningsModal={setEarningsModal}
                  setCurrentTripExpanded={setCurrentTripExpanded}
                  setCurrentTrip={setCurrentTrip}
                  setTripPinInput={setTripPinInput}
                  setTripPinError={setTripPinError}
                  setTripPinModalVisible={setTripPinModalVisible}
                  setSubScreen={setSubScreen}
                  advanceTrip={advanceTrip}
                  hapticLight={hapticLight}
                  hapticMedium={hapticMedium}
                  hapticSelection={hapticSelection}
                />
              ) : null}
              {activeTab === 'trips' ? (
                <DriverTripsTabContent styles={styles} ui={ui} completedTrips={completedTrips} />
              ) : null}
            </ScrollView>
          )}
        </Animated.View>
      </SafeAreaView>
      ) : null}

      {!subScreen ? (
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(24,24,28,0.88)' : 'rgba(255,255,255,0.82)' }]}
      >
        <Pressable style={styles.tabItem} onPress={() => { if (activeTab !== 'home') hapticSelection(); setActiveTab('home'); }}>
          <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={24} color={activeTab === 'home' ? ui.tabActive : ui.tabInactive} />
          <Text style={[styles.tabLabel, { color: ui.tabInactive }, activeTab === 'home' ? [styles.tabLabelActive, { color: ui.tabActive }] : null]}>Home</Text>
        </Pressable>
        <Pressable
          style={styles.tabItem}
          onPress={() => {
            hapticMedium();
            if (isOnline) {
              setIsOnline(false);
              return;
            }
            void (async () => {
              const loc = await ensureDriverLocationReady();
              if (!loc.ok) {
                Alert.alert('Location required', loc.message, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => void Linking.openSettings() },
                ]);
                return;
              }
              setIsOnline(true);
            })();
          }}
          accessibilityRole="switch"
          accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
        >
          <View style={[styles.onlineTogglePill, { backgroundColor: isOnline ? '#16a34a' : ui.tabInactive }]}>
            <View style={[styles.onlineToggleDot, { backgroundColor: '#ffffff', alignSelf: isOnline ? 'flex-end' : 'flex-start' }]} />
          </View>
          <Text style={[styles.tabLabel, { color: isOnline ? '#16a34a' : ui.tabInactive, fontWeight: '700' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { if (activeTab !== 'settings') hapticSelection(); setActiveTab('settings'); }}>
          <Ionicons name={activeTab === 'settings' ? 'settings' : 'settings-outline'} size={24} color={activeTab === 'settings' ? ui.tabActive : ui.tabInactive} />
          <Text style={[styles.tabLabel, { color: ui.tabInactive }, activeTab === 'settings' ? [styles.tabLabelActive, { color: ui.tabActive }] : null]}>Settings</Text>
        </Pressable>
      </BlurView>
      ) : null}

      {!subScreen && showHomeChrome && driverSheetMinimized && currentTrip?.status !== 'in_trip' ? (
        <View style={styles.sheetExpandBtnWrap} pointerEvents="box-none">
          <Pressable
            style={[styles.sheetExpandBtn, { backgroundColor: ui.panelBg, borderColor: ui.border }]}
            onPress={() => {
              hapticMedium();
              expandDriverSheet();
            }}
            accessibilityRole="button"
            accessibilityLabel="Expand trip sheet"
          >
            <Ionicons name="chevron-up" size={20} color={ui.accent} />
            <Text style={[styles.sheetExpandBtnLabel, { color: ui.text }]}>Trip sheet</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Incoming request modal ── */}
      {(() => {
        const request = incomingRequests[0];
        if (!request || !isOnline || hasCurrentTrip || !showHomeChrome || !requestModalVisible) return null;

        const modalRouteCoords =
          requestModalRouteCoords.length > 1
            ? requestModalRouteCoords
            : [request.pickupCoordinate, request.dropoffCoordinate];

        return (
          <Modal
            key={request.id}
            visible
            animationType="fade"
            transparent
            statusBarTranslucent
            onRequestClose={() => handleDecline(request.id)}
          >
            <View style={styles.requestModalCenteredOverlay}>
            <Animated.View
              style={[
                styles.requestModalSheet,
                {
                  backgroundColor: ui.panelBg,
                  transform: [
                    ...requestModalPan.getTranslateTransform(),
                    { scale: requestModalPulse },
                  ],
                },
              ]}
            > 
              <View style={styles.requestModalHeader} {...requestModalPanResponder.panHandlers}>
                <View style={styles.requestModalHeaderLeft}>
                  <Text style={[styles.requestModalEyebrow, { color: ui.text }]}>{request.riderName}</Text>
                </View>
                <Text style={[styles.requestFare, { color: '#16a34a' }]}>{request.fare}</Text>
              </View>
              {/* Mini map */}
              <View style={styles.requestModalMap}>
                <RidrMapView
                  isDark={isDark}
                  loadingBackgroundColor={ui.panelBg}
                  style={StyleSheet.absoluteFillObject}
                  scrollEnabled
                  zoomEnabled
                  showsCompass={false}
                  initialRegion={{
                    latitude: (request.pickupCoordinate.latitude + request.dropoffCoordinate.latitude) / 2,
                    longitude: (request.pickupCoordinate.longitude + request.dropoffCoordinate.longitude) / 2,
                    latitudeDelta:
                      Math.abs(request.pickupCoordinate.latitude - request.dropoffCoordinate.latitude) * 2.4 + 0.025,
                    longitudeDelta:
                      Math.abs(request.pickupCoordinate.longitude - request.dropoffCoordinate.longitude) * 2.4 + 0.025,
                  }}
                >
                  <Polyline
                    coordinates={modalRouteCoords}
                    strokeColor={ridrMapRouteStroke.outer}
                    strokeWidth={7}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={false}
                  />
                  <Polyline
                    coordinates={modalRouteCoords}
                    strokeColor={ridrMapRouteStroke.inner}
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={false}
                  />
                  <Marker coordinate={request.pickupCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={ridrMapMarkerStyles.pickup} />
                  </Marker>
                  <Marker coordinate={request.dropoffCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={ridrMapMarkerStyles.dropoff} />
                  </Marker>
                  <Marker coordinate={driverMarker} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={ridrMapMarkerStyles.nearbyDriver}>
                      <Ionicons name="car-sport" size={14} color={colors.accent} />
                    </View>
                  </Marker>
                </RidrMapView>
              </View>
              {/* Top row: meta + payment */}
              <View style={styles.requestTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.requestMeta, { color: ui.textMuted }]}>{request.eta} · {request.distance}</Text>
                </View>
                <View style={styles.requestFareBlock}>
                  <LinearGradient
                    colors={request.paymentLabel === 'Cash' ? ['#16a34a', '#15803d'] : ['#2563eb', '#1d4ed8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.inlineBadge, { alignSelf: 'flex-end' }]}
                  >
                    <Text style={styles.inlineBadgeTextBold}>{request.paymentLabel}</Text>
                  </LinearGradient>
                </View>
              </View>
              {/* Route pill */}
              <View style={[styles.routePill, { backgroundColor: ui.soft }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 10, alignItems: 'center' }}>
                    <View style={[styles.routeDot, { backgroundColor: '#171717' }]} />
                  </View>
                  <Text style={[styles.routePillText, { color: ui.text, flex: 1 }]} numberOfLines={1}>{request.pickup}</Text>
                </View>
                <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
                  <View style={{ width: 10, alignItems: 'center' }}>
                    <View style={[styles.routeConnector, { backgroundColor: ui.textMuted, height: 22, opacity: 0.4 }]} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 10, alignItems: 'center' }}>
                    <View style={[styles.routeDot, { backgroundColor: '#FFD000' }]} />
                  </View>
                  <Text style={[styles.routePillText, { color: ui.text, flex: 1 }]} numberOfLines={1}>{request.dropoff}</Text>
                </View>
              </View>
              {/* Swipe to accept / decline */}
              <SwipeToAction
                onAccept={() => handleAccept(request.id)}
                onDecline={() => handleDecline(request.id)}
                disabled={isBusy}
                isDark={isDark}
                borderColor={ui.border}
              />
            </Animated.View>
            </View>
          </Modal>
        );
      })()}

      <Modal
        visible={tripPinModalVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onShow={() => setTimeout(() => pinInputRef.current?.focus(), 50)}
        onRequestClose={() => {
          setTripPinModalVisible(false);
          setTripPinInput('');
          setTripPinError('');
        }}
      >
        <View style={styles.requestModalCenteredOverlay}>
          <View style={[styles.tripPinModalSheet, { backgroundColor: ui.panelBg }]}> 
            <Text style={[styles.modalTitle, { color: ui.text }]}>Start trip</Text>
            <Text style={[styles.tripPinModalCopy, { color: ui.textMuted }]}>Enter the 4-digit PIN the rider received after you accepted this trip.</Text>
            {/* Hidden input captures keyboard */}
            <TextInput
              ref={pinInputRef}
              value={tripPinInput}
              onChangeText={(value) => {
                const digits = value.replace(/\D/g, '').slice(0, 5);
                setTripPinInput(digits);
                if (tripPinError) setTripPinError('');
                if (digits.length === 5) confirmTripStartPin();
              }}
              keyboardType="number-pad"
              maxLength={5}
              caretHidden
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            {/* Digit boxes */}
            <Pressable style={styles.tripPinDigitRow} onPress={() => pinInputRef.current?.focus()}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[styles.tripPinDigitBox, {
                    borderBottomColor: tripPinError ? '#dc2626' : tripPinInput.length === i ? ui.accent : tripPinInput.length > i ? ui.text : ui.border,
                    borderBottomWidth: tripPinInput.length === i ? 2.5 : 1.5,
                  }]}
                >
                  <Text style={[styles.tripPinDigitText, { color: ui.text }]}>
                    {tripPinInput[i] ? '●' : ''}
                  </Text>
                </View>
              ))}
            </Pressable>
            {tripPinError ? (
              <Text style={styles.tripPinErrorText}>{tripPinError}</Text>
            ) : null}
            <View style={styles.tripPinActions}>
              <Pressable
                style={[styles.tripPinActionButton, { borderColor: ui.border, backgroundColor: ui.soft }]}
                onPress={() => {
                  setTripPinModalVisible(false);
                  setTripPinInput('');
                  setTripPinError('');
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: ui.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.tripPinActionButton, { backgroundColor: ui.accent, borderColor: 'transparent' }]}
                onPress={confirmTripStartPin}
              >
                <Text style={styles.primaryButtonText}>Start</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Earnings detail modal ── */}
      <Modal visible={earningsModal === 'earnings'} animationType="slide" transparent onRequestClose={() => setEarningsModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEarningsModal(null)} />
        <View style={[styles.modalSheet, { backgroundColor: ui.panelBg }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: ui.text }]}>Today's Earnings</Text>
          <Text style={[styles.modalStat, { color: '#16a34a' }]}>{formatJmd(availableCashOutAmount)}</Text>
          <Text style={[styles.modalStatLabel, { color: ui.textMuted }]}>Total earned today</Text>
          <View style={[styles.modalDivider, { backgroundColor: ui.border }]} />
          {[
            { label: 'Base fares', value: 'J$9,840' },
            { label: 'Tips received', value: 'J$1,200' },
            { label: 'Surge bonuses', value: 'J$1,390' },
            { label: 'Platform fee', value: '−J$0' },
          ].map((row) => (
            <View key={row.label} style={styles.modalRow}>
              <Text style={[styles.modalRowLabel, { color: ui.textMuted }]}>{row.label}</Text>
              <Text style={[styles.modalRowValue, { color: ui.text }]}>{row.value}</Text>
            </View>
          ))}
          <View style={[styles.modalDivider, { backgroundColor: ui.border }]} />
          <Text style={[styles.modalFootnote, { color: ui.textMuted }]}>Payments are settled daily at midnight.</Text>
          <Pressable
            style={[styles.modalPrimaryBtn, { backgroundColor: '#16a34a', marginTop: 12 }]}
            onPress={() => {
              hapticMedium();
              setEarningsModal(null);
              setSubScreen('cashOut');
            }}
          >
            <Text style={styles.modalPrimaryBtnText}>Cash out</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Trips today detail modal ── */}
      <Modal visible={earningsModal === 'trips'} animationType="slide" transparent onRequestClose={() => setEarningsModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEarningsModal(null)} />
        <View style={[styles.modalSheet, { backgroundColor: ui.panelBg }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: ui.text }]}>Trips Today</Text>
          <Text style={[styles.modalStat, { color: ui.text }]}>9</Text>
          <Text style={[styles.modalStatLabel, { color: ui.textMuted }]}>Completed trips</Text>
          <View style={[styles.modalDivider, { backgroundColor: ui.border }]} />
          {[
            ...completedTrips,
            { id: 'done-4', riderName: 'Omar S.', route: 'Kingston to Portmore', fare: 'J$2,650', when: 'Today, 6:50 AM' },
            { id: 'done-5', riderName: 'Tanya M.', route: 'New Kingston to Airport', fare: 'J$3,100', when: 'Today, 5:30 AM' },
          ].map((trip) => (
            <View key={trip.id} style={[styles.modalTripRow, { borderColor: ui.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalRowValue, { color: ui.text }]}>{trip.route}</Text>
                <Text style={[styles.modalRowLabel, { color: ui.textMuted }]}>{trip.riderName} • {trip.when}</Text>
              </View>
              <Text style={[styles.modalRowValue, { color: ui.text }]}>{trip.fare}</Text>
            </View>
          ))}
          <Pressable style={styles.modalCloseBtn} onPress={() => setEarningsModal(null)}>
            <Text style={styles.modalCloseBtnText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Rating detail modal ── */}
      <Modal visible={earningsModal === 'rating'} animationType="slide" transparent onRequestClose={() => setEarningsModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEarningsModal(null)} />
        <View style={[styles.modalSheet, { backgroundColor: ui.panelBg }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: ui.text }]}>Your Rating</Text>
          <Text style={[styles.modalStat, { color: ui.text }]}>4.9 ★</Text>
          <Text style={[styles.modalStatLabel, { color: ui.textMuted }]}>Based on 312 ratings</Text>
          <View style={[styles.modalDivider, { backgroundColor: ui.border }]} />
          {[
            { stars: 5, pct: 88 },
            { stars: 4, pct: 9 },
            { stars: 3, pct: 2 },
            { stars: 2, pct: 1 },
            { stars: 1, pct: 0 },
          ].map(({ stars, pct }) => (
            <View key={stars} style={styles.ratingBarRow}>
              <Text style={[styles.ratingBarStar, { color: ui.textMuted }]}>{stars} ★</Text>
              <View style={[styles.ratingBarTrack, { backgroundColor: ui.soft }]}>
                <View style={[styles.ratingBarFill, { width: `${pct}%` as any, backgroundColor: '#FFD000' }]} />
              </View>
              <Text style={[styles.ratingBarPct, { color: ui.textMuted }]}>{pct}%</Text>
            </View>
          ))}
          <View style={[styles.modalDivider, { backgroundColor: ui.border }]} />
          <Text style={[styles.modalFootnote, { color: ui.textMuted }]}>Ratings reflect your last 90 days of trips.</Text>
          <Pressable style={styles.modalCloseBtn} onPress={() => setEarningsModal(null)}>
            <Text style={styles.modalCloseBtnText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Trip detail modal (centered, like rider Activity) ── */}
      <Modal
        visible={selectedTripDetail !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedTripDetail(null)}
      >
        <Pressable style={styles.rideDetailOverlay} onPress={() => setSelectedTripDetail(null)}>
          <Pressable style={[styles.rideDetailSheet, { backgroundColor: ui.card }]} onPress={() => {}}>
            <View style={styles.rideDetailHandle} />
            <View style={[styles.rideDetailIconWrap, { backgroundColor: '#171717' }]}>
              <Text style={styles.rideDetailAvatarText}>
                {(selectedTripDetail?.riderName ?? '').split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>

            {(() => {
              const route = splitTripRoute(selectedTripDetail?.route ?? '');
              return (
                <>
                  <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{route.from}</Text>
                  {route.to ? (
                    <View style={styles.rideDetailArrowRow}>
                      <View style={[styles.rideDetailLine, { backgroundColor: ui.border }]} />
                      <Ionicons name="arrow-down" size={16} color={ui.textMuted} />
                      <View style={[styles.rideDetailLine, { backgroundColor: ui.border }]} />
                    </View>
                  ) : null}
                  {route.to ? (
                    <Text style={[styles.rideDetailRoute, { color: ui.text }]}>{route.to}</Text>
                  ) : null}
                </>
              );
            })()}

            <View style={[styles.rideDetailDivider, { backgroundColor: ui.border }]} />
            <View style={styles.rideDetailMeta}>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Rider</Text>
                <Text style={[styles.rideDetailMetaValue, { color: ui.text }]}>{selectedTripDetail?.riderName}</Text>
              </View>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Date</Text>
                <Text style={[styles.rideDetailMetaValue, { color: ui.text }]}>{selectedTripDetail?.when}</Text>
              </View>
              <View style={styles.rideDetailMetaItem}>
                <Text style={[styles.rideDetailMetaLabel, { color: ui.textMuted }]}>Fare</Text>
                <Text style={[styles.rideDetailMetaValue, { color: ui.text }]}>{selectedTripDetail?.fare}</Text>
              </View>
            </View>

            <Pressable style={styles.rideDetailCloseBtn} onPress={() => setSelectedTripDetail(null)}>
              <Text style={styles.rideDetailCloseBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Rider chat modal ── */}
      <Modal
        visible={showRiderChat}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowRiderChat(false)}
      >
        <View style={chatModalStyles.overlay}>
          <View style={[chatModalStyles.sheet, { backgroundColor: ui.panelBg }]}>
            {/* Header */}
            <View style={[chatModalStyles.header, { backgroundColor: ui.panelBg, borderBottomColor: ui.border }]}>
              <Pressable style={chatModalStyles.headerSide} onPress={() => setShowRiderChat(false)} hitSlop={8}>
                <Ionicons name="arrow-back" size={24} color={ui.text} />
              </Pressable>
              <Text style={[chatModalStyles.headerTitle, { color: ui.text }]}>Chat</Text>
              <View style={chatModalStyles.headerSide} />
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {/* Messages */}
              <ScrollView
                ref={riderChatScrollRef}
                style={chatModalStyles.messageList}
                contentContainerStyle={chatModalStyles.messageListContent}
                onContentSizeChange={() => riderChatScrollRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
              >
              {riderChatMessages.length === 0 ? (
                <Text style={[chatModalStyles.emptyText, { color: ui.textMuted }]}>
                  No messages yet. Say hello!
                </Text>
              ) : (
                riderChatMessages.map((msg) => (
                  <View key={msg.id} style={[chatModalStyles.messageRow, msg.sender === 'me' ? chatModalStyles.messageRowMe : chatModalStyles.messageRowThem]}>
                    <Text style={[chatModalStyles.senderLabel, { color: ui.textMuted }]}>
                      {msg.sender === 'me' ? 'You' : currentTrip?.riderName ?? 'Rider'}
                    </Text>
                    <Text style={[chatModalStyles.messageText, { color: ui.text }]}>
                      {msg.text}
                    </Text>
                  </View>
                ))
              )}
              </ScrollView>

              {/* Input */}
              <View style={[chatModalStyles.inputRow, { borderTopColor: ui.border, backgroundColor: ui.panelBg }]}>
              <TextInput
                style={[chatModalStyles.textInput, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', color: ui.text }]}
                placeholder="Message…"
                placeholderTextColor={ui.textMuted}
                value={riderChatInput}
                onChangeText={setRiderChatInput}
                returnKeyType="send"
                onSubmitEditing={() => {
                  const text = riderChatInput.trim();
                  if (!text) return;
                  const myMsg: ChatMessage = { id: String(Date.now()), text, sender: 'me', ts: Date.now() };
                  setRiderChatMessages((prev) => [...prev, myMsg]);
                  setRiderChatInput('');
                  hapticLight();
                  setTimeout(() => {
                    const reply = RIDER_AUTO_REPLIES[Math.floor(Math.random() * RIDER_AUTO_REPLIES.length)];
                    setRiderChatMessages((prev) => [...prev, { id: String(Date.now() + 1), text: reply, sender: 'them', ts: Date.now() }]);
                  }, 1200);
                }}
              />
              <Pressable
                style={[chatModalStyles.sendBtn, { opacity: riderChatInput.trim() ? 1 : 0.4 }]}
                disabled={!riderChatInput.trim()}
                onPress={() => {
                  const text = riderChatInput.trim();
                  if (!text) return;
                  const myMsg: ChatMessage = { id: String(Date.now()), text, sender: 'me', ts: Date.now() };
                  setRiderChatMessages((prev) => [...prev, myMsg]);
                  setRiderChatInput('');
                  hapticLight();
                  setTimeout(() => {
                    const reply = RIDER_AUTO_REPLIES[Math.floor(Math.random() * RIDER_AUTO_REPLIES.length)];
                    setRiderChatMessages((prev) => [...prev, { id: String(Date.now() + 1), text: reply, sender: 'them', ts: Date.now() }]);
                  }, 1200);
                }}
              >
                <Ionicons name="send" size={20} color="#ffffff" />
              </Pressable>
            </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  enrouteDropdownPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 6,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  enrouteHeaderBar: {
    marginTop: 10,
  },
  enrouteHeaderBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b0b0b',
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
  },
  enrouteHeaderBarTextBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  enrouteHeaderBarTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  enrouteHeaderBarTime: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  enrouteHeaderDropdownBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrouteMapToggleBtn: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  overlaySafeArea: {
    flex: 1,
  },
  editProfileRoot: {
    flex: 1,
  },
  editProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 4,
    paddingBottom: 12,
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
  },
  editProfileScroll: {
    flex: 1,
  },
  profileViewScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  profileViewSectionHeadingWrap: {
    marginBottom: 10,
    marginTop: 4,
  },
  profileViewSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  profileViewCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileViewDivider: {
    height: StyleSheet.hairlineWidth,
  },
  profileViewValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
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
  },
  profilePaymentSub: {
    fontSize: 12,
    marginTop: 2,
  },
  mapWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 26,
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  profileLabels: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  profileIconShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  notifIconShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ── earnings pills (home tab) ── */
  earningsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  earningsPill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  earningsPillCenter: {
    flex: 1.25,
  },
  earningsPillValueBlack: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  earningsPillLabelBlack: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  earningsPillValueYellow: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  earningsPillLabelYellow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  /* ── earnings modals ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,128,0.35)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  /* ── centered trip detail modal (like rider Activity) ── */
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
    backgroundColor: 'rgba(120,120,128,0.35)',
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
  rideDetailAvatarText: {
    color: '#FFD000',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  rideDetailCloseBtn: {
    marginTop: 16,
    backgroundColor: '#FFD000',
    borderRadius: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  rideDetailCloseBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  requestModalCenteredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  requestModalSheet: {
    width: '100%',
    borderRadius: 28,
    padding: 20,
    paddingBottom: 24,
    gap: 14,
    overflow: 'hidden',
  },
  requestModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestModalHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestModalLiveDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  requestModalEyebrow: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#171717',
  },
  requestModalPersonBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestModalMap: {
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: -4,
  },
  tripPinModalSheet: {
    width: '100%',
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  tripPinModalCopy: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  tripPinDigitRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  tripPinDigitBox: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  tripPinDigitText: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  tripPinInput: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
  },
  tripPinErrorText: {
    marginTop: -4,
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tripPinActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  tripPinActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestModalQueueBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  requestModalQueueText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  modalCashOutPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalCashOutPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalStat: {
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 46,
  },
  modalStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -6,
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modalRowLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalRowValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalTripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  modalFootnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
  modalCloseBtn: {
    backgroundColor: '#FFD000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    color: '#171717',
    fontSize: 15,
    fontWeight: '900',
  },
  modalPrimaryBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingBarStar: {
    width: 32,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  ratingBarPct: {
    width: 32,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'left',
  },
  /* ── surge / demand overlay ── */
  surgeBadge: {
    position: 'absolute',
    bottom: 18,
    right: 14,
    backgroundColor: '#ef4444',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 5,
  },
  surgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  surgeMultText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  surgeLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  demandLegend: {
    position: 'absolute',
    bottom: 18,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  driverStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  statDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  sheet: {
    flex: 1,
  },
  sheetBase: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetDragHandleHit: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 2,
    marginBottom: 0,
  },
  sheetDragHandle: {
    width: 56,
    height: 6,
    borderRadius: 3,
    alignSelf: 'center',
  },
  sheetHome: {
    marginTop: DRIVER_MAP_HEIGHT,
  },
  sheetFlat: {
    marginTop: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 108,
    gap: 16,
  },
  contentHome: {
    paddingTop: 18,
  },
  contentEnroute: {
    paddingTop: 10,
    gap: 12,
  },
  contentFlat: {
    paddingTop: 28,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  onlinePill: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  onlinePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171717',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  currentTripWrap: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  currentTripRoute: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  currentTripArrivalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  currentTripArrivalBarText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  currentTripArrivalPill: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentTripArrivalPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  currentTripArrivalChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTripSurface: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 14,
  },
  currentTripTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentTripRiderMeta: {
    flex: 1,
    gap: 4,
  },
  currentTripRiderName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  currentTripMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  currentTripStatusSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  currentTripContactActions: {
    flexDirection: 'row',
    gap: 10,
  },
  currentTripContactBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTripStageRow: {
    flexDirection: 'row',
    gap: 5,
  },
  tripPhasePill: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tripPhasePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  currentTripStageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currentTripStageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  currentTripStageText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  progressStep: {
    alignItems: 'center',
    width: 58,
    gap: 6,
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  currentTripActions: {
    flexDirection: 'row',
    gap: 10,
  },
  tripActionPill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
  },
  tripActionPillPrimary: {
    backgroundColor: '#FFD000',
  },
  tripActionPillPrimaryText: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '900',
  },
  tripActionPillCancel: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  tripActionPillCancelText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
  currentTripPrimaryButton: {
    flex: 1,
    justifyContent: 'center',
  },
  currentTripSecondaryButton: {
    minWidth: 132,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyState: {
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  requestCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 5,
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  requestMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  requestFareBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  requestFare: {
    fontSize: 18,
    fontWeight: '900',
  },
  requestMetaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inlineBadgeTextBold: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  routePill: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  routeLineContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  routeDotsCol: {
    width: 12,
    alignItems: 'center',
    paddingVertical: 2,
  },
  routeConnector: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    marginVertical: 3,
  },
  routeTextsCol: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: 12,
  },
  routePillText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  /* legacy — kept for any other references */
  routePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeLineCol: {
    width: 14,
    alignItems: 'center',
  },
  routePillDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 24,
  },
  routeBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  routeColumn: {
    alignItems: 'center',
    width: 14,
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  routeLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  routeLabels: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  swipeTrack: {
    height: DRIVER_TRACK_H,
    borderRadius: DRIVER_TRACK_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  swipeFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  swipeThumb: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DRIVER_THUMB_W,
    height: DRIVER_TRACK_H,
    borderRadius: DRIVER_TRACK_H / 2,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  swipeDeclineLabel: {
    position: 'absolute',
    left: 48,
    fontSize: 15,
    fontWeight: '800',
    zIndex: 2,
  },
  swipeAcceptLabel: {
    position: 'absolute',
    right: 48,
    fontSize: 15,
    fontWeight: '800',
    zIndex: 2,
  },
  tripHistoryCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tripHistoryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  tripHistoryRoute: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  tripHistoryFare: {
    fontSize: 15,
    fontWeight: '800',
  },
  tripHistoryMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  homeSectionGap: {
    marginTop: 20,
    gap: 10,
  },
  weeklyCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  weeklyStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weeklyStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weeklyStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
  },
  weeklyStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  weeklyStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  cashOutAvailableCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    borderRadius: 26,
    paddingVertical: 26,
    paddingHorizontal: 20,
    minHeight: 150,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  cashOutFrostRadial: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 1,
  },
  cashOutFrostRadialTopLeft: {
    width: 220,
    height: 220,
    left: -80,
    top: -110,
  },
  cashOutFrostRadialBottomRight: {
    width: 260,
    height: 260,
    right: -120,
    bottom: -140,
  },
  cashOutFrostRadialCenter: {
    width: 180,
    height: 180,
    left: '48%',
    top: '50%',
    transform: [{ translateX: -90 }, { translateY: -90 }],
  },
  cashOutAvailableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
  },
  cashOutAvailableName: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  cashOutAvailableStaffCode: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  cashOutAvailableLabel: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  cashOutAvailableValue: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginTop: 6,
  },
  cashOutAmountInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  cashOutAmountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cashOutAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  cashOutAmountRowLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
  },
  cashOutInlineInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 120,
  },
  cashOutAmountCurrency: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 8,
  },
  cashOutInlineAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  cashOutAmountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  cashOutAmountError: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD000',
  },
  cashOutBreakdownWrap: {
    paddingTop: 12,
  },
  cashOutBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  cashOutBreakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  cashOutBreakdownValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  cashOutBreakdownNetLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  cashOutBreakdownNetValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  cashOutAmountCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 8,
    marginTop: 8,
  },
  cashOutAmountLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  cashOutAmountValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cashOutFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cashOutFeeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cashOutDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  cashOutNetLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  cashOutNetValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  cashOutFootnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  accountLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetExpandBtnWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
    zIndex: 7,
    pointerEvents: 'box-none',
  },
  sheetExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetExpandBtnLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  onlineTogglePill: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  onlineToggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
});

const chatModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
    opacity: 0.6,
  },
  messageRow: {
    gap: 2,
    maxWidth: '75%',
  },
  messageRowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(123,142,247,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  messageRowThem: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(123,142,247,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#7b8ef7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});