import { useState } from "react";
import { Modal, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { DURATION_EMPHASIZED, SPRING_SNAPPY, VELOCITY_THRESHOLD } from "../constants/motion";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * A bottom sheet that behaves like a real one: drag it down and it follows
 * your finger 1:1, the backdrop fades with it, release past ~25% of the
 * sheet's own height (or a fast enough flick) dismisses it, anything less
 * springs back. Replaces the plain `<Modal>` + tap-outside-to-close pattern
 * used for filter/boost/rose/report/etc — one implementation, reused
 * everywhere a sheet slides up from the bottom.
 */
export function BottomSheet({ visible, onClose, children, sheetStyle }: Props) {
  const translateY = useSharedValue(0);
  const [sheetHeight, setSheetHeight] = useState(400); // replaced by real measurement on first layout

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.value / sheetHeight),
  }));
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, translateY.value) }],
  }));

  const close = () => {
    translateY.value = 0;
    onClose();
  };

  const dragGesture = Gesture.Pan()
    // Only claims downward drags (dismiss direction). Deliberately NOT
    // symmetric: an upward move must fall through untouched to whatever's
    // inside the sheet, so a future scrollable sheet body can still be
    // scrolled up without this gesture stealing the touch first.
    .activeOffsetY(6)
    .failOffsetX([-12, 12])
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const dismiss = e.translationY > sheetHeight * 0.25 || e.velocityY > VELOCITY_THRESHOLD;
      if (dismiss) {
        translateY.value = withTiming(sheetHeight + 40, { duration: DURATION_EMPHASIZED }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0, { ...SPRING_SNAPPY, velocity: e.velocityY });
      }
    });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.root}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            <GestureDetector gesture={Gesture.Tap().onEnd(() => runOnJS(close)())}>
              <View style={StyleSheet.absoluteFill} />
            </GestureDetector>
          </Animated.View>
          <GestureDetector gesture={dragGesture}>
            <Animated.View
              style={[sheetStyle, sheetAnimatedStyle]}
              onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
            >
              <View style={styles.grabber} />
              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.75)" },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#2A2620", alignSelf: "center", marginBottom: 14 },
});
