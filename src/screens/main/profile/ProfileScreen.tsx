import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatE164International } from '../../../lib/phone';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';
import type { ProfileCard } from './profileTypes';

// ── Live card preview ────────────────────────────────────────────────────────
function CardPreview({ number, name, expiry }: { number: string; name: string; expiry: string }) {
  const cleanNum = number.replace(/\D/g, '');
  const isVisa = cleanNum.startsWith('4');
  const isMc = cleanNum.startsWith('5') || cleanNum.startsWith('2');

  const displayNum = [0, 1, 2, 3]
    .map((i) => cleanNum.slice(i * 4, i * 4 + 4).padEnd(4, '•'))
    .join('   ');

  const displayName = name.trim() ? name.toUpperCase() : 'FULL NAME';
  const displayExpiry = expiry.trim() || 'MM/YY';

  return (
    <LinearGradient
      colors={['#7C3AED', '#4338CA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardPreviewStyles.card}
    >
      <View style={cardPreviewStyles.topRow}>
        <Text style={cardPreviewStyles.bankLabel}>Ridr Pay</Text>
        {isMc ? (
          <View style={cardPreviewStyles.mcWrap}>
            <View style={[cardPreviewStyles.mcCircle, { backgroundColor: '#EB001B' }]} />
            <View style={[cardPreviewStyles.mcCircle, { backgroundColor: '#F79E1B', marginLeft: -12 }]} />
          </View>
        ) : isVisa ? (
          <Text style={cardPreviewStyles.visaText}>VISA</Text>
        ) : (
          <Ionicons name="card-outline" size={26} color="rgba(255,255,255,0.7)" />
        )}
      </View>
      <Text style={cardPreviewStyles.cardNumber}>{displayNum}</Text>
      <View style={cardPreviewStyles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={cardPreviewStyles.metaLabel}>CARDHOLDER</Text>
          <Text style={cardPreviewStyles.metaValue} numberOfLines={1}>{displayName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={cardPreviewStyles.metaLabel}>EXPIRES</Text>
          <Text style={cardPreviewStyles.metaValue}>{displayExpiry}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const cardPreviewStyles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 20,
    padding: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginBottom: 6,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  mcWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.92,
  },
  visaText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  cardNumber: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  metaValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

const addCardModalStyles = StyleSheet.create({
  centeredWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
  },
});

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  onEdit: () => void;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  userPhoneE164: string | null;
  cards: ProfileCard[];
  defaultCard: string | null;
  /** Sets default payment method on the server (PowerTranz vault id). */
  selectDefaultCard: (id: string) => void;
  addCardVisible: boolean;
  setAddCardVisible: (v: boolean) => void;
  newCardNumber: string;
  setNewCardNumber: (v: string) => void;
  newCardName: string;
  setNewCardName: (v: string) => void;
  newCardExpiry: string;
  setNewCardExpiry: (v: string) => void;
  newCardCvv: string;
  setNewCardCvv: (v: string) => void;
  closeAddCardSheet: () => void;
  saveNewCard: () => Promise<void>;
  onConfirmSignOut: () => void;
};

export function ProfileScreen({
  ui,
  isDark,
  onBack,
  onEdit,
  userFirstName,
  userLastName,
  userEmail,
  userPhoneE164,
  cards,
  defaultCard,
  selectDefaultCard,
  addCardVisible,
  setAddCardVisible,
  newCardNumber,
  setNewCardNumber,
  newCardName,
  setNewCardName,
  newCardExpiry,
  setNewCardExpiry,
  newCardCvv,
  setNewCardCvv,
  closeAddCardSheet,
  saveNewCard,
  onConfirmSignOut,
}: Props) {
  const modalShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 18,
  } as const;

  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.screenBg, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Profile</Text>
        <Pressable style={styles.editProfileHeaderSide} onPress={onEdit} hitSlop={8}>
          <Ionicons name="pencil" size={22} color={ui.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.editProfileScroll}
        contentContainerStyle={styles.profileViewScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.editProfileAvatarWrap}>
          <View style={[styles.editProfileAvatarImage, { backgroundColor: ui.softBg }]}>
            <Ionicons name="person" size={56} color={ui.textMuted} />
          </View>
        </View>

        <View style={styles.profileViewSectionHeadingWrap}>
          <Text style={[styles.profileViewSectionTitle, { color: ui.text }]}>Personal information</Text>
        </View>
        <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg }]}>
          <View style={styles.profileViewRow}>
            <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>First name</Text>
            <Text style={[styles.profileViewValue, { color: ui.text }]}>{userFirstName.trim() ? userFirstName : '—'}</Text>
          </View>
          <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
          <View style={styles.profileViewRow}>
            <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>Last name</Text>
            <Text style={[styles.profileViewValue, { color: ui.text }]}>{userLastName.trim() ? userLastName : '—'}</Text>
          </View>
          <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
          <View style={[styles.profileViewRow, styles.profileViewRowTop]}>
            <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>Email</Text>
            <Text style={[styles.profileViewValue, styles.profileViewValueMultiline, { color: ui.text }]} numberOfLines={4}>
              {userEmail.trim() ? userEmail : '—'}
            </Text>
          </View>
          <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
          <View style={[styles.profileViewRow, styles.profileViewRowTop]}>
            <Text style={[styles.profileViewLabel, { color: ui.textMuted }]}>Phone</Text>
            <Text style={[styles.profileViewValue, styles.profileViewValueMultiline, { color: ui.text }]} numberOfLines={3}>
              {userPhoneE164 ? formatE164International(userPhoneE164) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.profilePaymentSectionHeader}>
          <Text style={[styles.profileViewSectionTitle, styles.profileViewSectionTitleFlex, { color: ui.text }]}>Payment methods</Text>
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
            <Ionicons name="add" size={20} color={ui.text} />
          </Pressable>
        </View>
        <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg }]}>
          {cards.length === 0 ? (
            <Text style={[styles.profileViewValue, { color: ui.textMuted, paddingVertical: 14, paddingHorizontal: 4 }]}>
              No saved cards. Tap + to add a card. Card payments use your default card on file.
            </Text>
          ) : null}
          {cards.map((card, i) => (
            <View key={card.id}>
              <Pressable
                style={styles.profilePaymentRow}
                onPress={() => selectDefaultCard(card.id)}
              >
                <View style={[styles.profilePaymentCardIcon, card.type === 'visa' ? styles.profilePaymentVisa : styles.profilePaymentMc]}>
                  <Text style={styles.profilePaymentCardIconText}>{card.type === 'visa' ? 'VISA' : 'MC'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profilePaymentLabel, { color: ui.text }]}>{card.label}</Text>
                  <Text style={[styles.profilePaymentSub, { color: ui.textMuted }]}>•••• {card.last4}</Text>
                </View>
                {defaultCard === card.id && (
                  <View style={styles.profilePaymentDefaultBadge}>
                    <Text style={styles.profilePaymentDefaultText}>Default</Text>
                  </View>
                )}
                <Ionicons
                  name={defaultCard === card.id ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={defaultCard === card.id ? '#ffd54a' : ui.textMuted}
                />
              </Pressable>
              {i < cards.length - 1 ? <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} /> : null}
            </View>
          ))}
        </View>

        <Pressable
          style={[
            styles.signOutButton,
            { backgroundColor: isDark ? '#7f1d1d' : '#fee2e2', borderColor: isDark ? '#b91c1c' : '#ef4444' },
          ]}
          onPress={onConfirmSignOut}
        >
          <Text style={[styles.signOutButtonText, { color: isDark ? '#fecaca' : '#b91c1c' }]}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={addCardVisible} animationType="fade" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Dim backdrop */}
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={closeAddCardSheet}
          />

          {/* Centered sheet */}
          <View style={addCardModalStyles.centeredWrap} pointerEvents="box-none">
            <View
              style={[
                addCardModalStyles.sheet,
                {
                  backgroundColor: ui.cardBg,
                  borderColor: ui.divider,
                },
                modalShadow,
              ]}
            >
              <Text style={[addCardModalStyles.headerTitle, { color: ui.text }]}>Add card</Text>
              <CardPreview
                number={newCardNumber}
                name={newCardName}
                expiry={newCardExpiry}
              />
              <Text style={[styles.modalLabel, { color: ui.textMuted, marginTop: 16 }]}>Card number</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: ui.softBg, borderColor: ui.divider, color: ui.text }]}
                value={newCardNumber}
                onChangeText={setNewCardNumber}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={ui.placeholder}
                keyboardType="number-pad"
                autoComplete="cc-number"
                selectionColor={ui.ctaBg}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
              <Text style={[styles.modalLabel, { color: ui.textMuted, marginTop: 14 }]}>Name on card</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: ui.softBg, borderColor: ui.divider, color: ui.text }]}
                value={newCardName}
                onChangeText={setNewCardName}
                placeholder="As printed on card"
                placeholderTextColor={ui.placeholder}
                autoCapitalize="characters"
                selectionColor={ui.ctaBg}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
              <View style={[styles.addCardRow, { marginTop: 14 }]}>
                <View style={styles.addCardRowField}>
                  <Text style={[styles.modalLabel, { color: ui.textMuted }]}>Expiry</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: ui.softBg, borderColor: ui.divider, color: ui.text }]}
                    value={newCardExpiry}
                    onChangeText={setNewCardExpiry}
                    placeholder="MM/YY"
                    placeholderTextColor={ui.placeholder}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    selectionColor={ui.ctaBg}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                  />
                </View>
                <View style={styles.addCardRowField}>
                  <Text style={[styles.modalLabel, { color: ui.textMuted }]}>CVV</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: ui.softBg, borderColor: ui.divider, color: ui.text }]}
                    value={newCardCvv}
                    onChangeText={setNewCardCvv}
                    placeholder="•••"
                    placeholderTextColor={ui.placeholder}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    selectionColor={ui.ctaBg}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <Pressable
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: '#FFD000',
                    paddingVertical: 14,
                    alignItems: 'center',
                  }}
                  onPress={closeAddCardSheet}
                >
                  <Text style={{ color: ui.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    backgroundColor: '#FFD000',
                    paddingVertical: 14,
                    alignItems: 'center',
                  }}
                  onPress={() => { void saveNewCard(); }}
                >
                  <Text style={{ color: '#000000', fontSize: 15, fontWeight: '800' }}>Add card</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
