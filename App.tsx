import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

import { authEnabled, firebaseApp, firebaseReady, missingFirebaseConfig } from './src/lib/firebase';
import {
  formatE164International,
  migrateLegacyNational,
  releaseE164,
  reserveE164,
  validateToE164,
} from './src/lib/phone';

const carMarkerAsset = require('./assets/car-marker.png');
const addCardPreviewAsset = require('./assets/master_card.png');

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
const destinationSuggestions = [
  { id: 'airport', title: 'Norman Manley Airport', subtitle: 'Palisadoes, Kingston', icon: 'airplane' as const },
  { id: 'half-way-tree', title: 'Half-Way Tree', subtitle: 'St. Andrew, Kingston', icon: 'business' as const },
  { id: 'new-kingston', title: 'New Kingston', subtitle: 'Knutsford Blvd, Kingston', icon: 'location' as const },
  { id: 'liguanea', title: 'Liguanea', subtitle: 'Hope Rd, Kingston', icon: 'cafe' as const },
  { id: 'downtown', title: 'Downtown Kingston', subtitle: 'King Street, Kingston', icon: 'storefront' as const },
  { id: 'portmore', title: 'Portmore', subtitle: 'St. Catherine, Jamaica', icon: 'home' as const },
];

// Default centre: Kingston, Jamaica
const JAMAICA_KINGSTON = { latitude: 17.9970, longitude: -76.7936 };

function buildCoords(base: { latitude: number; longitude: number }) {
  const pickup   = { latitude: base.latitude + 0.005,  longitude: base.longitude - 0.003 };
  const dropoff  = { latitude: base.latitude - 0.005,  longitude: base.longitude + 0.002 };
  const driver   = { latitude: base.latitude + 0.002,  longitude: base.longitude - 0.008 };
  const route = [
    driver,
    { latitude: base.latitude + 0.003, longitude: base.longitude - 0.006 },
    { latitude: base.latitude + 0.004, longitude: base.longitude - 0.004 },
    pickup,
    { latitude: base.latitude + 0.001, longitude: base.longitude - 0.002 },
    dropoff,
  ];
  return { pickup, dropoff, driver, route };
}

const MAP_HEIGHT = 400;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ANIMATION_TREE_KEY = 'animation-tree-v2';

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
function SupportIcon() {
  return (
    <Ionicons name="notifications-outline" size={22} color="#ffffff" />
  );
}

// Profile avatar button — user icon
function ProfileIcon() {
  return <Ionicons name="person" size={28} color="#171717" />;
}

// Tab icons use Ionicons (from @expo/vector-icons)

