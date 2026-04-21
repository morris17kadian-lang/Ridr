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
import { resetPasswordWithToken } from '../../../api/passwordReset';
import type { ResetPasswordProps } from '../../../navigation/types';
import { useAppTheme } from '../../../theme/ThemeProvider';
import { useAuthStyles } from '../authStyles';

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordProps) {
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();
  const emailFromRoute = route.params?.email ?? '';
  const identifierFromRoute = route.params?.identifier ?? emailFromRoute;
  const resetToken = route.params?.resetToken ?? '';
  const staffCode = route.params?.staffCode ?? '';
  const isTemporaryPassword = route.params?.isTemporaryPassword === true;
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
      if (resetToken) {
        await resetPasswordWithToken(resetToken, password);
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      Alert.alert('Password updated', 'You can sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('SignIn') },
      ]);
    } catch (e) {
      Alert.alert('Reset password', e instanceof Error ? e.message : 'Could not update password.');
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
          <View style={authStyles.formCard}>
            <View style={authStyles.formCardSection}>
              {isTemporaryPassword ? (
                <Text style={authStyles.subtitle}>
                  Your temporary driver password must be changed before you can continue.
                  {staffCode ? ` Staff code: ${staffCode}.` : ''}
                </Text>
              ) : emailFromRoute ? (
                <Text style={authStyles.subtitle}>Resetting password for {emailFromRoute}</Text>
              ) : (
                <Text style={authStyles.subtitle}>
                  Enter a new password for your account. If you used a reset link from email, you can set
                  it here.
                </Text>
              )}

              {identifierFromRoute ? (
                <>
                  <Text style={authStyles.label}>{isTemporaryPassword ? 'Username' : 'Account'}</Text>
                </>
              ) : null}

            </View>
            {identifierFromRoute ? (
              <TextInput
                style={[authStyles.input, authStyles.inputCardBleed]}
                value={identifierFromRoute}
                editable={false}
                placeholderTextColor={colors.textPlaceholder}
              />
            ) : null}

            <View style={authStyles.formCardSection}>

              <Text style={authStyles.label}>New password</Text>
            </View>
            <TextInput
              style={[authStyles.input, authStyles.inputCardBleed]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textPlaceholder}
              secureTextEntry
            />

            <View style={authStyles.formCardSection}>
              <Text style={authStyles.label}>Confirm new password</Text>
            </View>
            <TextInput
              style={[authStyles.input, authStyles.inputCardBleed, authStyles.inputCardBleedLast]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              placeholderTextColor={colors.textPlaceholder}
              secureTextEntry
            />

            <View style={authStyles.formCardSection}>
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
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
