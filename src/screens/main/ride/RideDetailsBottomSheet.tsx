import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, type GestureResponderHandlers } from 'react-native';
import { greyCarAsset } from '../../../assets/images';
import { hapticMedium, hapticWarning } from '../../../lib/haptics';
import type { MainScreenUi } from '../mainScreenUi';
import type { ActiveTripState, TripCancelReason } from './activeTripTypes';

const ACCENT = '#FFD000';
const SIZE_PILL_BLUE = '#2563eb';
const CANCEL_FEE_FREE = 0;
const CANCEL_FEE_PARTIAL = 2.50;
const CANCEL_FEE_FULL_FARE = -1; // -1 means full fare applies

type CancelOption = {
  reason: TripCancelReason;
  label: string;
  description: string;
  /** Fee in USD. -1 = full fare charged. 0 = free. */
  fee: number;
};

const CANCEL_OPTIONS: CancelOption[] = [
  {
    reason: 'change_of_plans',
    label: 'Change of plans',
    description: 'I no longer need this ride',
    fee: CANCEL_FEE_PARTIAL,
  },
  {
    reason: 'driver_too_far',
    label: 'Driver is too far away',
    description: "The ETA is longer than I expected",
    fee: CANCEL_FEE_FREE,
  },
  {
    reason: 'wrong_pickup',
    label: 'Wrong pickup location',
    description: 'I set the wrong pickup point',
    fee: CANCEL_FEE_FREE,
  },
  {
    reason: 'booked_by_mistake',
    label: 'Booked by mistake',
    description: 'I accidentally placed this booking',
    fee: CANCEL_FEE_PARTIAL,
  },
  {
    reason: 'other',
    label: 'Other reason',
    description: 'Another reason not listed above',
    fee: CANCEL_FEE_FULL_FARE,
  },
];

