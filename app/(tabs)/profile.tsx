import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image as CachedImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import ReanimatedView, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { DURATION_NORMAL, SPRING_SNAPPY, PHOTO_VELOCITY_THRESHOLD } from "../../constants/motion";
import { IS_DEMO } from "../../demo/config";
import { demoRuntime } from "../../demo/runtime";
import { Touchable } from "../../components/Touchable";
import { supabase } from "../lib/supabase";
import { uploadMedia } from "../lib/upload-media";
import { useCoin } from "../../contexts/CoinContext";
import { useUser } from "../../contexts/UserContext";
import { PhotoCropModal } from "../../components/PhotoCropModal";
import { RangeSlider } from "../../components/RangeSlider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DATING_GOAL_OPTIONS, DatingGoalIcon, toggleDatingGoal } from "../../components/DatingGoalOptions";
import { DatingGoalsSlide } from "../../components/DatingGoalsSlide";
import { friendlyError } from "../lib/friendly-error";

const { width: SW, height: SH } = Dimensions.get("window");
const MAX_PHOTOS = 6;

const CARD_W = Math.min(SW - 48, 420);
const CARD_H = Math.min(SH * 0.72, 600);

const CONTENT_W = Math.min(SW, 600) - 40;
const GRID_GAP = 8;
const GRID_COLS = 3;
// Supporting photos (everything after the hero) — same uniform tile size
// used throughout the rest of the editor.
const SLOT_SIZE = (CONTENT_W - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
// The hero — back to a real lead photo, full content width, but capped
// well short of the original's ~52% of screen height that read as too
// dominant. 4:5-ish, same card language as Discovery, moderated.
const HERO_W = CONTENT_W;
const HERO_H = Math.min(HERO_W * 1.1, SH * 0.38);

// One deliberate "surface" tone, used everywhere something needs to read as
// a distinct raised element against the near-black page background (row
// groups, goal cells, the empty photo tile, the coins card) — previously
// these each used a slightly different dark gray, which read as unpolished
// even though no single one was wrong on its own.
const SURFACE = "#0C0B09";
const SURFACE_RAISED = "#121008";

// Module-level cache — survives tab switches and component remounts within a session
let _cUid = "";
let _cImages: string[] = [];
let _cMeta: { name: string; age: string; phone: string; minAge: string; maxAge: string; distance: string; email: string; datingGoals: string[] } | null = null;

// A compact, tap-to-edit settings row — label left, value + chevron right,
// value becomes an inline TextInput while editing. Used for every plain
// editable field (Förnamn, Ålder, Telefon) instead of an always-open input,
// per the brief: "Förnamn   Astrid   >" rather than a giant open field.
function ProfileRow({
  label, value, placeholder, editing, editable = true, onPress, onChangeText, onBlur, keyboardType, maxLength,
}: {
  label: string; value: string; placeholder?: string; editing: boolean; editable?: boolean;
  onPress?: () => void; onChangeText?: (t: string) => void; onBlur?: () => void;
  keyboardType?: "default" | "numeric" | "phone-pad"; maxLength?: number;
}) {
  return (
    <Touchable style={styles.row} onPress={editable ? onPress : undefined} disabled={!editable || editing} haptic={false}>
      <Text style={styles.rowLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.rowInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#3A3530"
          autoFocus
          keyboardType={keyboardType}
          maxLength={maxLength}
          onBlur={onBlur}
          onSubmitEditing={onBlur}
          returnKeyType="done"
        />
      ) : (
        <View style={styles.rowValueWrap}>
          <Text style={styles.rowValue} numberOfLines={1}>{value || placeholder || "—"}</Text>
          {editable && <Ionicons name="chevron-forward" size={16} color="#3A3530" />}
        </View>
      )}
    </Touchable>
  );
}


