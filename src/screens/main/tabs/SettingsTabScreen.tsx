import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeOverride } from '../../../theme/ThemeProvider';
import { mainTabStyles as styles } from '../styles/mainTabStyles';
import type { TabUi } from './ActivityTabScreen';

type SettingsScreen =
  | 'settingsPassword'
  | 'settingsNotifications'
  | 'settingsLanguage'
  | 'settingsAppearance'
  | 'settingsHelp'
  | 'settingsSupport'
  | 'settingsTerms';

type Props = {
  ui: TabUi;
  openProfile: () => void;
  setScreen: (s: SettingsScreen) => void;
  selectedLang: string;
  themeOverride: ThemeOverride;
  refreshing: boolean;
  onRefresh: () => void;
  onClearCache: () => void;
};

export function SettingsTabScreen({
  ui,
  openProfile,
  setScreen,
  selectedLang,
  themeOverride,
  refreshing,
  onRefresh,
  onClearCache,
}: Props) {
  return (
    <View style={[styles.tabScreen, { backgroundColor: ui.screenBg }]}>
      <View style={[styles.tabScreenHeader, { backgroundColor: ui.panelBg, borderBottomColor: ui.divider }]}>
        <Text style={[styles.tabScreenTitle, { color: ui.text }]}>Settings</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.tabScreenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ui.textMuted}
            colors={['#171717']}
          />
        }
      >
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Account</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <Pressable style={styles.settingsRow} onPress={openProfile}>
            <Ionicons name="person-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsPassword')}>
            <Ionicons name="lock-closed-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsNotifications')}>
            <Ionicons name="notifications-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Notifications</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Preferences</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <Pressable style={styles.settingsRow} onPress={openProfile}>
            <Ionicons name="card-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Payment Methods</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsLanguage')}>
            <Ionicons name="language-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Language</Text>
            <View style={styles.settingsRowRight}>
              <Text style={[styles.settingsRowValue, { color: ui.textMuted }]}>{selectedLang}</Text>
              <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
            </View>
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsAppearance')}>
            <Ionicons name="color-palette-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Appearance</Text>
            <View style={styles.settingsRowRight}>
              <Text style={[styles.settingsRowValue, { color: ui.textMuted }]}>
                {themeOverride === 'system' ? 'System' : themeOverride === 'light' ? 'Light' : 'Dark'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
            </View>
          </Pressable>
        </View>

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Data</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <Pressable style={styles.settingsRow} onPress={onClearCache}>
            <Ionicons name="trash-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Clear cache</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.tabSectionLabel, { color: ui.textMuted }]}>Support</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsHelp')}>
            <Ionicons name="help-circle-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Help Centre</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsSupport')}>
            <Ionicons name="headset-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
          <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} />
          <Pressable style={styles.settingsRow} onPress={() => setScreen('settingsTerms')}>
            <Ionicons name="document-text-outline" size={20} color={ui.text} />
            <Text style={[styles.settingsRowLabel, { color: ui.text }]}>Terms & Privacy</Text>
            <Ionicons name="chevron-forward" size={16} color={ui.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
