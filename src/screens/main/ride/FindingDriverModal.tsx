import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { greyCarAsset } from '../../../assets/images';
import type { MainScreenUi } from '../mainScreenUi';

const THUMB = 64;
const TRACK_H = 68;
const H_PADDING = 20;
const ACCENT = '#FFD000';

export type DriverInfo = {
  name: string;
  carDetails: string;
  plate: string;
  rating: number;
  etaLabel: string;
};

type Phase = 'searching' | 'readySwipe' | 'no_driver_found';

type Props = {
  visible: boolean;
  phase: Phase;
  ui: MainScreenUi;
  isDark: boolean;
  fromLabel: string;
  toLabel: string;
  fareFormatted: string;
  etaLabel: string;
  paymentLabel: string;
  onChangePayment: (value: 'Card' | 'Cash') => void;
  onClose: () => void;
  onSwipeConfirm: () => void | Promise<void>;
  onRetry: () => void;
  /** True while POST /rides is in flight */
  confirming?: boolean;
  /** Dev-only: jump to “driver found” without waiting (not shown in production) */
  onDevSkipWait?: () => void;
  /** False when there is no saved default card — Card chip is disabled (use Cash or add a card in Profile). */
  canPayWithCard: boolean;
  /** Multiple drivers found — rendered as a swipeable carousel */
  drivers?: DriverInfo[];
  // Legacy single-driver props (used when drivers is not provided)
  driverName?: string;
  driverCarDetails?: string;
  driverPlate?: string;
  driverRating?: number;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Three concentric rings that pulse outward — played with staggered JS timers so no Animated.delay needed */
function PulsingRings({ color }: { color: string }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const running: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    [ring1, ring2, ring3].forEach((v, i) => {
      const launch = () => {
        const a = Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 1800, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
        a.start();
        running.push(a);
      };
      if (i === 0) {
        launch();
      } else {
        timers.push(setTimeout(launch, i * 600));
      }
    });

    return () => {
      timers.forEach(clearTimeout);
      running.forEach((a) => a.stop());
    };
  }, [ring1, ring2, ring3]);

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1.5,
    borderColor: color,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 2.6] }) }],
    opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 0.2, 0] }),
  });

  return (
    <View style={{ width: 116, height: 116, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <Animated.View style={ringStyle(ring3)} />
      <View
        style={{
          width: 74,
          height: 74,
          borderRadius: 37,
          backgroundColor: color + '1c',
          borderWidth: 2,
          borderColor: color + '55',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="car" size={30} color={color} />
      </View>
    </View>
  );
}

/** Horizontal shimmer line that scans left → right on loop */
function ScanBar({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-90, 420] });

  return (
    <View
      style={{
        width: '100%',
        height: 3,
        borderRadius: 3,
        backgroundColor: color + '25',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: 90,
          height: '100%',
          borderRadius: 3,
          backgroundColor: color,
          opacity: 0.9,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

/** Stacked selectable list of driver cards */
function DriverList({
  drivers,
  ui,
  isDark,
  selectedIndex,
  onSelect,
}: {
  drivers: DriverInfo[];
  ui: MainScreenUi;
  isDark: boolean;
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={styles.driverListWrap}>
      {drivers.map((driver, i) => {
        const selected = i === selectedIndex;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            style={[
              styles.driverListCard,
              {
                backgroundColor: selected
                  ? isDark ? '#24221c' : '#ffffff'
                  : isDark ? 'rgba(255,255,255,0.04)' : ui.cardBg,
                borderColor: selected ? ACCENT : ui.divider,
                borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: selected ? 8 : 1 },
                shadowOpacity: selected ? 0.18 : 0.05,
                shadowRadius: selected ? 14 : 3,
                elevation: selected ? 10 : 1,
              },
            ]}
          >
            {/* Car image */}
            <Image source={greyCarAsset} style={styles.driverListCarImg} resizeMode="contain" />
            {/* Driver info */}
            <View style={styles.driverListInfo}>
              <View style={styles.driverListNameRow}>
                <Text style={[styles.driverListName, { color: ui.text }]}>Driver {i + 1}</Text>
                <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              </View>
            </View>
            {/* ETA badge */}
            <View style={styles.driverListEtaBadge}>
              <Text style={styles.driverListEtaText}>{driver.etaLabel}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function GreenGlow() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    [ring1, ring2].forEach((v, i) => {
      const launch = () => {
        const a = Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 2000, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
        a.start();
        animations.push(a);
      };
      if (i === 0) launch();
      else timers.push(setTimeout(launch, 800));
    });

    return () => {
      timers.forEach(clearTimeout);
      animations.forEach((a) => a.stop());
    };
  }, [ring1, ring2]);

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#22c55e',
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.7, 0.4, 0] }),
  });

  return (
    <>
      <Animated.View style={ringStyle(ring1)} pointerEvents="none" />
      <Animated.View style={ringStyle(ring2)} pointerEvents="none" />
    </>
  );
}

function SwipeToSend({
  ui,
  isDark,
  disabled,
  onConfirm,
  fareFormatted,
}: {
  ui: MainScreenUi;
  isDark: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  fareFormatted?: string;
}) {
  const [thumbX, setThumbX] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackXInWindow = useRef(0);

  const maxX = Math.max(0, trackWidth - THUMB);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_, g) => {
          // Keep thumb centered under the finger while dragging.
          const fingerX = g.moveX - trackXInWindow.current;
          const x = Math.max(0, Math.min(maxX, fingerX - THUMB / 2));
          setThumbX(x);
        },
        onPanResponderMove: (_, g) => {
          const fingerX = g.moveX - trackXInWindow.current;
          const x = Math.max(0, Math.min(maxX, fingerX - THUMB / 2));
          setThumbX(x);
        },
        onPanResponderRelease: (_, g) => {
          const fingerX = g.moveX - trackXInWindow.current;
          const x = Math.max(0, Math.min(maxX, fingerX - THUMB / 2));
          if (maxX > 0 && x >= maxX * 0.6) {
            setThumbX(maxX);
            onConfirm();
            setThumbX(0);
          } else {
            setThumbX(0);
          }
        },
      }),
    [disabled, maxX, onConfirm]
  );

  // Fill width: thumb centre position = thumbX + THUMB/2
  const fillWidth = thumbX + THUMB / 2 + 4;

  return (
    <View
      style={[
        styles.swipeTrack,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderColor: ui.divider,
        },
      ]}
      pointerEvents="auto"
      {...panResponder.panHandlers}
      onLayout={(e) => {
        setTrackWidth(e.nativeEvent.layout.width);
      }}
      onTouchStart={(e) => {
        // Capture absolute X so pan responder can map finger -> track coordinates.
        trackXInWindow.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
      }}
    >
      {/* Yellow fill that grows as thumb is dragged */}
      <View
        style={[
          styles.swipeFill,
          { width: fillWidth, opacity: thumbX > 0 ? 1 : 0 },
        ]}
        pointerEvents="none"
      />
      <Text style={[styles.swipeHint, { color: disabled ? ui.textMuted : ui.text }]} pointerEvents="none">
        {disabled ? 'Sending request…' : (
          fareFormatted
            ? <>{'Slide to pay '}<Text style={{ fontWeight: '900' }}>{fareFormatted}</Text></>
            : 'Slide to pay'
        )}
      </Text>
      <View
        style={[
          styles.swipeThumb,
          {
            backgroundColor: ACCENT,
            transform: [{ translateX: thumbX }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="chevron-forward" size={26} color="#171717" />
      </View>
    </View>
  );
}

export function FindingDriverModal({
  visible,
  phase,
  ui,
  isDark,
  fromLabel,
  toLabel,
  fareFormatted,
  etaLabel,
  paymentLabel,
  onChangePayment,
  onClose,
  onSwipeConfirm,
  onRetry,
  confirming = false,
  onDevSkipWait,
  canPayWithCard,
  drivers,
  driverName = 'Marcus W.',
  driverCarDetails = 'Toyota Corolla · Silver',
  driverPlate = 'P 4821',
  driverRating = 4.9,
}: Props) {
  const searching = phase === 'searching';
  const noDriver = phase === 'no_driver_found';

  // Normalise to a drivers array — prefer the `drivers` prop, fall back to legacy single-driver props
  const driverList: DriverInfo[] = drivers && drivers.length > 0
    ? drivers
    : [{
        name: driverName,
        carDetails: driverCarDetails,
        plate: driverPlate,
        rating: driverRating,
        etaLabel,
      }];
  const modalTitle = searching ? 'Finding Driver' : noDriver ? 'No Drivers Nearby' : `${driverList.length} Driver${driverList.length === 1 ? '' : 's'} Found`;
  const [selectedDriverIndex, setSelectedDriverIndex] = useState(-1);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <BlurView intensity={Platform.OS === 'ios' ? 42 : 32} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <Pressable
          style={styles.dimTap}
          onPress={searching ? undefined : onClose}
          pointerEvents="auto"
        />
        <View style={[styles.sheet, { backgroundColor: ui.cardBg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} pointerEvents="auto">

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              {searching ? (
                <View style={[styles.statusDot, { backgroundColor: ACCENT }]} />
              ) : noDriver ? (
                <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
              ) : null}
              <Text style={[styles.title, { color: ui.text }]}>{modalTitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="close" size={18} color={ui.textMuted} />
            </Pressable>
          </View>

          {searching ? (
            <View style={styles.loadingBlock}>
              <PulsingRings color={ACCENT} />
              <View style={{ width: '100%', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <Text style={[styles.loadingHeading, { color: ui.text }]}>Searching nearby drivers</Text>
                <ScanBar color={ACCENT} />
                <Text style={[styles.loadingSub, { color: ui.textMuted }]}>Matching you with the best available driver…</Text>
              </View>
              {__DEV__ && typeof onDevSkipWait === 'function' ? (
                <Pressable
                  onPress={onDevSkipWait}
                  style={[styles.devSkipBtn, { borderColor: ui.divider, backgroundColor: ui.softBg }]}
                  accessibilityLabel="Skip wait (development only)"
                >
                  <Text style={[styles.devSkipText, { color: ui.textMuted }]}>Skip wait (dev)</Text>
                </Pressable>
              ) : null}
            </View>
          ) : noDriver ? (
            <View style={styles.loadingBlock}>
              <View style={styles.noDriverCircle}>
                <Ionicons name="alert-circle" size={38} color="#ef4444" />
              </View>
              <Text style={[styles.loadingHeading, { color: ui.text }]}>No drivers available</Text>
              <Text style={[styles.loadingSub, { color: ui.textMuted }]}>No drivers found nearby right now.</Text>
              <Pressable style={[styles.retryBtn, { backgroundColor: ui.text }]} onPress={onRetry}>
                <Ionicons name="refresh" size={16} color={ui.screenBg} />
                <Text style={[styles.retryBtnText, { color: ui.screenBg }]}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Locations card at top */}
              <View style={[styles.locationsCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: ui.divider }]}>
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  {/* Vertical timeline column */}
                  <View style={styles.locTimeline}>
                    <View style={[styles.locDotOuter, { borderColor: ui.text }]} />
                    <View style={[styles.locConnector, { backgroundColor: ui.divider }]} />
                    <View style={[styles.locDotFill, { backgroundColor: ACCENT }]} />
                  </View>
                  {/* Text column */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.locTextRow}>
                      <Text style={[styles.locLabel, { color: ui.textMuted }]}>From</Text>
                      <Text style={[styles.locText, { color: ui.text }]} numberOfLines={1}>{fromLabel || '—'}</Text>
                    </View>
                    <View style={styles.locTextRow}>
                      <Text style={[styles.locLabel, { color: ui.textMuted }]}>To</Text>
                      <Text style={[styles.locText, { color: ui.text }]} numberOfLines={1}>{toLabel || '—'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Driver list */}
              <DriverList
                drivers={driverList}
                ui={ui}
                isDark={isDark}
                selectedIndex={selectedDriverIndex}
                onSelect={setSelectedDriverIndex}
              />

              {/* Slide to pay — shown only once a driver is selected */}
              {selectedDriverIndex >= 0 ? (
                <SwipeToSend ui={ui} isDark={isDark} disabled={confirming} onConfirm={() => void onSwipeConfirm()} fareFormatted={fareFormatted} />
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: H_PADDING,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dimTap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheet: {
    position: 'relative',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 0,
    paddingBottom: 22,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    zIndex: 2,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 4,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  driverCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  driverCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  etaSubtitle: {
    fontSize: 13,
    marginLeft: 16,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    gap: 12,
    marginBottom: 8,
  },
  loadingHeading: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  loadingSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  noDriverCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef444418',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 22,
  },
  foundIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundText: {
    fontSize: 15,
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  devSkipBtn: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  devSkipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
    padding: 16,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  metaItem: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    alignSelf: 'center',
    marginHorizontal: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  routeDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  routeTimeline: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  routeTrack: {
    width: 14,
    alignItems: 'center',
    paddingTop: 2,
    gap: 0,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeDotOrigin: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  routeDotDest: {
    marginTop: 2,
  },
  routeLine: {
    flex: 1,
    width: 2,
    minHeight: 12,
    marginVertical: 2,
  },
  routeLabels: {
    flex: 1,
    gap: 10,
  },
  routeRow: {
    gap: 2,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  paymentHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  paymentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paymentChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  paymentChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  paymentChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  driverHero: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  carouselWrapper: {
    overflow: 'hidden',
  },
  etaBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: -8,
    marginBottom: 4,
  },
  etaBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171717',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  driverCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverAvatarWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  driverHeroAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverHeroInitials: {
    fontSize: 38,
    fontWeight: '800',
    color: '#ffffff',
  },
  driverHeroName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  driverHeroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  locationsCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
  },
  locTimeline: {
    width: 28,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    gap: 0,
  },
  locConnector: {
    flex: 1,
    width: 2,
    minHeight: 14,
    marginVertical: 3,
    borderRadius: 1,
  },
  locTextRow: {
    paddingVertical: 10,
  },
  locDotOuter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  locDotFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  locLine: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 22,
  },
  locLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 22,
    marginBottom: 10,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  driverAvatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  driverAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  driverInfo: {
    flex: 1,
    gap: 3,
    alignItems: 'flex-end',
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '600',
  },
  driverCarText: {
    fontSize: 13,
    lineHeight: 17,
  },
  driverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  platePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  plateText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  swipeTrack: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    marginHorizontal: 14,
  },
  swipeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 18,
    marginBottom: 6,
  },
  swipeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: ACCENT,
    borderRadius: TRACK_H / 2,
    zIndex: 1,
  },
  swipeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    zIndex: 2,
  },
  swipeThumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    top: 0,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  // ── Driver list (stacked selectable cards) ─────────────────────
  driverListWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    gap: 8,
    paddingVertical: 2,
  },
  driverListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  driverListCarImg: {
    width: 80,
    height: 50,
  },
  driverListInfo: {
    flex: 1,
    gap: 2,
  },
  driverListNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  driverListName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  driverListSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  driverListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  driverListMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  driverListEtaBadge: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
  },
  driverListEtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171717',
    textAlign: 'center',
  },
});
