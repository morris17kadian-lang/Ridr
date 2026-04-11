import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';

import { requestPasswordReset, resetPasswordWithToken } from '../../../../api/passwordReset';
import { useAuth } from '../../../../context/AuthContext';
import type { MainScreenUi } from '../../mainScreenUi';
import { styles } from '../../styles/mainScreenStyles';

type Step = 1 | 2 | 3;

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
};

export function SettingsPasswordScreen({ ui, isDark, onBack }: Props) {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const onSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Email', 'Enter the email for your account.');
      return;
    }
    setSending(true);
    try {
      await requestPasswordReset(trimmed);
      setStep(2);
      Alert.alert(
        'Check your email',
        'We sent a verification code. Enter it below, then choose a new password.',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send code.';
      Alert.alert('Could not send email', msg);
    } finally {
      setSending(false);
    }
  };

  const onContinueFromCode = () => {
    if (!code.trim()) {
      Alert.alert('Code', 'Enter the code from your email.');
      return;
    }
    setStep(3);
  };

  const onResendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Email', 'Go back to step 1 and enter your email.');
      return;
    }
    setSending(true);
    try {
      await requestPasswordReset(trimmed);
      Alert.alert('Sent', 'We sent another code to your email.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not resend.';
      Alert.alert('Could not resend', msg);
    } finally {
      setSending(false);
    }
  };

  const onUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Password', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password', 'Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordWithToken(code.trim(), newPassword);
      await signOut();
      Alert.alert('Password updated', 'Sign in again with your new password.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not update password.';
      Alert.alert('Could not update password', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View
        style={[
          styles.editProfileHeader,
          { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider },
        ]}
      >
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Change Password</Text>
        <View style={styles.editProfileHeaderSide} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.editProfileScroll}
          contentContainerStyle={styles.editProfileScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.editProfileLabel, { color: ui.textMuted, marginTop: 12, marginBottom: 4 }]}>
            Step {step} of 3
          </Text>
          <Text style={{ color: ui.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
            {step === 1 && "We'll email you a code to confirm it's you."}
            {step === 2 && 'Enter the code from the email we sent.'}
            {step === 3 && 'Choose your new password.'}
          </Text>

          {step === 1 && (
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16, gap: 12 }]}>
              <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Email</Text>
              <TextInput
                style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={ui.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              <Pressable
                style={[styles.modalSaveBtn, { marginTop: 8, backgroundColor: ui.text }]}
                onPress={() => void onSendCode()}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={ui.screenBg} />
                ) : (
                  <Text style={[styles.modalSaveBtnText, { color: ui.screenBg }]}>Send verification code</Text>
                )}
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16, gap: 12 }]}>
              <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>Verification code</Text>
              <TextInput
                style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
                value={code}
                onChangeText={setCode}
                placeholder="Enter code from email"
                placeholderTextColor={ui.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.modalSaveBtn, { marginTop: 8, backgroundColor: ui.text }]}
                onPress={onContinueFromCode}
              >
                <Text style={[styles.modalSaveBtnText, { color: ui.screenBg }]}>Continue</Text>
              </Pressable>
              <Pressable onPress={() => void onResendCode()} disabled={sending} style={{ paddingVertical: 8 }}>
                {sending ? (
                  <ActivityIndicator color={ui.textMuted} />
                ) : (
                  <Text style={{ color: ui.text, textAlign: 'center', fontSize: 15 }}>Resend code</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setStep(1)} style={{ paddingVertical: 4 }}>
                <Text style={{ color: ui.textMuted, textAlign: 'center', fontSize: 14 }}>Change email</Text>
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <View style={[styles.tabCard, { backgroundColor: ui.cardBg, borderColor: ui.divider, padding: 16, gap: 12 }]}>
              <Text style={[styles.editProfileLabel, { color: ui.textMuted }]}>New password</Text>
              <TextInput
                style={[styles.editProfileInput, { backgroundColor: ui.softBg, color: ui.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
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
              <Pressable
                style={[styles.modalSaveBtn, { marginTop: 8, backgroundColor: ui.text }]}
                onPress={() => void onUpdatePassword()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={ui.screenBg} />
                ) : (
                  <Text style={[styles.modalSaveBtnText, { color: ui.screenBg }]}>Update password</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setStep(2)} style={{ paddingVertical: 4 }}>
                <Text style={{ color: ui.textMuted, textAlign: 'center', fontSize: 14 }}>Back to code</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
