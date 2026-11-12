import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Touchable } from "../../components/Touchable";
import { BottomSheet } from "../../components/BottomSheet";
import { glowShadow } from "../../constants/style";
import { DURATION_NORMAL, DURATION_EMPHASIZED, SPRING_SNAPPY, VELOCITY_THRESHOLD, PHOTO_VELOCITY_THRESHOLD } from "../../constants/motion";
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppLoader } from "../../components/AppLoader";
import { useUser } from "../../contexts/UserContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { unlockMatch, sendRose, activateBoost } from "../lib/wallet-api";
import { blockUser, reportUser, REPORT_REASONS } from "../lib/moderation-api";
import { friendlyError } from "../lib/friendly-error";
import { getMyDuos } from "../lib/duo-api";
import { useCoin } from "../../contexts/CoinContext";
import { CoinBalanceChip } from "../../components/CoinBalanceChip";
import { RoseIcon } from "../../components/RoseIcon";
import { BoostIcon } from "../../components/BoostIcon";
import { LogoIcon } from "../../components/LogoIcon";
import { SadIcon } from "../../components/SadIcon";
import { DatingGoalsSlide } from "../../components/DatingGoalsSlide";


const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = Math.min(SW - 32, 420);
const CARD_H = Math.min(SH * 0.62, 560);

const UNLOCK_COST = 80;
const UNLOCK_REWARD = 20;
const ROSE_COST = 300;
const ROSE_REPLY_REWARD = 150;
const PAGE_SIZE = 20;
const REFILL_THRESHOLD = 5;

