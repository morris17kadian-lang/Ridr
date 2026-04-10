import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

const PUSH_TOKEN_KEY = 'ridr_push_token_v1';

/**
 * Requests push notification permission and retrieves the Expo push token.
 * - Only runs on physical devices (simulators/emulators cannot receive push notifications)
 * - Caches the token in AsyncStorage so it's available for later backend sync
 * - Returns the token string once obtained, or null if unavailable/denied
 */
export function usePushToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function register() {
      // Push notifications are not supported on simulators/emulators
      if (!Device.isDevice) return;

      // Android: set notification channel so alerts show properly
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Ridr',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#171717',
        });
      }

      // Check existing permission status first
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        // Let the user know they can enable it later in system settings
        Alert.alert(
          'Notifications disabled',
          'You can enable push notifications in your device Settings at any time.',
          [{ text: 'OK' }],
        );
        return;
      }

      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();

      if (!cancelled) {
        setToken(expoPushToken);
        // Cache locally — used when backend is ready for sync
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}