export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(_cMeta?.name ?? "");
  const [age, setAge] = useState(_cMeta?.age ?? "");
  const [email, setEmail] = useState(_cMeta?.email ?? "");
  const [phone, setPhone] = useState(_cMeta?.phone ?? "");
  const [minAge, setMinAge] = useState(_cMeta?.minAge ?? "18");
  const [maxAge, setMaxAge] = useState(_cMeta?.maxAge ?? "45");
  const [distance, setDistance] = useState(_cMeta?.distance ?? "50");
  const [datingGoals, setDatingGoals] = useState<string[]>(_cMeta?.datingGoals ?? []);
  const [images, setImages] = useState<string[]>(_cImages);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);
  // Which row (if any) is expanded into its inline TextInput right now —
  // only one at a time, tap-to-edit instead of everything always open.
  const [editingField, setEditingField] = useState<"name" | "age" | "phone" | null>(null);
  // URIs that failed to load (dropped connection, slow network) — shows a
  // placeholder instead of a blank tile; tracked by URI so one bad load
  // doesn't taint any photo that loads fine.
  const [failedPhotoUris, setFailedPhotoUris] = useState<Set<string>>(new Set());
  const markPhotoFailed = (uri: string) =>
    setFailedPhotoUris((prev) => (prev.has(uri) ? prev : new Set(prev).add(uri)));
  const { coinBalance } = useCoin();
  const { currentUser, refreshUser } = useUser();

  // ── Drag-to-reorder ──────────────────────────────────────────────────────────
  const [dragActive, setDragActive] = useState<number | null>(null);
  const [dragHover, setDragHover] = useState<number | null>(null);
  const dragXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const activeRef = useRef<number | null>(null);
  const imagesRef = useRef<string[]>(images);
  useEffect(() => { imagesRef.current = images; _cImages = images; }, [images]);
  const slotMeasures = useRef<Array<{ x: number; y: number; w: number; h: number } | null>>([]);
  const slotViewRefs = useRef<Array<View | null>>([]);

  const refreshMeasures = () => {
    slotViewRefs.current.forEach((r, i) => {
      r?.measureInWindow((x, y, w, h) => { slotMeasures.current[i] = { x, y, w, h }; });
    });
  };

  const nearestSlot = (px: number, py: number): number | null => {
    let best: number | null = null, bestD = Infinity;
    slotMeasures.current.forEach((s, i) => {
      if (!s) return;
      const d = Math.hypot(px - (s.x + s.w / 2), py - (s.y + s.h / 2));
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  // PanResponder lives on the GRID CONTAINER.
  // onMoveShouldSetPanResponderCapture steals the gesture from the child Pressable
  // after long-press fires and sets activeRef.current.
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => activeRef.current !== null,
    onMoveShouldSetPanResponderCapture: () => activeRef.current !== null,
    onPanResponderMove: (evt) => {
      if (activeRef.current === null) return;
      const { pageX, pageY } = evt.nativeEvent;
      dragXY.setValue({ x: pageX, y: pageY });
      const h = nearestSlot(pageX, pageY);
      setDragHover(h !== activeRef.current ? h : null);
    },
    onPanResponderRelease: (evt) => {
      const aIdx = activeRef.current;
      if (aIdx === null) return;
      const { pageX, pageY } = evt.nativeEvent;
      const h = nearestSlot(pageX, pageY);
      if (h !== null && h !== aIdx) {
        const arr = [...imagesRef.current];
        arr.splice(h, 0, arr.splice(aIdx, 1)[0]);
        setImages(arr);
      }
      activeRef.current = null;
      setDragActive(null);
      setDragHover(null);
    },
    onPanResponderTerminate: () => {
      activeRef.current = null;
      setDragActive(null);
      setDragHover(null);
    },
  })).current;

  const startDrag = (idx: number) => {
    refreshMeasures(); // async, updates slotMeasures for hit testing
    const s = slotMeasures.current[idx]; // cached from onLayout, good enough for ghost start
    const fallbackW = idx === 0 ? HERO_W : SLOT_SIZE;
    const fallbackH = idx === 0 ? HERO_H : SLOT_SIZE;
    dragXY.setValue({ x: (s?.x ?? 0) + (s?.w ?? fallbackW) / 2, y: (s?.y ?? 0) + (s?.h ?? fallbackH) / 2 });
    activeRef.current = idx;
    setDragActive(idx);
    setDragHover(null);
  };

  // Desktop/web: mousedown starts tracking; moving > 4px activates drag
  const onSlotMouseDown = (e: any, idx: number) => {
    if (typeof document === 'undefined') return;
    const startX: number = e.nativeEvent?.pageX ?? e.pageX ?? 0;
    const startY: number = e.nativeEvent?.pageY ?? e.pageY ?? 0;
    refreshMeasures();
    let started = false;

    const move = (me: MouseEvent) => {
      if (!started) {
        if (Math.hypot(me.pageX - startX, me.pageY - startY) < 5) return;
        started = true;
        dragXY.setValue({ x: me.pageX, y: me.pageY });
        activeRef.current = idx;
        setDragActive(idx);
        setDragHover(null);
        return;
      }
      dragXY.setValue({ x: me.pageX, y: me.pageY });
      const h = nearestSlot(me.pageX, me.pageY);
      setDragHover(h !== activeRef.current ? h : null);
    };

    const up = (me: MouseEvent) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (!started) return;
      const aIdx = activeRef.current;
      if (aIdx !== null) {
        const h = nearestSlot(me.pageX, me.pageY);
        if (h !== null && h !== aIdx) {
          const arr = [...imagesRef.current];
          arr.splice(h, 0, arr.splice(aIdx, 1)[0]);
          setImages(arr);
        }
      }
      activeRef.current = null;
      setDragActive(null);
      setDragHover(null);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => { if (currentUser?.id) loadProfile(currentUser.id, currentUser.email ?? ""); }, [currentUser?.id]);

  const loadProfile = async (userId: string, emailVal: string) => {
    if (!userId) return;
    setEmail(emailVal);

    // Meta query — always refresh (tiny payload, < 1 KB)
    supabase.from("profiles")
      .select("name, first_name, age, min_age, max_age, distance, phone, is_admin, dating_goals")
      .eq("id", userId).single()
      .then(({ data }) => {
        if (!data) return;
        const n = data.name || data.first_name || "";
        const a = data.age ? String(data.age) : "";
        const p = data.phone ?? "";
        const mi = data.min_age ? String(data.min_age) : "18";
        const ma = data.max_age ? String(data.max_age) : "45";
        const d = data.distance ? String(data.distance) : "50";
        const dg: string[] = data.dating_goals ?? [];
        _cMeta = { name: n, age: a, phone: p, minAge: mi, maxAge: ma, distance: d, email: emailVal, datingGoals: dg };
        setName(n); setAge(a); setPhone(p); setMinAge(mi); setMaxAge(ma); setDistance(d); setDatingGoals(dg);
        setIsAdmin(data.is_admin ?? false);
      });

    // Images — skip if already cached for this user (can be several MB of base64)
    if (_cUid === userId && _cImages.length > 0) return;

    supabase.from("profiles")
      .select("avatar, images")
      .eq("id", userId).single()
      .then(({ data }) => {
        if (!data) return;
        const imgs: string[] = data.images ?? (data.avatar ? [data.avatar] : []);
        _cUid = userId;
        _cImages = imgs;
        setImages(imgs);
      });
  };

  const pickPhoto = async () => {
    if (images.length >= MAX_PHOTOS) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      setCropSourceUri(result.assets[0].uri);
    } catch { /* dismissed */ }
  };

  const handleCropConfirm = async (croppedUri: string) => {
    setCropSourceUri(null);
    try {
      const userId = currentUser?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('not_authenticated');
      const resp = await fetch(croppedUri);
      const blob = await resp.blob();
      const url = await uploadMedia(blob, blob.type || 'image/jpeg', userId, 'image', croppedUri);
      setImages((prev) => [...prev, url]);
    } catch (err: any) {
      setSaveMsg({ ok: false, text: friendlyError(err, "Kunde inte ladda upp bilden.") });
    }
  };

  const removePhoto = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const openPreview = (idx: number = 0) => {
    setPreviewIndex(idx);
    setPreviewVisible(true);
  };

  const saveProfile = async () => {
    if (images.length < 2) {
      setSaveMsg({ ok: false, text: "Du måste ha minst 2 foton för att spara." });
      return;
    }
    if (!name.trim()) {
      setSaveMsg({ ok: false, text: "Fyll i ditt namn." });
      return;
    }
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 18) {
      setSaveMsg({ ok: false, text: "Ange en giltig ålder (minst 18)." });
      return;
    }

    const userId = currentUser?.id ?? (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      setSaveMsg({ ok: false, text: "Du är inte inloggad. Logga ut och in igen." });
      return;
    }

    setLoading(true);
    setSaveMsg(null);
    try {
      const trimmedName = name.trim().split(" ")[0];
      const { error } = await supabase.from("profiles").update({
        name: trimmedName,
        first_name: trimmedName,
        age: ageNum,
        avatar: images[0] ?? null,
        images,
        distance: Number(distance) || 50,
        min_age: Number(minAge) || 18,
        max_age: Number(maxAge) || 45,
        phone: phone.trim() || null,
        dating_goals: datingGoals,
      }).eq("id", userId);
      if (!error) { _cImages = images; refreshUser(); }
      setSaveMsg(error ? { ok: false, text: friendlyError(error, "Kunde inte spara profilen.") } : { ok: true, text: "Sparat ✓" });
    } catch (e: any) {
      setSaveMsg({ ok: false, text: friendlyError(e, "Kunde inte spara profilen.") });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    _cUid = ""; _cImages = []; _cMeta = null;
    try { await supabase.auth.signOut(); } catch {}
    router.replace("/auth");
  };

  // Demo Mode only: restore every fictional profile, match, chat and coin
  // to the start state, then return to the demo welcome screen.
  const handleDemoReset = async () => {
    demoRuntime?.resetDemo();
    await handleLogout();
  };

  const avatarUri = images[0] || null;

  // Preview modal: dating goals get an extra "slide" appended after photos,
  // same treatment as the real swipe card, so editing here shows exactly
  // what others will see.
  const hasGoalsSlide = datingGoals.length > 0;
  const goalsSlideIndex = images.length;
  const totalPreviewSlides = images.length + (hasGoalsSlide ? 1 : 0);
  const isGoalsSlide = hasGoalsSlide && previewIndex === goalsSlideIndex;

  // Real horizontal paging in the preview modal — same "follows the finger,
  // snaps on distance or velocity" treatment as the Discovery card's photo
  // browser. No competing gesture here (this modal has no swipe-to-decide),
  // so it's a plain Pan, scoped to plain photo-to-photo moves only.
  const previewDragX = useSharedValue(0);
  const canPreviewPrev = !isGoalsSlide && previewIndex > 0;
  const canPreviewNext = !isGoalsSlide && previewIndex < images.length - 1;
  const prevPreviewUri = canPreviewPrev ? images[previewIndex - 1] : null;
  const nextPreviewUri = canPreviewNext ? images[previewIndex + 1] : null;

  const goToPreview = (delta: 1 | -1) => {
    setPreviewIndex((i) => Math.max(0, Math.min(totalPreviewSlides - 1, i + delta)));
  };

  const previewPanGesture = Gesture.Pan()
    .enabled(!isGoalsSlide)
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onUpdate((e) => {
      const min = canPreviewNext ? -CARD_W : 0;
      const max = canPreviewPrev ? CARD_W : 0;
      previewDragX.value = Math.max(min, Math.min(max, e.translationX));
    })
    .onEnd((e) => {
      const threshold = CARD_W * 0.28;
      const passedNext = canPreviewNext && (e.translationX < -threshold || e.velocityX < -PHOTO_VELOCITY_THRESHOLD);
      const passedPrev = canPreviewPrev && (e.translationX > threshold || e.velocityX > PHOTO_VELOCITY_THRESHOLD);

      if (passedNext) {
        previewDragX.value = withTiming(-CARD_W, { duration: DURATION_NORMAL }, (finished) => {
          if (finished) { previewDragX.value = 0; runOnJS(goToPreview)(1); }
        });
      } else if (passedPrev) {
        previewDragX.value = withTiming(CARD_W, { duration: DURATION_NORMAL }, (finished) => {
          if (finished) { previewDragX.value = 0; runOnJS(goToPreview)(-1); }
        });
      } else {
        previewDragX.value = withSpring(0, { ...SPRING_SNAPPY, velocity: e.velocityX });
      }
    });

  const currentPreviewDragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: previewDragX.value }] }));
  const prevPreviewDragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: previewDragX.value - CARD_W }] }));
  const nextPreviewDragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: previewDragX.value + CARD_W }] }));

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} scrollEnabled={dragActive === null}>

        {/* Simple header — no hero, no "moment". Just where you are and the
            one action (preview) that belongs up top. */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profil</Text>
          <Touchable
            style={styles.previewBtn}
            onPress={() => openPreview(0)}
            haptic={false}
            disabled={images.length === 0}
          >
            <Ionicons name="eye-outline" size={14} color={images.length === 0 ? "#4A4035" : "#C9A84C"} />
            <Text style={[styles.previewLink, images.length === 0 && styles.disabled]}>Förhandsgranska</Text>
          </Touchable>
        </View>

        {/* Hero — the lead photo, back to a real moment: full width, soft
            shadow, gradient + name/age overlay, same card language as
            Discovery. Sized to lead without dominating (see HERO_H above).
            Supporting photos sit in a uniform grid below it. */}
        <View {...panResponder.panHandlers}>
          <View
            ref={(r) => { slotViewRefs.current[0] = r as View | null; }}
            onLayout={() => { slotViewRefs.current[0]?.measureInWindow((x, y, w, h) => { slotMeasures.current[0] = { x, y, w, h }; }); }}
            style={[styles.hero, dragActive === 0 && styles.photoSlotDragging, dragHover === 0 && styles.slotHover]}
            // @ts-ignore — web only
            onMouseDown={(e: any) => images.length > 0 && onSlotMouseDown(e, 0)}
          >
            <Touchable
              onPress={images.length > 0 ? () => openPreview(0) : pickPhoto}
              onLongPress={() => images.length > 0 && startDrag(0)}
              delayLongPress={350}
              style={StyleSheet.absoluteFill}
              accessibilityLabel={images.length > 0 ? "Förhandsgranska profil" : "Lägg till foto"}
              accessibilityRole="button"
            >
              {avatarUri && !failedPhotoUris.has(avatarUri) ? (
                <CachedImage source={{ uri: avatarUri }} style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" onError={() => markPhotoFailed(avatarUri)} />
              ) : (
                <View style={[styles.heroImage, styles.heroEmpty]}>
                  <Ionicons name={avatarUri ? "cloud-offline-outline" : "camera-outline"} size={30} color="#4A4035" />
                  <Text style={styles.heroEmptyText}>{avatarUri ? "Kunde inte ladda" : "Lägg till din första bild"}</Text>
                </View>
              )}
            </Touchable>
            {avatarUri && <LinearGradient colors={["transparent", "rgba(0,0,0,0.78)"]} style={styles.heroGradient} pointerEvents="none" />}
            {avatarUri && (
              <View style={styles.heroInfo} pointerEvents="none">
                <Text style={styles.heroName} numberOfLines={1}>{name || "Din profil"}</Text>
                {age ? <Text style={styles.heroAge}>{age} år</Text> : null}
              </View>
            )}
            {avatarUri && dragActive === null && (
              <Touchable style={styles.removeBtn} onPress={() => removePhoto(0)} hitSlop={10} accessibilityLabel="Ta bort foto" accessibilityRole="button">
                <Ionicons name="close" size={13} color="#fff" />
              </Touchable>
            )}
          </View>

          {/* Supporting photos — uniform grid, same tile language used
              everywhere else on the page. */}
          {images.length > 0 && (
            <View style={styles.photoGrid}>
              {images.slice(1).map((uri, i) => {
                const idx = i + 1;
                return (
                  <View
                    key={idx}
                    ref={(r) => { slotViewRefs.current[idx] = r as View | null; }}
                    onLayout={() => { slotViewRefs.current[idx]?.measureInWindow((x, y, w, h) => { slotMeasures.current[idx] = { x, y, w, h }; }); }}
                    style={[styles.slot, dragActive === idx && styles.photoSlotDragging, dragHover === idx && styles.slotHover]}
                    // @ts-ignore — web only
                    onMouseDown={(e: any) => onSlotMouseDown(e, idx)}
                  >
                    <Touchable
                      onPress={() => openPreview(idx)}
                      onLongPress={() => startDrag(idx)}
                      delayLongPress={350}
                      style={StyleSheet.absoluteFill}
                      accessibilityLabel={`Förhandsgranska foto ${idx + 1}`}
                      accessibilityRole="button"
                    >
                      {failedPhotoUris.has(uri) ? (
                        <View style={[styles.slotImage, styles.photoImageFallback]}>
                          <Ionicons name="cloud-offline-outline" size={18} color="#3A3530" />
                        </View>
                      ) : (
                        // @ts-ignore — draggable is web-only
                        <Image source={{ uri }} style={styles.slotImage} resizeMode="cover" draggable={false} onError={() => markPhotoFailed(uri)} />
                      )}
                    </Touchable>
                    {dragActive === null && (
                      <Touchable style={styles.removeBtn} onPress={() => removePhoto(idx)} hitSlop={10} accessibilityLabel="Ta bort foto" accessibilityRole="button">
                        <Ionicons name="close" size={13} color="#fff" />
                      </Touchable>
                    )}
                  </View>
                );
              })}
              {images.length < MAX_PHOTOS && (
                <Touchable style={styles.slotEmpty} onPress={pickPhoto} accessibilityLabel="Lägg till foto" accessibilityRole="button">
                  <Ionicons name="add" size={22} color="#5A5040" />
                </Touchable>
              )}
            </View>
          )}
        </View>
        <Text style={styles.photoHint}>
          {images.length}/{MAX_PHOTOS} foton · Håll in och dra för att ändra ordning
        </Text>

        {/* Identity heading, then the info as compact tap-to-edit rows —
            not giant inputs that are always open. */}
        <Text style={styles.identityHeading} numberOfLines={1}>
          {name || "Ditt namn"}{age ? `, ${age}` : ""}
        </Text>

        <View style={styles.rowGroup}>
          <ProfileRow
            label="Förnamn"
            value={name}
            placeholder="Ditt förnamn"
            editing={editingField === "name"}
            onPress={() => setEditingField("name")}
            onChangeText={setName}
            onBlur={() => setEditingField(null)}
          />
          <View style={styles.rowDivider} />
          <ProfileRow
            label="Ålder"
            value={age}
            placeholder="—"
            editing={editingField === "age"}
            onPress={() => setEditingField("age")}
            onChangeText={setAge}
            onBlur={() => setEditingField(null)}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>

        {/* Dating goals — a balanced 2-column grid: same heights, consistent
            alignment, optically centered text. Selection shows as a thin
            gold border + gold text, not a filled gold background. */}
        <Text style={styles.sectionLabel}>Vad söker du</Text>
        <View style={styles.goalGrid}>
          {DATING_GOAL_OPTIONS.map((opt, i) => {
            const selected = datingGoals.includes(opt.value);
            // An odd-count grid otherwise leaves one tile dangling next to
            // an empty gap — the last tile spans the full row instead, so
            // every row is genuinely full. Also reads as fitting, since
            // "Vet inte" is the one option that's exclusive of the rest.
            const isDangling = DATING_GOAL_OPTIONS.length % 2 === 1 && i === DATING_GOAL_OPTIONS.length - 1;
            return (
              <Touchable
                key={opt.value}
                style={[styles.goalCell, isDangling && styles.goalCellFull, selected && styles.goalCellSelected]}
                haptic="selection"
                onPress={() => setDatingGoals((prev) => toggleDatingGoal(prev, opt.value))}
              >
                <DatingGoalIcon value={opt.value} size={17} />
                <Text style={[styles.goalText, selected && styles.goalTextSelected]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </Touchable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Preferenser</Text>
        <View style={styles.looseGroup}>
          <RangeSlider
            label="Ålder som föredras"
            min={18}
            max={99}
            values={[Number(minAge) || 18, Number(maxAge) || 45]}
            onChange={([lo, hi]) => { setMinAge(String(lo)); setMaxAge(String(hi)); }}
            formatValue={([lo, hi]) => `${lo} - ${hi >= 99 ? "99+" : hi}`}
          />
          <View style={styles.looseDivider} />
          <RangeSlider
            label="Max distans"
            min={1}
            max={200}
            values={[Number(distance) || 50]}
            onChange={([km]) => setDistance(String(km))}
            formatValue={([km]) => km >= 200 ? "200+ km" : `${km} km`}
          />
        </View>

        <Touchable style={[styles.saveBtn, loading && styles.disabled]} haptic="medium" onPress={saveProfile} disabled={loading}>
          <Text style={styles.saveBtnText}>{loading ? "Sparar..." : "Spara ändringar"}</Text>
        </Touchable>

        {!!saveMsg && (
          <Text style={saveMsg.ok ? styles.successText : styles.errorText}>{saveMsg.text}</Text>
        )}

        <View style={styles.divider} />

        {/* Coins — a distinct CTA, not a plain data group, so it keeps its
            card treatment while everything around it stays row-based. */}
        <Touchable style={styles.coinCard} onPress={() => router.push("/buy-coins" as any)}>
          <View style={styles.coinLeft}>
            <Text style={styles.coinLabel}>Coins</Text>
            <Text style={styles.coinValue}>✦ {coinBalance.toLocaleString("sv-SE")}</Text>
          </View>
          <Text style={styles.coinBuy}>Köp fler →</Text>
        </Touchable>

        {/* Account — deliberately the most muted section on the page; this
            is settings, not the dating profile, and shouldn't compete with
            it visually. */}
        <Text style={styles.sectionLabel}>Konto</Text>
        <View style={styles.rowGroup}>
          <ProfileRow label="E-post" value={email} editing={false} editable={false} />
          <View style={styles.rowDivider} />
          <ProfileRow
            label="Telefon"
            value={phone}
            placeholder="Lägg till"
            editing={editingField === "phone"}
            onPress={() => setEditingField("phone")}
            onChangeText={setPhone}
            onBlur={() => setEditingField(null)}
            keyboardType="phone-pad"
          />
        </View>

        {isAdmin && (
          <Touchable style={styles.adminBtnRow} onPress={() => router.push("/admin" as any)}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#C9A84C" />
            <Text style={styles.adminBtnText}>Admin-panel</Text>
          </Touchable>
        )}

        {IS_DEMO && (
          <Touchable style={styles.demoResetBtn} onPress={handleDemoReset} testID="demo-reset-btn">
            <Ionicons name="refresh" size={16} color="#C9A84C" />
            <Text style={styles.demoResetText}>Återställ demo</Text>
          </Touchable>
        )}

        <Touchable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>{IS_DEMO ? "Avsluta demo" : "Logga ut"}</Text>
        </Touchable>
      </ScrollView>

      {/* ── Drag ghost photo ── */}
      {dragActive !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            dragActive === 0 ? styles.hero : styles.slot,
            {
              position: "absolute",
              zIndex: 999,
              left: Animated.subtract(dragXY.x, (dragActive === 0 ? HERO_W : SLOT_SIZE) / 2),
              top: Animated.subtract(dragXY.y, (dragActive === 0 ? HERO_H : SLOT_SIZE) / 2),
              borderWidth: 1.5,
              borderColor: "#C9A84C",
              transform: [{ scale: 1.08 }],
              shadowColor: "#C9A84C",
              shadowOpacity: 0.5,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 16,
            },
          ]}
        >
          <Image source={{ uri: images[dragActive] }} style={dragActive === 0 ? styles.heroImage : styles.slotImage} resizeMode="cover" />
        </Animated.View>
      )}

      {/* ── Profile Preview Modal ── */}
      <Modal visible={previewVisible} transparent animationType="fade">
        {/* RN Modal renders in its own native window on iOS, outside the root
            GestureHandlerRootView — this local one makes sure the drag
            gesture above still receives touches correctly inside it. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.previewOverlay}>
          {/* Close */}
          <Touchable style={styles.previewClose} onPress={() => setPreviewVisible(false)} hitSlop={10} accessibilityLabel="Stäng förhandsvisning" accessibilityRole="button">
            <Text style={styles.previewCloseText}>✕</Text>
          </Touchable>

          <Text style={styles.previewTitle}>Så här ser andra dig</Text>

          {/* Card */}
          <GestureDetector gesture={previewPanGesture}>
          <View style={styles.previewCard}>
            {isGoalsSlide ? (
              <DatingGoalsSlide goals={datingGoals} title="Vad du söker" />
            ) : images.length > 0 ? (
              <>
                {prevPreviewUri && (
                  <ReanimatedView.View style={[styles.previewCardPhoto, prevPreviewDragStyle]}>
                    <CachedImage source={{ uri: prevPreviewUri }} style={styles.previewCardPhoto} contentFit="cover" cachePolicy="memory-disk" />
                  </ReanimatedView.View>
                )}
                {nextPreviewUri && (
                  <ReanimatedView.View style={[styles.previewCardPhoto, nextPreviewDragStyle]}>
                    <CachedImage source={{ uri: nextPreviewUri }} style={styles.previewCardPhoto} contentFit="cover" cachePolicy="memory-disk" />
                  </ReanimatedView.View>
                )}
                <ReanimatedView.View style={[styles.previewCardPhoto, currentPreviewDragStyle]}>
                  {failedPhotoUris.has(images[previewIndex]) ? (
                    <View style={[styles.previewCardPhoto, { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="cloud-offline-outline" size={40} color="#333" />
                    </View>
                  ) : (
                    <CachedImage
                      source={{ uri: images[previewIndex] }}
                      style={styles.previewCardPhoto}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      onError={() => markPhotoFailed(images[previewIndex])}
                    />
                  )}
                </ReanimatedView.View>
              </>
            ) : (
              <View style={[styles.previewCardPhoto, { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="camera-outline" size={40} color="#333" />
              </View>
            )}

            {/* Dot indicators */}
            {totalPreviewSlides > 1 && (
              <View style={styles.previewDots}>
                {Array.from({ length: totalPreviewSlides }).map((_, i) => (
                  <View key={i} style={[styles.previewDot, i === previewIndex && styles.previewDotActive]} />
                ))}
              </View>
            )}

            {/* Tap zones */}
            <View style={styles.tapZones}>
              <Touchable style={styles.tapLeft} onPress={() => setPreviewIndex(i => Math.max(0, i - 1))} />
              <Touchable style={styles.tapRight} onPress={() => setPreviewIndex(i => Math.min(totalPreviewSlides - 1, i + 1))} />
            </View>

            {/* Card info */}
            <View style={styles.previewCardInfo}>
              <Text style={styles.previewCardName}>{name || "Ditt namn"}, {age || "?"}</Text>
              <Text style={styles.previewCardSub}>Det är du! 👑</Text>
            </View>
          </View>
          </GestureDetector>

          {/* Photo counter */}
          {totalPreviewSlides > 0 && (
            <Text style={styles.previewCounter}>{previewIndex + 1} / {totalPreviewSlides}</Text>
          )}
        </View>
        </GestureHandlerRootView>
      </Modal>

      <PhotoCropModal
        visible={!!cropSourceUri}
        uri={cropSourceUri}
        onCancel={() => setCropSourceUri(null)}
        onConfirm={handleCropConfirm}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#080808" },
  content: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 48 },

  // Simple header — title + the one action (preview) that belongs at the
  // top. No photo here at all.
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  pageTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  previewBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  previewLink: { color: "#C9A84C", fontSize: 14, fontWeight: "700" },

  // Hero — the lead photo. Same soft-shadow + surface language as the rest
  // of the page's polish pass, just scaled up for the one element that's
  // meant to lead. Gradient + name/age overlay is the signature hero
  // treatment from the very first version of this screen; it's back, just
  // sized so it leads without taking over the fold.
  hero: {
    width: HERO_W, height: HERO_H, borderRadius: 20, overflow: "hidden", backgroundColor: SURFACE,
    position: "relative", marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  heroImage: { width: "100%", height: "100%" },
  heroEmpty: { alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(201,168,76,0.22)" },
  heroEmptyText: { color: "#4A4035", fontSize: 13, fontWeight: "600" },
  heroGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: "48%" },
  heroInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 18 },
  heroName: { color: "#fff", fontSize: 23, fontWeight: "900", letterSpacing: 0.3 },
  heroAge: { color: "rgba(255,255,255,0.78)", fontSize: 14, marginTop: 2 },

  // Supporting photos — uniform 3-column grid below the hero. Same soft
  // shadow as the hero, scaled down, so the two feel like one family.
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  slot: {
    width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 16, overflow: "hidden", position: "relative",
    backgroundColor: SURFACE,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  slotImage: { width: "100%", height: "100%" },
  slotEmpty: {
    width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 16,
    borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(201,168,76,0.22)",
    alignItems: "center", justifyContent: "center", backgroundColor: SURFACE,
  },
  slotHover: { borderWidth: 2, borderColor: "#C9A84C" },

  // Identity — a plain display heading (not editable here directly; the
  // rows below are where you actually edit Förnamn/Ålder).
  identityHeading: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 0.2, marginTop: 22, marginBottom: 14 },

  // Compact tap-to-edit rows (ProfileRow) — label left, value + chevron
  // right, value becomes an inline input while editing. Rows live on a
  // single soft "surface" panel (subtle tone shift, no border, gentle
  // shadow) instead of bare dividers straight on the page background —
  // enough structure to feel designed without becoming a heavy card.
  rowGroup: {
    backgroundColor: SURFACE, borderRadius: 18, paddingHorizontal: 16, marginBottom: 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3,
  },
  rowDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15 },
  rowLabel: { color: "#8A8070", fontSize: 15 },
  rowValueWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { color: "#fff", fontSize: 15, fontWeight: "600", maxWidth: 220 },
  rowInput: { color: "#C9A84C", fontSize: 15, fontWeight: "600", padding: 0, width: 160, textAlign: "right" },

  // Preferenser keeps the same soft-surface panel language as the rows
  // above, just with a divider between its two sliders instead of a
  // second nested row.
  looseGroup: {
    backgroundColor: SURFACE, borderRadius: 18, padding: 16, marginBottom: 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3,
  },
  looseDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginVertical: 16 },
  inputBare: { color: "#fff", fontSize: 15, padding: 0 },

  divider: { height: 1, backgroundColor: "#141210", marginVertical: 24 },

  coinCard: {
    backgroundColor: SURFACE, borderRadius: 18, padding: 20,
    marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3,
    flexDirection: "row", alignItems: "center",
  },
  coinLeft: { flex: 1 },
  coinLabel: { color: "#5A5040", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 },
  coinValue: { color: "#C9A84C", fontSize: 22, fontWeight: "800" },
  coinBuy: { color: "#C9A84C", fontSize: 13, fontWeight: "600" },

  sectionLabel: { color: "#4A4035", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  photoHint: { color: "#2A2018", fontSize: 11, marginBottom: 12, marginTop: 10 },

  photoImageFallback: { alignItems: "center", justifyContent: "center" },
  // A small glass-like chip, inset from the corner — not a flat circle
  // flush against the edge, which is what made it look bolted-on before.
  removeBtn: {
    position: "absolute", top: 7, right: 7, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(8,8,8,0.72)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  photoSlotDragging: { opacity: 0 },

  emailText: { color: "#fff", fontSize: 15 },
  inputLabel: { color: "#3A3530", fontSize: 11, marginBottom: 4, letterSpacing: 1 },

  // Balanced 2-column grid — same heights, consistent alignment, text
  // optically centered. Unselected cells carry no border at all, just the
  // surface tone; selected reads as a thin gold border plus a soft gold
  // glow — restraint everywhere except the one state gold exists to mark.
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 },
  // Icon ABOVE label, not beside it — a row layout can only center the
  // icon+text pair as a block, which visibly biases the text off-centre
  // once there's an icon eating space on one side. Stacking removes the
  // asymmetry outright: both icon and text centre independently, on every
  // cell, regardless of label length. Height isn't fixed — padding alone
  // guarantees every cell matches since every cell has the same content.
  goalCell: {
    width: (CONTENT_W - 8) / 2,
    paddingVertical: 14, paddingHorizontal: 8, borderRadius: 14,
    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: "transparent",
  },
  // The odd one out spans the full row — no dangling tile next to an empty
  // gap, every row genuinely full width.
  goalCellFull: { width: CONTENT_W },
  goalCellSelected: {
    borderColor: "#C9A84C", backgroundColor: SURFACE_RAISED,
    shadowColor: "#C9A84C", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  goalText: { color: "#6A6052", fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  goalTextSelected: { color: "#C9A84C" },

  saveBtn: {
    backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 12,
    shadowColor: "#C9A84C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  saveBtnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  duosBtn: { borderRadius: 50, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#2E2A18", marginBottom: 10, backgroundColor: "#101010" },
  duosBtnText: { color: "#C9A84C", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  adminBtnRow: { flexDirection: "row", gap: 8, borderRadius: 50, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#C9A84C", marginBottom: 10, backgroundColor: "#0D0B04" },
  adminBtnText: { color: "#C9A84C", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  demoResetBtn: { flexDirection: "row", gap: 8, borderRadius: 50, paddingVertical: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#C9A84C40", marginBottom: 12 },
  demoResetText: { color: "#C9A84C", fontSize: 15, fontWeight: "600" },
  logoutBtn: { borderRadius: 50, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#1E1C19" },
  logoutText: { color: "#3A3530", fontSize: 15, fontWeight: "600" },
  successText: { color: "#C9A84C", textAlign: "center", fontSize: 14, fontWeight: "600", marginBottom: 12 },
  errorText: { color: "#ff4d4d", textAlign: "center", fontSize: 14, marginBottom: 12 },
  disabled: { opacity: 0.5 },


  // Preview modal
  previewOverlay: { flex: 1, backgroundColor: "#080808", alignItems: "center", justifyContent: "center", paddingTop: 60, paddingBottom: 40 },
  previewClose: { position: "absolute", top: 52, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: "#181614", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2E2A18" },
  previewCloseText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  previewTitle: { color: "#3A3020", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 },
  previewCard: { width: CARD_W, height: CARD_H, borderRadius: 24, overflow: "hidden", backgroundColor: "#101010", position: "relative" },
  previewCardPhoto: { width: "100%", height: "100%", position: "absolute" },
  previewDots: { position: "absolute", top: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5, zIndex: 10 },
  previewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  previewDotActive: { backgroundColor: "#C9A84C", width: 20, borderRadius: 3 },
  tapZones: { position: "absolute", top: 0, left: 0, right: 0, bottom: 80, flexDirection: "row", zIndex: 5 },
  tapLeft: { width: "35%", height: "100%" },
  tapRight: { width: "65%", height: "100%" },
  previewCardInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 22, paddingBottom: 28, backgroundColor: "rgba(0,0,0,0.7)" },
  previewCardName: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  previewCardSub: { color: "rgba(201,168,76,0.8)", fontSize: 13, marginTop: 4 },
  previewCounter: { color: "#2A2018", fontSize: 12, marginTop: 16, letterSpacing: 1 },
});
