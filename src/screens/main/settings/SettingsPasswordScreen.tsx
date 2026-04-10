import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  onUpdated: () => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
};

export function SettingsPasswordScreen({
  ui,
  isDark,
  onBack,
  onUpdated,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
}: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Change Password</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.editProfileScroll} contentContainerStyle={styles.editProfileScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, marginTop: 20, padding: 16, gap: 12 }]}>
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>New password</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={ui.placeholder}
              secureTextEntry
              autoComplete="password-new"
            />
            <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Confirm password</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              placeholderTextColor={ui.placeholder}
              secureTextEntry
            />
          </View>
          <Pressable
            style={[styles.modalSaveBtn, { marginTop: 24, backgroundColor: ui.text }]}
            onPress={() => {
              if (!newPassword || newPassword.length < 6) { Alert.alert('Password', 'Use at least 6 characters.'); return; }
              if (newPassword !== confirmPassword) { Alert.alert('Password', 'Passwords do not match.'); return; }
              Alert.alert('Password', 'Password updated successfully.');
              setNewPassword('');
              setConfirmPassword('');
              onUpdated();
            }}
          >
            <Text style={[styles.modalSaveBtnText, { color: ui.screenBg }]}>Update Password</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
