import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword:
    | {
        email?: string;
        identifier?: string;
        resetToken?: string;
        staffCode?: string;
        isTemporaryPassword?: boolean;
      }
    | undefined;
};

export type MainStackParamList = {
  Home: undefined;
};

export type DriverStackParamList = {
  DriverHome: undefined;
};

export type AuthEntryProps = NativeStackScreenProps<AuthStackParamList, 'SignIn' | 'SignUp'>;
export type SignInProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
export type SignUpProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
export type ForgotPasswordProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export type ResetPasswordProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;
