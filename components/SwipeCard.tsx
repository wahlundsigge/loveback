import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { DURATION_EMPHASIZED, SPRING_GENTLE, SPRING_SNAPPY, VELOCITY_THRESHOLD } from "../constants/motion";
import { GOLD, SURFACE } from "../constants/style";
import { DatingGoalsSlide } from "./DatingGoalsSlide";
import { DATING_GOAL_OPTIONS } from "./DatingGoalOptions";

const { width: SW, height: SH } = Dimensions.get("window");
export const CARD_W = Math.min(SW - 32, 420);
export const CARD_H = Math.min(SH * 0.62, 560);

// How far past the edge a card flies before the deck advances. The release
// decision reacts to BOTH distance and speed — a short, fast flick swipes
// as confidently as a slow long drag. Shared motion constants
// (constants/motion.ts) keep this in step with every other drag gesture.
const FLY_OUT_X = SW * 1.3;
const FLY_OUT_Y = SH * 0.9;
const DISTANCE_THRESHOLD = 110;
// Top-right corner reserved for the report button (handled by the card's
// own tap gesture so it can never fight the swipe).
const REPORT_HIT = 60;

export type SwipeOutcome = "like" | "skip";
export type SwipeCardHandle = {
  /** Fly the card off-screen, then report the outcome — same motion as a completed drag. */
  fly: (direction: "left" | "right" | "up", outcome: SwipeOutcome) => void;
};

type Props = {
  ref?: Ref<SwipeCardHandle>;
  card: any;
  /** Top card is interactive; the one behind it just waits and scales up. */
  isTop: boolean;
  /** Reciprocal visibility: the viewer sees as many photos as they have themselves. */
  myPhotoCount: number;
  /** 0 → 1 as the top card is dragged toward (or flies past) the threshold. */
  deckProgress: SharedValue<number>;
  onSwiped: (outcome: SwipeOutcome, card: any) => void;
  onReport: (card: any) => void;
};

