import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
};

export function SettingsTermsScreen({ ui, isDark, onBack }: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Terms & Privacy</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <ScrollView style={styles.editProfileScroll} contentContainerStyle={[styles.editProfileScrollContent, { paddingTop: 20 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Terms of Service</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16 }]}>
          <Text style={[styles.notifRowSub, { color: ui.text, lineHeight: 22 }]}>
            {`By using Ridr, you agree to our Terms of Service. We collect location data to provide ride services and improve the app experience.\n\nRidr reserves the right to update these terms. Continued use of the app constitutes acceptance of any changes.`}
          </Text>
        </View>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Privacy Policy</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16 }]}>
          <Text style={[styles.notifRowSub, { color: ui.text, lineHeight: 22 }]}>
            {`Your personal data is never sold to third parties. You may request deletion of your data at any time by contacting support@ridr.app.`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