export default function App() {
  const [selectedRide, setSelectedRide] = useState('ride');
  const [activeTab, setActiveTab] = useState('home');
  const [screen, setScreen] = useState<'home' | 'profile' | 'profileEdit'>('home');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Profile
  const [userFirstName, setUserFirstName] = useState('Sarah');
  const [userLastName, setUserLastName] = useState('');
  const [editingFirstName, setEditingFirstName] = useState('');
  const [editingLastName, setEditingLastName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPhoneE164, setUserPhoneE164] = useState<string | null>(null);
  const [userCountryCode, setUserCountryCode] = useState('+1876');
  const [userEmail, setUserEmail] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('+1876');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // Addresses
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [addressModal, setAddressModal] = useState<'home' | 'work' | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationFocused, setDestinationFocused] = useState(false);
  const destinationInputRef = useRef<TextInput>(null);

  // Support modal
  const [supportVisible, setSupportVisible] = useState(false);

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
        savedName,
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
        AsyncStorage.getItem('profile_name'),
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
      } else if (savedName) {
        const p = savedName.trim().split(/\s+/);
        setUserFirstName(p[0] || 'Sarah');
      }
      if (savedLast !== null) {
        setUserLastName(savedLast);
      } else if (savedName && savedFirst === null) {
        const p = savedName.trim().split(/\s+/);
        setUserLastName(p.slice(1).join(' ') || '');
      }
      if (savedHome) setHomeAddress(savedHome);
      if (savedWork) setWorkAddress(savedWork);
      const country = savedCountry || '+1876';
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

  const displayName = `${userFirstName} ${userLastName}`.trim() || userFirstName;

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
    await AsyncStorage.setItem('profile_name', `${first} ${last}`.trim());

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

  const onResetPassword = () => {
    const email = userEmail.trim();
    if (!email) {
      Alert.alert(
        'Reset password',
        'Add an email in your profile first, then try again.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert(
      'Reset password',
      `We will send a reset link to ${email}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send link', onPress: () => {} },
      ],
    );
  };

  const countryCodes = [
    { code: '+1876', label: 'Jamaica' },
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

  const mapCenter = userLocation ?? JAMAICA_KINGSTON;
  const { pickup: pickupCoordinate, dropoff: dropoffCoordinate, driver: driverCoordinate, route: routeCoordinates } = buildCoords(mapCenter);

  // Animated drag-to-expand-map
  const panValue = useRef(new Animated.Value(0)).current;
  const destinationLiftAnim = useRef(new Animated.Value(0)).current;
  const scrollOffsetRef = useRef(0);
  const maxDrag = SCREEN_HEIGHT - (MAP_HEIGHT - 30);
  const searchSuggestions = [
    ...(homeAddress ? [{ id: 'saved-home', title: 'Home', subtitle: homeAddress, icon: 'home' as const }] : []),
    ...(workAddress ? [{ id: 'saved-work', title: 'Work', subtitle: workAddress, icon: 'briefcase' as const }] : []),
    ...destinationSuggestions,
  ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);

  const filteredSuggestions = searchSuggestions
    .filter((item) => {
      if (!destinationQuery.trim()) return true;
      const query = destinationQuery.trim().toLowerCase();
      return item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query);
    })
    .slice(0, destinationQuery.trim() ? 5 : 4);

  const mapHeightAnim = panValue.interpolate({
    inputRange: [0, maxDrag],
    outputRange: [MAP_HEIGHT, SCREEN_HEIGHT],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => scrollOffsetRef.current <= 0 && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponderCapture: (_, gs) => scrollOffsetRef.current <= 0 && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panValue.setValue(gs.dy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          Animated.timing(panValue, {
            toValue: maxDrag,
            duration: 280,
            useNativeDriver: false,
          }).start(() => {
            setMapExpanded(true);
            panValue.setValue(0);
          });
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
    setDestinationFocused(true);
    Animated.spring(destinationLiftAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const handleDestinationBlur = () => {
    setTimeout(() => {
      setDestinationFocused(false);
      Animated.spring(destinationLiftAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 8,
        tension: 65,
      }).start();
    }, 120);
  };

  const selectDestination = (value: string) => {
    setDestinationQuery(value);
    destinationInputRef.current?.blur();
    setDestinationFocused(false);
    Animated.spring(destinationLiftAnim, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const searchSheetTranslateY = destinationLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(MAP_HEIGHT - 118)],
  });

  // ── Profile (read-only) ─────────────────────────────────────────
  if (screen === 'profile') {
    return (
      <View style={styles.editProfileRoot}>
        <StatusBar style="dark" />
        <View style={styles.editProfileHeader}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('home')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#171717" />
          </Pressable>
          <Text style={styles.editProfileHeaderTitle}>Profile</Text>
          <Pressable style={styles.editProfileHeaderSide} onPress={openProfileEdit} hitSlop={8}>
            <Ionicons name="pencil" size={22} color="#171717" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.editProfileScroll}
          contentContainerStyle={styles.profileViewScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.editProfileAvatarWrap}>
            <View style={styles.editProfileAvatarImage}>
              <Ionicons name="person" size={56} color="#8a8a8a" />
            </View>
          </View>

          <View style={styles.profileViewSectionHeadingWrap}>
            <Text style={styles.profileViewSectionTitle}>Personal information</Text>
          </View>
          <View style={styles.profileViewCard}>
            <View style={styles.profileViewRow}>
              <Text style={styles.profileViewLabel}>First name</Text>
              <Text style={styles.profileViewValue}>{userFirstName.trim() ? userFirstName : '—'}</Text>
            </View>
            <View style={styles.profileViewDivider} />
            <View style={styles.profileViewRow}>
              <Text style={styles.profileViewLabel}>Last name</Text>
              <Text style={styles.profileViewValue}>{userLastName.trim() ? userLastName : '—'}</Text>
            </View>
            <View style={styles.profileViewDivider} />
            <View style={[styles.profileViewRow, styles.profileViewRowTop]}>
              <Text style={styles.profileViewLabel}>Email</Text>
              <Text style={[styles.profileViewValue, styles.profileViewValueMultiline]} numberOfLines={4}>
                {userEmail.trim() ? userEmail : '—'}
              </Text>
            </View>
            <View style={styles.profileViewDivider} />
            <View style={[styles.profileViewRow, styles.profileViewRowTop]}>
              <Text style={styles.profileViewLabel}>Phone</Text>
              <Text style={[styles.profileViewValue, styles.profileViewValueMultiline]} numberOfLines={3}>
                {userPhoneE164 ? formatE164International(userPhoneE164) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.profilePaymentSectionHeader}>
            <Text style={[styles.profileViewSectionTitle, styles.profileViewSectionTitleFlex]}>Payment methods</Text>
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
              <Ionicons name="add" size={20} color="#171717" />
            </Pressable>
          </View>
          <View style={styles.profileViewCard}>
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
                    <Text style={styles.profilePaymentLabel}>{card.label}</Text>
                    <Text style={styles.profilePaymentSub}>•••• {card.last4}</Text>
                  </View>
                  {defaultCard === card.id && (
                    <View style={styles.profilePaymentDefaultBadge}>
                      <Text style={styles.profilePaymentDefaultText}>Default</Text>
                    </View>
                  )}
                  <Ionicons
                    name={defaultCard === card.id ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={defaultCard === card.id ? '#ffd54a' : '#cccccc'}
                  />
                </Pressable>
                {i < cards.length - 1 ? <View style={styles.profileViewDivider} /> : null}
              </View>
            ))}
          </View>

          <Pressable style={styles.resetPasswordButton} onPress={onResetPassword}>
            <Text style={styles.resetPasswordButtonText}>Reset password</Text>
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
      <View style={styles.editProfileRoot}>
        <StatusBar style="dark" />
        <View style={styles.editProfileHeader}>
          <Pressable style={styles.editProfileHeaderSide} onPress={() => setScreen('profile')} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#171717" />
          </Pressable>
          <Text style={styles.editProfileHeaderTitle}>Edit Profile</Text>
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
            <View style={styles.editProfileAvatarImage}>
              <Ionicons name="person" size={56} color="#8a8a8a" />
            </View>
            <Pressable style={styles.editProfileAvatarCamera} hitSlop={6}>
              <Ionicons name="camera" size={18} color="#171717" />
            </Pressable>
          </View>

          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>First name</Text>
            <TextInput
              style={styles.editProfileInput}
              value={editingFirstName}
              onChangeText={setEditingFirstName}
              placeholder="Charlotte"
              placeholderTextColor="#b0b0b0"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>Last name</Text>
            <TextInput
              style={styles.editProfileInput}
              value={editingLastName}
              onChangeText={setEditingLastName}
              placeholder="King"
              placeholderTextColor="#b0b0b0"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>E mail address</Text>
            <TextInput
              style={styles.editProfileInput}
              value={editingEmail}
              onChangeText={setEditingEmail}
              placeholder="johnkinggraphics@gmail.com"
              placeholderTextColor="#b0b0b0"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>User name</Text>
            <TextInput
              style={styles.editProfileInput}
              value={editingUsername}
              onChangeText={setEditingUsername}
              placeholder="@johnkinggraphics"
              placeholderTextColor="#b0b0b0"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>Password</Text>
            <View style={styles.editProfilePasswordRow}>
              <TextInput
                style={[styles.editProfileInput, styles.editProfilePasswordInput]}
                value={editingPassword}
                onChangeText={setEditingPassword}
                placeholder="••••••••••"
                placeholderTextColor="#b0b0b0"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable style={styles.editProfileEyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color="#171717" />
              </Pressable>
            </View>
          </View>

          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>Phone number</Text>
            <View style={styles.editProfilePhoneRow}>
              <Pressable style={styles.editProfileCountryBtn} onPress={() => setCountryPickerVisible(true)}>
                <Text style={styles.editProfileCountryText}>{countryCode}</Text>
                <Ionicons name="chevron-down" size={16} color="#171717" />
              </Pressable>
              <TextInput
                style={[styles.editProfileInput, styles.editProfilePhoneInput]}
                value={editingPhone}
                onChangeText={setEditingPhone}
                placeholder="6895312"
                placeholderTextColor="#b0b0b0"
                keyboardType="phone-pad"
              />
            </View>
            <Text style={styles.editProfileHint}>
              Valid mobile or landline for your country. Saved as E.164. Each number can only be linked once on this device.
            </Text>
          </View>
        </ScrollView>

        <Modal visible={countryPickerVisible} animationType="fade" transparent statusBarTranslucent>
          <View style={styles.editProfilePickerOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCountryPickerVisible(false)} />
            <View style={styles.editProfilePickerSheet}>
              <Text style={styles.editProfilePickerTitle}>Country code</Text>
              {countryCodes.map(({ code, label }) => (
                <Pressable
                  key={code}
                  style={styles.editProfilePickerRow}
                  onPress={() => { setCountryCode(code); setCountryPickerVisible(false); }}
                >
                  <Text style={styles.editProfilePickerCode}>{code}</Text>
                  <Text style={styles.editProfilePickerLabel}>{label}</Text>
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
  // ────────────────────────────────────────────────────────────────

  return (
    <View key={ANIMATION_TREE_KEY} style={styles.safeArea}>
      <StatusBar style="light" translucent />

      {/* Full-bleed background map — behind header */}
      <Animated.View style={[styles.mapWrapper, { height: mapHeightAnim }]}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        region={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={true}
        pitchEnabled={true}
      >
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#2f76c8"
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
        <Marker coordinate={pickupCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.mapMarkerPickup} />
        </Marker>
        <Marker coordinate={dropoffCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.mapMarkerDropoff} />
        </Marker>
        <Marker coordinate={driverCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarkerWrap}>
            <View style={styles.driverMarkerCard}>
              <Image source={carMarkerAsset} style={styles.mapCarImageLarge} resizeMode="contain" />
            </View>
          </View>
        </Marker>
      </MapView>
      </Animated.View>

      {/* Expand button over map */}
      <Pressable style={styles.mapExpandBtn} onPress={() => setMapExpanded(true)}>
        <Ionicons name="expand" size={16} color="#ffffff" />
      </Pressable>

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
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={true}
            toolbarEnabled={false}
            rotateEnabled={true}
            pitchEnabled={true}
          >
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#2f76c8"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
            <Marker coordinate={pickupCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.mapMarkerPickup} />
            </Marker>
            <Marker coordinate={dropoffCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.mapMarkerDropoff} />
            </Marker>
            <Marker coordinate={driverCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarkerWrap}>
                <View style={styles.driverMarkerCard}>
                  <Image source={carMarkerAsset} style={styles.mapCarImageLarge} resizeMode="contain" />
                </View>
              </View>
            </Marker>
          </MapView>
          <Pressable style={styles.mapCollapseBtn} onPress={() => setMapExpanded(false)}>
            <Ionicons name="contract" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </Modal>

      {/* Header — floats over map */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <View style={styles.profileBlock}>
            <Pressable style={styles.profileIconShell} onPress={openProfile}>
              <ProfileIcon />
            </Pressable>
            <View>
              <Text style={styles.greeting}>Good morning</Text>
              <Text style={styles.userName}>{displayName}</Text>
            </View>
          </View>
          <Pressable style={styles.supportButton} onPress={() => setSupportVisible(true)}>
            <SupportIcon />
          </Pressable>
        </View>
      </View>

      {/* Profile Modal — replaced by full screen, block removed */}

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

      {/* Support Modal */}
      <Modal visible={supportVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.supportModalIcon}>
              <Ionicons name="headset" size={36} color="#171717" />
            </View>
            <Text style={styles.modalTitle}>Customer Support</Text>
            <Text style={styles.supportModalSubtitle}>We're here to help 24/7. Choose how you'd like to reach us.</Text>
            <Pressable style={styles.supportOption}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#171717" />
              <Text style={styles.supportOptionText}>Live Chat</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
            <Pressable style={styles.supportOption}>
              <Ionicons name="call" size={22} color="#171717" />
              <Text style={styles.supportOptionText}>Call Us</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
            <Pressable style={styles.supportOption}>
              <Ionicons name="mail" size={22} color="#171717" />
              <Text style={styles.supportOptionText}>Email Support</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setSupportVisible(false)}>
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Bottom sheet — scrollable cards */}
      <Animated.View
        style={[styles.contentScroll, { transform: [{ translateY: Animated.add(panValue, searchSheetTranslateY) }] }]}
        {...panResponder.panHandlers}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={true}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        {/* Drag handle */}
        <View style={styles.dragHandleZone}>
          <View style={styles.dragHandle} />
        </View>

        {/* Destination Input Card */}
        <View style={styles.destinationCard}>
          <View style={[styles.whereToButton, destinationFocused ? styles.whereToButtonActive : null]}>
            <Ionicons name="search" size={18} color={destinationFocused ? '#171717' : '#999999'} />
            <TextInput
              ref={destinationInputRef}
              style={styles.whereToInput}
              value={destinationQuery}
              onChangeText={setDestinationQuery}
              onFocus={handleDestinationFocus}
              onBlur={handleDestinationBlur}
              placeholder="Where to?"
              placeholderTextColor="#aaaaaa"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="words"
            />
            <View style={styles.nowBadge}>
              <Text style={styles.nowText}>Now ▾</Text>
            </View>
          </View>

          {destinationFocused && filteredSuggestions.length > 0 ? (
            <View style={styles.suggestionList}>
              {filteredSuggestions.map((item, index) => (
                <View key={item.id}>
                  <Pressable style={styles.suggestionItem} onPress={() => selectDestination(item.title)}>
                    <View style={styles.suggestionIconWrap}>
                      <Ionicons name={item.icon} size={16} color="#171717" />
                    </View>
                    <View style={styles.suggestionTextBlock}>
                      <Text style={styles.suggestionTitle}>{item.title}</Text>
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="arrow-up-outline" size={16} color="#b2b2b2" style={styles.suggestionActionIcon} />
                  </Pressable>
                  {index < filteredSuggestions.length - 1 ? <View style={styles.suggestionDivider} /> : null}
                </View>
              ))}
            </View>
          ) : null}

          {!destinationFocused ? <View style={styles.addressList}>
            <Pressable style={styles.addressItem} onPress={() => openAddress('home')}>
              <View style={styles.addressIconHome}>
                <Ionicons name="home" size={14} color="#171717" />
              </View>
              <View style={styles.addressTextBlock}>
                <Text style={styles.addressLabel}>Home</Text>
                <Text style={styles.addressSub} numberOfLines={1}>{homeAddress || 'Add address'}</Text>
              </View>
              <Ionicons name={homeAddress ? 'pencil' : 'add-circle-outline'} size={18} color="#aaaaaa" />
            </Pressable>
            <View style={styles.addressDivider} />
            <Pressable style={styles.addressItem} onPress={() => openAddress('work')}>
              <View style={styles.addressIconWork}>
                <Ionicons name="briefcase" size={14} color="#171717" />
              </View>
              <View style={styles.addressTextBlock}>
                <Text style={styles.addressLabel}>Work</Text>
                <Text style={styles.addressSub} numberOfLines={1}>{workAddress || 'Add address'}</Text>
              </View>
              <Ionicons name={workAddress ? 'pencil' : 'add-circle-outline'} size={18} color="#aaaaaa" />
            </Pressable>
          </View> : null}
        </View>

        {/* Service Type Cards */}
        <View style={styles.serviceRow}>
          {(
            [
              { id: 'ride',       label: 'Ride',       sub: '2 min away',  icon: 'car-sport',  discount: '10%' },
              { id: 'rental',     label: 'Rental',     sub: 'By the hour', icon: 'key',        discount: '15%' },
              { id: 'outstation', label: 'Outstation', sub: 'Long trips',  icon: 'map',        discount: '25%' },
            ] as { id: string; label: string; sub: string; icon: 'car-sport' | 'key' | 'map'; discount: string }[]
          ).map(({ id, label, sub, icon, discount }) => {
            const active = selectedRide === id;
            return (
              <Pressable
                key={id}
                style={[styles.serviceCard, active && styles.serviceCardActive]}
                onPress={() => setSelectedRide(id)}
              >
                <View style={[styles.serviceIconRing, active && styles.serviceIconRingActive]}>
                  <Ionicons name={icon} size={26} color={active ? '#171717' : '#666666'} />
                </View>
                <View style={[styles.serviceDiscountPill, active && styles.serviceDiscountPillActive]}>
                  <Text style={[styles.serviceDiscountText, active && styles.serviceDiscountTextActive]}>{discount} OFF</Text>
                </View>
                <Text style={[styles.serviceTitle, active && styles.serviceTitleActive]}>{label}</Text>
                <Text style={[styles.serviceSubLabel, active && styles.serviceSubLabelActive]}>{sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Promotional Card */}
        <View style={styles.promoCard}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Invest today. Secure a{'\n'}healthy tomorrow &{'\n'}every day.</Text>
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
      </ScrollView>
      </Animated.View>

      {/* Bottom Navigation Tab Bar */}
      <BlurView intensity={80} tint="light" style={styles.tabBar}>
        <Pressable style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={24} color={activeTab === 'home' ? '#1a1a1a' : '#aaaaaa'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('activity')}>
          <Ionicons name={activeTab === 'activity' ? 'time' : 'time-outline'} size={24} color={activeTab === 'activity' ? '#1a1a1a' : '#aaaaaa'} />
          <Text style={[styles.tabLabel, activeTab === 'activity' && styles.tabLabelActive]}>Activity</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('notifications')}>
          <Ionicons name={activeTab === 'notifications' ? 'heart' : 'heart-outline'} size={24} color={activeTab === 'notifications' ? '#1a1a1a' : '#aaaaaa'} />
          <Text style={[styles.tabLabel, activeTab === 'notifications' && styles.tabLabelActive]}>Favourites</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <Ionicons name={activeTab === 'settings' ? 'settings' : 'settings-outline'} size={24} color={activeTab === 'settings' ? '#1a1a1a' : '#aaaaaa'} />
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
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
    bottom: 0,
    backgroundColor: '#ffffff',
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
    paddingTop: 56,
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
  profileIconShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffd54a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '600',
  },
  userName: {
    color: '#171717',
    fontSize: 22,
    fontWeight: '800',
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
  driverMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerCard: {
    width: 74,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  mapCarImageLarge: {
    width: 58,
    height: 34,
  },
  mapCarImageSmall: {
    width: 48,
    height: 28,
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
    top: MAP_HEIGHT - 68,
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
  whereToButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f2f2f2',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  whereToButtonActive: {
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
  nowBadge: {
    backgroundColor: '#171717',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  nowText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionList: {
    backgroundColor: '#ffffff',
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
  serviceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#ececec',
    minHeight: 148,
    justifyContent: 'center',
  },
  serviceCardActive: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  serviceIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f3f5f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  serviceIconRingActive: {
    backgroundColor: '#ffd54a',
  },
  serviceDiscountPill: {
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  serviceDiscountPillActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  serviceDiscountText: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
  },
  serviceDiscountTextActive: {
    color: '#ffd54a',
  },
  serviceTitle: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '800',
  },
  serviceTitleActive: {
    color: '#ffffff',
  },
  serviceSubLabel: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  serviceSubLabelActive: {
    color: 'rgba(255,255,255,0.6)',
  },
  // Promotional Card
  promoCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  promoContent: {
    flex: 1,
    gap: 12,
    justifyContent: 'space-between',
  },
  promoTitle: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  promoButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  promoButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  promoIllustration: {
    width: 80,
    height: 80,
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  promoBox1: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    width: 24,
    height: 32,
    backgroundColor: '#4a90e2',
    borderRadius: 4,
  },
  promoBox2: {
    position: 'absolute',
    bottom: 0,
    left: 38,
    width: 24,
    height: 48,
    backgroundColor: '#5da3f0',
    borderRadius: 4,
  },
  promoBox3: {
    position: 'absolute',
    bottom: 0,
    right: 10,
    width: 24,
    height: 64,
    backgroundColor: '#70b6ff',
    borderRadius: 4,
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

