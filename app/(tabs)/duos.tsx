import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Touchable } from "../../components/Touchable";
import { glowShadow, type as textType } from "../../constants/style";
import { DURATION_EMPHASIZED, SPRING_SNAPPY, VELOCITY_THRESHOLD } from "../../constants/motion";
import { friendlyError } from "../lib/friendly-error";

const _duoSvg = `<svg fill="#C9A84C" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800px" height="800px" viewBox="0 0 244 256" enable-background="new 0 0 244 256" xml:space="preserve"><path d="M133.781,2c20.372,0,36.888,16.515,36.888,36.888s-16.515,36.888-36.888,36.888S96.893,59.26,96.893,38.888S113.408,2,133.781,2z M236.319,219.99l-59.499-59.315l20.221,5.095c1.454,0.366,2.909,0.541,4.342,0.541c7.926,0,15.144-5.358,17.169-13.395c2.391-9.49-3.364-19.121-12.853-21.512l-59.028-14.871c0,0-49.027-49.344-51.748-52.032c-10.388-10.263-28.497-14.697-43.508,3.387C33.644,89.297,1.893,162.694,1.893,207.654C1.893,233.25,22.643,254,48.239,254c12.105,0,22.133-5.969,27.241-10.038l71.886-57.048l61.152,60.963c3.843,3.831,8.871,5.745,13.9,5.745c5.048,0,10.097-1.93,13.944-5.788C244.039,240.133,244.019,227.667,236.319,219.99z M100.117,120.179l22.609,22.712c2.612,2.624,5.71,4.689,9.095,6.109l-48.014,37.49C87.315,157.998,93.913,137.668,100.117,120.179z"/></svg>`;
const _duoIconUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_duoSvg)}`;

function EmptyNoDuo({ onPress }: { onPress: () => void }) {
  const [titleIdx, setTitleIdx] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const titleOpacity = useRef(new RNAnimated.Value(1)).current;
  const quoteOpacity = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const fade = (anim: RNAnimated.Value, setIdx: (fn: (i: number) => number) => void, len: number) =>
      setInterval(() => {
        RNAnimated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => {
          setIdx((i) => (i + 1) % len);
          RNAnimated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
        });
      }, 5000);

    const t1 = fade(titleOpacity, setTitleIdx, DUO_TITLES.length);
    const t2 = fade(quoteOpacity, setQuoteIdx, DUO_QUOTES.length);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <View style={noduoStyles.wrap}>
      <Image source={{ uri: _duoIconUri }} style={noduoStyles.icon} resizeMode="contain" />
      <RNAnimated.Text style={[noduoStyles.label, { opacity: titleOpacity }]}>
        {DUO_TITLES[titleIdx]}
      </RNAnimated.Text>
      <View style={noduoStyles.divider} />
      <RNAnimated.Text style={[noduoStyles.quote, { opacity: quoteOpacity }]}>
        {DUO_QUOTES[quoteIdx]}
      </RNAnimated.Text>
      <Touchable style={noduoStyles.btn} onPress={onPress}>
        <Text style={noduoStyles.btnText}>Skapa en Duo</Text>
      </Touchable>
    </View>
  );
}

const noduoStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 56,
    paddingBottom: 100,
  },
  icon: {
    width: 56,
    height: 56,
    opacity: 0.75,
    marginBottom: 24,
  },
  label: {
    color: "#C9A84C",
    ...textType.emptyStateLabel,
    textAlign: "center",
    marginBottom: 14,
  },
  divider: {
    width: 20,
    height: 1,
    backgroundColor: "#2A2420",
    marginBottom: 14,
  },
  quote: {
    color: "#2E2820",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 40,
  },
  btn: {
    borderWidth: 1,
    borderColor: "#C9A84C",
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnText: {
    color: "#C9A84C",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppLoader } from "../../components/AppLoader";
import { useUser } from "../../contexts/UserContext";
import { useCoin } from "../../contexts/CoinContext";
import { CoinBalanceChip } from "../../components/CoinBalanceChip";
import { DuoCard } from "../../components/DuoCard";
import { SadIcon } from "../../components/SadIcon";
import {
  duoSwipeLike,
  fetchDuoDeckPage,
  getLikedDuoIds,
  getMyDuos,
  unlockDuoMatch,
  type DuoDeckCard,
  type MyDuo,
} from "../lib/duo-api";

const DUO_TITLES = [
  "DIN HYPE-MAN SAKNAS",
  "INGEN PARTNER IN CRIME ÄN.",
  "INGEN ATT SWIPEA TILLSAMMANS MED ÄN.",
  "DITT DUO VÄNTAR FORTFARANDE.",
];

const DUO_QUOTES = [
  "En vän gör resan bättre.",
  "Två personer. Ett gemensamt uppdrag.",
  "Fyra ögon ser mer än två.",
  "Låt din vän hjälpa dig hitta rätt.",
];

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = Math.min(SW - 48, 420);
const CARD_H = Math.min(SH * 0.65, 580);
const PAGE_SIZE = 20;
const REFILL_THRESHOLD = 5;
const UNLOCK_COST = 80;
const UNLOCK_REWARD = 20;

export default function DuosScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { coinBalance, refreshBalance } = useCoin();

  const [myDuo, setMyDuo] = useState<MyDuo | null>(null);
  const [myDuoIds, setMyDuoIds] = useState<string[]>([]);
  const [loadingDuo, setLoadingDuo] = useState(true);

  const [duoCards, setDuoCards] = useState<DuoDeckCard[]>([]);
  const [duoCurrentIndex, setDuoCurrentIndex] = useState(0);

  const [duoMatchModal, setDuoMatchModal] = useState<{
    visible: boolean;
    otherMember1?: any;
    otherMember2?: any;
    duoMatchId?: string;
    unlocked: boolean;
  }>({ visible: false, unlocked: false });
  const [duoUnlocking, setDuoUnlocking] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  // True when the Duo deck is empty because the fetch actually failed, not
  // because there's genuinely no one left — same distinction as Discovery.
  const [duoLoadError, setDuoLoadError] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const duoPageOffsetRef = useRef(0);
  const duoNoMoreRef = useRef(false);
  const duoLoadingMoreRef = useRef(false);
  const likedDuoSetRef = useRef<Set<string>>(new Set());

  const completeLikeRef = useRef<() => void>(() => {});
  const completeSkipRef = useRef<() => void>(() => {});

  const FLY_OUT_X = SW * 1.3;
  const FLY_DURATION = DURATION_EMPHASIZED;
  const DISTANCE_THRESHOLD = 110;
  const SPRING_BACK = SPRING_SNAPPY;

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const passedRight = e.translationX > DISTANCE_THRESHOLD || (e.translationX > 20 && e.velocityX > VELOCITY_THRESHOLD);
      const passedLeft = e.translationX < -DISTANCE_THRESHOLD || (e.translationX < -20 && e.velocityX < -VELOCITY_THRESHOLD);

      if (passedRight) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        translateX.value = withTiming(FLY_OUT_X, { duration: FLY_DURATION }, (finished) => {
          if (finished) runOnJS(completeLikeRef.current)();
        });
        translateY.value = withTiming(translateY.value + e.velocityY * 0.05, { duration: FLY_DURATION });
      } else if (passedLeft) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        translateX.value = withTiming(-FLY_OUT_X, { duration: FLY_DURATION }, (finished) => {
          if (finished) runOnJS(completeSkipRef.current)();
        });
        translateY.value = withTiming(translateY.value + e.velocityY * 0.05, { duration: FLY_DURATION });
      } else {
        translateX.value = withSpring(0, { ...SPRING_BACK, velocity: e.velocityX });
        translateY.value = withSpring(0, { ...SPRING_BACK, velocity: e.velocityY });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-18, 0, 18], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 100], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-100, -20], [1, 0], Extrapolation.CLAMP),
  }));

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.id) loadMyDuo();
    }, [currentUser?.id])
  );

  useEffect(() => {
    if (myDuo?.status === "active") loadDuoCards();
  }, [myDuo?.id, myDuo?.status]);

  useEffect(() => {
    if (myDuo?.status !== "active") return;
    if (duoCards.length - duoCurrentIndex <= REFILL_THRESHOLD) loadMoreDuoCards();
  }, [duoCards.length, duoCurrentIndex, myDuo?.status]);

  const loadMyDuo = async () => {
    setLoadingDuo(true);
    const duos = await getMyDuos();
    setMyDuo(duos.find((d) => d.isActive) ?? null);
    setMyDuoIds(duos.map((d) => d.id));
    setLoadingDuo(false);
  };

  const loadDuoCards = async () => {
    if (!myDuo?.id) return;
    duoLoadingMoreRef.current = true;
    setDuoLoadError(false);
    try {
      likedDuoSetRef.current = await getLikedDuoIds(myDuo.id);
      duoPageOffsetRef.current = 0;
      duoNoMoreRef.current = false;
      const page = await fetchDuoDeckPage(0, PAGE_SIZE, myDuoIds);
      duoPageOffsetRef.current = page.length;
      if (page.length < PAGE_SIZE) duoNoMoreRef.current = true;
      setDuoCards(page.filter((d) => !likedDuoSetRef.current.has(d.id)));
      setDuoCurrentIndex(0);
    } catch (err) {
      // Previously uncaught — a dropped connection left this stuck on the
      // loading spinner forever with no way out.
      console.log("loadDuoCards error:", err);
      setDuoCards([]);
      setDuoLoadError(true);
    } finally {
      duoLoadingMoreRef.current = false;
    }
  };

  const loadMoreDuoCards = async () => {
    if (!myDuo?.id || duoNoMoreRef.current || duoLoadingMoreRef.current) return;
    duoLoadingMoreRef.current = true;
    try {
      const page = await fetchDuoDeckPage(duoPageOffsetRef.current, PAGE_SIZE, myDuoIds);
      duoPageOffsetRef.current += page.length;
      if (page.length < PAGE_SIZE) duoNoMoreRef.current = true;
      const filtered = page.filter((d) => !likedDuoSetRef.current.has(d.id));
      if (filtered.length > 0) setDuoCards((prev) => [...prev, ...filtered]);
    } catch (err) {
      showToast(friendlyError(err, "Kunde inte hämta fler Duos."));
    } finally {
      duoLoadingMoreRef.current = false;
    }
  };

  const duoCurrentCard = duoCards[duoCurrentIndex];
  const duoNextCard = duoCards[duoCurrentIndex + 1];

  // Mirrors duoCurrentCard every render so the gesture's completion callback
  // (which fires ~240ms after release, once the fly-off animation finishes)
  // still knows which card was on top when the swipe was actually decided —
  // nothing else changes duoCurrentIndex/duoCards during that window.
  const pendingLikeRef = useRef<DuoDeckCard | null>(null);
  pendingLikeRef.current = duoCurrentCard ?? null;

  const completeLike = async () => {
    translateX.value = 0;
    translateY.value = 0;
    const liked = pendingLikeRef.current;
    if (!liked || !myDuo) return;
    setDuoCards((prev) => prev.filter((d) => d.id !== liked.id));
    const result = await duoSwipeLike(myDuo.id, liked.id);
    if (!result.success) {
      // Card's already gone from the deck (optimistic) — same gap as
      // Discovery's completeLike: without this, a dropped connection makes
      // the swipe silently not count, with zero signal to the user.
      showToast(friendlyError({ message: result.error_code }, "Gillningen sparades inte — kolla din anslutning."));
      return;
    }
    if (result.matched && result.duoMatchId) {
      setDuoMatchModal({
        visible: true,
        otherMember1: liked.member1,
        otherMember2: liked.member2,
        duoMatchId: result.duoMatchId,
        unlocked: false,
      });
    }
  };
  completeLikeRef.current = completeLike;

  const completeSkip = () => {
    translateX.value = 0;
    translateY.value = 0;
    setDuoCurrentIndex((prev) => prev + 1);
  };
  completeSkipRef.current = completeSkip;

  const triggerDuoLike = () => {
    if (!duoCurrentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withTiming(FLY_OUT_X, { duration: FLY_DURATION }, (finished) => {
      if (finished) runOnJS(completeLikeRef.current)();
    });
  };

  const triggerDuoSkip = () => {
    if (!duoCurrentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withTiming(-FLY_OUT_X, { duration: FLY_DURATION }, (finished) => {
      if (finished) runOnJS(completeSkipRef.current)();
    });
  };

  const closeDuoMatchModal = () =>
    setDuoMatchModal({ visible: false, unlocked: duoMatchModal.unlocked });

  const handleDuoUnlock = async () => {
    if (!duoMatchModal.duoMatchId) return;
    if (coinBalance < UNLOCK_COST) {
      setDuoMatchModal({ ...duoMatchModal, visible: false });
      router.push("/buy-coins" as any);
      return;
    }
    setDuoUnlocking(true);
    try {
      const result = await unlockDuoMatch(duoMatchModal.duoMatchId);
      if (result.success) {
        await refreshBalance();
        setDuoMatchModal({ ...duoMatchModal, unlocked: true });
      } else if (result.error_code === "INSUFFICIENT_BALANCE") {
        setDuoMatchModal({ ...duoMatchModal, visible: false });
        router.push("/buy-coins" as any);
      }
    } finally {
      setDuoUnlocking(false);
    }
  };

  if (!currentUser) return <AppLoader />;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DUOS</Text>
        <View style={styles.headerRight}>
          <CoinBalanceChip />
          <Touchable style={styles.manageBtn} onPress={() => router.push("/manage-duos" as any)}>
            <Ionicons name="people" size={18} color="#000" />
          </Touchable>
        </View>
      </View>

      {loadingDuo ? null : !myDuo ? (
        <EmptyNoDuo onPress={() => router.push("/manage-duos" as any)} />
      ) : myDuo.status === "pending" ? (
        <View style={styles.stateWrap}>
          <Ionicons name="hourglass-outline" size={56} color="#C9A84C" style={{ opacity: 0.6, marginBottom: 20 }} />
          <Text style={styles.stateTitle}>VÄNTAR PÅ DIN PARTNER</Text>
          <Text style={styles.stateSub}>Din inbjudan väntar på att accepteras.</Text>
          <Touchable style={styles.ctaBtn} onPress={() => router.push("/manage-duos" as any)}>
            <Text style={styles.ctaBtnText}>Hantera duos</Text>
          </Touchable>
        </View>
      ) : (
        <>
          <View style={styles.partnerRow}>
            <Text style={styles.partnerLabel}>
              Duo med {myDuo.partner?.first_name || myDuo.partner?.name || "din partner"}
            </Text>
          </View>

          <GestureDetector gesture={panGesture}>
          <View style={styles.cardArea}>
            {duoCurrentCard ? (
              <>
                {duoNextCard && (
                  <View style={styles.cardNext}>
                    <DuoCard
                      member1={duoNextCard.member1}
                      member2={duoNextCard.member2}
                      width={CARD_W}
                      height={CARD_H}
                    />
                  </View>
                )}
                <Animated.View style={[styles.cardTop, cardAnimatedStyle]}>
                  <DuoCard
                    member1={duoCurrentCard.member1}
                    member2={duoCurrentCard.member2}
                    width={CARD_W}
                    height={CARD_H}
                  />
                  <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
                    <Text style={styles.stampText}>💅 Ja tack</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stamp, styles.nopeStamp, nopeStampStyle]}>
                    <Text style={[styles.stampText, { color: "#FF4458" }]}>❌ Nej tack</Text>
                  </Animated.View>
                </Animated.View>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <SadIcon size={72} />
                {duoLoadError ? (
                  <>
                    <Text style={styles.emptyTitle}>Kunde inte hämta Duos</Text>
                    <Text style={styles.emptyText}>Kolla din anslutning och försök igen.</Text>
                    <Touchable style={styles.ctaBtn} onPress={loadDuoCards}>
                      <Text style={styles.ctaBtnText}>Försök igen</Text>
                    </Touchable>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>Inga fler Duos just nu</Text>
                    <Text style={styles.emptyText}>Kom tillbaka senare!</Text>
                  </>
                )}
              </View>
            )}
          </View>
          </GestureDetector>

          <View style={[styles.actions, !duoCurrentCard && styles.actionsDisabled]}>
            <Touchable
              testID="duo-skip"
              style={[styles.actionBtn, styles.skipBtn]}
              haptic={false}
              onPress={triggerDuoSkip}
              disabled={!duoCurrentCard}
            >
              <Text style={styles.skipIcon}>✕</Text>
            </Touchable>
            <Touchable
              testID="duo-like"
              style={[styles.actionBtn, styles.likeBtn]}
              haptic={false}
              onPress={triggerDuoLike}
              disabled={!duoCurrentCard}
            >
              <Text style={styles.likeIcon}>♥</Text>
            </Touchable>
          </View>
        </>
      )}

      {!!toast && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Duo match modal */}
      <Modal visible={duoMatchModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.matchBox}>
            <Text style={styles.matchEmoji}>♛</Text>
            <Text style={styles.matchTitle}>Era Duos matchade!</Text>
            <Text style={styles.matchText}>
              Ni och {duoMatchModal.otherMember1?.first_name || duoMatchModal.otherMember1?.name}
              {" & "}
              {duoMatchModal.otherMember2?.first_name || duoMatchModal.otherMember2?.name} gillar varandra.
            </Text>
            {duoMatchModal.unlocked ? (
              <>
                <Text style={styles.matchUnlocked}>Chatten är upplåst ✓</Text>
                <Touchable
                  style={styles.unlockBtn}
                  onPress={() => {
                    closeDuoMatchModal();
                    router.push("/(tabs)/matches" as any);
                  }}
                >
                  <Text style={styles.unlockBtnText}>💬 Gå till Matchningar</Text>
                </Touchable>
              </>
            ) : (
              <>
                <Text style={styles.matchSub}>✦ Lås upp chatten för {UNLOCK_COST} Coins</Text>
                <Text style={styles.matchSubSmall}>
                  Er andra Duo delar {Math.floor(UNLOCK_REWARD / 2)} Coins var i belöning
                </Text>
                <Touchable
                  testID="duo-unlock-btn"
                  style={[styles.unlockBtn, duoUnlocking && styles.disabled]}
                  haptic="medium"
                  onPress={handleDuoUnlock}
                  disabled={duoUnlocking}
                >
                  <Text style={styles.unlockBtnText}>
                    {duoUnlocking ? "Låser upp..." : `Lås upp för ${UNLOCK_COST} Coins`}
                  </Text>
                </Touchable>
              </>
            )}
            <Touchable
              style={styles.closeBtn}
              onPress={() => {
                closeDuoMatchModal();
                router.push("/(tabs)/matches" as any);
              }}
            >
              <Text style={styles.closeBtnText}>Se match i Matchningar →</Text>
            </Touchable>
            <Touchable style={styles.laterBtn} onPress={closeDuoMatchModal}>
              <Text style={styles.laterBtnText}>Fortsätt swipa</Text>
            </Touchable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080808", paddingTop: 52 },
  toastWrap: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: "#FF6B8A", borderRadius: 50,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 4, flexShrink: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  manageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#C9A84C",
    alignItems: "center",
    justifyContent: "center",
  },

  partnerRow: { paddingHorizontal: 20, marginBottom: 6 },
  partnerLabel: { color: "#4A4035", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },

  stateWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 56, paddingBottom: 100 },
  stateTitle: { color: "#C9A84C", ...textType.emptyStateLabel, textAlign: "center", marginBottom: 10 },
  stateSub: { color: "#4A4035", ...textType.body, textAlign: "center", marginBottom: 28, maxWidth: 260 },
  ctaBtn: { backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 15, paddingHorizontal: 32 },
  ctaBtnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },

  cardArea: {
    height: CARD_H + 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cardTop: { width: CARD_W, height: CARD_H, zIndex: 1 },
  cardNext: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    transform: [{ scale: 0.94 }, { translateY: 14 }],
    zIndex: 0,
  },
  emptyCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    backgroundColor: "#101010",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1C19",
    gap: 12,
  },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  emptyText: { color: "#4A4035", fontSize: 13 },

  stamp: {
    position: "absolute",
    top: 40,
    borderWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "-20deg" }],
  },
  likeStamp: { left: 20, borderColor: "#C9A84C" },
  nopeStamp: { right: 20, borderColor: "#FF4458", transform: [{ rotate: "20deg" }] },
  stampText: { fontSize: 24, fontWeight: "900", color: "#C9A84C", letterSpacing: 2 },

  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
    paddingVertical: 14,
    paddingBottom: 24,
  },
  actionsDisabled: { opacity: 0.25 },
  // Same deliberate hierarchy as the solo swipe screen — Like is the loud,
  // primary action; Skip is the same size but quiet/outline, not a second
  // identical gold circle.
  actionBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
  },
  skipBtn: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#3A3228" },
  likeBtn: { backgroundColor: "#C9A84C", ...glowShadow(0.28, 16) },
  skipIcon: { fontSize: 20, color: "#8A7A5C", fontWeight: "700" },
  likeIcon: { fontSize: 24, color: "#000", fontWeight: "900" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  matchBox: {
    backgroundColor: "#0D0B09",
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 24,
    alignItems: "center",
    width: "88%",
    borderWidth: 1,
    borderColor: "#2E2A18",
  },
  matchEmoji: { fontSize: 44, marginBottom: 14, color: "#C9A84C" },
  matchTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 8, letterSpacing: 1 },
  matchText: { color: "#887060", fontSize: 15, textAlign: "center", marginBottom: 20 },
  matchUnlocked: { color: "#C9A84C", fontSize: 15, fontWeight: "700", marginBottom: 16 },
  matchSub: { color: "#887060", fontSize: 14, textAlign: "center", marginBottom: 4 },
  matchSubSmall: { color: "#4A4035", fontSize: 12, textAlign: "center", marginBottom: 20 },
  unlockBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
  },
  unlockBtnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  closeBtn: {
    backgroundColor: "#181614",
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1C19",
  },
  closeBtnText: { color: "#C9A84C", fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },
  laterBtn: { paddingVertical: 10, alignItems: "center", width: "100%", marginTop: 4 },
  laterBtnText: { color: "#4A4035", fontSize: 14, fontWeight: "500" },
});
