import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import type { ThemeOverride } from '../../../../theme/ThemeProvider';
import type { MainScreenUi } from '../../mainScreenUi';
import { styles } from '../../styles/mainScreenStyles';

const OPTIONS: Array<{ label: string; value: ThemeOverride; icon: string }> = [
  { label: 'System default', value: 'system', icon: 'phone-portrait-outline' },
  { label: 'Light', value: 'light', icon: 'sunny-outline' },
  { label: 'Dark', value: 'dark', icon: 'moon-outline' },
];

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  themeOverride: ThemeOverride;
  setThemeOverride: (o: ThemeOverride) => void;
};

export function SettingsAppearanceScreen({
  ui,
  isDark,
  onBack,
  themeOverride,
  setThemeOverride,
}: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Appearance</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.tabSectionLabel, { color: ui.textMuted, marginTop: 20 }]}>Theme</Text>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider }]}>
          {OPTIONS.map((opt, i) => (
            <View key={opt.value}>
              <Pressable
                style={[styles.settingsRow, { paddingVertical: 16 }]}
                onPress={() => setThemeOverride(opt.value)}
              >
                <Ionicons name={opt.icon as never} size={20} color={ui.text} />
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>{opt.label}</Text>
                {themeOverride === opt.value
                  ? <Ionicons name="checkmark-circle" size={22} color={ui.ctaBg} />
                  : <Ionicons name="ellipse-outline" size={22} color={ui.textMuted} />}
              </Pressable>
              {i < OPTIONS.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
