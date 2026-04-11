import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import type { MainScreenUi } from '../../mainScreenUi';
import { styles } from '../../styles/mainScreenStyles';

const LANGS = ['English', 'Spanish', 'French', 'Patois'] as const;

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  selectedLang: string;
  onSelectLang: (lang: string) => void;
};

export function SettingsLanguageScreen({
  ui,
  isDark,
  onBack,
  selectedLang,
  onSelectLang,
}: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Language</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, marginTop: 20 }]}>
          {LANGS.map((lang, i) => (
            <View key={lang}>
              <Pressable
                style={[styles.settingsRow, { paddingVertical: 16 }]}
                onPress={() => onSelectLang(lang)}
              >
                <Text style={[styles.settingsRowLabel, { color: ui.text }]}>{lang}</Text>
                {selectedLang === lang
                  ? <Ionicons name="checkmark-circle" size={22} color={ui.ctaBg} />
                  : <Ionicons name="ellipse-outline" size={22} color={ui.textMuted} />}
              </Pressable>
              {i < LANGS.length - 1 ? <View style={[styles.tabDivider, { backgroundColor: ui.divider }]} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
