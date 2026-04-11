import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function safe(fn: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await fn();
  } catch {
    /* Simulator without haptics, or unsupported device */
  }
}

/** Tabs, toggles, chips, picking a default option */
export function hapticSelection(): void {
  void safe(() => Haptics.selectionAsync());
}

export function hapticLight(): void {
  void safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium(): void {
  void safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticHeavy(): void {
  void safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

/** Driver matched, ride booked, success paths */
export function hapticSuccess(): void {
  void safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  );
}

export function hapticWarning(): void {
  void safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  );
}

export function hapticError(): void {
  void safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  );
}
