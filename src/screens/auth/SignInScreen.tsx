import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import type { AuthEntryProps } from '../../navigation/types';
import { authStyles } from './authStyles';
import { AuthModeToggle } from './components/AuthModeToggle';
import { AuthPasswordField } from './components/AuthPasswordField';
import { AuthTextField } from './components/AuthTextField';

type AuthMode = 'login' | 'signup';

export default function SignInScreen({ navigation, route }: AuthEntryProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(route.name === 'SignUp' ? 'signup' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(route.name === 'SignUp' ? 'signup' : 'login');
  }, [route.name]);

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Sign in to continue with Ridr.'
        : 'Create your account to book rides and manage trips.',
    [mode]
  );

  const onSubmit = async () => {
    if (mode === 'login') {
      if (!email.trim() || !password) {
        Alert.alert('Sign in', 'Enter email and password.');
        return;
      }
      setSubmitting(true);
      try {
        await signIn(email.trim(), password);
      } catch (e) {
        Alert.alert('Sign in', e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const f = firstName.trim();
    const l = lastName.trim();
    const p = phone.trim();
    if (!f || !l) {
      Alert.alert('Sign up', 'Enter your first and last name.');
      return;
    }
    if (!p) {
      Alert.alert('Sign up', 'Enter your phone number.');
      return;
    }
    const phoneParsed = parsePhoneNumberFromString(p, 'US') ?? parsePhoneNumberFromString(p);
    if (!phoneParsed || !isValidPhoneNumber(phoneParsed.number)) {
      Alert.alert('Sign up', 'Enter a valid phone number. Include country code (e.g. +1 555 123 4567).');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Sign up', 'Enter your email address.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Sign up', 'Use at least 6 characters for your password.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        firstName: f,
        lastName: l,
        phone: phoneParsed.number,
      });
    } catch (e) {
      Alert.alert('Sign up', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={authStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={authStyles.welcomeTitle}>Welcome</Text>
          <Text style={authStyles.welcomeSubtitle}>{subtitle}</Text>

          <AuthModeToggle
            mode={mode}
            onLoginPress={() => setMode('login')}
            onSignUpPress={() => setMode('signup')}
          />

          {mode === 'signup' ? (
            <>
              <View style={authStyles.nameRow}>
                <View style={authStyles.nameRowHalf}>
                  <AuthTextField
                    label="First name"
                    icon="person-outline"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Alex"
                    autoComplete="given-name"
                    textContentType="givenName"
                    blockStyle={authStyles.fieldBlockInRow}
                  />
                </View>
                <View style={[authStyles.nameRowHalf, authStyles.nameRowHalfLast]}>
                  <AuthTextField
                    label="Last name"
                    icon="person-outline"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Rivera"
                    autoComplete="family-name"
                    textContentType="familyName"
                    blockStyle={authStyles.fieldBlockInRow}
                  />
                </View>
              </View>

              <AuthTextField
                label="Phone number"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
            </>
          ) : null}

          <AuthTextField
            label="Email address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />

          <AuthPasswordField
            label={mode === 'login' ? 'Password' : 'Create password'}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'}
            autoComplete={mode === 'login' ? 'password' : 'password-new'}
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
          />

          {mode === 'login' ? (
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={authStyles.forgotRow}
              hitSlop={8}
            >
              <Text style={authStyles.forgotText}>Forgot password?</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={authStyles.primaryBtn}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={authStyles.primaryBtnText}>{mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
            )}
          </Pressable>

          <Text style={authStyles.socialDivider}>or continue with</Text>

          <Pressable style={[authStyles.socialBtn, authStyles.socialBtnDisabled]} disabled>
            <Ionicons name="logo-google" size={18} color="#9c9c9c" />
            <Text style={authStyles.socialBtnTextDisabled}>Continue with Google (soon)</Text>
          </Pressable>

          {Platform.OS === 'ios' ? (
            <Pressable style={[authStyles.socialBtn, authStyles.socialBtnDisabled]} disabled>
              <Ionicons name="logo-apple" size={19} color="#9c9c9c" />
              <Text style={authStyles.socialBtnTextDisabled}>Continue with Apple (soon)</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
