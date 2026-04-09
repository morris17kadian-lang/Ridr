import { useEffect, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { InteractionManager, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';

/**
 * Keeps the native splash (ridr-logo) visible until session is read from storage,
 * then hides splash and shows either auth or main app.
 *
 * While `loading` is true we render a lightweight placeholder instead of `null` so
 * `NavigationContainer` always has a real child (avoids native-stack / Fabric edge cases).
 * Splash is hidden after the auth tree has had a chance to mount.
 */
export function SplashAuthGate() {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();
  const hiddenRef = useRef(false);
  const isLoading = loading === true;
  const hasUser = !!(user && typeof user === 'object');

  useEffect(() => {
    if (isLoading || hiddenRef.current) return;

    const handle = InteractionManager.runAfterInteractions(() => {
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      requestAnimationFrame(() => {
        void SplashScreen.hideAsync().catch(() => {});
      });
    });

    return () => handle.cancel();
  }, [isLoading]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  return hasUser ? <MainStack /> : <AuthStack />;
}
