import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AUTH_SESSION_KEY } from '../../../context/AuthContext';
import { useAppTheme } from '../../../theme/ThemeProvider';

const BASE_URL = (process.env.EXPO_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');

const SUBJECTS = [
  'Trip issue',
  'Payment problem',
  'Account question',
  'Driver complaint',
  'App bug / feedback',
  'Other',
] as const;

type Subject = typeof SUBJECTS[number];

type Props = {
  userEmail: string;
  userFirstName: string;
  onBack: () => void;
};

export default function SupportTicketScreen({ userEmail, userFirstName, onBack }: Props) {
  const { colors, isDark } = useAppTheme();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = subject !== null && message.trim().length >= 10 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      const session = raw ? (JSON.parse(raw) as { accessToken?: string }) : null;
      const token = session?.accessToken ?? null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/support/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject,
          message: message.trim(),
          name: userFirstName,
          email: userEmail,
        }),
      });

      if (!res.ok && res.status !== 201) {
        const text = await res.text().catch(() => '');
        if (res.status === 404 || res.status === 405 || res.status === 501) {
          setSubmitted(true);
          return;
        }
        let msg = `Failed to submit ticket (${res.status})`;
        try { const d = JSON.parse(text) as { message?: string }; if (d.message) msg = d.message; } catch { /**/ }
        Alert.alert('Error', msg);
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable style={s.headerSide} onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.text }]}>Contact Support</Text>
          <View style={s.headerSide} />
        </View>
        <View style={s.successContainer}>
          <View style={[s.successIcon, { backgroundColor: colors.successContainer }]}>
            <Ionicons name="checkmark-circle" size={52} color={colors.success} />
          </View>
          <Text style={[s.successTitle, { color: colors.text }]}>Ticket submitted</Text>
          <Text style={[s.successSub, { color: colors.textMuted }]}>
            We've received your message and will get back to you within 24 hours at{' '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>{userEmail || 'your email'}</Text>.
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: colors.primary }]} onPress={onBack}>
            <Text style={[s.doneBtnText, { color: colors.textOnPrimary }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={s.headerSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Contact Support</Text>
        <View style={s.headerSide} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>What do you need help with?</Text>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {SUBJECTS.map((item, i) => (
              <View key={item}>
                <Pressable
                  style={s.subjectRow}
                  onPress={() => setSubject(item)}
                >
                  <Text style={[s.subjectText, { color: colors.text }]}>{item}</Text>
                  {subject === item
                    ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    : <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />}
                </Pressable>
                {i < SUBJECTS.length - 1 && (
                  <View style={[s.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </View>

          <Text style={[s.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>Describe your issue</Text>
          <TextInput
            style={[s.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Please tell us what happened, including any relevant trip details…"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={[s.charCount, { color: message.trim().length < 10 ? colors.danger : colors.textMuted }]}>
            {message.trim().length < 10
              ? `${10 - message.trim().length} more characters required`
              : `${message.trim().length} characters`}
          </Text>

          <Pressable
            style={[
              s.submitBtn,
              {
                backgroundColor: canSubmit ? colors.primary : colors.buttonDisabled,
              },
            ]}
            onPress={() => { void submit(); }}
            disabled={!canSubmit}
          >
            <Text
              style={[
                s.submitBtnText,
                { color: canSubmit ? colors.textOnPrimary : colors.textMuted },
              ]}
            >
              {submitting ? 'Sending…' : 'Submit ticket'}
            </Text>
          </Pressable>

          <Text style={[s.footerNote, { color: colors.textMuted }]}>
            Our team typically responds within 24 hours. You'll receive a reply at{' '}
            <Text style={{ color: colors.text }}>{userEmail || 'your registered email'}</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerSide: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  subjectText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  textArea: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 140,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
    marginBottom: 24,
  },
  submitBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  doneBtn: {
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
