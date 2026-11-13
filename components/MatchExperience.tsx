import { useEffect } from "react";
import { Dimensions, Modal, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SPRING_GENTLE, SPRING_SNAPPY } from "../constants/motion";
import { BG, GOLD, glowShadow } from "../constants/style";
import { Touchable } from "./Touchable";

const { width: SW } = Dimensions.get("window");
const PHOTO = Math.min(132, Math.round(SW * 0.33));
const OVERLAP = 22;
// The moment the two portraits touch — badge, ring and haptic all key off it.
const MEET_MS = 520;

type Props = {
  visible: boolean;
  /** Photos for "our" side (one for solo, two for a Duo) and theirs. */
  mine: (string | null | undefined)[];
  theirs: (string | null | undefined)[];
  overline?: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  unlocking: boolean;
  unlockLabel: string;
  unlockHint: string;
  chatLabel: string;
  onUnlock: () => void;
  onOpenChat: () => void;
  onShowInMatches: () => void;
  onContinue: () => void;
};

/**
 * The match moment: both portraits glide in and meet, a single gold ring
 * breathes out from the point of contact, then the next step is offered.
 * Deliberately quiet — no confetti, one motion, one haptic.
 */
export function MatchExperience(props: Props) {
  const { visible, mine, theirs, unlocked, unlocking } = props;
  const enter = useSharedValue(0);
  const badge = useSharedValue(0);
  const ring = useSharedValue(0);
  const copy = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      enter.set(0); badge.set(0); ring.set(0); copy.set(0);
      return;
    }
    enter.set(withDelay(120, withSpring(1, SPRING_GENTLE)));
    badge.set(withDelay(MEET_MS, withSpring(1, SPRING_SNAPPY)));
    ring.set(withDelay(MEET_MS, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
    copy.set(withDelay(MEET_MS + 120, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
    const t = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), MEET_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.4], [0, 1], "clamp"),
    transform: [
      { translateX: interpolate(enter.value, [0, 1], [-SW * 0.45, OVERLAP / 2]) },
      { rotate: `${interpolate(enter.value, [0, 1], [-14, -5])}deg` },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.4], [0, 1], "clamp"),
    transform: [
      { translateX: interpolate(enter.value, [0, 1], [SW * 0.45, -OVERLAP / 2]) },
      { rotate: `${interpolate(enter.value, [0, 1], [14, 5])}deg` },
    ],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, badge.value * 2), transform: [{ scale: badge.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.5, 2.1]) }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copy.value,
    transform: [{ translateY: interpolate(copy.value, [0, 1], [14, 0]) }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={props.onContinue}>
      <View style={styles.backdrop} testID="match-experience">
        <View style={styles.stage}>
          <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />
          <Animated.View style={leftStyle}><Portraits uris={mine} /></Animated.View>
          <Animated.View style={rightStyle}><Portraits uris={theirs} /></Animated.View>
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Ionicons name="heart" size={18} color="#000" />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Text style={styles.overline}>{props.overline ?? "DET ÄR EN MATCH"}</Text>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>{props.title}</Text>
          <Text style={styles.subtitle}>{props.subtitle}</Text>

          {unlocked ? (
            <Touchable style={styles.primaryBtn} haptic="medium" onPress={props.onOpenChat} testID="match-open-chat">
              <Ionicons name="chatbubble-ellipses" size={16} color="#000" />
              <Text style={styles.primaryText}>{props.chatLabel}</Text>
            </Touchable>
          ) : (
            <>
              <Touchable
                style={[styles.primaryBtn, unlocking && styles.disabled]}
                haptic="medium"
                onPress={props.onUnlock}
                disabled={unlocking}
                testID="match-unlock"
              >
                <Text style={styles.primaryText}>{unlocking ? "Låser upp..." : props.unlockLabel}</Text>
              </Touchable>
              <Text style={styles.hint}>{props.unlockHint}</Text>
            </>
          )}

          <Touchable style={styles.secondaryBtn} onPress={props.onContinue} testID="match-continue">
            <Text style={styles.secondaryText}>Fortsätt utforska</Text>
          </Touchable>
          {!unlocked && (
            <Touchable style={styles.linkBtn} onPress={props.onShowInMatches}>
              <Text style={styles.linkText}>Visa i Matchningar</Text>
            </Touchable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function Portraits({ uris }: { uris: (string | null | undefined)[] }) {
  const list = uris.slice(0, 2);
  const size = list.length > 1 ? Math.round(PHOTO * 0.74) : PHOTO;
  return (
    <View style={styles.portraitRow}>
      {list.map((uri, i) => (
        <View
          key={i}
          style={[
            styles.portrait,
            { width: size, height: size, borderRadius: size / 2 },
            i > 0 && { marginLeft: -size * 0.34, marginTop: size * 0.3 },
          ]}
        >
          {uri ? (
            <Image source={{ uri }} style={styles.portraitImg} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Ionicons name="person" size={size * 0.42} color="#3A3228" />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(6,6,6,0.965)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  stage: { height: PHOTO + 60, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 36 },
  ring: {
    position: "absolute", width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2,
    borderWidth: 1, borderColor: GOLD,
  },
  portraitRow: { flexDirection: "row" },
  portrait: {
    borderWidth: 2, borderColor: GOLD, backgroundColor: "#141210", overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  portraitImg: { width: "100%", height: "100%" },
  badge: {
    position: "absolute", bottom: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: GOLD,
    alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: BG, ...glowShadow(0.35, 14),
  },
  copy: { alignItems: "center", alignSelf: "stretch" },
  overline: { color: GOLD, fontSize: 11, fontWeight: "700", letterSpacing: 5, marginBottom: 14 },
  title: { color: "#fff", fontSize: 30, fontFamily: "Georgia", fontWeight: "700", textAlign: "center", letterSpacing: 0.3 },
  subtitle: { color: "#8E8371", fontSize: 15, textAlign: "center", marginTop: 8, marginBottom: 34, lineHeight: 22 },
  primaryBtn: {
    alignSelf: "stretch", flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
    backgroundColor: GOLD, borderRadius: 50, paddingVertical: 16, ...glowShadow(0.22, 16),
  },
  primaryText: { color: "#000", fontSize: 15, fontWeight: "800", letterSpacing: 0.4 },
  disabled: { opacity: 0.5 },
  hint: { color: "#5A5040", fontSize: 12, marginTop: 10, textAlign: "center" },
  secondaryBtn: {
    alignSelf: "stretch", alignItems: "center", borderRadius: 50, paddingVertical: 15, marginTop: 14,
    borderWidth: 1, borderColor: "#2A261E",
  },
  secondaryText: { color: "#D8CBA6", fontSize: 15, fontWeight: "600" },
  linkBtn: { paddingVertical: 14 },
  linkText: { color: "#6A5E48", fontSize: 13, fontWeight: "500" },
});
