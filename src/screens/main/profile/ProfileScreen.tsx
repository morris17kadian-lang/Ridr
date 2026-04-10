import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
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
import { addCardPreviewAsset } from '../../../assets/images';
import { formatE164International } from '../../../lib/phone';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';
import type { ProfileCard } from './profileTypes';

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
