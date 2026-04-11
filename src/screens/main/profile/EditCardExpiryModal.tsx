import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { MainScreenUi } from '../mainScreenUi';
import { styles } from '../styles/mainScreenStyles';

const sheetStyles = StyleSheet.create({
  centeredWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
});

const modalShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.22,
  shadowRadius: 26,
  elevation: 18,
} as const;

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  visible: boolean;
  last4: string;
  expiryMonth: string;
  setExpiryMonth: (v: string) => void;
  expiryYear: string;
  setExpiryYear: (v: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
};

export function EditCardExpiryModal({
  ui,
  isDark,
  visible,
  last4,
  expiryMonth,
  setExpiryMonth,
  expiryYear,
  setExpiryYear,
  onClose,
  onSave,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={onClose}
        />
        <View style={sheetStyles.centeredWrap} pointerEvents="box-none">
          <View
            style={[
              sheetStyles.sheet,
              {
                backgroundColor: ui.cardBg,
                borderColor: ui.divider,
              },
              modalShadow,
            ]}
          >
            <Text style={[sheetStyles.headerTitle, { color: ui.text }]}>Update expiry</Text>
            <Text style={[sheetStyles.sub, { color: ui.textMuted }]}>
              Card ending in {last4}. Only expiry can be updated; card number stays on file.
            </Text>
            <View style={sheetStyles.row}>
              <View style={sheetStyles.field}>
                <Text style={[styles.modalLabel, { color: ui.textMuted }]}>Month (MM)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: ui.softBg, borderColor: ui.divider, color: ui.text }]}
                  value={expiryMonth}
                  onChangeText={(t) => setExpiryMonth(t.replace(/\D/g, '').slice(0, 2))}
                  placeholder="MM"
                  placeholderTextColor={ui.placeholder}
                  keyboardType="number-pad"
                  maxLength={2}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
              </View>
              <View style={sheetStyles.field}>
                <Text style={[styles.modalLabel, { color: ui.textMuted }]}>Year (YY)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: ui.softBg, borderColor: ui.divider, color: ui.text }]}
                  value={expiryYear}
                  onChangeText={(t) => setExpiryYear(t.replace(/\D/g, '').slice(0, 2))}
                  placeholder="YY"
                  placeholderTextColor={ui.placeholder}
                  keyboardType="number-pad"
                  maxLength={2}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
              <Pressable
                style={{
                  flex: 1,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: ui.divider,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
                onPress={onClose}
              >
                <Text style={{ color: ui.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  borderRadius: 20,
                  backgroundColor: ui.ctaBg,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
                onPress={() => void onSave()}
              >
                <Text style={{ color: ui.ctaText, fontSize: 15, fontWeight: '800' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