export function SwipeCard({ ref, card, isTop, myPhotoCount, deckProgress, onSwiped, onReport }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const leaving = useSharedValue(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedUris, setFailedUris] = useState<Set<string>>(new Set());
  const leavingRef = useRef(false);

  const firstName = (card.first_name || card.name || "").split(" ")[0];
  const allPhotos: string[] = card.images?.length > 0 ? card.images : card.avatar ? [card.avatar] : [];
  const visiblePhotos = allPhotos.slice(0, Math.max(1, myPhotoCount));
  const hiddenCount = allPhotos.length - visiblePhotos.length;

  // Dating goals get an extra "slide" after the real photos — never a
  // filter, purely an info card so the photos stay clean.
  const goals: string[] = card.dating_goals ?? [];
  const hasGoalsSlide = goals.length > 0;
  const totalSlides = Math.max(1, visiblePhotos.length + (hasGoalsSlide ? 1 : 0));
  const isGoalsSlide = hasGoalsSlide && photoIndex === visiblePhotos.length;
  const photoUri = isGoalsSlide ? null : visiblePhotos[photoIndex] ?? visiblePhotos[0] ?? null;
  const photoBroken = !photoUri || failedUris.has(photoUri);
  const goalLabels = DATING_GOAL_OPTIONS.filter((o) => goals.includes(o.value)).map((o) => o.label).slice(0, 2);

  // Warm the cache so tapping through photos never shows a blank frame.
  useEffect(() => {
    const rest = visiblePhotos.slice(1).filter((u) => !u.toLowerCase().endsWith(".mp4"));
    if (rest.length > 0) Image.prefetch(rest).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const finish = (outcome: SwipeOutcome) => onSwiped(outcome, card);

  const stepPhoto = (delta: 1 | -1) => {
    setPhotoIndex((prev) => {
      const next = Math.max(0, Math.min(totalSlides - 1, prev + delta));
      if (next !== prev) Haptics.selectionAsync();
      return next;
    });
  };

  const fly = (direction: "left" | "right" | "up", outcome: SwipeOutcome) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    leaving.set(true);
    Haptics.impactAsync(outcome === "like" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    const done = (finished?: boolean) => {
      "worklet";
      if (finished) runOnJS(finish)(outcome);
    };
    deckProgress.set(withTiming(1, { duration: DURATION_EMPHASIZED }));
    if (direction === "up") {
      translateY.set(withTiming(-FLY_OUT_Y, { duration: DURATION_EMPHASIZED }, done));
    } else {
      translateX.set(withTiming(direction === "right" ? FLY_OUT_X : -FLY_OUT_X, { duration: DURATION_EMPHASIZED }, done));
    }
  };

  useImperativeHandle(ref, () => ({ fly }));

  // Card swipe: horizontal drags only (a clear sideways intent), so a tap
  // can never be mistaken for a swipe and vice versa. Runs on the UI thread.
  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      if (leaving.value) return;
      translateX.set(e.translationX);
      translateY.set(e.translationY * 0.6);
      deckProgress.set(Math.min(1, Math.abs(e.translationX) / DISTANCE_THRESHOLD));
    })
    .onEnd((e) => {
      if (leaving.value) return;
      const right = e.translationX > DISTANCE_THRESHOLD || (e.translationX > 20 && e.velocityX > VELOCITY_THRESHOLD);
      const left = e.translationX < -DISTANCE_THRESHOLD || (e.translationX < -20 && e.velocityX < -VELOCITY_THRESHOLD);

      if (right || left) {
        leaving.set(true);
        runOnJS(Haptics.impactAsync)(right ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        deckProgress.set(withTiming(1, { duration: DURATION_EMPHASIZED }));
        translateX.set(withTiming(right ? FLY_OUT_X : -FLY_OUT_X, { duration: DURATION_EMPHASIZED }, (finished) => {
          if (finished) runOnJS(finish)(right ? "like" : "skip");
        }));
        translateY.set(withTiming(translateY.value + e.velocityY * 0.05, { duration: DURATION_EMPHASIZED }));
      } else {
        // Under threshold — spring back, carrying the release velocity so
        // the snap-back continues the gesture's own momentum.
        translateX.set(withSpring(0, { ...SPRING_SNAPPY, velocity: e.velocityX }));
        translateY.set(withSpring(0, { ...SPRING_SNAPPY, velocity: e.velocityY }));
        deckProgress.set(withSpring(0, SPRING_GENTLE));
      }
    });

  // Photos: plain taps only — left side back, right side forward.
  const tap = Gesture.Tap()
    .enabled(isTop)
    .maxDuration(280)
    .maxDistance(10)
    .onEnd((e, success) => {
      if (!success || leaving.value) return;
      if (e.x > CARD_W - REPORT_HIT && e.y < REPORT_HIT) runOnJS(onReport)(card);
      else runOnJS(stepPhoto)(e.x < CARD_W * 0.4 ? -1 : 1);
    });

  const gesture = Gesture.Race(pan, tap);

  // A discreet tick the moment a drag crosses the decision threshold.
  useAnimatedReaction(
    () => Math.abs(translateX.value) > DISTANCE_THRESHOLD,
    (past, prev) => {
      if (prev !== null && past !== prev && !leaving.value) runOnJS(Haptics.selectionAsync)();
    },
  );

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      // Waiting underneath: rises and grows into place as the top card leaves.
      return {
        transform: [
          { translateX: 0 },
          { translateY: interpolate(deckProgress.value, [0, 1], [14, 0], Extrapolation.CLAMP) },
          { rotate: "0deg" },
          { scale: interpolate(deckProgress.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
        ],
      };
    }
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-14, 0, 14], Extrapolation.CLAMP)}deg` },
        { scale: 1 },
      ],
    };
  }, [isTop]);

  // Just promoted to the top: the deck's progress belongs to the next
  // waiting card from here on. Declared after cardStyle so the style has
  // already switched off the "waiting" formula when this resets.
  useEffect(() => {
    if (isTop) deckProgress.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTop]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: isTop ? 0 : interpolate(deckProgress.value, [0, 1], [0.45, 0], Extrapolation.CLAMP),
  }), [isTop]);
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [16, DISTANCE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-DISTANCE_THRESHOLD, -16], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.shadowWrap, { zIndex: isTop ? 2 : 1 }, cardStyle]} testID={isTop ? "swipe-card-top" : "swipe-card-next"}>
        <View style={styles.card}>
          {isGoalsSlide ? (
            <DatingGoalsSlide goals={goals} title={`Vad ${firstName} söker`} />
          ) : photoBroken ? (
            <View style={[styles.photo, styles.photoFallback]}>
              <Ionicons name="person" size={72} color="#2A2620" />
            </View>
          ) : (
            <>
              <Image
                source={{ uri: photoUri }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={140}
                onError={() => setFailedUris((prev) => new Set(prev).add(photoUri))}
              />
              {photoUri.toLowerCase().endsWith(".mp4") && (
                <View style={styles.videoOverlay}>
                  <Text style={styles.videoIcon}>▶</Text>
                </View>
              )}
            </>
          )}

          {/* Legibility gradients — top for the photo bars, bottom for the name */}
          <LinearGradient colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0)"]} style={styles.topFade} pointerEvents="none" />
          {!isGoalsSlide && (
            <LinearGradient
              colors={["rgba(8,8,8,0)", "rgba(8,8,8,0.55)", "rgba(8,8,8,0.94)"]}
              locations={[0, 0.5, 1]}
              style={styles.bottomFade}
              pointerEvents="none"
            />
          )}

          {totalSlides > 1 && (
            <View style={styles.bars} pointerEvents="none">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <View key={i} style={[styles.bar, i === photoIndex && styles.barActive]} />
              ))}
            </View>
          )}

          {/* Swipe feedback: a soft tint plus a quiet label, no loud stamps */}
          <Animated.View style={[styles.tint, styles.tintLike, likeStyle]} pointerEvents="none" />
          <Animated.View style={[styles.tint, styles.tintNope, nopeStyle]} pointerEvents="none" />
          <Animated.View style={[styles.verdict, styles.verdictLike, likeStyle]} pointerEvents="none">
            <Text style={[styles.verdictText, { color: GOLD }]}>JA TACK</Text>
          </Animated.View>
          <Animated.View style={[styles.verdict, styles.verdictNope, nopeStyle]} pointerEvents="none">
            <Text style={styles.verdictText}>NEJ TACK</Text>
          </Animated.View>

          <View
            style={styles.reportBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Rapportera profil"
            onAccessibilityTap={() => onReport(card)}
          >
            <Ionicons name="flag-outline" size={15} color="#fff" style={{ opacity: 0.85 }} />
          </View>

          {!isGoalsSlide && (
            <View style={styles.info} pointerEvents="none">
              <Text style={styles.name} numberOfLines={1}>
                {firstName}
                {card.age != null && <Text style={styles.age}>  {card.age}</Text>}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-sharp" size={12} color={GOLD} />
                <Text style={styles.meta}>{card.distance ?? 5} km bort</Text>
              </View>
              {goalLabels.length > 0 && (
                <View style={styles.chipRow}>
                  {goalLabels.map((label) => (
                    <View key={label} style={styles.chip}>
                      <Text style={styles.chipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}
              {hiddenCount > 0 && (
                <Text style={styles.morePhotosHint}>+{hiddenCount} fler foton synliga med fler egna foton</Text>
              )}
            </View>
          )}

          <Animated.View style={[styles.dim, dimStyle]} pointerEvents="none" />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const RADIUS = 28;

const styles = StyleSheet.create({
  // Shadow lives on the outer view; clipping on the inner one — a single
  // view can't both clip its corners and cast a shadow on iOS.
  shadowWrap: {
    position: "absolute", width: CARD_W, height: CARD_H, borderRadius: RADIUS,
    backgroundColor: SURFACE,
    shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  card: {
    flex: 1, borderRadius: RADIUS, overflow: "hidden", backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(201,168,76,0.22)",
  },
  photo: { position: "absolute", width: "100%", height: "100%" },
  photoFallback: { backgroundColor: "#141210", alignItems: "center", justifyContent: "center" },
  videoOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  videoIcon: { fontSize: 48, color: "rgba(255,255,255,0.9)" },
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 84 },
  bottomFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: "48%" },
  bars: { position: "absolute", top: 12, left: 14, right: 60, flexDirection: "row", gap: 5 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.32)" },
  barActive: { backgroundColor: GOLD },
  tint: { ...StyleSheet.absoluteFill },
  tintLike: { backgroundColor: "rgba(201,168,76,0.16)" },
  tintNope: { backgroundColor: "rgba(0,0,0,0.38)" },
  verdict: {
    position: "absolute", top: 54, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 50,
    borderWidth: 1.5, backgroundColor: "rgba(8,8,8,0.62)",
  },
  verdictLike: { left: 20, borderColor: GOLD, transform: [{ rotate: "-8deg" }] },
  verdictNope: { right: 20, borderColor: "rgba(255,255,255,0.7)", transform: [{ rotate: "8deg" }] },
  verdictText: { fontSize: 14, fontWeight: "800", letterSpacing: 3.5, color: "rgba(255,255,255,0.92)" },
  reportBtn: {
    position: "absolute", top: 22, right: 12, width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center",
  },
  info: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingBottom: 24 },
  name: { color: "#fff", fontSize: 30, fontWeight: "700", letterSpacing: 0.2 },
  age: { fontWeight: "300", color: "rgba(255,255,255,0.86)" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  meta: { color: "rgba(255,255,255,0.78)", fontSize: 13, letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderRadius: 50, paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: "rgba(8,8,8,0.5)", borderWidth: 1, borderColor: "rgba(201,168,76,0.45)",
  },
  chipText: { color: "#E2CD8E", fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  morePhotosHint: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 10, fontStyle: "italic" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "#000" },
});
