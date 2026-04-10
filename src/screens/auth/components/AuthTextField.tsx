import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../theme/ThemeProvider';
import { useAuthStyles } from '../authStyles';

/** Only props we forward — avoids `{...rest}` leaking values that confuse Fabric (e.g. string booleans). */
export type AuthTextFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  editable?: boolean;
  style?: TextInputProps['style'];
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
  /** Merged with `fieldBlock` (e.g. `{ marginBottom: 0 }` in a row). */
  blockStyle?: ViewStyle;
  /** Narrow columns (e.g. name row): label aligns inside the column, not with full-bleed fields. */
  compactLabel?: boolean;
};

export function AuthTextField({
  label,
  icon,
  style,
  onFocus,
  onBlur,
  editable = true,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect = false,
  autoComplete,
  textContentType,
  blockStyle,
  compactLabel,
}: AuthTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { colors } = useAppTheme();
  const authStyles = useAuthStyles();

  return (
    <View style={[authStyles.fieldBlock, blockStyle]}>
      <Text style={[authStyles.fieldLabel, compactLabel && authStyles.fieldLabelCompact]}>{label}</Text>
      <View style={[authStyles.fieldShell, focused && authStyles.fieldShellFocused]}>
        <Ionicons name={icon} size={20} color={colors.text} style={authStyles.fieldIconLeft} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
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
        />
      </View>
    </View>
  );
}
