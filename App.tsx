import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as THREE from 'three';

import { authEnabled, firebaseApp, firebaseReady, missingFirebaseConfig } from './src/lib/firebase';

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

const pickupCoordinate = { latitude: 40.7582, longitude: -73.9856 };
const dropoffCoordinate = { latitude: 40.7484, longitude: -73.9857 };
const driverCoordinate = { latitude: 40.7548, longitude: -73.9912 };
const routeCoordinates = [
  driverCoordinate,
  { latitude: 40.7563, longitude: -73.9892 },
  { latitude: 40.7542, longitude: -73.9868 },
  pickupCoordinate,
  { latitude: 40.7524, longitude: -73.9859 },
  dropoffCoordinate,
];

const carMarkerAsset = require('./assets/car-marker.png');

// Car icon component - Clean simple style
function CarIcon({ type, isSelected }: { type: string; isSelected: boolean }) {
  const bodyColor = isSelected ? '#d0d0d0' : '#b0b0b0';
  const roofColor = isSelected ? '#ffffff' : '#3a3a3a';
  const wheelColor = isSelected ? '#ffffff' : '#000000';

  if (type === 'sedan') {
    return (
      <View style={styles.carIconContainer}>
        {/* Roof/Cabin */}
        <View style={[styles.simpleCarRoof, { 
          backgroundColor: roofColor,
          width: 30,
          height: 14,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        }]} />
        {/* Body */}
        <View style={[styles.simpleCarBody, { 
          backgroundColor: bodyColor,
          width: 48,
          height: 12,
          borderRadius: 6,
          marginTop: -2,
        }]} />
        {/* Wheels */}
        <View style={styles.simpleCarWheels}>
          <View style={[styles.simpleCarWheel, { backgroundColor: wheelColor, left: 6 }]} />
          <View style={[styles.simpleCarWheel, { backgroundColor: wheelColor, right: 6 }]} />
        </View>
      </View>
    );
  }

  if (type === 'suv') {
    return (
      <View style={styles.carIconContainer}>
        <View style={[styles.simpleCarRoof, { 
          backgroundColor: roofColor,
          width: 34,
          height: 18,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
        }]} />
        <View style={[styles.simpleCarBody, { 
          backgroundColor: bodyColor,
          width: 50,
          height: 14,
          borderRadius: 7,
          marginTop: -2,
        }]} />
        <View style={styles.simpleCarWheels}>
          <View style={[styles.simpleCarWheel, { backgroundColor: wheelColor, left: 5, width: 12, height: 12 }]} />
          <View style={[styles.simpleCarWheel, { backgroundColor: wheelColor, right: 5, width: 12, height: 12 }]} />
        </View>
      </View>
    );
  }

  if (type === 'van') {
    return (
      <View style={styles.carIconContainer}>
        <View style={[styles.simpleCarRoof, { 
          backgroundColor: roofColor,
          width: 38,
          height: 22,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        }]} />
        <View style={[styles.simpleCarBody, { 
          backgroundColor: bodyColor,
          width: 52,
          height: 12,
          borderRadius: 6,
          marginTop: -2,
        }]} />
        <View style={styles.simpleCarWheels}>
          <View style={[styles.simpleCarWheel, { backgroundColor: wheelColor, left: 5, width: 12, height: 12 }]} />
          <View style={[styles.simpleCarWheel, { backgroundColor: wheelColor, right: 5, width: 12, height: 12 }]} />
        </View>
      </View>
    );
  }

  return null;
}

function MapCarIcon() {
  return (
    <View style={styles.mapCarIconShell}>
      <View style={styles.mapCarTopDeck}>
        <View style={styles.mapCarWindowRear} />
        <View style={styles.mapCarWindowFront} />
      </View>
      <View style={styles.mapCarBodyRealistic}>
        <View style={styles.mapCarLightRear} />
        <View style={styles.mapCarDoorLine} />
        <View style={styles.mapCarLightFront} />
      </View>
      <View style={styles.mapCarWheelRow}>
        <View style={styles.mapCarWheelRealistic} />
        <View style={styles.mapCarWheelRealistic} />
      </View>
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

// Tab bar icons - Clean standard designs
function HomeIcon({ active }: { active: boolean }) {
  const color = active ? '#ffffff' : '#999999';
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.houseBase, { backgroundColor: color }]} />
      <View style={[styles.houseRoof, { borderBottomColor: color }]} />
      <View style={styles.houseDoor} />
    </View>
  );
}

