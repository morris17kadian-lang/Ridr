import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../theme/ThemeProvider';
import { useAuthStyles } from '../authStyles';

export type AuthPasswordFieldProps = {
  label: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  editable?: boolean;
  style?: TextInputProps['style'];
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
  secureTextEntry?: boolean;
};

export function AuthPasswordField({
  label,
  style,
  onFocus,
  onBlur,
  secureTextEntry = true,
  editable = true,
  value,
  onChangeText,
  placeholder,
  autoComplete,
  textContentType,
}: AuthPasswordFieldProps) {
  const [focused, setFocused] = useState(false);
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();
  const [visible, setVisible] = useState(false);

  return (
    <View style={authStyles.fieldBlock}>
      <Text style={authStyles.fieldLabel}>{label}</Text>
      <View style={[authStyles.fieldShell, focused && authStyles.fieldShellFocused]}>
        <Ionicons name="key-outline" size={20} color={colors.text} style={authStyles.fieldIconLeft} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoComplete={autoComplete}
          textContentType={textContentType}
          style={[authStyles.fieldInput, style]}
          placeholderTextColor={colors.textPlaceholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          editable={editable}
          multiline={false}
          scrollEnabled={false}
          spellCheck={false}
          autoCorrect={false}
          secureTextEntry={Boolean(secureTextEntry && !visible)}
        />
        <Pressable
          style={authStyles.eyeBtn}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
