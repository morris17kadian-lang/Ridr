import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';

const FAQS = [
  'How do I book a ride?',
  'How do I cancel a trip?',
  'How do I update my payment method?',
  'I have a complaint about a driver.',
] as const;

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  onContactSupport: () => void;
};

export function SettingsHelpScreen({
  ui,
  isDark,
  onBack,
  onContactSupport,
}: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Help Centre</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Frequently asked questions</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          {FAQS.map((q, i) => (
            <View key={q}>
              <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={() => Alert.alert('Help', q)}>
                <Ionicons name="chatbubble-outline" size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text, fontWeight: '500' }]}>{q}</Text>
                <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
              </Pressable>
              {i < FAQS.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
            </View>
          ))}
        </View>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Still need help?</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <Pressable style={[styles.settingsRow, { paddingVertical: 16 }]} onPress={onContactSupport}>
            <Ionicons name="headset-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
