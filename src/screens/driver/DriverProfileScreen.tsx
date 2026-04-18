import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { formatE164International } from '../../lib/phone';
import type { MainScreenUi } from '../main/mainScreenUi';
import { styles } from '../main/styles/mainScreenStyles';
import { AddPayoutModal, type PayoutAccount } from './AddPayoutModal';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  onEdit: () => void;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  userPhoneE164: string | null;
  payoutAccounts: PayoutAccount[];
  addPayoutVisible: boolean;
  setAddPayoutVisible: (v: boolean) => void;
  onAddPayoutSave: (account: Omit<PayoutAccount, 'id'>) => void;
  onPayoutLongPress: (account: PayoutAccount) => void;
  onConfirmSignOut: () => void;
};

export function DriverProfileScreen({
  ui,
  isDark,
  onBack,
  onEdit,
  userFirstName,
  userLastName,
  userEmail,
  userPhoneE164,
  payoutAccounts,
  addPayoutVisible,
  setAddPayoutVisible,
  onAddPayoutSave,
  onPayoutLongPress,
  onConfirmSignOut,
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
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Profile</Text>
        <Pressable
          style={styles.editProfileHeaderSide}
          onPress={() => {
            hapticLight();
            onEdit();
          }}
          hitSlop={8}
        >
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

        {/* Personal information */}
        <View style={styles.profileViewSectionHeadingWrap}>
          <Text style={[styles.profileViewSectionTitle, { color: ui.text }]}>Personal information</Text>
        </View>
        <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
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

        {/* Payout methods */}
        <View style={styles.profilePaymentSectionHeader}>
          <Text
            style={[styles.profileViewSectionTitle, styles.profileViewSectionTitleFlex, { color: ui.text }]}
            numberOfLines={1}
          >
            Payout methods
          </Text>
          <Pressable
            style={[
              styles.profileAddCardIconBtn,
              { backgroundColor: ui.softBg, borderColor: ui.divider },
            ]}
            onPress={() => {
              hapticMedium();
              setAddPayoutVisible(true);
            }}
            hitSlop={8}
            accessibilityLabel="Link payout account"
          >
            <Ionicons name="add" size={24} color={ui.text} />
          </Pressable>
        </View>
        <View style={[styles.profileViewCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          {payoutAccounts.length === 0 ? (
            <View style={{ paddingVertical: 16, paddingHorizontal: 4, gap: 6 }}>
              <Text style={[styles.profileViewValue, { color: ui.textMuted, textAlign: 'left' }]}>
                No payout method linked.
              </Text>
              <Text style={[styles.profileViewValue, { color: ui.textMuted, fontSize: 13, textAlign: 'left', lineHeight: 18 }]}>
                Tap + to link a bank account or card. Earnings are sent to your payout method, minus a 1% app fee.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.profileViewValue, { color: ui.textMuted, paddingBottom: 10, paddingHorizontal: 4, fontSize: 13, textAlign: 'left' }]}>
                Long press to remove a payout method.
              </Text>
              {payoutAccounts.map((account, i) => (
                <View key={account.id}>
                  <Pressable
                    style={styles.profilePaymentRow}
                    onLongPress={() => onPayoutLongPress(account)}
                    delayLongPress={450}
                    accessibilityHint="Long press to remove"
                  >
                    <View style={[
                      styles.profilePaymentCardIcon,
                      account.type === 'bank'
                        ? { backgroundColor: '#1a5276' }
                        : account.last4 && (account.label.toLowerCase().includes('visa') ? styles.profilePaymentVisa : styles.profilePaymentMc),
                    ]}>
                      <Text style={styles.profilePaymentCardIconText}>
                        {account.type === 'bank' ? 'BANK' : (account.label.toLowerCase().includes('visa') ? 'VISA' : 'MC')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.profilePaymentLabel, { color: ui.text }]} numberOfLines={1}>
                        {account.label}
                      </Text>
                      <Text style={[styles.profilePaymentSub, { color: ui.textMuted }]}>
                        {account.type === 'bank' ? `Account •••• ${account.last4}` : `•••• ${account.last4}`}
                      </Text>
                    </View>
                    <View style={[styles.profilePaymentDefaultBadge, { backgroundColor: '#166534' }]}>
                      <Text style={[styles.profilePaymentDefaultText, { color: '#bbf7d0' }]}>Payout</Text>
                    </View>
                  </Pressable>
                  {i < payoutAccounts.length - 1 && (
                    <View style={[styles.profileViewDivider, { backgroundColor: ui.divider }]} />
                  )}
                </View>
              ))}
            </>
          )}
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

      <AddPayoutModal
        ui={ui}
        isDark={isDark}
        visible={addPayoutVisible}
        onClose={() => setAddPayoutVisible(false)}
        onSave={onAddPayoutSave}
      />
    </View>
  );
}
