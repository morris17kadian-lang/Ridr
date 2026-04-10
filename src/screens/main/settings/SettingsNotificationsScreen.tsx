import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StatusBar, Switch, Text, View } from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  notifRideUpdates: boolean;
  setNotifRideUpdates: (v: boolean) => void;
  notifDriverArrival: boolean;
  setNotifDriverArrival: (v: boolean) => void;
  notifTripReceipt: boolean;
  setNotifTripReceipt: (v: boolean) => void;
  notifPromos: boolean;
  setNotifPromos: (v: boolean) => void;
  notifNewFeatures: boolean;
  setNotifNewFeatures: (v: boolean) => void;
  notifSurveys: boolean;
  setNotifSurveys: (v: boolean) => void;
  notifSecurity: boolean;
  setNotifSecurity: (v: boolean) => void;
  notifPayments: boolean;
  setNotifPayments: (v: boolean) => void;
};

const track = (isDark: boolean, softBg: string) =>
  ({ true: isDark ? '#ffffff' : '#171717', false: softBg } as const);
const thumb = (isDark: boolean) => (isDark ? '#171717' : '#fff');

export function SettingsNotificationsScreen({
  ui,
  isDark,
  onBack,
  notifRideUpdates,
  setNotifRideUpdates,
  notifDriverArrival,
  setNotifDriverArrival,
  notifTripReceipt,
  setNotifTripReceipt,
  notifPromos,
  setNotifPromos,
  notifNewFeatures,
  setNotifNewFeatures,
  notifSurveys,
  setNotifSurveys,
  notifSecurity,
  setNotifSecurity,
  notifPayments,
  setNotifPayments,
}: Props) {
  const tc = track(isDark, ui.softBg);
  const th = thumb(isDark);
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Notifications</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Trips</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Ride updates</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Status changes & driver info</Text>
            </View>
            <Switch value={notifRideUpdates} onValueChange={setNotifRideUpdates} trackColor={tc} thumbColor={th} />
          </View>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Driver arrival</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Alert when your driver is nearby</Text>
            </View>
            <Switch value={notifDriverArrival} onValueChange={setNotifDriverArrival} trackColor={tc} thumbColor={th} />
          </View>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Trip receipts</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Email & in-app receipt after each trip</Text>
            </View>
            <Switch value={notifTripReceipt} onValueChange={setNotifTripReceipt} trackColor={tc} thumbColor={th} />
          </View>
        </View>

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Promotions</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Deals & offers</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Discounts and promo codes</Text>
            </View>
            <Switch value={notifPromos} onValueChange={setNotifPromos} trackColor={tc} thumbColor={th} />
          </View>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>New features</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Product updates and announcements</Text>
            </View>
            <Switch value={notifNewFeatures} onValueChange={setNotifNewFeatures} trackColor={tc} thumbColor={th} />
          </View>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Surveys & feedback</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Help us improve Ridr</Text>
            </View>
            <Switch value={notifSurveys} onValueChange={setNotifSurveys} trackColor={tc} thumbColor={th} />
          </View>
        </View>

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Account</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Security alerts</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Sign-ins and password changes</Text>
            </View>
            <Switch value={notifSecurity} onValueChange={setNotifSecurity} trackColor={tc} thumbColor={th} />
          </View>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifRowLabel, { color: ui.text }]}>Payment activity</Text>
              <Text style={[styles.notifRowSub, { color: ui.textMuted }]}>Charges, refunds & payment issues</Text>
            </View>
            <Switch value={notifPayments} onValueChange={setNotifPayments} trackColor={tc} thumbColor={th} />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
