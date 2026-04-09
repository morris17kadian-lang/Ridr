import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeName = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  textPlaceholder: string;
  border: string;
  accent: string;
  primary: string;
  textOnPrimary: string;
  inputBg: string;
  inputBorder: string;
  card: string;
};

const lightColors: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#171717',
  textMuted: '#666666',
  textPlaceholder: '#aaaaaa',
  border: '#ececec',
  accent: '#ffd54a',
  primary: '#171717',
  textOnPrimary: '#ffffff',
  inputBg: '#fafafa',
  inputBorder: '#e6e6e6',
  card: '#ffffff',
};

const darkColors: ThemeColors = {
  background: '#0c0c0d',
  surface: '#151517',
  text: '#f5f5f5',
  textMuted: '#a1a1aa',
  textPlaceholder: '#6b7280',
  border: '#2b2b31',
  accent: '#ffd54a',
  primary: '#ffd54a',
  textOnPrimary: '#171717',
  inputBg: '#1e1f23',
  inputBorder: '#33363d',
  card: '#1a1b1f',
};

type AppTheme = {
  theme: ThemeName;
  isDark: boolean;
  colors: ThemeColors;
};

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme: ThemeName = scheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<AppTheme>(
    () => ({
      theme,
      isDark: theme === 'dark',
      colors: theme === 'dark' ? darkColors : lightColors,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
