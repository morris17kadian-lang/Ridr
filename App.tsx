import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getApiBaseUrl, getApiHealthUrl } from './src/api/config';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    if (!__DEV__) return;
    const base = getApiBaseUrl();
    const health = getApiHealthUrl();
    if (!health) return;
    console.log('[Ridr API] resolved base URL:', base || '(empty)');
    console.log('[Ridr API] health check URL:', health);
    void fetch(health)
      .then(async (res) => {
        const body = await res.text().catch(() => '');
        console.log('[Ridr API] GET', health, '->', res.status, body.slice(0, 120));
      })
      .catch((err) => console.warn('[Ridr API] health request failed:', err));
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigation />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppNavigation() {
  const { colors, isDark } = useAppTheme();

  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          primary: colors.accent,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          primary: colors.accent,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </NavigationContainer>
  );
}
