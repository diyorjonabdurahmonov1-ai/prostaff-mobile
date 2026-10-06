import { type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** How far the surface sinks while held. iOS uses ~0.96–0.98 for cards. */
  scaleTo?: number;
  /** Dim on press as well — matches UIKit's highlight on plain buttons. */
  dim?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * A press target that springs down under the finger, the way UIKit buttons and
 * SwiftUI cards do. Runs on the UI thread via Reanimated so it never stutters.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  scaleTo = 0.97,
  dim = 1,
  style,
  accessibilityLabel,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - (1 - scaleTo) * pressed.value, Motion.press) }],
    opacity: withSpring(1 - (1 - dim) * pressed.value, Motion.press),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      style={[style, animatedStyle, disabled ? { opacity: 0.4 } : null]}>
      {children}
    </AnimatedPressable>
  );
}