export default function Swipe() {
  const insets = useSafeAreaInsets();
  const { currentUser, refreshUser } = useUser();
  const [cards, setCards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  // True when the deck is empty because the fetch actually failed (bad
  // connection), not because there's genuinely no one left to show —
  // the empty-state render below needs to tell those two apart.
  const [loadError, setLoadError] = useState(false);
  // Photo URLs that failed to load (dropped/slow connection, expired storage
  // link) — tracked by URI so a retry on a fresh profile/photo isn't tainted
  // by an earlier failure elsewhere in the deck.
  const [failedPhotoUris, setFailedPhotoUris] = useState<Set<string>>(new Set());
  const markPhotoFailed = (uri: string) =>
    setFailedPhotoUris((prev) => (prev.has(uri) ? prev : new Set(prev).add(uri)));
  const [filter, setFilter] = useState({ minAge: "18", maxAge: "45", maxDistance: "100" });
  const [filterVisible, setFilterVisible] = useState(false);
  const [matchModal, setMatchModal] = useState<{
    visible: boolean;
    partner?: any;
    matchId?: string;
    unlocked: boolean;
  }>({ visible: false, unlocked: false });
  const [unlocking, setUnlocking] = useState(false);
  const [roseModal, setRoseModal] = useState(false);
  const [roseMessage, setRoseMessage] = useState("");
  const [roseSending, setRoseSending] = useState(false);
  const [roseError, setRoseError] = useState("");
  const [roseToast, setRoseToast] = useState("");
  const [boostModal, setBoostModal] = useState(false);
  const [boostSending, setBoostSending] = useState(false);
  const [boostCountdown, setBoostCountdown] = useState("");

  const [reportModal, setReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportTargetName, setReportTargetName] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [reportSending, setReportSending] = useState(false);

  // Own Duo teammate(s) — excluded from the solo deck below (you shouldn't
  // see your own Duo partner as an individually-swipeable profile). Duo
  // *swiping* itself lives entirely in the Duos tab (components/DuoCard.tsx,
  // app/(tabs)/duos.tsx) — this screen only needs the exclusion list.
  const [myDuoPartnerIds, setMyDuoPartnerIds] = useState<string[]>([]);

  const { coinBalance, refreshBalance } = useCoin();

  // Card drag position — Reanimated shared values, driven entirely on the UI
  // thread via Gesture Handler so dragging never round-trips through the JS
  // thread/bridge per frame (this is what makes the swipe feel native/60fps
  // instead of laggy).
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const touchStartX = useRef(0);
  const blockedIdsRef = useRef<Set<string>>(new Set());

  // Photo carousel drag offset — separate from the card's own translateX so
  // paging through photos and swiping the card can never fight over the
  // same value; composed as an Exclusive gesture below so a short, quick
  // horizontal drag pages photos while a longer/faster one falls through to
  // the card swipe.
  const photoDragX = useSharedValue(0);

  // Refs used inside the gesture callback to avoid stale closures
  const photoIndexRef = useRef(0);
  const visiblePhotosCountRef = useRef(1);
  // These run AFTER the card has finished flying off-screen (see panGesture
  // below) — they're the actual state/API-mutating side of a swipe.
  const completeLikeRef = useRef<() => void>(() => {});
  const completeSkipRef = useRef<() => void>(() => {});

  // Paginated deck loading — avoids fetching every profile's photos up front
  const pageOffsetRef = useRef(0);
  const noMoreCardsRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const likedSetRef = useRef<Set<string>>(new Set());

  // How far past the edge a card flies before we swap in the next one, and
  // how long that exit takes. Release decision reacts to BOTH how far the
  // card travelled AND how fast it was moving — a short, fast flick swipes
  // just as confidently as a slow long drag, matching how the gesture
  // actually reads to a thumb. Shared motion constants (constants/motion.ts)
  // so this matches every other drag-to-decide gesture in the app.
  const FLY_OUT_X = SW * 1.3;
  const FLY_DURATION = DURATION_EMPHASIZED;
  const DISTANCE_THRESHOLD = 110;
  const SPRING_BACK = SPRING_SNAPPY;

  // Rebuilt fresh every render (cheap, and the recommended Gesture Handler
  // pattern) so it always closes over the latest ref callbacks below —
  // no useRef-memoization needed the way the old PanResponder required.
  // onUpdate/onEnd run on the UI thread; only the haptic (not worklet-safe)
  // and the post-animation state update cross back to JS, via runOnJS.
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
        // Under threshold — spring back, carrying the release velocity through
        // so the snap-back continues the gesture's own momentum instead of
        // restarting from a standstill.
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

  useEffect(() => {
    if (currentUser) loadCards();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadMyDuo();
  }, [currentUser]);

  // Boost countdown ticker
  useEffect(() => {
    const tick = () => {
      const exp = currentUser?.boost_expires_at;
      if (!exp) { setBoostCountdown(""); return; }
      const diff = Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 1000));
      if (diff === 0) { setBoostCountdown(""); return; }
      const m = Math.floor(diff / 60).toString().padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      setBoostCountdown(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentUser?.boost_expires_at]);

  const handleBoost = async () => {
    setBoostSending(true);
    const result = await activateBoost();
    setBoostSending(false);
    setBoostModal(false);
    if (result.success) {
      await Promise.all([refreshBalance(), refreshUser()]);
    } else if (result.error_code === "INSUFFICIENT_BALANCE") {
      router.push("/buy-coins" as any);
    }
  };



  // Only the columns the swipe deck actually renders — profiles.images holds
  // full base64 photo data (hundreds of KB each), so pulling "*" for the whole
  // remaining deck up front made every load pull down megabytes at once.
  const fetchProfilesPage = async (offset: number) => {
    if (!currentUser?.id) return [];
    let query = supabase
      .from("profiles")
      .select("id, first_name, name, age, gender, distance, avatar, images, dating_goals")
      .neq("id", currentUser.id)
      .eq("profile_completed", true);

    // Your own Duo teammates (across ANY of your duos) shouldn't show up as
    // individually-swipeable profiles.
    if (myDuoPartnerIds.length > 0) query = query.not("id", "in", `(${myDuoPartnerIds.join(",")})`);
    if (blockedIdsRef.current.size > 0) query = query.not("id", "in", `(${[...blockedIdsRef.current].join(",")})`);

    const { data, error } = await query
      .order("boost_expires_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    // Thrown (not swallowed to []) — a genuine fetch failure must not render
    // identically to "you've seen everyone", which tells the user to widen
    // their filters instead of pointing at the actual problem.
    if (error) throw error;
    return data ?? [];
  };

  const applyFilters = (rows: any[]) => {
    const minAge = Number(filter.minAge) || 18;
    const maxAge = Number(filter.maxAge) || 99;
    const lookingFor = currentUser?.looking_for ?? "alla";

    return rows.filter((p: any) => {
      if (likedSetRef.current.has(p.id)) return false;
      if (blockedIdsRef.current.has(p.id)) return false;
      if (lookingFor && lookingFor !== "alla" && p.gender !== lookingFor) return false;
      if (p.age !== null && p.age !== undefined) {
        const age = Number(p.age);
        if (age < minAge || age > maxAge) return false;
      }
      return true;
    });
  };

  const loadCards = async () => {
    if (!currentUser?.id) return;
    // Set synchronously (before any await) so the refill effect below can't
    // race this initial load and double-fetch the first page.
    loadingMoreRef.current = true;
    setLoadError(false);
    try {
      // Fetch likes and blocks in parallel — both are independent
      const [{ data: likedRows }, { data: blockedRows }] = await Promise.all([
        supabase.from("likes").select("to_user").eq("from_user", currentUser.id),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUser.id),
      ]);
      likedSetRef.current = new Set((likedRows ?? []).map((r: any) => r.to_user));
      blockedIdsRef.current = new Set((blockedRows ?? []).map((r: any) => r.blocked_id));

      pageOffsetRef.current = 0;
      noMoreCardsRef.current = false;

      const page = await fetchProfilesPage(0);
      pageOffsetRef.current = page.length;
      if (page.length < PAGE_SIZE) noMoreCardsRef.current = true;

      setCards(applyFilters(page));
      setCurrentIndex(0);
      setPhotoIndex(0);
      photoIndexRef.current = 0;
    } catch (err) {
      // Previously uncaught here — a dropped connection left the deck stuck
      // on its initial loading state forever, with no sign anything had
      // gone wrong. Now it lands on a real "couldn't load, try again" state.
      console.log("loadCards error:", err);
      setCards([]);
      setLoadError(true);
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const loadMoreCards = async () => {
    if (!currentUser?.id || noMoreCardsRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const page = await fetchProfilesPage(pageOffsetRef.current);
      pageOffsetRef.current += page.length;
      if (page.length < PAGE_SIZE) noMoreCardsRef.current = true;
      const filtered = applyFilters(page);
      if (filtered.length > 0) setCards(prev => [...prev, ...filtered]);
    } catch (err) {
      // A failed top-up isn't worth a blocking error state — the current
      // card is still fine — but it should say something instead of just
      // quietly never refilling the deck again.
      showRoseToast(friendlyError(err, "Kunde inte hämta fler profiler."));
    } finally {
      loadingMoreRef.current = false;
    }
  };

  // Top up the deck before the user runs out of already-fetched cards
  useEffect(() => {
    if (!currentUser?.id) return;
    if (cards.length - currentIndex <= REFILL_THRESHOLD) loadMoreCards();
  }, [cards.length, currentIndex, currentUser?.id]);

  const loadMyDuo = async () => {
    const duos = await getMyDuos();
    setMyDuoPartnerIds(duos.map((d) => d.partner?.id).filter(Boolean) as string[]);
  };

  const currentCard = cards[currentIndex];

  // Reciprocal visibility: viewer can see as many photos as they have themselves
  const myPhotoCount = Math.max(1, currentUser?.images?.length ?? 1);
  const allPhotos: string[] = currentCard?.images?.length > 0
    ? currentCard.images
    : currentCard?.avatar ? [currentCard.avatar] : [];
  const visiblePhotos = allPhotos.slice(0, myPhotoCount);

  // Dating goals get an extra "slide" appended after the real photos — never
  // a filter, purely an info card so photos stay clean.
  const currentDatingGoals: string[] = currentCard?.dating_goals ?? [];
  const hasGoalsSlide = currentDatingGoals.length > 0;
  const goalsSlideIndex = visiblePhotos.length;
  const totalSlides = visiblePhotos.length + (hasGoalsSlide ? 1 : 0);
  const isGoalsSlide = hasGoalsSlide && photoIndex === goalsSlideIndex;
  const currentPhotoUrl = !isGoalsSlide ? (visiblePhotos[photoIndex] ?? visiblePhotos[0] ?? null) : null;

  // Keep ref in sync with derived value — includes the goals slide so tap
  // navigation can advance onto it and clamp there.
  visiblePhotosCountRef.current = Math.max(1, totalSlides);

  // Real horizontal paging between photos — follows the finger with a
  // neighbour photo sliding in from the edge, snaps on distance OR velocity,
  // springs back otherwise. Scoped to plain photos only (not the goals
  // slide, which is a different component) and to a tight, short-range
  // activation window so it never competes with the card's own swipe:
  // Exclusive() below gives this gesture first refusal on near-horizontal
  // drags, and anything it doesn't claim (bigger movement, or no neighbour
  // to reveal) falls through to the card-swipe gesture untouched.
  const canPagePrev = !isGoalsSlide && photoIndex > 0;
  const canPageNext = !isGoalsSlide && photoIndex < visiblePhotos.length - 1;
  const prevPhotoUrl = canPagePrev ? visiblePhotos[photoIndex - 1] : null;
  const nextPagingPhotoUrl = canPageNext ? visiblePhotos[photoIndex + 1] : null;

  const PHOTO_DISTANCE_THRESHOLD = CARD_W * 0.28;

  const goToPhoto = (delta: 1 | -1) => {
    const next = Math.max(0, Math.min(visiblePhotosCountRef.current - 1, photoIndexRef.current + delta));
    photoIndexRef.current = next;
    setPhotoIndex(next);
  };

  const photoPanGesture = Gesture.Pan()
    .enabled(!isGoalsSlide && totalSlides > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onUpdate((e) => {
      // Clamp so you can't drag past a photo that doesn't exist.
      const min = canPageNext ? -CARD_W : 0;
      const max = canPagePrev ? CARD_W : 0;
      photoDragX.value = Math.max(min, Math.min(max, e.translationX));
    })
    .onEnd((e) => {
      const passedNext = canPageNext && (e.translationX < -PHOTO_DISTANCE_THRESHOLD || e.velocityX < -PHOTO_VELOCITY_THRESHOLD);
      const passedPrev = canPagePrev && (e.translationX > PHOTO_DISTANCE_THRESHOLD || e.velocityX > PHOTO_VELOCITY_THRESHOLD);

      if (passedNext) {
        photoDragX.value = withTiming(-CARD_W, { duration: DURATION_NORMAL }, (finished) => {
          if (finished) {
            photoDragX.value = 0;
            runOnJS(goToPhoto)(1);
          }
        });
      } else if (passedPrev) {
        photoDragX.value = withTiming(CARD_W, { duration: DURATION_NORMAL }, (finished) => {
          if (finished) {
            photoDragX.value = 0;
            runOnJS(goToPhoto)(-1);
          }
        });
      } else {
        photoDragX.value = withSpring(0, { ...SPRING_SNAPPY, velocity: e.velocityX });
      }
    });

  const photoExclusiveGesture = Gesture.Exclusive(photoPanGesture, panGesture);

  const currentPhotoDragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: photoDragX.value }] }));
  const prevPhotoDragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: photoDragX.value - CARD_W }] }));
  const nextPhotoDragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: photoDragX.value + CARD_W }] }));

  // Runs once the card has finished animating off-screen — the actual
  // state/API side of a like. The next card is already sitting underneath
  // (rendered as styles.nextCard), so resetting translateX/Y here happens
  // off-screen from the user's perspective, not as a visible jump.
  const completeLike = async () => {
    translateX.value = 0;
    translateY.value = 0;
    if (!currentCard || !currentUser) return;

    const likedCard = currentCard;
    setCards(prev => prev.filter(c => c.id !== likedCard.id));
    setPhotoIndex(0);
    photoIndexRef.current = 0;

    const { error: likeError } = await supabase.from("likes").insert([{ from_user: currentUser.id, to_user: likedCard.id }]);
    if (likeError && likeError.code !== "23505") {
      // Card is already gone from the deck (optimistic) — without this the
      // swipe silently fails to register on a dropped connection and the
      // user has no way to know, including losing what would've been a match.
      showRoseToast(friendlyError(likeError, "Gillningen sparades inte — kolla din anslutning."));
      return;
    }
    const { data: reciprocal, error: checkError } = await supabase.from("likes").select("*").eq("from_user", likedCard.id).eq("to_user", currentUser.id);
    if (!checkError && reciprocal && reciprocal.length > 0) await createOrUpdateMatch(likedCard);
  };
  completeLikeRef.current = completeLike;

  const completeSkip = () => {
    translateX.value = 0;
    translateY.value = 0;
    setCurrentIndex(prev => prev + 1);
    setPhotoIndex(0);
    photoIndexRef.current = 0;
  };
  completeSkipRef.current = completeSkip;

  // Button-triggered like/skip (the heart/X circles) get the same fly-off
  // motion as a completed drag, instead of the card just vanishing — one
  // consistent physical response regardless of how the swipe was made.
  const triggerLike = () => {
    if (!currentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withTiming(FLY_OUT_X, { duration: FLY_DURATION }, (finished) => {
      if (finished) runOnJS(completeLikeRef.current)();
    });
  };

  const triggerSkip = () => {
    if (!currentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withTiming(-FLY_OUT_X, { duration: FLY_DURATION }, (finished) => {
      if (finished) runOnJS(completeSkipRef.current)();
    });
  };

  const openReportModal = (card: any) => {
    setReportTargetId(card.id);
    setReportTargetName((card.first_name || card.name || "").split(" ")[0]);
    setSelectedReason("");
    setReportModal(true);
  };

  const submitBlockOnly = async () => {
    if (!reportTargetId) return;
    setReportSending(true);
    try {
      const result = await blockUser(reportTargetId);
      blockedIdsRef.current.add(reportTargetId);
      if (result?.refunded) {
        setRoseToast("Dina coins har återbetalats.");
        setTimeout(() => setRoseToast(""), 3500);
      }
    } finally {
      setReportSending(false);
      setReportModal(false);
      setSelectedReason("");
      completeSkipRef.current();
    }
  };

  const submitReport = async () => {
    if (!selectedReason || !reportTargetId) return;
    setReportSending(true);
    try {
      const [, blockResult] = await Promise.all([
        reportUser(reportTargetId, selectedReason),
        blockUser(reportTargetId),
      ]);
      blockedIdsRef.current.add(reportTargetId);
      if (blockResult?.refunded) {
        setRoseToast("Dina coins har återbetalats.");
        setTimeout(() => setRoseToast(""), 3500);
      }
    } finally {
      setReportSending(false);
      setReportModal(false);
      setSelectedReason("");
      completeSkipRef.current();
    }
  };

  const createOrUpdateMatch = async (partner: any) => {
    const sorted = [currentUser.id, partner.id].sort();
    const user1 = sorted[0], user2 = sorted[1];
    const { data: matchResult, error: matchError } = await supabase
      .from("matches")
      .insert({ user1, user2, match_locked: true, paid_by: null, chat_unlocked: false })
      .select("id").single();
    if (matchError && matchError.code !== "23505") { console.log("Kunde inte skapa match:", matchError.message); return; }
    if (matchError?.code === "23505") {
      const { data: existing } = await supabase.from("matches").select("id, chat_unlocked").eq("user1", user1).eq("user2", user2).maybeSingle();
      if (!existing) return;
      setMatchModal({ visible: true, partner, matchId: existing.id, unlocked: existing.chat_unlocked });
      return;
    }
    setMatchModal({ visible: true, partner, matchId: matchResult?.id, unlocked: false });
  };

  const handlePayReveal = async () => {
    if (!currentUser || !matchModal.partner || !matchModal.matchId) return;
    if (coinBalance < UNLOCK_COST) { setMatchModal({ ...matchModal, visible: false }); router.push("/buy-coins" as any); return; }
    setUnlocking(true);
    try {
      const result = await unlockMatch(matchModal.matchId);
      if (result.success || result.error_code === "ALREADY_UNLOCKED") { await refreshBalance(); setMatchModal({ ...matchModal, unlocked: true }); }
      else if (result.error_code === "INSUFFICIENT_BALANCE") { setMatchModal({ ...matchModal, visible: false }); router.push("/buy-coins" as any); }
    } catch (err) { console.error("Unlock error:", err); }
    finally { setUnlocking(false); }
  };

  const closeMatchModal = () => setMatchModal({ visible: false, unlocked: matchModal.unlocked });

  const showRoseToast = (msg: string) => { setRoseToast(msg); setTimeout(() => setRoseToast(""), 3000); };

  const handleSendRose = async () => {
    if (!currentCard || !currentUser) return;
    if (!roseMessage.trim()) { setRoseError("Skriv ett meddelande."); return; }
    if (coinBalance < ROSE_COST) { setRoseModal(false); router.push("/buy-coins" as any); return; }
    setRoseSending(true); setRoseError("");
    const result = await sendRose(currentCard.id, roseMessage);
    setRoseSending(false);
    if (result.success || result.error_code === "ALREADY_SENT") {
      await refreshBalance(); setRoseModal(false); setRoseMessage(""); completeSkipRef.current();
      showRoseToast(`Rose skickad till ${currentCard.name}!`);
    } else if (result.error_code === "INSUFFICIENT_BALANCE") {
      setRoseModal(false); router.push("/buy-coins" as any);
    } else {
      setRoseError("Något gick fel. Försök igen.");
    }
  };

  if (!currentUser) return <AppLoader />;

  const nextCard = cards[currentIndex + 1];
  const nextCardPhotos: string[] = nextCard?.images?.length > 0 ? nextCard.images : nextCard?.avatar ? [nextCard.avatar] : [];
  const nextCardPhoto = nextCardPhotos[0] ?? null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <LogoIcon size={26} />
          <Text style={styles.logo} numberOfLines={1}>LOVEBACK</Text>
        </View>
        <View style={styles.headerRight}>
          <CoinBalanceChip />
          {/* One grouped utility pill instead of two separate floating
              circles — reads as a single designed control, not two buttons
              that happened to land next to each other. */}
          <View style={[styles.utilityGroup, boostCountdown ? styles.utilityGroupBoostActive : null]}>
            <Touchable
              style={styles.utilityBtn}
              onPress={() => boostCountdown ? null : setBoostModal(true)}
              accessibilityLabel={boostCountdown ? `Boost aktiv, ${boostCountdown} kvar` : "Boosta din profil"}
              accessibilityRole="button"
            >
              {boostCountdown
                ? <Text style={styles.utilityBoostText}><BoostIcon size={13} /> {boostCountdown}</Text>
                : <BoostIcon size={17} />}
            </Touchable>
            <View style={styles.utilityDivider} />
            <Touchable style={styles.utilityBtn} onPress={() => setFilterVisible(true)} accessibilityLabel="Filter" accessibilityRole="button">
              <Ionicons name="options-outline" size={17} color="#C9A84C" />
            </Touchable>
          </View>
        </View>
      </View>


      {/* Card stack */}
      <GestureDetector gesture={photoExclusiveGesture}>
      <View style={styles.cardArea}>
        {currentCard ? (
          <>
            {/* Background (next) card */}
            {nextCard && (
              <View style={[styles.card, styles.nextCard]}>
                {nextCardPhoto && <Image source={{ uri: nextCardPhoto }} style={styles.cardPhoto} contentFit="cover" cachePolicy="memory-disk" />}
              </View>
            )}

            {/* Animated top card */}
            <Animated.View style={[styles.card, cardAnimatedStyle]}>
              {/* Current photo, video, or the dating-goals info slide */}
              {isGoalsSlide ? (
                <DatingGoalsSlide
                  goals={currentDatingGoals}
                  title={`Vad ${(currentCard.first_name || currentCard.name || "").split(" ")[0]} söker`}
                />
              ) : (
                <>
                  {/* Neighbour photos peek in from the edge while dragging */}
                  {prevPhotoUrl && (
                    <Animated.View style={[styles.cardPhoto, prevPhotoDragStyle]}>
                      <Image source={{ uri: prevPhotoUrl }} style={styles.cardPhoto} contentFit="cover" cachePolicy="memory-disk" />
                    </Animated.View>
                  )}
                  {nextPagingPhotoUrl && (
                    <Animated.View style={[styles.cardPhoto, nextPhotoDragStyle]}>
                      <Image source={{ uri: nextPagingPhotoUrl }} style={styles.cardPhoto} contentFit="cover" cachePolicy="memory-disk" />
                    </Animated.View>
                  )}
                  <Animated.View style={[styles.cardPhoto, currentPhotoDragStyle]}>
                    {currentPhotoUrl && !failedPhotoUris.has(currentPhotoUrl) && (
                      <Image
                        source={{ uri: currentPhotoUrl }}
                        style={styles.cardPhoto}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                        onError={() => markPhotoFailed(currentPhotoUrl)}
                      />
                    )}
                    {currentPhotoUrl?.toLowerCase().endsWith(".mp4") && (
                      <View style={styles.videoPlayOverlay}>
                        <Text style={styles.videoPlayIcon}>▶</Text>
                      </View>
                    )}
                    {(!currentPhotoUrl || failedPhotoUris.has(currentPhotoUrl)) && (
                      <View style={[styles.cardPhoto, styles.cardPhotoFallback]}>
                        <Ionicons name="person" size={72} color="#2A2620" />
                      </View>
                    )}
                  </Animated.View>
                </>
              )}

              {/* Left / right tap zones for photo navigation */}
              {totalSlides > 1 && (
                <View style={styles.photoTapZones} pointerEvents="box-none">
                  <Touchable
                    style={styles.photoTapLeft}
                    haptic={false}
                    scaleTo={1}
                    accessibilityLabel="Föregående foto"
                    accessibilityRole="button"
                    onPress={() => {
                      const next = Math.max(0, photoIndexRef.current - 1);
                      photoIndexRef.current = next;
                      setPhotoIndex(next);
                    }}
                  />
                  <Touchable
                    style={styles.photoTapRight}
                    haptic={false}
                    scaleTo={1}
                    accessibilityLabel="Nästa foto"
                    accessibilityRole="button"
                    onPress={() => {
                      const next = Math.min(visiblePhotosCountRef.current - 1, photoIndexRef.current + 1);
                      photoIndexRef.current = next;
                      setPhotoIndex(next);
                    }}
                  />
                </View>
              )}

              {/* Photo dot indicators */}
              {totalSlides > 1 && (
                <View style={styles.photoDots}>
                  {Array.from({ length: totalSlides }).map((_, i) => (
                    <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
                  ))}
                </View>
              )}

              {/* Dark gradient at bottom */}
              <View style={styles.cardGradient} />

              {/* Report button — top-right corner */}
              <Touchable
                style={styles.cardReportBtn}
                onPress={() => openReportModal(currentCard)}
                hitSlop={8}
                accessibilityLabel="Rapportera profil"
                accessibilityRole="button"
              >
                <Ionicons name="flag-outline" size={16} color="#fff" style={{ opacity: 0.85 }} />
              </Touchable>

              {/* Like / Nope stamp */}
              <Animated.View style={[styles.stamp, styles.likeStamp, likeStampStyle]}>
                <Text style={styles.stampText}>💅 Ja tack</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.nopeStamp, nopeStampStyle]}>
                <Text style={[styles.stampText, { color: "#FF4458" }]}>❌ Nej tack</Text>
              </Animated.View>

              {/* Card info */}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{(currentCard.first_name || currentCard.name || "").split(" ")[0]}, {currentCard.age}</Text>
                <Text style={styles.cardSub}>{currentCard.distance ?? 5} km bort</Text>
                {visiblePhotos.length < allPhotos.length && (
                  <Text style={styles.morePhotosHint}>+{allPhotos.length - visiblePhotos.length} fler foton synliga med fler egna foton</Text>
                )}
              </View>

            </Animated.View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <SadIcon size={80} />
            {loadError ? (
              <>
                <Text style={styles.emptyTitle}>Kunde inte hämta profiler</Text>
                <Text style={styles.emptyText}>Kolla din anslutning och försök igen.</Text>
                <Touchable style={styles.emptyCardBtn} onPress={loadCards}>
                  <Text style={styles.emptyCardBtnText}>Försök igen</Text>
                </Touchable>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Inga fler profiler</Text>
                <Text style={styles.emptyText}>Prova ett större sökområde.</Text>
                <Touchable style={styles.emptyCardBtn} onPress={() => setFilterVisible(true)}>
                  <Text style={styles.emptyCardBtnText}>Justera filter</Text>
                </Touchable>
              </>
            )}
          </View>
        )}
      </View>
      </GestureDetector>

      {/* Action buttons */}
      <View style={[styles.actions, !currentCard && styles.actionsDisabled]}>
        <Touchable style={[styles.actionBtn, styles.skipBtn]} haptic={false} scaleTo={0.92} onPress={triggerSkip} disabled={!currentCard} accessibilityLabel="Nej tack" accessibilityRole="button">
          <Text style={styles.skipIcon}>✕</Text>
        </Touchable>
        <Touchable style={[styles.actionBtn, styles.roseBtn]} scaleTo={0.92} onPress={() => { setRoseError(""); setRoseModal(true); }} disabled={!currentCard} accessibilityLabel="Skicka en Rose" accessibilityRole="button">
          <RoseIcon size={20} />
        </Touchable>
        <Touchable style={[styles.actionBtn, styles.likeBtn]} haptic={false} scaleTo={0.92} onPress={triggerLike} disabled={!currentCard} accessibilityLabel="Ja tack" accessibilityRole="button">
          <Text style={styles.likeIcon}>♥</Text>
        </Touchable>
      </View>

      {/* Rose toast */}
      {!!roseToast && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{roseToast}</Text>
        </View>
      )}

      {/* Filter sheet — reached directly from the header icon */}
      <BottomSheet visible={filterVisible} onClose={() => { setFilterVisible(false); loadCards(); }} sheetStyle={styles.filterSheet}>
        <Text style={styles.filterTitle}>Filter</Text>
        <Text style={styles.filterLabel}>Ålder: {filter.minAge} – {filter.maxAge} år</Text>
        <View style={styles.filterRow}>
          <TextInput style={styles.filterInput} placeholder="Min" placeholderTextColor="#555"
            keyboardType="numeric" value={filter.minAge} onChangeText={(v) => setFilter({ ...filter, minAge: v })} />
          <Text style={styles.filterDash}>–</Text>
          <TextInput style={styles.filterInput} placeholder="Max" placeholderTextColor="#555"
            keyboardType="numeric" value={filter.maxAge} onChangeText={(v) => setFilter({ ...filter, maxAge: v })} />
        </View>
        <Text style={styles.filterLabel}>Max distans: {filter.maxDistance} km</Text>
        <TextInput style={styles.filterInput} placeholder="km" placeholderTextColor="#555"
          keyboardType="numeric" value={filter.maxDistance} onChangeText={(v) => setFilter({ ...filter, maxDistance: v })} />
        <Touchable style={styles.filterApply} haptic="medium" onPress={() => { setFilterVisible(false); loadCards(); }}>
          <Text style={styles.filterApplyText}>Tillämpa</Text>
        </Touchable>
      </BottomSheet>

      {/* Boost sheet */}
      <BottomSheet visible={boostModal} onClose={() => setBoostModal(false)} sheetStyle={styles.roseSheet}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <BoostIcon size={22} />
          <Text style={[styles.roseSheetTitle, { marginBottom: 0, marginLeft: 8 }]}>Boosta din profil</Text>
        </View>
        <Text style={styles.roseSheetSub}>
          Din profil visas längst upp i andras feeds i 30 minuter.{"\n"}
          Kostar 200 Coins.
        </Text>
        <View style={styles.roseCostRow}>
          <Text style={styles.roseCostLabel}>✦ 200 Coins</Text>
          <Text style={styles.roseBalance}>Saldo: {coinBalance.toLocaleString("sv-SE")}</Text>
        </View>
        <Touchable
          style={[styles.roseSendBtn, boostSending && styles.disabled]}
          haptic="medium"
          onPress={handleBoost}
          disabled={boostSending}
        >
          {boostSending ? (
            <Text style={styles.roseSendBtnText}>Aktiverar...</Text>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <BoostIcon size={18} color="#000" />
              <Text style={styles.roseSendBtnText}>Aktivera Boost</Text>
            </View>
          )}
        </Touchable>
        <Touchable style={styles.laterBtn} onPress={() => setBoostModal(false)}>
          <Text style={styles.laterBtnText}>Avbryt</Text>
        </Touchable>
      </BottomSheet>

      {/* Rose compose sheet */}
      <BottomSheet visible={roseModal} onClose={() => { setRoseModal(false); setRoseError(""); }} sheetStyle={styles.roseSheet}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <RoseIcon size={22} />
          <Text style={[styles.roseSheetTitle, { marginBottom: 0, marginLeft: 8 }]}>Skicka en Rose</Text>
        </View>
        {currentCard && (
          <Text style={styles.roseSheetSub}>
            Hoppa över matchningen — skriv direkt till {currentCard.name}.{"\n"}
            Svarar de, får de {ROSE_REPLY_REWARD} ✦ som tack.
          </Text>
        )}
        <TextInput
          style={styles.roseInput}
          placeholder="Skriv något fint..."
          placeholderTextColor="#444"
          value={roseMessage}
          onChangeText={setRoseMessage}
          multiline
          maxLength={300}
        />
        {!!roseError && <Text style={styles.roseErrorText}>{roseError}</Text>}
        <View style={styles.roseCostRow}>
          <Text style={styles.roseCostLabel}>✦ {ROSE_COST} Coins</Text>
          <Text style={styles.roseBalance}>Saldo: {coinBalance.toLocaleString("sv-SE")}</Text>
        </View>
        <Touchable style={[styles.roseSendBtn, roseSending && styles.disabled]} haptic="medium" onPress={handleSendRose} disabled={roseSending}>
          {roseSending ? (
            <Text style={styles.roseSendBtnText}>Skickar...</Text>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <RoseIcon size={18} color="#000" />
              <Text style={styles.roseSendBtnText}>Skicka Rose</Text>
            </View>
          )}
        </Touchable>
        <Touchable style={styles.laterBtn} onPress={() => { setRoseModal(false); setRoseError(""); }}>
          <Text style={styles.laterBtnText}>Avbryt</Text>
        </Touchable>
      </BottomSheet>

      {/* Report sheet */}
      <BottomSheet visible={reportModal} onClose={() => setReportModal(false)} sheetStyle={styles.reportSheet}>
        <Text style={styles.reportSheetTitle}>Rapportera {reportTargetName}</Text>
        {REPORT_REASONS.map(reason => (
          <Touchable
            key={reason}
            style={[styles.reportOption, selectedReason === reason && styles.reportOptionSelected]}
            onPress={() => setSelectedReason(reason)}
          >
            <Text style={styles.reportOptionText}>{reason}</Text>
            {selectedReason === reason && <Text style={styles.reportOptionCheck}>✓</Text>}
          </Touchable>
        ))}
        <Touchable
          style={[styles.reportSubmitBtn, reportSending && { opacity: 0.4 }]}
          onPress={submitBlockOnly}
          disabled={reportSending}
        >
          <Text style={styles.reportSubmitText}>{reportSending ? "Skickar..." : "Blockera"}</Text>
        </Touchable>
        <Touchable
          style={[styles.reportBlockBtn, (!selectedReason || reportSending) && { opacity: 0.4 }]}
          onPress={submitReport}
          disabled={!selectedReason || reportSending}
        >
          <Text style={styles.reportBlockText}>Blockera och rapportera</Text>
        </Touchable>
        <Touchable onPress={() => setReportModal(false)}>
          <Text style={styles.reportCancelText}>Avbryt</Text>
        </Touchable>
      </BottomSheet>

      {/* Match modal */}
      <Modal visible={matchModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.matchBox}>
            <Text style={styles.matchEmoji}>♛</Text>
            <Text style={styles.matchTitle}>Det är en match!</Text>
            <Text style={styles.matchText}>Du och {matchModal.partner?.name || "någon"} gillar varandra.</Text>
            {matchModal.unlocked ? (
              <>
                <Text style={styles.matchUnlocked}>Chatten är upplåst ✓</Text>
                <Touchable style={styles.unlockBtn} onPress={() => { closeMatchModal(); router.push("/(tabs)/matches" as any); }}>
                  <Text style={styles.unlockBtnText}>💬 Gå till Matchningar</Text>
                </Touchable>
              </>
            ) : (
              <>
                <Text style={styles.matchSub}>✦ Lås upp chatten för {UNLOCK_COST} Coins</Text>
                <Text style={styles.matchSubSmall}>Din match får {UNLOCK_REWARD} Coins i belöning</Text>
                <Touchable style={[styles.unlockBtn, unlocking && styles.disabled]} haptic="medium" onPress={handlePayReveal} disabled={unlocking}>
                  <Text style={styles.unlockBtnText}>{unlocking ? "Låser upp..." : `✦ Lås upp för ${UNLOCK_COST} Coins`}</Text>
                </Touchable>
              </>
            )}
            <Touchable style={styles.closeBtn} onPress={() => { closeMatchModal(); router.push("/(tabs)/matches" as any); }}>
              <Text style={styles.closeBtnText}>Se match i Matchningar →</Text>
            </Touchable>
            <Touchable style={styles.laterBtn} onPress={closeMatchModal}>
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
  loadingText: { color: "#fff", textAlign: "center", marginTop: 100, fontSize: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  // logoRow can shrink (and its text ellipsize) before headerRight ever
  // loses space — the filter/boost buttons are real actions and must never
  // get pushed off-screen by a long coin balance or a wide logo.
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 },
  logo: { color: "#C9A84C", fontSize: 15, fontWeight: "700", letterSpacing: 6, fontFamily: "Georgia" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  utilityGroup: {
    flexDirection: "row", alignItems: "center", height: 36, borderRadius: 18,
    backgroundColor: "#101010", borderWidth: 1, borderColor: "#1E1C19",
  },
  utilityGroupBoostActive: { borderColor: "#C9A84C40" },
  utilityBtn: { minWidth: 36, height: 36, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  utilityDivider: { width: 1, height: 16, backgroundColor: "#1E1C19" },
  utilityBoostText: { fontSize: 13, color: "#C9A84C", fontWeight: "700" },
  cardArea: { height: CARD_H + 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  card: { width: CARD_W, height: CARD_H, borderRadius: 24, overflow: "hidden", backgroundColor: "#101010", ...glowShadow(0.08, 24), zIndex: 1 },
  nextCard: { position: "absolute", transform: [{ scale: 0.94 }, { translateY: 14 }], zIndex: 0, shadowOpacity: 0 },
  cardPhoto: { width: "100%", height: "100%", position: "absolute" },
  cardPhotoFallback: { backgroundColor: "#141210", alignItems: "center", justifyContent: "center" },
  photoTapZones: { position: "absolute", top: 0, left: 0, right: 0, bottom: "30%", flexDirection: "row", zIndex: 5 },
  photoTapLeft: { flex: 4 },
  photoTapRight: { flex: 6 },
  cardReportBtn: { position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", zIndex: 20 },
  reportSheet: { backgroundColor: "#111010", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 24 },
  reportSheetTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 20, textAlign: "center" },
  reportOption: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#1A1815", marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reportOptionSelected: { backgroundColor: "#1E1A10", borderWidth: 1, borderColor: "#C9A84C" },
  reportOptionText: { color: "#fff", fontSize: 15 },
  reportOptionCheck: { color: "#C9A84C", fontSize: 16, fontWeight: "700" },
  reportSubmitBtn: { backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 14, alignItems: "center", marginTop: 16, marginBottom: 8 },
  reportSubmitText: { color: "#000", fontWeight: "800", fontSize: 15 },
  reportBlockBtn: { backgroundColor: "#1A1815", borderRadius: 50, paddingVertical: 14, alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#3A2A1A" },
  reportBlockText: { color: "#C9A84C", fontWeight: "700", fontSize: 14 },
  reportCancelText: { color: "#4A4035", fontSize: 14, textAlign: "center", paddingVertical: 8 },
  photoDots: { position: "absolute", top: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5, zIndex: 10 },
  photoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  photoDotActive: { backgroundColor: "#C9A84C", width: 20, borderRadius: 3 },
  cardGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: CARD_H * 0.5, backgroundColor: "rgba(0,0,0,0.0)", borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  stamp: { position: "absolute", top: 40, borderWidth: 3, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, transform: [{ rotate: "-20deg" }] },
  likeStamp: { left: 20, borderColor: "#C9A84C" },
  nopeStamp: { right: 20, borderColor: "#FF4458", transform: [{ rotate: "20deg" }] },
  stampText: { fontSize: 24, fontWeight: "900", color: "#C9A84C", letterSpacing: 2 },
  cardInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 22, paddingBottom: 28, backgroundColor: "rgba(0,0,0,0.7)" },
  cardName: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 0.3 },
  cardSub: { color: "rgba(201,168,76,0.7)", fontSize: 13, marginTop: 3, letterSpacing: 0.5 },
  morePhotosHint: { color: "#5A4E38", fontSize: 12, marginTop: 6, fontStyle: "italic" },
  emptyCard: { width: CARD_W, height: CARD_H, borderRadius: 24, backgroundColor: "#101010", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1E1C19" },
  emptyEmoji: { fontSize: 44, marginBottom: 16 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8, letterSpacing: 1 },
  emptyText: { color: "#4A4035", fontSize: 13 },
  emptyCardBtn: { marginTop: 20, borderWidth: 1, borderColor: "#C9A84C", borderRadius: 50, paddingVertical: 12, paddingHorizontal: 24 },
  emptyCardBtnText: { color: "#C9A84C", fontWeight: "700", fontSize: 14 },
  actions: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 22, paddingVertical: 14, paddingBottom: 24 },
  actionsDisabled: { opacity: 0.25 },
  // Deliberate hierarchy instead of three identical loud circles: Like is
  // the primary action (solid, biggest, the only one that keeps the glow).
  // Skip is the same size but quiet — outline only, no fill. Rose is
  // smaller and tucked between them, since it's a rarer, secondary action
  // that shouldn't visually compete with the two everyday ones.
  actionBtn: { width: 58, height: 58, borderRadius: 29, justifyContent: "center", alignItems: "center" },
  skipBtn: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#3A3228" },
  likeBtn: { backgroundColor: "#C9A84C", ...glowShadow(0.28, 16) },
  skipIcon: { fontSize: 20, color: "#8A7A5C", fontWeight: "700" },
  likeIcon: { fontSize: 24, color: "#000", fontWeight: "900" },
  roseBtn: { backgroundColor: "#0D0C0A", width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#3A2E14" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  filterSheet: { backgroundColor: "#101010", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48, borderTopWidth: 1, borderTopColor: "#1E1C19" },
  filterTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 20, letterSpacing: 1 },
  filterLabel: { color: "#887060", fontSize: 12, marginBottom: 8, marginTop: 12, letterSpacing: 0.5 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterDash: { color: "#3A3530", fontSize: 18 },
  filterInput: { flex: 1, backgroundColor: "#181614", color: "#fff", borderRadius: 12, padding: 14, fontSize: 15, textAlign: "center", borderWidth: 1, borderColor: "#1E1C19" },
  filterApply: { backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  filterApplyText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  matchBox: { backgroundColor: "#0D0B09", borderRadius: 24, padding: 28, marginHorizontal: 24, alignItems: "center", alignSelf: "center", width: "88%", borderWidth: 1, borderColor: "#2E2A18" },
  matchEmoji: { fontSize: 44, marginBottom: 14, color: "#C9A84C" },
  matchTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 8, letterSpacing: 1 },
  matchText: { color: "#887060", fontSize: 15, textAlign: "center", marginBottom: 20 },
  matchUnlocked: { color: "#C9A84C", fontSize: 15, fontWeight: "700", marginBottom: 16 },
  matchSub: { color: "#887060", fontSize: 14, textAlign: "center", marginBottom: 4 },
  matchSubSmall: { color: "#4A4035", fontSize: 12, textAlign: "center", marginBottom: 20 },
  unlockBtn: { backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12, width: "100%", alignItems: "center" },
  unlockBtnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  closeBtn: { backgroundColor: "#181614", borderRadius: 50, paddingVertical: 15, paddingHorizontal: 24, width: "100%", alignItems: "center", borderWidth: 1, borderColor: "#1E1C19" },
  closeBtnText: { color: "#C9A84C", fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },
  laterBtn: { paddingVertical: 10, alignItems: "center", width: "100%", marginTop: 4 },
  laterBtnText: { color: "#4A4035", fontSize: 14, fontWeight: "500" },
  roseSheet: { backgroundColor: "#101010", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48, borderTopWidth: 1, borderTopColor: "#1E1C19" },
  roseSheetTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8, textAlign: "center", letterSpacing: 0.5 },
  roseSheetSub: { color: "#5A5040", fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 16 },
  roseInput: { backgroundColor: "#181614", color: "#fff", borderRadius: 14, padding: 16, fontSize: 15, minHeight: 90, textAlignVertical: "top", borderWidth: 1, borderColor: "#1E1C19", marginBottom: 10 },
  roseErrorText: { color: "#ff4d4d", fontSize: 13, textAlign: "center", marginBottom: 8 },
  roseCostRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  roseCostLabel: { color: "#C9A84C", fontSize: 15, fontWeight: "700" },
  roseBalance: { color: "#4A4035", fontSize: 13 },
  roseSendBtn: { backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 16, alignItems: "center", marginBottom: 10 },
  roseSendBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },
  toastWrap: { position: "absolute", bottom: 120, alignSelf: "center", backgroundColor: "#FF6B8A", borderRadius: 50, paddingVertical: 10, paddingHorizontal: 20 },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  videoPlayOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  videoPlayIcon: { fontSize: 48, color: "rgba(255,255,255,0.9)" },
});
