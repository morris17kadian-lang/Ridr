import { Ionicons } from '@expo/vector-icons';
import { Alert, Animated, Pressable, Text, View } from 'react-native';

type DriverTripStatus = 'matched' | 'arrived' | 'in_trip' | 'completed' | 'cancelled';

type DriverTrip = {
  riderName: string;
  distance: string;
  fare: string;
  paymentLabel: string;
  pickup: string;
  dropoff: string;
  status: DriverTripStatus;
  arrivedAtMs?: number;
};

type CompletedTrip = {
  id: string;
  route: string;
  fare: string;
  riderName: string;
  when: string;
};

type DriverUi = {
  soft: string;
  border: string;
  text: string;
  textMuted: string;
  card: string;
};

type ProgressStep = { key: DriverTripStatus; label: string };

type TripBarCopy = {
  title: string;
  pill: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type EarningsModal = null | 'earnings' | 'trips' | 'rating';

type DriverHomeTabContentProps = {
  styles: any;
  ui: DriverUi;
  availableCashOutAmount: number;
  currentTrip: DriverTrip | null;
  currentTripExpanded: boolean;
  tripUiTick: number;
  progressIndex: number;
  completedTrips: CompletedTrip[];
  allTripsSlideAnim: Animated.Value;
  driverProgressSteps: ProgressStep[];
  formatJmd: (amount: number) => string;
  getTripBarCopy: (trip: any, tick: number) => TripBarCopy;
  setEarningsModal: (value: EarningsModal) => void;
  setCurrentTripExpanded: (updater: (prev: boolean) => boolean) => void;
  setCurrentTrip: (updater: any) => void;
  setTripPinInput: (value: string) => void;
  setTripPinError: (value: string) => void;
  setTripPinModalVisible: (value: boolean) => void;
  setSubScreen: (value: 'allTrips') => void;
  advanceTrip: () => void;
  hapticLight: () => void;
  hapticMedium: () => void;
  hapticSelection: () => void;
};

export function DriverHomeTabContent({
  styles,
  ui,
  availableCashOutAmount,
  currentTrip,
  currentTripExpanded,
  tripUiTick,
  progressIndex,
  completedTrips,
  allTripsSlideAnim,
  driverProgressSteps,
  formatJmd,
  getTripBarCopy,
  setEarningsModal,
  setCurrentTripExpanded,
  setCurrentTrip,
  setTripPinInput,
  setTripPinError,
  setTripPinModalVisible,
  setSubScreen,
  advanceTrip,
  hapticLight,
  hapticMedium,
  hapticSelection,
}: DriverHomeTabContentProps) {
  return (
    <>
      {currentTrip?.status !== 'in_trip' ? (
        <View style={styles.earningsRow}>
          <Pressable
            style={[styles.earningsPill, { backgroundColor: '#171717' }]}
            onPress={() => {
              hapticLight();
              setEarningsModal('rating');
            }}
          >
            <Text style={styles.earningsPillValueBlack}>4.9 ★</Text>
            <Text style={styles.earningsPillLabelBlack}>Rating</Text>
          </Pressable>
          <Pressable
            style={[styles.earningsPill, styles.earningsPillCenter, { backgroundColor: '#16a34a' }]}
            onPress={() => {
              hapticLight();
              setEarningsModal('earnings');
            }}
          >
            <Text style={styles.earningsPillValueYellow}>{formatJmd(availableCashOutAmount)}</Text>
            <Text style={styles.earningsPillLabelYellow}>Today&apos;s earnings</Text>
          </Pressable>
          <Pressable
            style={[styles.earningsPill, { backgroundColor: '#171717' }]}
            onPress={() => {
              hapticLight();
              setEarningsModal('trips');
            }}
          >
            <Text style={styles.earningsPillValueBlack}>9</Text>
            <Text style={styles.earningsPillLabelBlack}>Trips today</Text>
          </Pressable>
        </View>
      ) : null}

      {currentTrip && currentTrip.status !== 'in_trip' ? (
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
                  <Text style={[styles.currentTripMeta, { color: ui.textMuted }]}>
                    {currentTrip.distance} • {currentTrip.fare} • {currentTrip.paymentLabel}
                  </Text>
                </View>
                <View style={styles.currentTripContactActions}>
                  <Pressable
                    style={[styles.currentTripContactBtn, { backgroundColor: '#171717' }]}
                    onPress={() => {
                      hapticLight();
                      Alert.alert('Call rider', `Calling ${currentTrip.riderName} is not wired up yet.`);
                    }}
                  >
                    <Ionicons name="call" size={17} color="#ffffff" />
                  </Pressable>
                  <Pressable
                    style={[styles.currentTripContactBtn, { backgroundColor: '#171717' }]}
                    onPress={() => {
                      hapticLight();
                      Alert.alert('Message rider', `Messaging ${currentTrip.riderName} is not wired up yet.`);
                    }}
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
                  <Text style={[styles.routePillText, { color: ui.text, flex: 1 }]} numberOfLines={1}>
                    {currentTrip.pickup}
                  </Text>
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
                  <Text style={[styles.routePillText, { color: ui.text, flex: 1 }]} numberOfLines={1}>
                    {currentTrip.dropoff}
                  </Text>
                </View>
              </View>

              <View style={styles.currentTripStageRow}>
                {driverProgressSteps.map((step, index) => {
                  const isActive = index <= progressIndex;
                  const isCurrent = currentTrip.status === step.key;
                  const isNext = index === progressIndex + 1;
                  const isCompleted = currentTrip.status === 'completed' || currentTrip.status === 'cancelled';
                  const canTap = (!isCompleted && isNext && step.key !== 'in_trip') || (isCurrent && step.key === 'arrived');

                  return (
                    <Pressable
                      key={step.key}
                      style={[
                        styles.tripPhasePill,
                        {
                          backgroundColor: isCurrent ? '#FFD000' : isActive ? '#171717' : ui.card,
                          borderColor: isCurrent ? '#FFD000' : isActive ? '#171717' : ui.border,
                          opacity: canTap ? 1 : isNext ? 0.45 : 1,
                        },
                      ]}
                      onPress={() => {
                        if (!canTap) return;
                        if (step.key === 'arrived') {
                          if (currentTrip.status === 'matched') {
                            hapticMedium();
                            setCurrentTrip((prev: any) => (prev ? { ...prev, status: 'arrived', arrivedAtMs: Date.now() } : prev));
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
                      <Text
                        style={[
                          styles.tripPhasePillText,
                          { color: isCurrent ? '#171717' : isActive ? '#FFD000' : ui.textMuted },
                        ]}
                        numberOfLines={1}
                      >
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

      {currentTrip?.status !== 'in_trip' ? (
        <>
          <View style={styles.homeSectionGap}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: ui.text }]}>This week</Text>
            </View>
            <Pressable
              style={[styles.weeklyCard, { backgroundColor: ui.card, borderColor: ui.border }]}
              onPress={() => {
                hapticLight();
                setEarningsModal('earnings');
              }}
            >
              <View style={styles.weeklyStatRow}>
                <View style={styles.weeklyStatItem}>
                  <Text style={[styles.weeklyStatValue, { color: ui.text }]}>94%</Text>
                  <Text style={[styles.weeklyStatLabel, { color: ui.textMuted }]}>Acceptance</Text>
                </View>
                <View style={[styles.weeklyStatDivider, { backgroundColor: ui.border }]} />
                <View style={styles.weeklyStatItem}>
                  <Text style={[styles.weeklyStatValue, { color: ui.text }]}>6.2 hrs</Text>
                  <Text style={[styles.weeklyStatLabel, { color: ui.textMuted }]}>Online time</Text>
                </View>
                <View style={[styles.weeklyStatDivider, { backgroundColor: ui.border }]} />
                <View style={styles.weeklyStatItem}>
                  <Text style={[styles.weeklyStatValue, { color: ui.text }]}>J$48,200</Text>
                  <Text style={[styles.weeklyStatLabel, { color: ui.textMuted }]}>Earned</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.homeSectionGap}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: ui.text }]}>Recent trips</Text>
              <Pressable
                onPress={() => {
                  hapticLight();
                  allTripsSlideAnim.setValue(800);
                  setSubScreen('allTrips');
                  Animated.timing(allTripsSlideAnim, {
                    toValue: 0,
                    duration: 320,
                    useNativeDriver: true,
                  }).start();
                }}
                hitSlop={8}
              >
                <Text style={[styles.sectionSub, { color: '#171717' }]}>View all →</Text>
              </Pressable>
            </View>
            {completedTrips.slice(0, 2).map((trip) => (
              <View key={trip.id} style={[styles.tripHistoryCard, { borderColor: ui.border, backgroundColor: ui.card }]}>
                <View style={styles.tripHistoryTopRow}>
                  <Text style={[styles.tripHistoryRoute, { color: ui.text }]}>{trip.route}</Text>
                  <Text style={[styles.tripHistoryFare, { color: ui.text }]}>{trip.fare}</Text>
                </View>
                <Text style={[styles.tripHistoryMeta, { color: ui.textMuted }]}>Rider {trip.riderName} • {trip.when}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}
