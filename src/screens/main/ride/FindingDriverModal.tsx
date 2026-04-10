import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';

const THUMB = 64;
const TRACK_H = 68;
const H_PADDING = 20;

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
  onSwipeConfirm: () => void;
  onRetry: () => void;
};

function SwipeToSend({ ui, isDark, onConfirm }: { ui: MainScreenUi; isDark: boolean; onConfirm: () => void }) {
  const [thumbX, setThumbX] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackXInWindow = useRef(0);

  const maxX = Math.max(0, trackWidth - THUMB - 8);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
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
    [maxX, onConfirm]
  );

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
      <Text style={[styles.swipeHint, { color: ui.textMuted }]} pointerEvents="none">
        Slide to send ride request
      </Text>
      <View
        style={[
          styles.swipeThumb,
          {
            backgroundColor: ui.ctaBg,
            transform: [{ translateX: thumbX }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="chevron-forward" size={26} color={ui.ctaText} />
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
}: Props) {
  const searching = phase === 'searching';
  const noDriver = phase === 'no_driver_found';
  const modalTitle = searching ? 'Finding Driver' : noDriver ? 'No Drivers Nearby' : 'Driver Found';

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <BlurView intensity={Platform.OS === 'ios' ? 42 : 32} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <Pressable
          style={styles.dimTap}
          onPress={searching ? undefined : onClose}
          pointerEvents="auto"
        />
        <View style={[styles.sheet, { backgroundColor: ui.cardBg, borderColor: ui.divider }]} pointerEvents="auto">
          <View style={styles.sheetHeader}>
            <Text style={[styles.title, { color: ui.text }]}>{modalTitle}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={ui.textMuted} />
            </Pressable>
          </View>

          {searching ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={ui.ctaBg} />
              <Text style={[styles.loadingSub, { color: ui.textMuted }]}>Matching you with a nearby driver…</Text>
            </View>
          ) : noDriver ? (
            <View style={styles.loadingBlock}>
              <Ionicons name="alert-circle-outline" size={30} color={ui.textMuted} />
              <Text style={[styles.loadingSub, { color: ui.textMuted }]}>No drivers found nearby right now.</Text>
              <Pressable style={[styles.retryBtn, { backgroundColor: ui.text }]} onPress={onRetry}>
                <Text style={[styles.retryBtnText, { color: ui.screenBg }]}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.foundBadge}>
              <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              <Text style={[styles.foundText, { color: ui.text }]}>Ready to confirm your trip</Text>
            </View>
          )}

          <View style={[styles.tripCard, { backgroundColor: ui.softBg }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.metaLabel, { color: ui.textMuted }]}>Fare</Text>
              <Text style={[styles.metaValue, { color: ui.text }]}>{fareFormatted}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={[styles.metaLabel, { color: ui.textMuted }]}>ETA</Text>
              <Text style={[styles.metaValue, { color: ui.text }]}>{etaLabel}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={[styles.metaLabel, { color: ui.textMuted }]}>Payment</Text>
              <View style={styles.paymentRow}>
                {(['Card', 'Cash'] as const).map((option) => {
                  const selected = paymentLabel === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => onChangePayment(option)}
                      style={[
                        styles.paymentChip,
                        {
                          borderColor: selected ? ui.text : ui.divider,
                          backgroundColor: selected ? ui.text : ui.cardBg,
                        },
                      ]}
                    >
                      <Text style={[styles.paymentChipText, { color: selected ? ui.screenBg : ui.text }]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: ui.divider }]} />
            <Text style={[styles.routeLabel, { color: ui.textMuted }]}>From</Text>
            <Text style={[styles.routeText, { color: ui.text }]} numberOfLines={2}>
              {fromLabel || '—'}
            </Text>
            <Text style={[styles.routeLabel, { color: ui.textMuted, marginTop: 10 }]}>To</Text>
            <Text style={[styles.routeText, { color: ui.text }]} numberOfLines={2}>
              {toLabel || '—'}
            </Text>
          </View>

          {!searching && !noDriver ? <SwipeToSend ui={ui} isDark={isDark} onConfirm={onSwipeConfirm} /> : null}
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
  },
  dimTap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheet: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    zIndex: 2,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    marginBottom: 8,
  },
  loadingSub: {
    fontSize: 14,
    textAlign: 'center',
  },
  foundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  foundText: {
    fontSize: 15,
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryBtnText: {
    fontWeight: '700',
  },
  tripCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
  },
  metaValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  paymentChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 15,
    lineHeight: 20,
  },
  swipeTrack: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  swipeThumb: {
    position: 'absolute',
    left: 4,
    width: THUMB,
    height: THUMB - 10,
    borderRadius: (THUMB - 10) / 2,
    top: Math.round((TRACK_H - (THUMB - 10)) / 2),
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
