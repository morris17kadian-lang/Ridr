import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { clearAppCache } from '../../lib/appCacheStorage';
import { incomingRequestChimeUri } from '../../lib/incomingRequestChime';
import { useAuth } from '../../context/AuthContext';
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess } from '../../lib/haptics';
import { useAppTheme, type ThemeOverride } from '../../theme/ThemeProvider';
import { KSA_MAP_CENTER, type LatLng } from '../main/locationResolve';
import type { MainScreenUi } from '../main/mainScreenUi';
import { ProfileEditScreen } from '../main/profile/screens/ProfileEditScreen';
import { ProfileScreen } from '../main/profile/screens/ProfileScreen';
import { DEFAULT_PROFILE_CARDS, type ProfileCard } from '../main/profile/profileTypes';
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

type DriverTab = 'home' | 'trips' | 'settings';
type DriverSubScreen =
  | null
  | 'profile'
  | 'profileEdit'
  | 'notifications'
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
  pickup: string;
  pickupCoordinate: LatLng;
  dropoff: string;
  dropoffCoordinate: LatLng;
  fare: string;
  eta: string;
  distance: string;
  paymentLabel: 'Card' | 'Cash';
};

type DriverTripStatus = Extract<TripStatus, 'matched' | 'arrived' | 'completed' | 'cancelled'>;

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
  { key: 'completed', label: 'Completed' },
];

