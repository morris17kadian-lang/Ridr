import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Dimensions, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

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
  const [mapExpanded, setMapExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const mapCenter = userLocation ?? JAMAICA_KINGSTON;
  const { pickup: pickupCoordinate, dropoff: dropoffCoordinate, driver: driverCoordinate, route: routeCoordinates } = buildCoords(mapCenter);

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
            <Pressable style={styles.profileIconShell}>
              <ProfileIcon />
            </Pressable>
            <View>
              <Text style={styles.greeting}>Good morning</Text>
              <Text style={styles.userName}>Sarah</Text>
            </View>
          </View>
          <Pressable style={styles.supportButton}>
            <Ionicons name="headset" size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Bottom sheet — scrollable cards */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Destination Input Card */}
        <View style={styles.destinationCard}>
          <Pressable style={styles.whereToButton}>
            <Text style={styles.whereToText}>Where to?</Text>
            <View style={styles.nowBadge}>
              <Text style={styles.nowText}>Now</Text>
            </View>
          </Pressable>

          <View style={styles.addressList}>
            <Pressable style={styles.addressItem}>
              <View style={styles.addressAddButton}>
                <View style={styles.addressPlusHorizontal} />
                <View style={styles.addressPlusVertical} />
              </View>
              <Text style={styles.addressText}>Add Home Address</Text>
            </Pressable>
            <View style={styles.addressDivider} />
            <Pressable style={styles.addressItem}>
              <View style={styles.addressAddButton}>
                <View style={styles.addressPlusHorizontal} />
                <View style={styles.addressPlusVertical} />
              </View>
              <Text style={styles.addressText}>Add Work Address</Text>
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
    backgroundColor: 'transparent',
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    top: MAP_HEIGHT - 44,
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
  // Destination Card
  destinationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    gap: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  whereToButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
  },
  whereToText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  nowBadge: {
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nowText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  addressList: {
    gap: 12,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    backgroundColor: '#ececec',
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
  floatingButton: {
    position: 'absolute',
    bottom: 25,
    left: '50%',
    marginLeft: -35,
    width: 70,
    height: 70,
    zIndex: 10,
  },
  plusButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffd54a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  plusHorizontal: {
    position: 'absolute',
    width: 24,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  plusVertical: {
    position: 'absolute',
    width: 3,
    height: 24,
    backgroundColor: '#000000',
    borderRadius: 2,
  },
});