function BellIcon({ active }: { active: boolean }) {
  const color = active ? '#ffffff' : '#999999';
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.bellBody, { borderColor: color }]} />
      <View style={[styles.bellTop, { backgroundColor: color }]} />
      <View style={[styles.bellBottom, { backgroundColor: color }]} />
    </View>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const color = active ? '#ffffff' : '#999999';
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.wrenchHandle, { backgroundColor: color }]} />
      <View style={[styles.wrenchHead, { borderColor: color }]} />
    </View>
  );
}

function ActivityIcon({ active }: { active: boolean }) {
  const color = active ? '#ffffff' : '#999999';
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.listLine1, { backgroundColor: color }]} />
      <View style={[styles.listLine2, { backgroundColor: color }]} />
      <View style={[styles.listLine3, { backgroundColor: color }]} />
    </View>
  );
}

function VehiclePreview3D() {
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <GLView
      style={styles.vehiclePreviewCanvas}
      onContextCreate={(gl) => {
        const renderer = new Renderer({ gl }) as unknown as {
          setSize: (width: number, height: number) => void;
          render: (scene: THREE.Scene, camera: THREE.Camera) => void;
        };
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#f3f7fb');

        const camera = new THREE.PerspectiveCamera(
          50,
          gl.drawingBufferWidth / gl.drawingBufferHeight,
          0.1,
          1000,
        );
        camera.position.set(0, 1.8, 6);
        camera.lookAt(0, 0.8, 0);

        scene.add(new THREE.AmbientLight(0xffffff, 1.25));

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
        directionalLight.position.set(5, 7, 6);
        scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xb8d9ff, 0.6);
        fillLight.position.set(-4, 3, -2);
        scene.add(fillLight);

        const carGroup = new THREE.Group();

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.9, 1.8),
          new THREE.MeshStandardMaterial({ color: '#f4f7fa', metalness: 0.15, roughness: 0.42 }),
        );
        body.position.y = 0.75;
        carGroup.add(body);

        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(1.9, 0.8, 1.35),
          new THREE.MeshStandardMaterial({ color: '#20252b', metalness: 0.2, roughness: 0.35 }),
        );
        cabin.position.set(0.15, 1.35, 0);
        carGroup.add(cabin);

        const windshield = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.42, 1.18),
          new THREE.MeshStandardMaterial({ color: '#bfe1fb', metalness: 0.1, roughness: 0.08 }),
        );
        windshield.position.set(0.62, 1.36, 0);
        carGroup.add(windshield);

        const rearWindow = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.42, 1.18),
          new THREE.MeshStandardMaterial({ color: '#9cccf0', metalness: 0.1, roughness: 0.08 }),
        );
        rearWindow.position.set(-0.42, 1.36, 0);
        carGroup.add(rearWindow);

        const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#1c1f23', roughness: 0.9 });
        const rimMaterial = new THREE.MeshStandardMaterial({ color: '#5b646d', metalness: 0.45, roughness: 0.3 });
        const wheelPositions = [
          [-1.15, 0.25, 0.98],
          [1.15, 0.25, 0.98],
          [-1.15, 0.25, -0.98],
          [1.15, 0.25, -0.98],
        ];

        wheelPositions.forEach(([x, y, z]) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.42, 24), wheelMaterial);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, y, z);
          carGroup.add(wheel);

          const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.44, 18), rimMaterial);
          rim.rotation.z = Math.PI / 2;
          rim.position.set(x, y, z);
          carGroup.add(rim);
        });

        const headlight = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.16, 1.05),
          new THREE.MeshStandardMaterial({ color: '#9fd7ff', emissive: '#6cbfff', emissiveIntensity: 0.35 }),
        );
        headlight.position.set(1.82, 0.82, 0);
        carGroup.add(headlight);

        const taillight = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.16, 1.05),
          new THREE.MeshStandardMaterial({ color: '#ff7266', emissive: '#ff4f40', emissiveIntensity: 0.25 }),
        );
        taillight.position.set(-1.82, 0.82, 0);
        carGroup.add(taillight);

        carGroup.rotation.y = -0.45;
        carGroup.rotation.x = -0.08;
        scene.add(carGroup);

        const floor = new THREE.Mesh(
          new THREE.CircleGeometry(3.1, 48),
          new THREE.MeshStandardMaterial({ color: '#e5edf4', roughness: 1 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.02;
        scene.add(floor);

        const render = () => {
          animationFrameRef.current = requestAnimationFrame(render);
          carGroup.rotation.y += 0.01;
          renderer.render(scene, camera);
          gl.endFrameEXP();
        };

        render();
      }}
    />
  );
}

