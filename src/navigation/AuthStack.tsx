import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import ForgotPasswordScreen from '../screens/auth/forgot-password/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/reset-password/ResetPasswordScreen';
import SignInScreen from '../screens/auth/sign-in/SignInScreen';
import SignUpScreen from '../screens/auth/sign-up/SignUpScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
      }}
      initialRouteName="SignIn"
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
