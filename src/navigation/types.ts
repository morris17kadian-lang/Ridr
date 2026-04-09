import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
};

export type MainStackParamList = {
  Home: undefined;
};

export type AuthEntryProps = NativeStackScreenProps<AuthStackParamList, 'SignIn' | 'SignUp'>;
export type SignInProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
export type SignUpProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
export type ForgotPasswordProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export type ResetPasswordProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;