function feeLabel(fee: number, fareLabel?: string): string {
  if (fee === 0) return 'No charge';
  if (fee === CANCEL_FEE_FULL_FARE) return `Full fare charged (${fareLabel ?? 'see fare'})`;
  return `$${fee.toFixed(2)} cancellation fee`;
}

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatMinSec(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${mm}:${ss}`;
}

type Props = {
  trip: ActiveTripState;
  ui: MainScreenUi;
  isDark: boolean;
  etaCountdownSec: number;
  headerPanHandlers?: GestureResponderHandlers;
  onToggleCollapse?: () => void;
  /** Called after user picks a cancel reason and confirms. */
  onCancelRide?: (reason: TripCancelReason, fee: number) => void;
};

export function RideDetailsBottomSheet({
  trip,
  ui,
  isDark,
  etaCountdownSec,
  headerPanHandlers,
  onToggleCollapse,
  onCancelRide,
}: Props) {
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<TripCancelReason | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (trip.status !== 'completed') return;
    const t = setTimeout(() => setShowReceipt(true), 700);
    return () => clearTimeout(t);
  }, [trip.status]);

  const handleShareTrip = async () => {
    hapticMedium();
    const msg = `I'm on a Ridr trip!\n\nDriver: ${name} (${trip.plate} – ${trip.carDetails})\nFrom: ${trip.fromLabel || 'Pickup'}\nTo: ${trip.toLabel || 'Dropoff'}\nETA: ~${trip.etaMinutes} min`;
    try { await Share.share({ message: msg, title: 'My Ridr Trip' }); } catch { /* cancelled */ }
  };

  type ChatMessage = { id: string; text: string; sender: 'me' | 'them'; ts: number };
  const DRIVER_AUTO_REPLIES = ["I'm close, be there soon!", "Okay, heading your way.", "No problem!", "Almost there!"];
  const [showDriverChat, setShowDriverChat] = useState(false);
  const [driverChatInput, setDriverChatInput] = useState('');
  const [driverChatMessages, setDriverChatMessages] = useState<ChatMessage[]>([]);
  const driverChatScrollRef = useRef<ScrollView | null>(null);

  const name = trip.driverName ?? 'Driver';
  const initials = getInitials(name);
  const avatarBg = avatarColor(name);
  const driverRating = trip.rating != null && trip.rating > 0 ? trip.rating : 4.5;
  const etaLabel = `${formatMinSec(etaCountdownSec)} Mins`;

  return (
    <View style={[styles.card, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
      {/* Black arrival bar */}
      <Pressable
        style={styles.arrivalBar}
        onPress={onToggleCollapse}
        accessibilityRole="button"
        accessibilityLabel="Toggle ride details"
        {...(headerPanHandlers ?? {})}
      >
        <Ionicons name="hourglass-outline" size={18} color="#ffffff" />
        <Text style={styles.arrivalBarText} numberOfLines={1}>
          The driver will arrive in
        </Text>
        <View style={styles.arrivalBarPill}>
          <Text style={styles.arrivalBarPillText}>{etaLabel}</Text>
        </View>
      </Pressable>

      {/* Sheet surface */}
      <View style={styles.surfaceShadow}>
        <View style={[styles.surface, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          {/* Vehicle */}
          <View style={styles.vehicleRow}>
            <View style={styles.vehicleLeft}>
              <Text style={[styles.plateNumber, { color: ui.text }]}>{trip.plate || '—'}</Text>
              <Text style={[styles.vehicleSub, { color: ui.textMuted }]} numberOfLines={1}>
                {trip.carDetails || 'Vehicle'}
              </Text>
            </View>
            <View style={styles.vehicleRight}>
              <Image source={greyCarAsset} style={styles.carImg} resizeMode="contain" />
              <View style={[styles.sizePill, { backgroundColor: SIZE_PILL_BLUE }]}>
                <Text style={styles.sizePillText}>Medium Size</Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.divider }]} />

          {/* Driver */}
          <View style={styles.driverRow}>
            <View style={styles.avatarWrap}>
              <View style={[styles.driverAvatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.driverAvatarText}>{initials}</Text>
              </View>
              <View style={styles.ratingOverlay}>
                <Text style={styles.ratingOverlayText}>{driverRating.toFixed(1)}</Text>
                <Ionicons name="star" size={12} color={ACCENT} />
              </View>
            </View>

            <View style={styles.driverMeta}>
              <Text style={[styles.driverName, { color: ui.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.driverSub, { color: ui.textMuted }]} numberOfLines={1}>
                Top Rated Driver 🏆
              </Text>
            </View>

            <View style={styles.driverActions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  if (trip.driverPhone) {
                    Linking.openURL(`tel:${trip.driverPhone}`);
                  } else {
                    Alert.alert('No number', 'Driver phone number is not available.');
                  }
                }}
              >
                <Ionicons name="call" size={18} color={ACCENT} />
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => setShowDriverChat(true)}
              >
                <Ionicons name="chatbubble-ellipses" size={16} color={ACCENT} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.divider }]} />

          {/* Safety actions */}
          <View style={styles.safetyRow}>
            <Pressable
              style={[styles.safetyBtn, { backgroundColor: isDark ? '#0f2019' : '#f0fdf4', borderColor: '#22c55e' }]}
              onPress={handleShareTrip}
            >
              <Ionicons name="share-social-outline" size={16} color="#22c55e" />
              <Text style={[styles.safetyBtnText, { color: '#22c55e' }]}>Share trip</Text>
            </Pressable>
            <Pressable
              style={[styles.safetyBtn, { backgroundColor: isDark ? '#2b0d0d' : '#fff1f1', borderColor: '#ef4444' }]}
              onPress={() => {
                hapticWarning();
                Alert.alert('Emergency SOS', 'Call Jamaica Emergency Services (119)?', [
                  { text: 'Call 119', style: 'destructive', onPress: () => Linking.openURL('tel:119') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              <Ionicons name="warning-outline" size={16} color="#ef4444" />
              <Text style={[styles.safetyBtnText, { color: '#ef4444' }]}>Emergency</Text>
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.divider }]} />

          {/* Route */}
          <View style={styles.routeWrap}>
            <View style={styles.routeTimeline}>
              <View style={[styles.routeDotStart, { backgroundColor: ui.textMuted }]} />
              <View style={[styles.routeLine, { backgroundColor: ui.divider }]} />
              <View style={[styles.routeDotEnd, { backgroundColor: ui.text }]} />
            </View>
            <View style={styles.routeTexts}>
              <View style={styles.routeItem}>
                <Text style={[styles.routeLabel, { color: ui.textMuted }]}>Start Location</Text>
                <Text style={[styles.routeValue, { color: ui.text }]} numberOfLines={1}>
                  {trip.fromLabel || 'Your Current Location'}
                </Text>
              </View>
              <View style={[styles.routeMidDivider, { backgroundColor: ui.divider }]} />
              <View style={styles.routeItem}>
                <Text style={[styles.routeLabel, { color: ui.textMuted }]}>Your Destination</Text>
                <Text style={[styles.routeValue, { color: ui.text }]} numberOfLines={1}>
                  {trip.toLabel || '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Cancel ride button */}
          {onCancelRide ? (
            <>
              <View style={[styles.divider, { backgroundColor: ui.divider }]} />
              <Pressable
                style={styles.cancelRideBtn}
                onPress={() => {
                  hapticWarning();
                  setSelectedReason(null);
                  setCancelModalVisible(true);
                }}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.cancelRideBtnText}>Cancel Ride</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {/* Cancel reason modal */}
      <Modal
        visible={cancelModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <Pressable style={cancelStyles.overlay} onPress={() => setCancelModalVisible(false)}>
          <Pressable style={[cancelStyles.sheet, { backgroundColor: ui.cardBg }]} onPress={() => {}}>
            <View style={cancelStyles.handle} />
            <Text style={[cancelStyles.title, { color: ui.text }]}>Cancel Ride</Text>
            <Text style={[cancelStyles.subtitle, { color: ui.textMuted }]}>
              Select a reason. A fee may apply.
            </Text>

            <ScrollView style={cancelStyles.optionList} showsVerticalScrollIndicator={false}>
              {CANCEL_OPTIONS.map((opt) => {
                const isSelected = selectedReason === opt.reason;
                return (
                  <Pressable
                    key={opt.reason}
                    style={[
                      cancelStyles.optionRow,
                      { borderColor: ui.divider, backgroundColor: isSelected ? (isDark ? '#1f1f23' : '#fffbea') : 'transparent' },
                      isSelected && { borderColor: ACCENT },
                    ]}
                    onPress={() => {
                      hapticMedium();
                      setSelectedReason(opt.reason);
                    }}
                  >
                    <View style={cancelStyles.optionLeft}>
                      <Text style={[cancelStyles.optionLabel, { color: ui.text }]}>{opt.label}</Text>
                      <Text style={[cancelStyles.optionDesc, { color: ui.textMuted }]}>{opt.description}</Text>
                    </View>
                    <View style={cancelStyles.optionRight}>
                      <Text
                        style={[
                          cancelStyles.feeTag,
                          { color: opt.fee === 0 ? '#22c55e' : '#ef4444' },
                        ]}
                      >
                        {feeLabel(opt.fee, trip.fareLabel)}
                      </Text>
                      <View style={[cancelStyles.radioOuter, { borderColor: isSelected ? ACCENT : ui.divider }]}>
                        {isSelected ? <View style={cancelStyles.radioInner} /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={[
                cancelStyles.confirmBtn,
                { opacity: selectedReason ? 1 : 0.45 },
              ]}
              disabled={!selectedReason}
              onPress={() => {
                if (!selectedReason) return;
                const opt = CANCEL_OPTIONS.find((o) => o.reason === selectedReason)!;
                const feeText = opt.fee === 0
                  ? 'You will not be charged.'
                  : opt.fee === CANCEL_FEE_FULL_FARE
                    ? `You will be charged the full fare (${trip.fareLabel ?? 'see fare'}).`
                    : `You will be charged a $${opt.fee.toFixed(2)} cancellation fee.`;
                hapticWarning();
                Alert.alert(
                  'Confirm Cancellation',
                  `${feeText}\n\nAre you sure you want to cancel?`,
                  [
                    { text: 'Go back', style: 'cancel' },
                    {
                      text: 'Yes, cancel',
                      style: 'destructive',
                      onPress: () => {
                        setCancelModalVisible(false);
                        onCancelRide?.(selectedReason, opt.fee === CANCEL_FEE_FULL_FARE ? trip.fareUsd : opt.fee);
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={cancelStyles.confirmBtnText}>Confirm Cancellation</Text>
            </Pressable>

            <Pressable style={cancelStyles.dismissBtn} onPress={() => setCancelModalVisible(false)}>
              <Text style={[cancelStyles.dismissBtnText, { color: ui.textMuted }]}>Keep my ride</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Trip receipt modal ── */}
      <Modal
        visible={showReceipt}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowReceipt(false)}
      >
        <View style={receiptStyles.overlay}>
          <View style={[receiptStyles.sheet, { backgroundColor: ui.cardBg }]}>
            <View style={receiptStyles.handle} />
            <View style={receiptStyles.checkCircle}>
              <Ionicons name="checkmark" size={32} color="#ffffff" />
            </View>
            <Text style={[receiptStyles.title, { color: ui.text }]}>Trip Completed</Text>
            <Text style={[receiptStyles.subtitle, { color: ui.textMuted }]}>
              Safe travels! Here's your trip receipt.
            </Text>
            <View style={[receiptStyles.receiptCard, { backgroundColor: isDark ? '#1b1c20' : '#f9f9f9', borderColor: ui.divider }]}>
              {([
                { label: 'Driver', value: name },
                { label: 'Vehicle', value: `${trip.plate} — ${trip.carDetails}` },
                { label: 'From', value: trip.fromLabel || 'Pickup' },
                { label: 'To', value: trip.toLabel || 'Dropoff' },
                { label: 'Fare', value: trip.fareLabel ?? `$${trip.fareUsd.toFixed(2)}` },
                { label: 'Payment', value: trip.paymentLabel ?? 'Card' },
              ] as { label: string; value: string }[]).map((row, i, arr) => (
                <React.Fragment key={row.label}>
                  <View style={receiptStyles.receiptRow}>
                    <Text style={[receiptStyles.receiptLabel, { color: ui.textMuted }]}>{row.label}</Text>
                    <Text style={[receiptStyles.receiptValue, { color: ui.text }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 ? <View style={[receiptStyles.receiptDivider, { backgroundColor: ui.divider }]} /> : null}
                </React.Fragment>
              ))}
            </View>
            <Pressable
              style={receiptStyles.shareBtn}
              onPress={async () => {
                const msg = `Ridr Trip Receipt\n\nDriver: ${name} (${trip.plate})\nFrom: ${trip.fromLabel || 'Pickup'}\nTo: ${trip.toLabel || 'Dropoff'}\nFare: ${trip.fareLabel ?? `$${trip.fareUsd.toFixed(2)}`}`;
                try { await Share.share({ message: msg }); } catch { /* cancelled */ }
              }}
            >
              <Ionicons name="share-outline" size={18} color="#171717" />
              <Text style={receiptStyles.shareBtnText}>Share Receipt</Text>
            </Pressable>
            <Pressable style={receiptStyles.closeBtn} onPress={() => setShowReceipt(false)}>
              <Text style={[receiptStyles.closeBtnText, { color: ui.textMuted }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Driver chat modal ── */}
      <Modal
        visible={showDriverChat}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowDriverChat(false)}
      >
        <View style={chatStyles.overlay}>
          <View style={[chatStyles.sheet, { backgroundColor: ui.cardBg }]}>
            {/* Header */}
            <View style={[chatStyles.header, { backgroundColor: ui.cardBg, borderBottomColor: ui.divider }]}>
              <Pressable style={chatStyles.headerSide} onPress={() => setShowDriverChat(false)} hitSlop={8}>
                <Ionicons name="arrow-back" size={24} color={ui.text} />
              </Pressable>
              <Text style={[chatStyles.headerTitle, { color: ui.text }]}>Chat</Text>
              <View style={chatStyles.headerSide} />
            </View>

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {/* Messages */}
              <ScrollView
                ref={driverChatScrollRef}
                style={chatStyles.messageList}
                contentContainerStyle={chatStyles.messageListContent}
                onContentSizeChange={() => driverChatScrollRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
              >
              {driverChatMessages.length === 0 ? (
                <Text style={[chatStyles.emptyText, { color: ui.textMuted }]}>
                  No messages yet. Say hello!
                </Text>
              ) : (
                driverChatMessages.map((msg) => (
                  <View key={msg.id} style={[chatStyles.messageRow, msg.sender === 'me' ? chatStyles.messageRowMe : chatStyles.messageRowThem]}>
                    <Text style={[chatStyles.senderLabel, { color: ui.textMuted }]}>
                      {msg.sender === 'me' ? 'You' : name}
                    </Text>
                    <Text style={[chatStyles.messageText, { color: ui.text }]}>
                      {msg.text}
                    </Text>
                  </View>
                ))
              )}
              </ScrollView>

              {/* Input */}
              <View style={[chatStyles.inputRow, { borderTopColor: ui.divider, backgroundColor: ui.cardBg }]}>
              <TextInput
                style={[chatStyles.textInput, { backgroundColor: ui.divider, color: ui.text }]}
                placeholder="Message…"
                placeholderTextColor={ui.textMuted}
                value={driverChatInput}
                onChangeText={setDriverChatInput}
                returnKeyType="send"
                onSubmitEditing={() => {
                  const text = driverChatInput.trim();
                  if (!text) return;
                  const myMsg: ChatMessage = { id: String(Date.now()), text, sender: 'me', ts: Date.now() };
                  setDriverChatMessages((prev) => [...prev, myMsg]);
                  setDriverChatInput('');
                  setTimeout(() => {
                    const reply = DRIVER_AUTO_REPLIES[Math.floor(Math.random() * DRIVER_AUTO_REPLIES.length)];
                    setDriverChatMessages((prev) => [...prev, { id: String(Date.now() + 1), text: reply, sender: 'them', ts: Date.now() }]);
                  }, 1200);
                }}
              />
              <Pressable
                style={[chatStyles.sendBtn, { opacity: driverChatInput.trim() ? 1 : 0.4 }]}
                disabled={!driverChatInput.trim()}
                onPress={() => {
                  const text = driverChatInput.trim();
                  if (!text) return;
                  const myMsg: ChatMessage = { id: String(Date.now()), text, sender: 'me', ts: Date.now() };
                  setDriverChatMessages((prev) => [...prev, myMsg]);
                  setDriverChatInput('');
                  setTimeout(() => {
                    const reply = DRIVER_AUTO_REPLIES[Math.floor(Math.random() * DRIVER_AUTO_REPLIES.length)];
                    setDriverChatMessages((prev) => [...prev, { id: String(Date.now() + 1), text: reply, sender: 'them', ts: Date.now() }]);
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

const shadowLift = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.22,
  shadowRadius: 22,
  elevation: 16,
} as const;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.35,
  },

  // Black arrival bar
  arrivalBar: {
    ...shadowLift,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 10,
  },
  arrivalBarText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  arrivalBarPill: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  arrivalBarPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Surface
  surfaceShadow: {
    ...shadowLift,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  surface: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },

  // Vehicle
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vehicleLeft: {
    flex: 1,
    gap: 4,
    paddingLeft: 28,
  },
  plateNumber: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  vehicleSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  vehicleRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
  },
  carImg: {
    width: 120,
    height: 64,
  },
  sizePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sizePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Driver
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  ratingOverlay: {
    position: 'absolute',
    left: 0,
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  ratingOverlayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#171717',
  },
  driverMeta: {
    flex: 1,
    gap: 3,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  driverSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 10,
    flexShrink: 0,
  },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Route
  routeWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  routeTimeline: {
    width: 16,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  routeDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    flex: 1,
    width: 2,
    minHeight: 16,
    marginVertical: 4,
    borderRadius: 1,
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeTexts: {
    flex: 1,
    gap: 0,
  },
  routeItem: {
    paddingVertical: 6,
  },
  routeMidDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  cancelRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cancelRideBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  safetyRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  safetyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  safetyBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

const cancelStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  optionList: {
    maxHeight: 340,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  optionLeft: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 12,
    fontWeight: '400',
  },
  optionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  feeTag: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD000',
  },
  confirmBtn: {
    marginTop: 16,
    backgroundColor: '#ef4444',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  dismissBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

const chatStyles = StyleSheet.create({
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

const receiptStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
    marginBottom: 20,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '500', marginBottom: 20, textAlign: 'center' },
  receiptCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    overflow: 'hidden',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  receiptLabel: { fontSize: 13, fontWeight: '500' },
  receiptValue: { fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  receiptDivider: { height: StyleSheet.hairlineWidth },
  shareBtn: {
    width: '100%',
    backgroundColor: '#FFD000',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  shareBtnText: { fontSize: 15, fontWeight: '800', color: '#171717' },
  closeBtn: { paddingVertical: 10, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
});