export default function App() {
  const [selectedRide, setSelectedRide] = useState('ride');
  const [activeTab, setActiveTab] = useState('home');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* Fixed Header */}
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
            <Text style={styles.supportIcon}>?</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map Section */}
        <View style={styles.mapCard}>
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: 40.7538,
              longitude: -73.9878,
              latitudeDelta: 0.018,
              longitudeDelta: 0.018,
            }}
            showsCompass={false}
            showsMyLocationButton={false}
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

          <View style={styles.mapTopShade} />
          <View style={styles.mapMiniCarLeft}>
            <Image source={carMarkerAsset} style={styles.mapCarImageSmall} resizeMode="contain" />
          </View>
          <View style={styles.mapMiniCarRight}>
            <Image source={carMarkerAsset} style={styles.mapCarImageSmall} resizeMode="contain" />
          </View>
          <View style={styles.mapCarMarker}>
            <View style={styles.mapCarMarkerShadow} />
            <View style={styles.mapCarMarkerBubble}>
              <Image source={carMarkerAsset} style={styles.mapCarImageLarge} resizeMode="contain" />
            </View>
          </View>
        </View>

        <View style={styles.vehiclePreviewCard}>
          <View style={styles.vehiclePreviewCopy}>
            <Text style={styles.vehiclePreviewLabel}>3D vehicle preview</Text>
            <Text style={styles.vehiclePreviewTitle}>Experimental render stack installed</Text>
            <Text style={styles.vehiclePreviewBody}>This uses `expo-gl`, `three`, and `expo-three` so you can swap in a better car model later.</Text>
          </View>
          <VehiclePreview3D />
        </View>

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
          <Pressable style={[styles.serviceCard, selectedRide === 'ride' && styles.serviceCardActive]} onPress={() => setSelectedRide('ride')}>
            <View style={styles.serviceIconContainer}>
              <CarIcon type="sedan" isSelected={selectedRide === 'ride'} />
              <View style={styles.discountBadge}><Text style={styles.discountText}>10%{'\n'}OFF</Text></View>
            </View>
            <Text style={[styles.serviceTitle, selectedRide === 'ride' && styles.serviceTitleActive]}>Ride</Text>
          </Pressable>

          <Pressable style={styles.serviceCard} onPress={() => setSelectedRide('rental')}>
            <View style={styles.serviceIconContainer}>
              <CarIcon type="suv" isSelected={false} />
              <View style={styles.discountBadge}><Text style={styles.discountText}>15%{'\n'}OFF</Text></View>
            </View>
            <Text style={styles.serviceTitle}>Rental</Text>
            <Text style={styles.serviceSubtitle}>15% OFF</Text>
          </Pressable>

          <Pressable style={styles.serviceCard} onPress={() => setSelectedRide('outstation')}>
            <View style={styles.serviceIconContainer}>
              <CarIcon type="van" isSelected={false} />
              <View style={styles.discountBadge}><Text style={styles.discountText}>25%{'\n'}OFF</Text></View>
            </View>
            <Text style={styles.serviceTitle}>Outstation</Text>
            <Text style={styles.serviceSubtitle}>25% OFF</Text>
          </Pressable>
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

      {/* Bottom Navigation Tab Bar with Notch */}
      <View style={styles.tabBar}>
        <Pressable style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <HomeIcon active={activeTab === 'home'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('activity')}>
          <ActivityIcon active={activeTab === 'activity'} />
          <Text style={[styles.tabLabel, activeTab === 'activity' && styles.tabLabelActive]}>Activity</Text>
        </Pressable>

        {/* Empty space for floating button */}
        <View style={styles.tabItemCenter} />

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('notifications')}>
          <BellIcon active={activeTab === 'notifications'} />
          <Text style={[styles.tabLabel, activeTab === 'notifications' && styles.tabLabelActive]}>Alerts</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <SettingsIcon active={activeTab === 'settings'} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    zIndex: 5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 130,
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
  supportIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
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
  vehiclePreviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  vehiclePreviewCopy: {
    flex: 1,
    gap: 6,
  },
  vehiclePreviewLabel: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  vehiclePreviewTitle: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '800',
  },
  vehiclePreviewBody: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 18,
  },
  vehiclePreviewCanvas: {
    width: 132,
    height: 104,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f3f7fb',
  },
  mapCarIconShell: {
    width: 54,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  mapCarTopDeck: {
    width: 28,
    height: 12,
    marginBottom: -2,
    backgroundColor: '#20252b',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 2,
  },
  mapCarWindowRear: {
    width: 8,
    height: 5,
    borderRadius: 2,
    backgroundColor: '#b8d7f1',
  },
  mapCarWindowFront: {
    width: 9,
    height: 5,
    borderRadius: 2,
    backgroundColor: '#d8eefc',
  },
  mapCarBodyRealistic: {
    width: 42,
    height: 14,
    borderRadius: 10,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 8,
    backgroundColor: '#f3f6f9',
    borderWidth: 1,
    borderColor: '#ced8e2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  mapCarDoorLine: {
    width: 1,
    height: 8,
    backgroundColor: '#c9d1da',
  },
  mapCarLightRear: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ff6f61',
  },
  mapCarLightFront: {
    width: 5,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9fd7ff',
  },
  mapCarWheelRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: -1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapCarWheelRealistic: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1c1f23',
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
    gap: 12,
    marginBottom: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#ececec',
    minHeight: 140,
    justifyContent: 'center',
  },
  serviceCardActive: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  serviceIconContainer: {
    position: 'relative',
    width: 60,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffd54a',
    borderRadius: 12,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountText: {
    color: '#171717',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 11,
  },
  serviceTitle: {
    color: '#171717',
    fontSize: 15,
    fontWeight: '800',
  },
  serviceTitleActive: {
    color: '#ffffff',
  },
  serviceSubtitle: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
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
  // Car Icon Styles
  carIconContainer: {
    width: 60,
    height: 48,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleCarRoof: {
    alignItems: 'center',
  },
  simpleCarBody: {
    alignItems: 'center',
  },
  simpleCarWheels: {
    position: 'absolute',
    bottom: -4,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  simpleCarWheel: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
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
  // Tab Icon Styles - Standard designs
  tabIconContainer: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Home Icon - House
  houseBase: {
    width: 18,
    height: 11,
    position: 'absolute',
    bottom: 4,
  },
  houseRoof: {
    position: 'absolute',
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  houseDoor: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 7,
    backgroundColor: '#171717',
  },
  // Bell Icon - Notification
  bellBody: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'absolute',
    top: 3,
  },
  bellTop: {
    width: 3,
    height: 3,
    borderRadius: 2,
    position: 'absolute',
    top: 1,
  },
  bellBottom: {
    width: 8,
    height: 3,
    borderRadius: 2,
    position: 'absolute',
    bottom: 2,
  },
  // Settings Icon - Wrench
  wrenchHandle: {
    width: 3,
    height: 14,
    borderRadius: 2,
    position: 'absolute',
    bottom: 2,
    transform: [{ rotate: '-45deg' }],
  },
  wrenchHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    position: 'absolute',
    top: 2,
    right: 2,
  },
  // Activity Icon - List
  listLine1: {
    width: 18,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    top: 5,
  },
  listLine2: {
    width: 18,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    top: 11,
  },
  listLine3: {
    width: 18,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    top: 17,
  },
});
