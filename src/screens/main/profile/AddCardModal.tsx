import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
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

import { hapticLight, hapticMedium } from '../../../lib/haptics';
import type { MainScreenUi } from '../mainScreenUi';
import { CardPreview } from './CardPreview';
import {
  formatCardNumberInput,
  formatExpiryInput,
  MAX_CARD_NUMBER_FORMATTED_LENGTH,
} from './paymentInputFormat';

const CARD_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

const sheetStyles = StyleSheet.create({
  centeredWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    maxHeight: '92%',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldBlock: {
    marginTop: 14,
  },
  fieldBlockTight: {
    marginTop: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputShellFocused: {
    borderWidth: 2,
    paddingHorizontal: 13.5,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    fontWeight: '500',
  },
  inputCard: {
    fontFamily: CARD_FONT,
    fontSize: 17,
    letterSpacing: 0.75,
    ...(Platform.OS === 'ios' ? { fontVariant: ['tabular-nums' as const] } : {}),
  },
  inputExpiry: {
    fontFamily: CARD_FONT,
    fontSize: 17,
    letterSpacing: 1,
    textAlign: 'center',
    ...(Platform.OS === 'ios' ? { fontVariant: ['tabular-nums' as const] } : {}),
  },
  inputCvv: {
    fontFamily: CARD_FONT,
    fontSize: 17,
    letterSpacing: 2,
    textAlign: 'right',
    ...(Platform.OS === 'ios' ? { fontVariant: ['tabular-nums' as const] } : {}),
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  rowField: {
    flex: 1,
  },
  rowFieldCvv: {
    width: '38%',
    maxWidth: 140,
    flex: 0,
  },
});

const modalShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.22,
  shadowRadius: 26,
  elevation: 18,
} as const;

type FocusField = 'number' | 'name' | 'expiry' | 'cvv' | null;

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  visible: boolean;
  onClose: () => void;
  newCardNumber: string;
  setNewCardNumber: (v: string) => void;
  newCardName: string;
  setNewCardName: (v: string) => void;
  newCardExpiry: string;
  setNewCardExpiry: (v: string) => void;
  newCardCvv: string;
  setNewCardCvv: (v: string) => void;
  onSave: () => void | Promise<void>;
};

export function AddCardModal({
  ui,
  isDark,
  visible,
  onClose,
  newCardNumber,
  setNewCardNumber,
  newCardName,
  setNewCardName,
  newCardExpiry,
  setNewCardExpiry,
  newCardCvv,
  setNewCardCvv,
  onSave,
}: Props) {
  const [focus, setFocus] = useState<FocusField>(null);

  const onCardNumberChange = useCallback(
    (t: string) => setNewCardNumber(formatCardNumberInput(t)),
    [setNewCardNumber]
  );
  const onExpiryChange = useCallback(
    (t: string) => setNewCardExpiry(formatExpiryInput(t)),
    [setNewCardExpiry]
  );
  const onCvvChange = useCallback(
    (t: string) => setNewCardCvv(t.replace(/\D/g, '').slice(0, 4)),
    [setNewCardCvv]
  );

  const shell = (isFocused: boolean) => [
    sheetStyles.inputShell,
    {
      backgroundColor: ui.softBg,
      borderColor: isFocused ? ui.ctaBg : ui.divider,
    },
    isFocused && sheetStyles.inputShellFocused,
  ];

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
            <Text style={[sheetStyles.headerTitle, { color: ui.text }]}>Add card</Text>
            <Text style={[sheetStyles.headerSub, { color: ui.textMuted }]}>
              Card details are formatted as you type. Expiry uses MM/YY.
            </Text>
            <CardPreview number={newCardNumber} name={newCardName} expiry={newCardExpiry} />

            <View style={sheetStyles.fieldBlock}>
              <Text style={[sheetStyles.label, { color: ui.textMuted }]}>CARD NUMBER</Text>
              <View style={shell(focus === 'number')}>
                <Ionicons
                  name="card-outline"
                  size={22}
                  color={focus === 'number' ? ui.ctaBg : ui.textMuted}
                  style={sheetStyles.inputIcon}
                />
                <TextInput
                  style={[sheetStyles.input, sheetStyles.inputCard, { color: ui.text }]}
                  value={newCardNumber}
                  onChangeText={onCardNumberChange}
                  placeholder="4242 4242 4242 4242"
                  placeholderTextColor={ui.placeholder}
                  keyboardType="number-pad"
                  maxLength={MAX_CARD_NUMBER_FORMATTED_LENGTH}
                  autoComplete="cc-number"
                  textContentType="creditCardNumber"
                  selectionColor={ui.ctaBg}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  onFocus={() => setFocus('number')}
                  onBlur={() => setFocus((f) => (f === 'number' ? null : f))}
                />
              </View>
            </View>

            <View style={sheetStyles.fieldBlockTight}>
              <Text style={[sheetStyles.label, { color: ui.textMuted }]}>NAME ON CARD</Text>
              <View style={shell(focus === 'name')}>
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={focus === 'name' ? ui.ctaBg : ui.textMuted}
                  style={sheetStyles.inputIcon}
                />
                <TextInput
                  style={[sheetStyles.input, { color: ui.text }]}
                  value={newCardName}
                  onChangeText={setNewCardName}
                  placeholder="Name as printed on card"
                  placeholderTextColor={ui.placeholder}
                  autoCapitalize="characters"
                  autoComplete="name"
                  textContentType="name"
                  selectionColor={ui.ctaBg}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  onFocus={() => setFocus('name')}
                  onBlur={() => setFocus((f) => (f === 'name' ? null : f))}
                />
              </View>
            </View>

            <View style={sheetStyles.row}>
              <View style={sheetStyles.rowField}>
                <Text style={[sheetStyles.label, { color: ui.textMuted }]}>EXPIRES</Text>
                <View style={shell(focus === 'expiry')}>
                  <TextInput
                    style={[sheetStyles.input, sheetStyles.inputExpiry, { color: ui.text }]}
                    value={newCardExpiry}
                    onChangeText={onExpiryChange}
                    placeholder="MM/YY"
                    placeholderTextColor={ui.placeholder}
                    keyboardType="number-pad"
                    maxLength={5}
                    autoComplete="cc-exp"
                    textContentType="none"
                    selectionColor={ui.ctaBg}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    onFocus={() => setFocus('expiry')}
                    onBlur={() => setFocus((f) => (f === 'expiry' ? null : f))}
                  />
                </View>
              </View>
              <View style={[sheetStyles.rowField, sheetStyles.rowFieldCvv]}>
                <Text style={[sheetStyles.label, { color: ui.textMuted }]}>CVC</Text>
                <View style={shell(focus === 'cvv')}>
                  <TextInput
                    style={[sheetStyles.input, sheetStyles.inputCvv, { color: ui.text }]}
                    value={newCardCvv}
                    onChangeText={onCvvChange}
                    placeholder="•••"
                    placeholderTextColor={ui.placeholder}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    textContentType="none"
                    autoComplete="off"
                    selectionColor={ui.ctaBg}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    onFocus={() => setFocus('cvv')}
                    onBlur={() => setFocus((f) => (f === 'cvv' ? null : f))}
                  />
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Pressable
                style={{
                  flex: 1,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: '#FFD000',
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
                onPress={() => {
                  hapticLight();
                  onClose();
                }}
              >
                <Text style={{ color: ui.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  borderRadius: 20,
                  backgroundColor: '#FFD000',
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
                onPress={() => {
                  hapticMedium();
                  void onSave();
                }}
              >
                <Text style={{ color: '#000000', fontSize: 15, fontWeight: '800' }}>Add card</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
