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
import type { ResetPasswordProps } from '../../navigation/types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useAuthStyles } from './authStyles';

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordProps) {
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();
  const emailFromRoute = route.params?.email ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!password || password !== confirm) {
      Alert.alert('Reset password', 'Passwords must match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Reset password', 'Use at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      /* Wire to Firebase confirmPasswordReset when available */
      await new Promise((r) => setTimeout(r, 400));
      Alert.alert('Password updated', 'You can sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('SignIn') },
      ]);
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
        <Text style={authStyles.headerTitle}>New password</Text>
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
          {emailFromRoute ? (
            <Text style={authStyles.subtitle}>Resetting password for {emailFromRoute}</Text>
          ) : (
            <Text style={authStyles.subtitle}>
              Enter a new password for your account. If you used a reset link from email, you can set
              it here (demo flow).
            </Text>
          )}

          <Text style={authStyles.label}>New password</Text>
          <TextInput
            style={authStyles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry
          />

          <Text style={authStyles.label}>Confirm new password</Text>
          <TextInput
            style={authStyles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry
          />

          <Pressable
            style={authStyles.primaryBtn}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={authStyles.primaryBtnText}>Update password</Text>
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
