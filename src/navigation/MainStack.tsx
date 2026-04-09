import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainScreen from '../screens/main/MainScreen';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Main app experience (map, profile, edit) lives in a single screen for now
 * with internal navigation state; can be split into separate stack screens later.
 */
export function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, freezeOnBlur: false }}>
      <Stack.Screen name="Home" component={MainScreen} />
    </Stack.Navigator>
  );
}