const incomingRequestsSeed: IncomingRequest[] = [
  {
    id: 'req-1',
    riderName: 'Alicia R.',
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

function getTripBadge(status: DriverTripStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'matched':
      return { label: 'Accepted', bg: '#fef3c7', text: '#92400e' };
    case 'arrived':
      return { label: 'At pickup', bg: '#ede9fe', text: '#6d28d9' };
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
    default:
      return null;
  }
}

function getStatusSummary(status: DriverTripStatus, paymentLabel: 'Card' | 'Cash'): string {
  switch (status) {
    case 'matched':
      return 'Trip accepted. Head to the pickup point.';
    case 'arrived':
      return 'You are at pickup. Start the trip when the rider is onboard.';
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
      return { title: 'Ride accepted. Head to pickup', pill: `${formatMinSec(etaCountdownSec)} Mins`, icon: 'checkmark-circle-outline' };
    case 'arrived':
      return { title: 'You have arrived at pickup', pill: 'Arrived', icon: 'location-outline' };
    case 'completed':
      return { title: 'Trip completed', pill: 'Done', icon: 'checkmark-done-outline' };
    case 'cancelled':
      return { title: 'Trip cancelled', pill: 'Closed', icon: 'close-circle-outline' };
  }
}

const DRIVER_TRACK_H = 52;
const DRIVER_THUMB_W = 50;
const DRIVER_MAP_HEIGHT = 410;
const DRIVER_SHEET_TOP = 250;
const DRIVER_SHEET_PEEK = 148;
const DRIVER_SHEET_MINIMIZED_OFFSET = Math.max(0, Dimensions.get('window').height - DRIVER_SHEET_TOP - DRIVER_SHEET_PEEK);

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
  const { user, setAppMode, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const [subScreen, setSubScreen] = useState<DriverSubScreen>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [surgeMultiplier] = useState(2.1); // reserved for future use
  type EarningsModal = null | 'earnings' | 'trips' | 'rating';
  const [earningsModal, setEarningsModal] = useState<EarningsModal>(null);
  const [incomingRequests, setIncomingRequests] = useState(incomingRequestsSeed);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<DriverTrip | null>(null);
  const [currentTripExpanded, setCurrentTripExpanded] = useState(true);
  const [tripUiTick, setTripUiTick] = useState(0);
  const [tripPinModalVisible, setTripPinModalVisible] = useState(false);
  const [tripPinInput, setTripPinInput] = useState('');
  const [tripPinError, setTripPinError] = useState('');
  const requestModalPulse = useRef(new Animated.Value(1)).current;
  const requestModalPan = useRef(new Animated.ValueXY()).current;
  const requestSoundRef = useRef<Audio.Sound | null>(null);
  const pinInputRef = useRef<TextInput>(null);
  const driverSheetPan = useRef(new Animated.Value(0)).current;
  const driverSheetOffset = useRef(new Animated.Value(0)).current;
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
  const [cards, setCards] = useState<ProfileCard[]>(DEFAULT_PROFILE_CARDS);
  const [defaultCard, setDefaultCard] = useState<string | null>(DEFAULT_PROFILE_CARDS[0]?.id ?? null);
  const [addCardVisible, setAddCardVisible] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');
  const [editExpiryVisible, setEditExpiryVisible] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
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

  const riderUi = useMemo<MainScreenUi>(
    () => ({
      screenBg: colors.background,
      panelBg: colors.card,
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

  const settingsUi = useMemo<TabUi>(
    () => ({
      screenBg: riderUi.screenBg,
      panelBg: riderUi.panelBg,
      cardBg: riderUi.cardBg,
      softBg: riderUi.softBg,
      text: riderUi.text,
      textMuted: riderUi.textMuted,
      divider: riderUi.divider,
      placeholder: riderUi.placeholder,
      accent: colors.accent,
      onAccentText: colors.textOnPrimary,
    }),
    [colors.accent, colors.textOnPrimary, riderUi]
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
  const driverMarker = currentTrip?.pickupCoordinate ?? { latitude: KSA_MAP_CENTER.latitude + 0.008, longitude: KSA_MAP_CENTER.longitude - 0.006 };

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
          return gs.dy < -8 && Math.abs(gs.dy) > Math.abs(gs.dx);
        }
        return driverScrollOffsetRef.current <= 0 && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx);
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
          if (gs.dy < -40 || gs.vy < -0.35) {
            expandDriverSheet();
          } else {
            Animated.spring(driverSheetPan, {
              toValue: 0,
              useNativeDriver: false,
              friction: 9,
              tension: 70,
            }).start();
          }
          return;
        }

        if (gs.dy > 120 || gs.vy > 0.5) {
          minimizeDriverSheet();
        } else {
          Animated.spring(driverSheetPan, {
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
    driverSheetEnabledRef.current = showHomeChrome;
  }, [showHomeChrome]);

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
    setCurrentTrip((prev) => (prev ? { ...prev, status: 'completed', completedAtMs: Date.now() } : prev));
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
    const digits = newCardNumber.replace(/\D/g, '');
    if (digits.length < 12) {
      Alert.alert('Card number', 'Enter a valid card number.');
      return;
    }
    const nextCard: ProfileCard = {
      id: `driver-card-${Date.now()}`,
      type: digits.startsWith('4') ? 'visa' : 'mastercard',
      last4: digits.slice(-4),
      label: newCardName.trim() || 'Driver card',
      expiryMonth: newCardExpiry.slice(0, 2),
      expiryYear: newCardExpiry.slice(-2),
    };
    setCards((prev) => [...prev, nextCard]);
    if (!defaultCard) setDefaultCard(nextCard.id);
    closeAddCardSheet();
  };

  const closeEditCardExpiry = () => {
    setEditExpiryVisible(false);
    setEditingCardId(null);
    setEditExpiryLast4('');
    setEditExpiryMonth('');
    setEditExpiryYear('');
  };

  const saveEditCardExpiry = async () => {
    if (!editingCardId) return;
    setCards((prev) =>
      prev.map((card) =>
        card.id === editingCardId
          ? { ...card, expiryMonth: editExpiryMonth.trim(), expiryYear: editExpiryYear.trim() }
          : card
      )
    );
    closeEditCardExpiry();
  };

  const onPaymentMethodLongPress = (card: ProfileCard) => {
    Alert.alert('Payment method', `Manage ${card.label}`, [
      {
        text: 'Update expiry',
        onPress: () => {
          setEditingCardId(card.id);
          setEditExpiryLast4(card.last4);
          setEditExpiryMonth(card.expiryMonth ?? '');
          setEditExpiryYear(card.expiryYear ?? '');
          setEditExpiryVisible(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setCards((prev) => prev.filter((item) => item.id !== card.id));
          setDefaultCard((prev) => (prev === card.id ? null : prev));
        },
      },
      { text: 'Cancel', style: 'cancel' },
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
    setTimeout(() => setSettingsRefreshing(false), 300);
  };

  const onClearDriverCache = () => {
    Alert.alert('Clear cache?', 'This removes locally cached app data on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearAppCache();
        },
      },
    ]);
  };

  const renderSubScreen = () => {
    switch (subScreen) {
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
          <View style={{ flex: 1, backgroundColor: riderUi.screenBg }}>
            <View style={[styles.driverStatsBar, { backgroundColor: ui.hero }]}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>J$12,430</Text>
                <Text style={styles.statLabel}>Today&apos;s earnings</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.statCard}>
                <Text style={styles.statValue}>9</Text>
                <Text style={styles.statLabel}>Trips today</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.statCard}>
                <Text style={styles.statValue}>4.9 ★</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
            <ProfileScreen
              ui={riderUi}
              isDark={isDark}
              onBack={() => setSubScreen(null)}
              onEdit={() => setSubScreen('profileEdit')}
            userFirstName={profileFirstName}
            userLastName={profileLastName}
            userEmail={profileEmail}
            userPhoneE164={profilePhone || null}
            cards={cards}
            defaultCard={defaultCard}
            selectDefaultCard={setDefaultCard}
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
            onConfirmSignOut={() => {
              void signOut();
            }}
          />
          </View>
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
            selectDefaultCard={setDefaultCard}
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
      default:
        return null;
    }
  };

  const renderHomeTab = () => (
    <>
      {/* ── Earnings summary pills ── */}
      <View style={styles.earningsRow}>
        <Pressable
          style={[styles.earningsPill, { backgroundColor: '#171717' }]}
          onPress={() => { hapticLight(); setEarningsModal('rating'); }}
        >
          <Text style={styles.earningsPillValueBlack}>4.9 ★</Text>
          <Text style={styles.earningsPillLabelBlack}>Rating</Text>
        </Pressable>
        <Pressable
          style={[styles.earningsPill, styles.earningsPillCenter, { backgroundColor: '#FFD000' }]}
          onPress={() => { hapticLight(); setEarningsModal('earnings'); }}
        >
          <Text style={styles.earningsPillValueYellow}>J$12,430</Text>
          <Text style={styles.earningsPillLabelYellow}>Today&apos;s earnings</Text>
        </Pressable>
        <Pressable
          style={[styles.earningsPill, { backgroundColor: '#171717' }]}
          onPress={() => { hapticLight(); setEarningsModal('trips'); }}
        >
          <Text style={styles.earningsPillValueBlack}>9</Text>
          <Text style={styles.earningsPillLabelBlack}>Trips today</Text>
        </Pressable>
      </View>

      {currentTrip ? (
        <View style={styles.currentTripWrap}>
          <Pressable
            style={styles.currentTripArrivalBar}
            onPress={() => {
              hapticSelection();
              setCurrentTripExpanded((prev) => !prev);
            }}
          >
            <Ionicons name={getTripBarCopy(currentTrip, tripUiTick).icon} size={18} color="#ffffff" />
            <Text style={styles.currentTripArrivalBarText} numberOfLines={1}>
              {getTripBarCopy(currentTrip, tripUiTick).title}
            </Text>
            <View style={styles.currentTripArrivalPill}>
              <Text style={styles.currentTripArrivalPillText}>{getTripBarCopy(currentTrip, tripUiTick).pill}</Text>
            </View>
            <View style={styles.currentTripArrivalChevron}>
              <Ionicons name={currentTripExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#000000" />
            </View>
          </Pressable>

          {currentTripExpanded ? (
            <View style={[styles.currentTripSurface, { backgroundColor: ui.soft, borderColor: ui.border }]}> 
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
                      Alert.alert('Call rider', `Calling ${currentTrip.riderName} is not wired up yet.`);
                    }}
                  >
                    <Ionicons name="call" size={17} color="#FFD000" />
                  </Pressable>
                  <Pressable
                    style={[styles.currentTripContactBtn, { backgroundColor: '#171717' }]}
                    onPress={() => {
                      hapticLight();
                      Alert.alert('Message rider', `Messaging ${currentTrip.riderName} is not wired up yet.`);
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#FFD000" />
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
                  const isNext = index === progressIndex + 1;
                  const isCompleted = currentTrip.status === 'completed' || currentTrip.status === 'cancelled';
                  const canTap = (!isCompleted && isNext) || (isCurrent && step.key === 'arrived');
                  return (
                    <Pressable
                      key={step.key}
                      style={[styles.tripPhasePill, {
                        backgroundColor: isCurrent ? '#FFD000'
                          : isActive ? '#171717'
                          : ui.card,
                        borderColor: isCurrent ? '#FFD000' : isActive ? '#171717' : ui.border,
                        opacity: canTap ? 1 : isNext ? 0.45 : 1,
                      }]}
                      onPress={() => {
                        if (!canTap) return;
                        if (step.key === 'arrived') {
                          if (currentTrip.status === 'matched') {
                            hapticMedium();
                            setCurrentTrip((prev) => prev ? { ...prev, status: 'arrived', arrivedAtMs: Date.now() } : prev);
                          } else {
                            hapticLight();
                          }
                          setTripPinInput('');
                          setTripPinError('');
                          setTripPinModalVisible(true);
                        } else if (step.key === 'completed') {
                          advanceTrip();
                        }
                      }}
                    >
                      <Text style={[styles.tripPhasePillText, {
                        color: isCurrent ? '#171717' : isActive ? '#FFD000' : ui.textMuted,
                      }]}>
                        {step.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

            </View>
          ) : null}
        </View>
      ) : null}

    </>
  );

  const renderTripsTab = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: ui.text }]}>Recent trips</Text>
        <Text style={[styles.sectionSub, { color: ui.textMuted }]}>Latest completed work</Text>
      </View>
      {completedTripsSeed.map((trip) => (
        <View key={trip.id} style={[styles.tripHistoryCard, { borderColor: ui.border, backgroundColor: ui.card }]}> 
          <View style={styles.tripHistoryTopRow}>
            <Text style={[styles.tripHistoryRoute, { color: ui.text }]}>{trip.route}</Text>
            <Text style={[styles.tripHistoryFare, { color: ui.text }]}>{trip.fare}</Text>
          </View>
          <Text style={[styles.tripHistoryMeta, { color: ui.textMuted }]}>Rider {trip.riderName} • {trip.when}</Text>
        </View>
      ))}
    </>
  );

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
        <View style={[styles.mapWrapper, { backgroundColor: ui.bg }]}> 
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: KSA_MAP_CENTER.latitude,
              longitude: KSA_MAP_CENTER.longitude,
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
          >
            <Marker coordinate={mapPickup} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.pickupMarker} />
            </Marker>
            <Marker coordinate={mapDropoff} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.dropoffMarker} />
            </Marker>
            <Marker coordinate={driverMarker} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarker}>
                <Ionicons name="car-sport" size={18} color="#ffffff" />
              </View>
            </Marker>
          </MapView>
        </View>
      ) : null}

      {!subScreen && showHomeChrome ? (
        <View style={[styles.fixedHeader, { backgroundColor: ui.headerOverlay }]}> 
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
                <Text style={[styles.greeting, { color: ui.textMuted }]}>Good morning</Text>
                <Text style={[styles.userName, { color: ui.text }]}>{name}</Text>
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
        </View>
      ) : null}

      {!subScreen ? (
      <SafeAreaView style={styles.overlaySafeArea} pointerEvents="box-none">
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
          {showHomeChrome ? <View style={[styles.sheetDragHandle, { backgroundColor: ui.border }]} {...driverSheetPanResponder.panHandlers} /> : null}
          {activeTab === 'settings' ? renderSettingsTab() : (
            <ScrollView
              contentContainerStyle={[styles.content, showHomeChrome ? styles.contentHome : styles.contentFlat]}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!driverSheetMinimized}
              onScroll={(event) => {
                driverScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {activeTab === 'home' ? renderHomeTab() : null}
              {activeTab === 'trips' ? renderTripsTab() : null}
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
            setIsOnline((prev) => !prev);
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

      {/* ── Incoming request modal ── */}
      {(() => {
        const request = incomingRequests[0];
        if (!request || !isOnline || hasCurrentTrip || !showHomeChrome || !requestModalVisible) return null;
        
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
                <MapView
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  style={StyleSheet.absoluteFillObject}
                  scrollEnabled
                  zoomEnabled
                  rotateEnabled
                  pitchEnabled={false}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass
                  toolbarEnabled={false}
                  initialRegion={{
                    latitude: (request.pickupCoordinate.latitude + request.dropoffCoordinate.latitude) / 2,
                    longitude: (request.pickupCoordinate.longitude + request.dropoffCoordinate.longitude) / 2,
                    latitudeDelta: Math.abs(request.pickupCoordinate.latitude - request.dropoffCoordinate.latitude) * 2.4 + 0.025,
                    longitudeDelta: Math.abs(request.pickupCoordinate.longitude - request.dropoffCoordinate.longitude) * 2.4 + 0.025,
                  }}
                >
                  <Polyline
                    coordinates={[request.pickupCoordinate, request.dropoffCoordinate]}
                    strokeColor="#FFD000"
                    strokeWidth={4}
                    lineDashPattern={[8, 4]}
                  />
                  <Marker coordinate={request.pickupCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.pickupMarker} />
                  </Marker>
                  <Marker coordinate={request.dropoffCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.dropoffMarker} />
                  </Marker>
                  <Marker coordinate={driverMarker} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.driverMarker}>
                      <Ionicons name="car-sport" size={14} color="#ffffff" />
                    </View>
                  </Marker>
                </MapView>
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
                style={[styles.secondaryButton, styles.tripPinSecondaryButton, { borderColor: ui.border, backgroundColor: ui.soft }]}
                onPress={() => {
                  setTripPinModalVisible(false);
                  setTripPinInput('');
                  setTripPinError('');
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: ui.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.tripPinPrimaryButton, { backgroundColor: ui.accent }]}
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
          <Text style={[styles.modalStat, { color: '#16a34a' }]}>J$12,430</Text>
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
          <Pressable style={styles.modalCloseBtn} onPress={() => setEarningsModal(null)}>
            <Text style={styles.modalCloseBtnText}>Done</Text>
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
            ...completedTripsSeed,
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlaySafeArea: {
    flex: 1,
  },
  mapWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 410,
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
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
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
    color: '#171717',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
  },
  earningsPillLabelYellow: {
    color: 'rgba(23,23,23,0.65)',
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
    gap: 10,
  },
  tripPinPrimaryButton: {
    flex: 1,
    justifyContent: 'center',
  },
  tripPinSecondaryButton: {
    minWidth: 110,
    justifyContent: 'center',
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
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
  sheetDragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: -2,
  },
  sheetHome: {
    marginTop: 250,
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
  contentFlat: {
    paddingTop: 28,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    gap: 16,
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
    gap: 8,
  },
  tripPhasePill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tripPhasePillText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
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
  accountLine: {
    fontSize: 14,
    lineHeight: 20,
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
  pickupMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#171717',
    borderWidth: 4,
    borderColor: '#FFD000',
  },
  dropoffMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFD000',
    borderWidth: 4,
    borderColor: '#171717',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#171717',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});