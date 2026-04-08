import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Dimensions, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { authEnabled, firebaseApp, firebaseReady, missingFirebaseConfig } from './src/lib/firebase';

const carMarkerAsset = require('./assets/car-marker.png');

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


// Customer support icon — person silhouette with headset
function SupportIcon() {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {/* Head */}
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginBottom: 1 }} />
      {/* Body */}
      <View style={{ width: 16, height: 9, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#fff' }} />
      {/* Headset arc */}
      <View style={{
        position: 'absolute', top: 0, left: 1, right: 1, height: 10,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        borderTopWidth: 2.5, borderLeftWidth: 2.5, borderRightWidth: 2.5,
        borderColor: '#fff', borderBottomWidth: 0,
      }} />
      {/* Left ear cup */}
      <View style={{ position: 'absolute', top: 6, left: 0, width: 4, height: 5, borderRadius: 2, backgroundColor: '#fff' }} />
      {/* Right ear cup */}
      <View style={{ position: 'absolute', top: 6, right: 0, width: 4, height: 5, borderRadius: 2, backgroundColor: '#fff' }} />
      {/* Mic boom */}
      <View style={{ position: 'absolute', top: 12, right: 1, width: 1.5, height: 5, borderRadius: 1, backgroundColor: '#fff', transform: [{ rotate: '20deg' }] }} />
      <View style={{ position: 'absolute', top: 16, right: 0, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#fff' }} />
    </View>
  );
}

// Profile Icon component
function ProfileIcon() {
  return (
    <View style={styles.profileIcon}>
      <View style={styles.profileHead} />
      <View style={styles.profileBody} />
    </View>
  );
}

// Tab icons use Ionicons (from @expo/vector-icons)

export default function App() {
  const [selectedRide, setSelectedRide] = useState('ride');
  const [activeTab, setActiveTab] = useState('home');
  const [screen, setScreen] = useState<'home' | 'profile'>('home');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Profile
  const [userName, setUserName] = useState('Sarah');
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [activeField, setActiveField] = useState<'name'|'phone'|'email'|null>(null);

  // Payments
  const [cards] = useState([
    { id: '1', type: 'visa',       last4: '4242', label: 'Personal Visa' },
    { id: '2', type: 'mastercard', last4: '8888', label: 'Work Mastercard' },
  ]);
  const [defaultCard, setDefaultCard] = useState('1');
  const [applePayEnabled, setApplePayEnabled] = useState(false);
  const [cashEnabled, setCashEnabled] = useState(true);

  // Addresses
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [addressModal, setAddressModal] = useState<'home' | 'work' | null>(null);
  const [addressInput, setAddressInput] = useState('');

  // Support modal
  const [supportVisible, setSupportVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedName, savedHome, savedWork, savedPhone, savedEmail] = await Promise.all([
        AsyncStorage.getItem('profile_name'),
        AsyncStorage.getItem('address_home'),
        AsyncStorage.getItem('address_work'),
        AsyncStorage.getItem('profile_phone'),
        AsyncStorage.getItem('profile_email'),
      ]);
      if (savedName) setUserName(savedName);
      if (savedHome) setHomeAddress(savedHome);
      if (savedWork) setWorkAddress(savedWork);
      if (savedPhone) setUserPhone(savedPhone);
      if (savedEmail) setUserEmail(savedEmail);

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

  const saveProfile = async () => {
    const name = editingName.trim();
    const phone = editingPhone.trim();
    const email = editingEmail.trim();
    if (name) { setUserName(name); await AsyncStorage.setItem('profile_name', name); }
    if (phone !== userPhone) { setUserPhone(phone); await AsyncStorage.setItem('profile_phone', phone); }
    if (email !== userEmail) { setUserEmail(email); await AsyncStorage.setItem('profile_email', email); }
    setActiveField(null);
    setScreen('home');
  };

  const profileDirty =
    editingName.trim() !== userName ||
    editingPhone.trim() !== userPhone ||
    editingEmail.trim() !== userEmail;

  const openProfile = () => {
    setEditingName(userName);
    setEditingPhone(userPhone);
    setEditingEmail(userEmail);
    setScreen('profile');
  };

  const openAddress = (type: 'home' | 'work') => {
    setAddressInput(type === 'home' ? homeAddress : workAddress);
    setAddressModal(type);
  };

  const mapCenter = userLocation ?? JAMAICA_KINGSTON;
  const { pickup: pickupCoordinate, dropoff: dropoffCoordinate, driver: driverCoordinate, route: routeCoordinates } = buildCoords(mapCenter);

  // ── Profile Screen ──────────────────────────────────────────────
  if (screen === 'profile') {
    return (
      <View style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.profileScreenHeader}>
          <Pressable style={styles.profileScreenBack} onPress={() => setScreen('home')}>
            <Ionicons name="arrow-back" size={22} color="#171717" />
          </Pressable>
          <Text style={styles.profileScreenTitle}>My Profile</Text>
          {profileDirty ? (
            <Pressable style={styles.profileHeaderSaveBtn} onPress={saveProfile}>
              <Text style={styles.profileHeaderSaveBtnText}>Save</Text>
            </Pressable>
          ) : (
            <View style={{ width: 58 }} />
          )}
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }} contentContainerStyle={styles.profileScreenContent} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.profileAvatarWrap}>
            <View style={styles.profileAvatarLarge}>
              <ProfileIcon />
            </View>
            <Pressable style={styles.profileAvatarEdit}>
              <Ionicons name="camera" size={16} color="#171717" />
            </Pressable>
          </View>

          {/* Personal Info */}
          <View style={styles.profileFieldGroup}>
            <Text style={styles.profileFieldGroupLabel}>Personal Info</Text>

            {/* Name */}
            <View style={styles.profileFieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileFieldLabel}>Full Name</Text>
                <TextInput
                  style={[styles.profileFieldInput, activeField === 'name' && styles.profileFieldInputActive]}
                  value={editingName}
                  onChangeText={setEditingName}
                  onFocus={() => setActiveField('name')}
                  placeholder="Your full name"
                  placeholderTextColor="#aaa"
                  autoCapitalize="words"
                  editable={activeField === 'name'}
                />
              </View>
              <Pressable onPress={() => setActiveField(activeField === 'name' ? null : 'name')} style={styles.profileFieldIcon}>
                <Ionicons
                  name={activeField === 'name' ? 'checkmark-circle' : 'pencil'}
                  size={20}
                  color={activeField === 'name' ? '#ffd54a' : '#cccccc'}
                />
              </Pressable>
            </View>
            <View style={styles.profileFieldDivider} />

            {/* Phone */}
            <View style={styles.profileFieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileFieldLabel}>Phone</Text>
                <TextInput
                  style={[styles.profileFieldInput, activeField === 'phone' && styles.profileFieldInputActive]}
                  value={editingPhone}
                  onChangeText={setEditingPhone}
                  onFocus={() => setActiveField('phone')}
                  placeholder="+1 876 000 0000"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  editable={activeField === 'phone'}
                />
              </View>
              <Pressable onPress={() => setActiveField(activeField === 'phone' ? null : 'phone')} style={styles.profileFieldIcon}>
                <Ionicons
                  name={activeField === 'phone' ? 'checkmark-circle' : 'pencil'}
                  size={20}
                  color={activeField === 'phone' ? '#ffd54a' : '#cccccc'}
                />
              </Pressable>
            </View>
            <View style={styles.profileFieldDivider} />

            {/* Email */}
            <View style={styles.profileFieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileFieldLabel}>Email</Text>
                <TextInput
                  style={[styles.profileFieldInput, activeField === 'email' && styles.profileFieldInputActive]}
                  value={editingEmail}
                  onChangeText={setEditingEmail}
                  onFocus={() => setActiveField('email')}
                  placeholder="you@example.com"
                  placeholderTextColor="#aaa"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={activeField === 'email'}
                />
              </View>
              <Pressable onPress={() => setActiveField(activeField === 'email' ? null : 'email')} style={styles.profileFieldIcon}>
                <Ionicons
                  name={activeField === 'email' ? 'checkmark-circle' : 'pencil'}
                  size={20}
                  color={activeField === 'email' ? '#ffd54a' : '#cccccc'}
                />
              </Pressable>
            </View>
          </View>

          {/* Saved Places */}
          <View style={styles.profileFieldGroup}>
            <Text style={styles.profileFieldGroupLabel}>Saved Places</Text>
            <Pressable style={styles.profilePlaceRow} onPress={() => openAddress('home')}>
              <View style={styles.addressIconHome}>
                <Ionicons name="home" size={15} color="#171717" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profilePlaceLabel}>Home</Text>
                <Text style={styles.profilePlaceSub} numberOfLines={1}>{homeAddress || 'Tap to add'}</Text>
              </View>
              <Ionicons name={homeAddress ? 'pencil' : 'add-circle-outline'} size={20} color="#aaa" />
            </Pressable>
            <View style={styles.profileFieldDivider} />
            <Pressable style={styles.profilePlaceRow} onPress={() => openAddress('work')}>
              <View style={styles.addressIconWork}>
                <Ionicons name="briefcase" size={15} color="#171717" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profilePlaceLabel}>Work</Text>
                <Text style={styles.profilePlaceSub} numberOfLines={1}>{workAddress || 'Tap to add'}</Text>
              </View>
              <Ionicons name={workAddress ? 'pencil' : 'add-circle-outline'} size={20} color="#aaa" />
            </Pressable>
          </View>

          {/* Payments */}
          <View style={styles.profileFieldGroup}>
            <Text style={styles.profileFieldGroupLabel}>Payment Methods</Text>

            {cards.map((card, i) => (
              <View key={card.id}>
                <Pressable style={styles.paymentRow} onPress={() => setDefaultCard(card.id)}>
                  <View style={[styles.paymentCardIcon, card.type === 'visa' ? styles.paymentCardIconVisa : styles.paymentCardIconMC]}>
                    <Text style={styles.paymentCardIconText}>{card.type === 'visa' ? 'VISA' : 'MC'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentRowLabel}>{card.label}</Text>
                    <Text style={styles.paymentRowSub}>•••• {card.last4}</Text>
                  </View>
                  {defaultCard === card.id && (
                    <View style={styles.paymentDefaultBadge}>
                      <Text style={styles.paymentDefaultText}>Default</Text>
                    </View>
                  )}
                  <Ionicons
                    name={defaultCard === card.id ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={defaultCard === card.id ? '#ffd54a' : '#cccccc'}
                  />
                </Pressable>
                {i < cards.length - 1 && <View style={styles.profileFieldDivider} />}
              </View>
            ))}

            <View style={styles.profileFieldDivider} />

            {/* Wallets */}
            <Pressable style={styles.paymentRow} onPress={() => setApplePayEnabled(v => !v)}>
              <View style={[styles.paymentCardIcon, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-apple" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentRowLabel}>Apple Pay</Text>
                <Text style={styles.paymentRowSub}>{applePayEnabled ? 'Enabled' : 'Not linked'}</Text>
              </View>
              <View style={[styles.paymentToggle, applePayEnabled && styles.paymentToggleOn]}>
                <View style={[styles.paymentToggleThumb, applePayEnabled && styles.paymentToggleThumbOn]} />
              </View>
            </Pressable>

            <View style={styles.profileFieldDivider} />

            <Pressable style={styles.paymentRow} onPress={() => setCashEnabled(v => !v)}>
              <View style={[styles.paymentCardIcon, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="cash" size={16} color="#2e7d32" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentRowLabel}>Cash</Text>
                <Text style={styles.paymentRowSub}>{cashEnabled ? 'Accepted' : 'Disabled'}</Text>
              </View>
              <View style={[styles.paymentToggle, cashEnabled && styles.paymentToggleOn]}>
                <View style={[styles.paymentToggleThumb, cashEnabled && styles.paymentToggleThumbOn]} />
              </View>
            </Pressable>

            <View style={styles.profileFieldDivider} />

            <Pressable style={styles.paymentAddRow}>
              <View style={styles.paymentAddIcon}>
                <Ionicons name="add" size={20} color="#171717" />
              </View>
              <Text style={styles.paymentAddText}>Add Payment Method</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
          </View>

        </ScrollView>

        {/* Address modal */}
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
    <View style={styles.safeArea}>
      <StatusBar style="light" translucent />

      {/* Full-bleed background map — behind header */}
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.fullBleedMap}
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
              <Text style={styles.userName}>{userName}</Text>
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
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Destination Input Card */}
        <View style={styles.destinationCard}>
          <Pressable style={styles.whereToButton}>
            <Ionicons name="search" size={18} color="#999999" />
            <Text style={styles.whereToText}>Where to?</Text>
            <View style={styles.nowBadge}>
              <Text style={styles.nowText}>Now ▾</Text>
            </View>
          </Pressable>

          <View style={styles.addressList}>
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
          </View>
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

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={24} color={activeTab === 'home' ? '#ffffff' : '#999999'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('activity')}>
          <Ionicons name={activeTab === 'activity' ? 'time' : 'time-outline'} size={24} color={activeTab === 'activity' ? '#ffffff' : '#999999'} />
          <Text style={[styles.tabLabel, activeTab === 'activity' && styles.tabLabelActive]}>Activity</Text>
        </Pressable>

        <View style={styles.tabItemCenter} />

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('notifications')}>
          <Ionicons name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'} size={24} color={activeTab === 'notifications' ? '#ffffff' : '#999999'} />
          <Text style={[styles.tabLabel, activeTab === 'notifications' && styles.tabLabelActive]}>Alerts</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <Ionicons name={activeTab === 'settings' ? 'settings' : 'settings-outline'} size={24} color={activeTab === 'settings' ? '#ffffff' : '#999999'} />
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
        </Pressable>
      </View>

      {/* FAB halo — white circle behind the floating button */}
      <View style={styles.fabHalo} />

      {/* Floating Plus Button */}
      <Pressable
        style={styles.floatingButton}
        onPress={() => console.log('Book new ride')}
      >
        <View style={styles.plusButton}>
          <View style={styles.plusHorizontal} />
          <View style={styles.plusVertical} />
        </View>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  fullBleedMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MAP_HEIGHT,
    zIndex: 0,
  },
  contentScroll: {
    position: 'absolute',
    top: MAP_HEIGHT - 30,
    left: 0,
    right: 0,
    bottom: 70,
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
    paddingTop: 20,
    paddingBottom: 100,
    gap: 18,
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
  profileIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#171717',
    marginBottom: 2,
  },
  profileBody: {
    width: 18,
    height: 10,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: '#171717',
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
  // Profile Screen
  profileScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileScreenBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileScreenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171717',
  },
  profileScreenContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 60,
  },
  profileAvatarWrap: {
    alignItems: 'center',
    marginVertical: 12,
    position: 'relative',
  },
  profileAvatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ffd54a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: '30%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileFieldGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileFieldGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaaaaa',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  profileField: {
    gap: 4,
    paddingVertical: 4,
  },
  profileFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaaaaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileFieldInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
    paddingVertical: 8,
  },
  profileFieldDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  profilePlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  profilePlaceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171717',
  },
  profilePlaceSub: {
    fontSize: 12,
    color: '#aaaaaa',
    marginTop: 2,
  },
  profileSaveBtn: {
    backgroundColor: '#171717',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  profileSaveBtnText: {
    color: '#ffd54a',
    fontSize: 16,
    fontWeight: '800',
  },
  profileHeaderSaveBtn: {
    backgroundColor: '#ffd54a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  profileHeaderSaveBtnText: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '800',
  },
  profileFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  profileFieldIcon: {
    padding: 4,
  },
  profileFieldInputActive: {
    color: '#171717',
    borderBottomWidth: 1.5,
    borderBottomColor: '#ffd54a',
  },
  // Payments
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  paymentCardIcon: {
    width: 42,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCardIconVisa: {
    backgroundColor: '#1a1f71',
  },
  paymentCardIconMC: {
    backgroundColor: '#eb001b',
  },
  paymentCardIconText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  paymentRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#171717',
  },
  paymentRowSub: {
    fontSize: 12,
    color: '#aaaaaa',
    marginTop: 1,
  },
  paymentDefaultBadge: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  paymentDefaultText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b8860b',
  },
  paymentToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  paymentToggleOn: {
    backgroundColor: '#ffd54a',
  },
  paymentToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  paymentAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  paymentAddIcon: {
    width: 42,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentAddText: {
    flex: 1,
    fontSize: 14,
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
  whereToButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f2f2f2',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  whereToText: {
    color: '#aaaaaa',
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#171717',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    zIndex: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabItemCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  fabHalo: {
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
  floatingButton: {
    position: 'absolute',
    bottom: 42,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    zIndex: 10,
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 16,
  },
  plusHorizontal: {
    position: 'absolute',
    width: 22,
    height: 3,
    backgroundColor: '#ffd54a',
    borderRadius: 2,
  },
  plusVertical: {
    position: 'absolute',
    width: 3,
    height: 22,
    backgroundColor: '#ffd54a',
    borderRadius: 2,
  },
});

