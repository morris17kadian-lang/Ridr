import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';

import { hapticLight, hapticMedium } from '../../../../lib/haptics';
import type { MainScreenUi } from '../../mainScreenUi';
import { styles } from '../../styles/mainScreenStyles';
import { AddCardModal } from '../../profile/AddCardModal';
import { EditCardExpiryModal } from '../../profile/EditCardExpiryModal';
import type { ProfileCard } from '../../profile/profileTypes';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  cards: ProfileCard[];
  defaultCard: string | null;
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
  onPaymentMethodLongPress: (card: ProfileCard) => void;
  editExpiryVisible: boolean;
  editExpiryLast4: string;
  editExpiryMonth: string;
  setEditExpiryMonth: (v: string) => void;
  editExpiryYear: string;
  setEditExpiryYear: (v: string) => void;
  closeEditCardExpiry: () => void;
  saveEditCardExpiry: () => Promise<void>;
};

export function SettingsPaymentScreen({
  ui,
  isDark,
  onBack,
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
  onPaymentMethodLongPress,
  editExpiryVisible,
  editExpiryLast4,
  editExpiryMonth,
  setEditExpiryMonth,
  editExpiryYear,
  setEditExpiryYear,
  closeEditCardExpiry,
  saveEditCardExpiry,
}: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.screenBg, borderBottomColor: ui.divider }]}>
        <Pressable
          style={styles.editProfileHeaderSide}
          onPress={() => {
            hapticLight();
            onBack();
          }}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Payment methods</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>

      <ScrollView
        style={styles.editProfileScroll}
        contentContainerStyle={styles.profileViewScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 14, lineHeight: 20, color: ui.textMuted, marginBottom: 10, marginTop: 4 }}>
          Saved cards are charged when you pay with card. Tap a card to set default.
        </Text>

        <View style={styles.profilePaymentSectionHeader}>
          <Text
            style={[styles.profileViewSectionTitle, styles.profileViewSectionTitleFlex, { color: ui.text }]}
            numberOfLines={1}
          >
            Your cards
          </Text>
          <Pressable
            style={[styles.profileAddCardIconBtn, { backgroundColor: ui.softBg, borderColor: ui.divider }]}
            onPress={() => {
              hapticMedium();
              setNewCardNumber('');
              setNewCardName('');
              setNewCardExpiry('');
              setNewCardCvv('');
              setAddCardVisible(true);
            }}
            hitSlop={8}
            accessibilityLabel="Add card"
          >
            <Ionicons name="add" size={24} color={ui.text} />
          </Pressable>
        </View>
        <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          {cards.length === 0 ? (
            <Text style={[styles.profileViewValue, { color: ui.textMuted, paddingVertical: 14, paddingHorizontal: 4 }]}>
              No saved cards yet. Tap + to add a card with the same secure flow as on your profile.
            </Text>
          ) : (
            <Text style={[styles.profileViewValue, { color: ui.textMuted, paddingBottom: 10, paddingHorizontal: 4, fontSize: 13 }]}>
              Tap a card to set default. Long press for update or delete.
            </Text>
          )}
          {cards.map((card, i) => (
            <View key={card.id}>
              <Pressable
                style={styles.profilePaymentRow}
                onPress={() => selectDefaultCard(card.id)}
                onLongPress={() => onPaymentMethodLongPress(card)}
                delayLongPress={450}
                accessibilityHint="Long press for more options"
              >
                <View
                  style={[styles.profilePaymentCardIcon, card.type === 'visa' ? styles.profilePaymentVisa : styles.profilePaymentMc]}
                >
                  <Text style={styles.profilePaymentCardIconText}>{card.type === 'visa' ? 'VISA' : 'MC'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.profilePaymentLabel, { color: ui.text }]} numberOfLines={1}>
                    {card.label}
                  </Text>
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
      </ScrollView>

      <AddCardModal
        ui={ui}
        isDark={isDark}
        visible={addCardVisible}
        onClose={closeAddCardSheet}
        newCardNumber={newCardNumber}
        setNewCardNumber={setNewCardNumber}
        newCardName={newCardName}
        setNewCardName={setNewCardName}
        newCardExpiry={newCardExpiry}
        setNewCardExpiry={setNewCardExpiry}
        newCardCvv={newCardCvv}
        setNewCardCvv={setNewCardCvv}
        onSave={saveNewCard}
      />
      <EditCardExpiryModal
        ui={ui}
        isDark={isDark}
        visible={editExpiryVisible}
        last4={editExpiryLast4}
        expiryMonth={editExpiryMonth}
        setExpiryMonth={setEditExpiryMonth}
        expiryYear={editExpiryYear}
        setExpiryYear={setEditExpiryYear}
        onClose={closeEditCardExpiry}
        onSave={saveEditCardExpiry}
      />
    </View>
  );
}
