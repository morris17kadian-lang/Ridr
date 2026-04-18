import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import type { MainScreenUi } from '../main/mainScreenUi';

export type PayoutAccount = {
  id: string;
  type: 'bank' | 'card';
  label: string;
  last4: string;
  bankName?: string;
};

type PayoutType = 'bank' | 'card';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  visible: boolean;
  onClose: () => void;
  onSave: (account: Omit<PayoutAccount, 'id'>) => void;
};

export function AddPayoutModal({ ui, isDark, visible, onClose, onSave }: Props) {
  const [payoutType, setPayoutType] = useState<PayoutType>('bank');

  // Bank fields
  const [bankName, setBankName] = useState('');
  const [holderName, setHolderName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');

  const resetFields = () => {
    setPayoutType('bank');
    setBankName('');
    setHolderName('');
    setRoutingNumber('');
    setAccountNumber('');
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const formatCardNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleSave = () => {
    if (payoutType === 'bank') {
      if (!bankName.trim()) { Alert.alert('Bank name required', 'Enter your bank name.'); return; }
      if (!holderName.trim()) { Alert.alert('Account holder required', 'Enter the account holder name.'); return; }
      if (routingNumber.replace(/\D/g, '').length < 8) { Alert.alert('Routing number', 'Enter a valid routing number.'); return; }
      if (accountNumber.replace(/\D/g, '').length < 5) { Alert.alert('Account number', 'Enter a valid account number.'); return; }
      const last4 = accountNumber.replace(/\D/g, '').slice(-4);
      onSave({ type: 'bank', bankName: bankName.trim(), label: bankName.trim(), last4 });
    } else {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12) { Alert.alert('Card number', 'Enter a valid card number.'); return; }
      if (!cardName.trim()) { Alert.alert('Name required', 'Enter the name on the card.'); return; }
      if (cardExpiry.replace(/\D/g, '').length < 4) { Alert.alert('Expiry', 'Enter a valid expiry (MM/YY).'); return; }
      const last4 = digits.slice(-4);
      const brand = digits.startsWith('4') ? 'Visa' : 'Mastercard';
      onSave({ type: 'card', label: `${brand} •••• ${last4}`, last4 });
    }
    handleClose();
  };

  const border = isDark ? 'rgba(255,255,255,0.12)' : '#e5e5e5';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5';
  const focusBorder = ui.ctaBg;

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const inputShell = (focused: boolean) => [
    s.inputShell,
    { backgroundColor: inputBg, borderColor: focused ? focusBorder : border },
    focused && s.inputShellFocused,
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.centeredWrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.sheet, { backgroundColor: ui.cardBg, borderColor: border }]}>
            {/* Header */}
            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.headerTitle, { color: ui.text }]}>Link payout method</Text>
                <Text style={[s.headerSub, { color: ui.textMuted }]}>
                  Earnings are paid to your linked account, minus a 1% app fee.
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8} style={s.closeBtn}>
                <Ionicons name="close" size={22} color={ui.textMuted} />
              </Pressable>
            </View>

            {/* Type toggle */}
            <View style={[s.toggle, { backgroundColor: ui.softBg, borderColor: border }]}>
              {(['bank', 'card'] as PayoutType[]).map((t) => (
                <Pressable
                  key={t}
                  style={[
                    s.toggleBtn,
                    payoutType === t && { backgroundColor: ui.ctaBg },
                  ]}
                  onPress={() => {
                    hapticLight();
                    setPayoutType(t);
                  }}
                >
                  <Ionicons
                    name={t === 'bank' ? 'business-outline' : 'card-outline'}
                    size={15}
                    color={payoutType === t ? ui.ctaText : ui.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[s.toggleLabel, { color: payoutType === t ? ui.ctaText : ui.textMuted }]}>
                    {t === 'bank' ? 'Bank account' : 'Card'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Bank fields */}
            {payoutType === 'bank' && (
              <>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>BANK NAME</Text>
                  <View style={inputShell(focusedField === 'bankName')}>
                    <Ionicons name="business-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, { color: ui.text }]}
                      placeholder="e.g. Chase, NCB"
                      placeholderTextColor={ui.textMuted}
                      value={bankName}
                      onChangeText={setBankName}
                      onFocus={() => setFocusedField('bankName')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                </View>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>ACCOUNT HOLDER NAME</Text>
                  <View style={inputShell(focusedField === 'holderName')}>
                    <Ionicons name="person-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, { color: ui.text }]}
                      placeholder="Full name on account"
                      placeholderTextColor={ui.textMuted}
                      value={holderName}
                      onChangeText={setHolderName}
                      onFocus={() => setFocusedField('holderName')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                </View>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>ROUTING NUMBER</Text>
                  <View style={inputShell(focusedField === 'routing')}>
                    <Ionicons name="git-branch-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, { color: ui.text }]}
                      placeholder="9-digit routing number"
                      placeholderTextColor={ui.textMuted}
                      value={routingNumber}
                      onChangeText={(v) => setRoutingNumber(v.replace(/\D/g, '').slice(0, 9))}
                      keyboardType="numeric"
                      onFocus={() => setFocusedField('routing')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                </View>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>ACCOUNT NUMBER</Text>
                  <View style={inputShell(focusedField === 'accountNum')}>
                    <Ionicons name="lock-closed-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, { color: ui.text }]}
                      placeholder="Account number"
                      placeholderTextColor={ui.textMuted}
                      value={accountNumber}
                      onChangeText={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 17))}
                      keyboardType="numeric"
                      secureTextEntry
                      onFocus={() => setFocusedField('accountNum')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </>
            )}

            {/* Card fields */}
            {payoutType === 'card' && (
              <>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>CARD NUMBER</Text>
                  <View style={inputShell(focusedField === 'cardNum')}>
                    <Ionicons name="card-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, s.monoInput, { color: ui.text }]}
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor={ui.textMuted}
                      value={cardNumber}
                      onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                      keyboardType="numeric"
                      onFocus={() => setFocusedField('cardNum')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                </View>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>NAME ON CARD</Text>
                  <View style={inputShell(focusedField === 'cardName')}>
                    <Ionicons name="person-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, { color: ui.text }]}
                      placeholder="Cardholder name"
                      placeholderTextColor={ui.textMuted}
                      value={cardName}
                      onChangeText={setCardName}
                      autoCapitalize="words"
                      onFocus={() => setFocusedField('cardName')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                    />
                  </View>
                </View>
                <View style={s.fieldBlock}>
                  <Text style={[s.label, { color: ui.textMuted }]}>EXPIRY</Text>
                  <View style={inputShell(focusedField === 'cardExpiry')}>
                    <Ionicons name="calendar-outline" size={18} color={ui.textMuted} style={s.icon} />
                    <TextInput
                      style={[s.input, s.monoInput, { color: ui.text }]}
                      placeholder="MM/YY"
                      placeholderTextColor={ui.textMuted}
                      value={cardExpiry}
                      onChangeText={(v) => setCardExpiry(formatExpiry(v))}
                      keyboardType="numeric"
                      onFocus={() => setFocusedField('cardExpiry')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </>
            )}

            {/* Save button */}
            <Pressable
              style={[s.saveBtn, { backgroundColor: ui.ctaBg }]}
              onPress={() => {
                hapticMedium();
                handleSave();
              }}
            >
              <Text style={[s.saveBtnText, { color: ui.ctaText }]}>Link account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centeredWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  sheet: {
    width: '100%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldBlock: {
    marginTop: 16,
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
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    fontWeight: '500',
  },
  monoInput: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 0.75,
  },
  saveBtn: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
