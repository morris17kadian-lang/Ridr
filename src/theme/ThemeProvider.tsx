import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeOverride = 'system' | 'light' | 'dark';
const THEME_OVERRIDE_KEY = 'ridr_theme_override';

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
  /** Soft panel behind inputs / secondary blocks */
  softBg: string;
  /** Floating header scrim over map */
  headerOverlay: string;
  tabActive: string;
  tabInactive: string;
  success: string;
  successContainer: string;
  danger: string;
  buttonDisabled: string;
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
  softBg: '#f7f7f7',
  headerOverlay: 'rgba(255,255,255,0.82)',
  tabActive: '#FFD000',
  tabInactive: '#1a1a1a',
  success: '#22c55e',
  successContainer: '#f0fdf4',
  danger: '#ef4444',
  buttonDisabled: '#e5e5e5',
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
  card: '#1b1c20',
  softBg: '#202227',
  headerOverlay: 'rgba(12,12,13,0.88)',
  tabActive: '#FFD000',
  tabInactive: '#f5f5f5',
  success: '#4ade80',
  successContainer: '#14532d',
  danger: '#f87171',
  buttonDisabled: '#2b2b31',
};

type AppTheme = {
  theme: ThemeName;
  isDark: boolean;
  colors: ThemeColors;
  themeOverride: ThemeOverride;
  setThemeOverride: (o: ThemeOverride) => void;
};

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [themeOverride, setThemeOverrideState] = useState<ThemeOverride>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_OVERRIDE_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setThemeOverrideState(v);
    }).catch(() => {});
  }, []);

  const setThemeOverride = useCallback((o: ThemeOverride) => {
    setThemeOverrideState(o);
    void AsyncStorage.setItem(THEME_OVERRIDE_KEY, o);
  }, []);

  const effectiveTheme: ThemeName =
    themeOverride === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : themeOverride;

  const value = useMemo<AppTheme>(
    () => ({
      theme: effectiveTheme,
      isDark: effectiveTheme === 'dark',
      colors: effectiveTheme === 'dark' ? darkColors : lightColors,
      themeOverride,
      setThemeOverride,
    }),
    [effectiveTheme, themeOverride, setThemeOverride]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
