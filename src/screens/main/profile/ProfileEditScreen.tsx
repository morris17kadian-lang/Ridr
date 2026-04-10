import { Ionicons } from '@expo/vector-icons';
import React, { type Dispatch, type SetStateAction } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';
import { PROFILE_COUNTRY_CODES } from './countryCodes';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
  onSave: () => void;
  profileDirty: boolean;
  editingFirstName: string;
  setEditingFirstName: (v: string) => void;
  editingLastName: string;
  setEditingLastName: (v: string) => void;
  editingEmail: string;
  setEditingEmail: (v: string) => void;
  editingUsername: string;
  setEditingUsername: (v: string) => void;
  editingPassword: string;
  setEditingPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  editingPhone: string;
  setEditingPhone: (v: string) => void;
  countryCode: string;
  setCountryCode: (v: string) => void;
  countryPickerVisible: boolean;
  setCountryPickerVisible: (v: boolean) => void;
  addressModal: 'home' | 'work' | null;
  addressInput: string;
  setAddressInput: (v: string) => void;
  saveAddress: () => void;
  closeAddressModal: () => void;
};

export function ProfileEditScreen({
  ui,
  isDark,
  onBack,
  onSave,
  profileDirty,
  editingFirstName,
  setEditingFirstName,
  editingLastName,
  setEditingLastName,
  editingEmail,
  setEditingEmail,
  editingUsername,
  setEditingUsername,
  editingPassword,
  setEditingPassword,
  showPassword,
  setShowPassword,
  editingPhone,
  setEditingPhone,
  countryCode,
  setCountryCode,
  countryPickerVisible,
  setCountryPickerVisible,
  addressModal,
  addressInput,
  setAddressInput,
  saveAddress,
  closeAddressModal,
}: Props) {
  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.editProfileHeader, { backgroundColor: ui.screenBg, borderBottomColor: ui.divider }]}>
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Edit Profile</Text>
        <Pressable
          style={styles.editProfileHeaderSide}
          onPress={() => { void onSave(); }}
          hitSlop={8}
        >
          <Ionicons
            name="checkmark"
            size={28}
            color={profileDirty ? '#22c55e' : '#c8c8c8'}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.editProfileScroll}
        contentContainerStyle={styles.editProfileScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.editProfileAvatarWrap}>
          <View style={[styles.editProfileAvatarImage, { backgroundColor: ui.softBg }]}>
            <Ionicons name="person" size={56} color={ui.textMuted} />
          </View>
          <Pressable style={[styles.editProfileAvatarCamera, { backgroundColor: ui.cardBg }]} hitSlop={6}>
            <Ionicons name="camera" size={18} color={ui.text} />
          </Pressable>
        </View>

        <View style={styles.editProfileField}>
          <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>First name</Text>
          <TextInput
            style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
            value={editingFirstName}
            onChangeText={setEditingFirstName}
            placeholder="Charlotte"
            placeholderTextColor={ui.placeholder}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.editProfileField}>
          <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Last name</Text>
          <TextInput
            style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
            value={editingLastName}
            onChangeText={setEditingLastName}
            placeholder="King"
            placeholderTextColor={ui.placeholder}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.editProfileField}>
          <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>E mail address</Text>
          <TextInput
            style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
            value={editingEmail}
            onChangeText={setEditingEmail}
            placeholder="johnkinggraphics@gmail.com"
            placeholderTextColor={ui.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.editProfileField}>
          <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>User name</Text>
          <TextInput
            style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
            value={editingUsername}
            onChangeText={setEditingUsername}
            placeholder="@johnkinggraphics"
            placeholderTextColor={ui.placeholder}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.editProfileField}>
          <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Password</Text>
          <View style={[styles.editProfilePasswordRow, { backgroundColor: ui.softBg }]}>
            <TextInput
              style={[styles.editProfileInput, styles.editProfilePasswordInput, { backgroundColor: 'transparent', color: ui.text }]}
              value={editingPassword}
              onChangeText={setEditingPassword}
              placeholder="••••••••••"
              placeholderTextColor={ui.placeholder}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable style={styles.editProfileEyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color={ui.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.editProfileField}>
          <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Phone number</Text>
          <View style={styles.editProfilePhoneRow}>
            <Pressable style={[styles.editProfileCountryBtn, { backgroundColor: ui.softBg }]} onPress={() => setCountryPickerVisible(true)}>
              <Text style={[styles.editProfileCountryText, { color: ui.text }]}>{countryCode}</Text>
              <Ionicons name="chevron-down" size={16} color={ui.text} />
            </Pressable>
            <TextInput
              style={[styles.editProfileInput, styles.editProfilePhoneInput, { backgroundColor: ui.softBg, color: ui.text }]}
              value={editingPhone}
              onChangeText={setEditingPhone}
              placeholder="6895312"
              placeholderTextColor={ui.placeholder}
              keyboardType="phone-pad"
            />
          </View>
          <Text style={[styles.editProfileHint, { color: ui.textMuted }]}>
            Valid mobile or landline for your country. Saved as E.164. Each number can only be linked once on this device.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={countryPickerVisible} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.editProfilePickerOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCountryPickerVisible(false)} />
          <View style={[styles.editProfilePickerSheet, { backgroundColor: ui.cardBg }]}>
            <Text style={[styles.editProfilePickerTitle, { color: ui.text }]}>Country code</Text>
            {PROFILE_COUNTRY_CODES.map(({ code, label }) => (
              <Pressable
                key={code}
                style={[styles.editProfilePickerRow, { borderBottomColor: ui.divider }]}
                onPress={() => { setCountryCode(code); setCountryPickerVisible(false); }}
              >
                <Text style={[styles.editProfilePickerCode, { color: ui.text }]}>{code}</Text>
                <Text style={[styles.editProfilePickerLabel, { color: ui.textMuted }]}>{label}</Text>
                {countryCode === code ? <Ionicons name="checkmark" size={20} color="#22c55e" /> : <View style={{ width: 20 }} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={addressModal !== null} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {addressModal === 'home' ? 'Home Address' : 'Work Address'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={addressInput}
              onChangeText={setAddressInput}
              placeholder={addressModal === 'home' ? 'e.g. 12 Constant Spring Rd' : 'e.g. 6 Ocean Blvd, Kingston'}
              placeholderTextColor="#aaa"
              autoCapitalize="words"
              autoFocus
            />
            <Pressable style={styles.modalSaveBtn} onPress={saveAddress}>
              <Text style={styles.modalSaveBtnText}>Save Address</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={closeAddressModal}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
