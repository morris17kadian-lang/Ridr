import { Pressable, Text, View } from 'react-native';
import { useAuthStyles } from '../authStyles';

type Mode = 'login' | 'signup';

type Props = {
  mode: Mode;
  onLoginPress: () => void;
  onSignUpPress: () => void;
};

export function AuthModeToggle({ mode, onLoginPress, onSignUpPress }: Props) {
  const authStyles = useAuthStyles();
  return (
    <View style={authStyles.modeToggleTrack}>
      <Pressable
        onPress={onLoginPress}
        style={[authStyles.modeToggleHalf, mode === 'login' ? authStyles.modeToggleHalfActive : null]}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'login' }}
      >
        <Text style={[authStyles.modeToggleText, mode === 'login' ? authStyles.modeToggleTextActive : authStyles.modeToggleTextIdle]}>
          Login
        </Text>
      </Pressable>
      <Pressable
        onPress={onSignUpPress}
        style={[authStyles.modeToggleHalf, mode === 'signup' ? authStyles.modeToggleHalfActive : null]}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'signup' }}
      >
        <Text style={[authStyles.modeToggleText, mode === 'signup' ? authStyles.modeToggleTextActive : authStyles.modeToggleTextIdle]}>
          Sign Up
        </Text>
      </Pressable>
    </View>
  );
}
