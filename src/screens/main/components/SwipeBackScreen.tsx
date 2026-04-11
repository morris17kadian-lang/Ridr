import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hapticLight } from '../../../lib/haptics';

const EDGE_PX = 40;
const SWIPE_MIN_DX = 56;

type Props = {
  children: React.ReactNode;
  onBack: () => void;
  /** When false, only children render (no edge swipe). */
  enabled?: boolean;
};

/**
 * iOS-style edge swipe from the left (below the header) to trigger `onBack`.
 * Does not cover the top header row so back buttons stay tappable.
 */
export function SwipeBackScreen({ children, onBack, enabled = true }: Props) {
  const insets = useSafeAreaInsets();
  /** Match compact `fixedHeader` height (padding + profile row + bottom padding). */
  const headerClearance = insets.top + 46;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          if (!enabled) return false;
          return evt.nativeEvent.pageX <= EDGE_PX;
        },
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 12 && g.dx > Math.abs(g.dy) * 1.2,
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_MIN_DX || (g.dx > 36 && (g.vx ?? 0) > 0.35)) {
            hapticLight();
            onBack();
          }
        },
      }),
    [enabled, onBack],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      {children}
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
      >
        <View style={[styles.edge, { top: headerClearance, width: EDGE_PX }]} {...panResponder.panHandlers} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  edge: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
