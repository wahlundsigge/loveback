import { forwardRef } from "react";
import { Pressable, type GestureResponderEvent, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PRESS_SCALE_IN, PRESS_SCALE_OUT } from "../constants/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TouchableProps = PressableProps & {
  /** Haptic fired on press. Default "light". Pass false to disable (e.g. invisible hit zones, rapid-fire taps). */
  haptic?: "light" | "medium" | "selection" | false;
  /** How much to scale down on press-in. Default 0.96 — subtle, not bouncy. */
  scaleTo?: number;
};

/**
 * Drop-in replacement for Pressable that adds native-thread (Reanimated)
 * press-scale feedback and a haptic tick — every tappable element in the app
 * currently gives zero visual/physical feedback on press, which is the
 * single biggest reason it reads as "web-like" rather than a native app.
 */
export const Touchable = forwardRef<React.ComponentRef<typeof Pressable>, TouchableProps>(
  function Touchable({ style, onPressIn, onPressOut, onPress, haptic = "light", scaleTo = 0.96, ...rest }, ref) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const handlePressIn = (e: GestureResponderEvent) => {
      scale.value = withTiming(scaleTo, { duration: PRESS_SCALE_IN });
      onPressIn?.(e);
    };
    const handlePressOut = (e: GestureResponderEvent) => {
      scale.value = withTiming(1, { duration: PRESS_SCALE_OUT });
      onPressOut?.(e);
    };
    const handlePress = (e: GestureResponderEvent) => {
      if (haptic === "selection") Haptics.selectionAsync();
      else if (haptic) Haptics.impactAsync(haptic === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    };

    return (
      <AnimatedPressable
        ref={ref}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[animatedStyle, style as any]}
        {...rest}
      />
    );
  }
);
