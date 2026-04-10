import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import type { AuthEntryProps } from '../../../navigation/types';
import { useAppTheme } from '../../../theme/ThemeProvider';
import { useAuthStyles } from '../authStyles';
import { AuthModeToggle } from '../components/AuthModeToggle';
import { AuthPasswordField } from '../components/AuthPasswordField';
import { AuthTextField } from '../components/AuthTextField';

type AuthMode = 'login' | 'signup';

export default function SignInScreen({ navigation, route }: AuthEntryProps) {
  const { signIn, signUp } = useAuth();
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();
  const [mode, setMode] = useState<AuthMode>(route.name === 'SignUp' ? 'signup' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const screenH = Dimensions.get('window').height;
  const logoSlide = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setMode(route.name === 'SignUp' ? 'signup' : 'login');
  }, [route.name]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoSlide, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(formSlide, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const logoAnimStyle = {
    transform: [
      {
        translateY: logoSlide.interpolate({
          inputRange: [0, 1],
          outputRange: [screenH * 0.3, 0],
        }),
      },
    ],
  };

  const formAnimStyle = {
    opacity: formSlide,
    transform: [
      {
        translateY: formSlide.interpolate({
          inputRange: [0, 1],
          outputRange: [70, 0],
        }),
      },
    ],
  };

  const toFriendlyError = (message: string) => {
    const m = message.trim();
    const lower = m.toLowerCase();
    if (lower.includes('missing expo_public_base_url')) {
      return 'App setup issue: base URL is missing. Please restart the app and try again.';
    }
    if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
      return 'Cannot reach the server. Check your internet and try again.';
    }
    if (lower.includes('invalid credentials') || lower.includes('unauthorized')) {
      return 'Email or password is incorrect.';
    }
    if (lower.includes('request failed (500)')) {
      return 'Server error. Please try again in a moment.';
    }
    return m || 'Something went wrong. Please try again.';
  };

  const showAuthError = (title: string, message: string) => {
    const friendly = toFriendlyError(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(friendly, ToastAndroid.LONG);
      return;
    }
    Alert.alert(title, friendly);
  };

  const onSubmit = async () => {
    if (mode === 'login') {
      if (!loginEmail.trim() || !password) {
        showAuthError('Sign in', 'Enter your email and password.');
        return;
      }
      setSubmitting(true);
      try {
        await signIn(loginEmail.trim(), password);
      } catch (e) {
        showAuthError('Sign in', e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const f = firstName.trim();
    const l = lastName.trim();
    const p = phone.trim();
    if (!f || !l) {
      showAuthError('Sign up', 'Enter your first and last name.');
      return;
    }
    if (!p) {
      showAuthError('Sign up', 'Enter your phone number.');
      return;
    }
    const phoneParsed = parsePhoneNumberFromString(p, 'US') ?? parsePhoneNumberFromString(p);
    if (!phoneParsed || !isValidPhoneNumber(phoneParsed.number)) {
      showAuthError('Sign up', 'Enter a valid phone number (for example: +1 555 123 4567).');
      return;
    }
    if (!email.trim()) {
      showAuthError('Sign up', 'Enter your email address.');
      return;
    }
    if (!password || password.length < 8) {
      showAuthError('Sign up', 'Use at least 8 characters for your password.');
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
      showAuthError('Sign up', e instanceof Error ? e.message : 'Something went wrong.');
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
          <Animated.View style={[authStyles.logoWrapper, logoAnimStyle]}>
            <Image
              source={require('../../../../assets/ridr-logo.png')}
              style={authStyles.logoImage}
            />
          </Animated.View>

          <Animated.View style={formAnimStyle}>
          <View style={authStyles.formCard}>
            <View style={authStyles.formCardSection}>
              <AuthModeToggle
                mode={mode}
                onLoginPress={() => setMode('login')}
                onSignUpPress={() => setMode('signup')}
              />
            </View>

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
                      compactLabel
                    />
                  </View>
                  <View style={authStyles.nameRowHalf}>
                    <AuthTextField
                      label="Last name"
                      icon="person-outline"
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Rivera"
                      autoComplete="family-name"
                      textContentType="familyName"
                      blockStyle={authStyles.fieldBlockInRow}
                      compactLabel
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

            {mode === 'login' ? (
              <AuthTextField
                label="Email address"
                icon="mail-outline"
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
            ) : (
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
            )}

            <AuthPasswordField
              label={mode === 'login' ? 'Password' : 'Create password'}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'}
              autoComplete={mode === 'login' ? 'password' : 'password-new'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
            />

            {mode === 'login' ? (
              <View style={authStyles.formCardSection}>
                <View style={authStyles.forgotRememberRow}>
                  <Pressable
                    onPress={() => navigation.navigate('ForgotPassword')}
                    hitSlop={8}
                  >
                    <Text style={authStyles.forgotText}>Forgot password?</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRememberMe(v => !v)}
                    style={authStyles.rememberMeBtn}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={rememberMe ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={rememberMe ? colors.primary : colors.textMuted}
                    />
                    <Text style={authStyles.rememberMeText}>Remember me</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={authStyles.formCardSection}>
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
            </View>

            <View style={authStyles.formCardSection}>
              <Text style={authStyles.socialDivider}>or continue with</Text>

              <View style={authStyles.socialIconsRow}>
                <Pressable style={authStyles.socialIconBtn} disabled>
                  <Ionicons name="logo-google" size={20} color={colors.textPlaceholder} />
                </Pressable>
                {Platform.OS === 'ios' ? (
                  <Pressable style={authStyles.socialIconBtn} disabled>
                    <Ionicons name="logo-apple" size={22} color={colors.textPlaceholder} />
                  </Pressable>
                ) : null}
                <Pressable style={authStyles.socialIconBtn} disabled>
                  <Ionicons name="mail-outline" size={20} color={colors.textPlaceholder} />
                </Pressable>
              </View>
            </View>
          </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
