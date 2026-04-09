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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import type { AuthEntryProps } from '../../navigation/types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useAuthStyles } from './authStyles';
import { AuthModeToggle } from './components/AuthModeToggle';
import { AuthPasswordField } from './components/AuthPasswordField';
import { AuthTextField } from './components/AuthTextField';

type AuthMode = 'login' | 'signup';

export default function SignInScreen({ navigation, route }: AuthEntryProps) {
  const { signIn, signUp } = useAuth();
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();
  const [mode, setMode] = useState<AuthMode>(route.name === 'SignUp' ? 'signup' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
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

  const onSubmit = async () => {
    if (mode === 'login') {
      if (!username.trim() || !password) {
        Alert.alert('Sign in', 'Enter your username and password.');
        return;
      }
      setSubmitting(true);
      try {
        await signIn(username.trim(), password);
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
          <Animated.View style={[authStyles.logoWrapper, logoAnimStyle]}>
            <Image
              source={require('../../../assets/ridr-logo.png')}
              style={authStyles.logoImage}
            />
          </Animated.View>

          <Animated.View style={formAnimStyle}>
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

          {mode === 'login' ? (
            <AuthTextField
              label="Username"
              icon="person-outline"
              value={username}
              onChangeText={setUsername}
              placeholder="Your first name"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
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
            placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'}
            autoComplete={mode === 'login' ? 'password' : 'password-new'}
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
          />

          {mode === 'login' ? (
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
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
