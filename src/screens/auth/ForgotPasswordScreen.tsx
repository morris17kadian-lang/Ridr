import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import type { ForgotPasswordProps } from '../../navigation/types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useAuthStyles } from './authStyles';

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordProps) {
  const { markPasswordResetSent } = useAuth();
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Forgot password', 'Enter the email for your account.');
      return;
    }
    setSubmitting(true);
    try {
      await markPasswordResetSent(trimmed);
      Alert.alert(
        'Check your email',
        `If an account exists for ${trimmed}, we sent instructions to reset your password.`,
        [{ text: 'OK', onPress: () => navigation.replace('ResetPassword', { email: trimmed }) }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.root} edges={['top', 'bottom']}>
      <View style={authStyles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={authStyles.headerTitle}>Forgot password</Text>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={authStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={authStyles.subtitle}>
            Enter your email and we&apos;ll send you a link to reset your password.
          </Text>

          <Text style={authStyles.label}>Email</Text>
          <TextInput
            style={authStyles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            style={authStyles.primaryBtn}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={authStyles.primaryBtnText}>Send reset link</Text>
            )}
          </Pressable>

          <View style={authStyles.linkRow}>
            <Pressable onPress={() => navigation.navigate('SignIn')}>
              <Text style={authStyles.linkText}>
                <Text style={authStyles.linkAccent}>Back to sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
