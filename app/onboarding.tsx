import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { WaveIcon } from "../components/WaveIcon";
import { BirthdayCakeIcon } from "../components/BirthdayCakeIcon";
import { MirrorIcon } from "../components/MirrorIcon";
import { ManIcon, FemaleIcon, NonBinaryIcon } from "../components/GenderIcons";
import { LoveIcon } from "../components/LoveIcon";
import { AllGendersIcon } from "../components/AllGendersIcon";
import { DATING_GOAL_OPTIONS, DatingGoalIcon, toggleDatingGoal } from "../components/DatingGoalOptions";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "./lib/supabase";
import { uploadMedia, type MediaType } from "./lib/upload-media";
import { PhotoCropModal } from "../components/PhotoCropModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { friendlyError } from "./lib/friendly-error";
import { Touchable } from "../components/Touchable";

function uriToDataUrl(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.onload = () => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = reject;
    xhr.open("GET", uri);
    xhr.send();
  });
}

const TOTAL_STEPS = 6;
const MAX_MEDIA = 6;
const MAX_VIDEOS = 2;
const MIN_MEDIA = 2;

type MediaSlot = {
  localUri: string;  // för preview (blob: URL från picker)
  dataUrl: string;   // base64 data URL — sparas direkt i DB, ingen Storage-upload
  type: MediaType;
};

const SLOT_W = Math.floor((Math.min(Dimensions.get("window").width, 500) - 56 - 16) / 3);
const SLOT_H = Math.floor(SLOT_W * 1.28);

const GENDER_OPTIONS = [
  { label: "Man", value: "man" },
  { label: "Kvinna", value: "kvinna" },
  { label: "Annat", value: "annat" },
];

const LOOKING_FOR_OPTIONS = [
  { label: "Kvinna", value: "kvinna" },
  { label: "Man", value: "man" },
  { label: "Alla", value: "alla" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [datingGoal, setDatingGoal] = useState<string[]>([]);
  const [mediaSlots, setMediaSlots] = useState<MediaSlot[]>([]);
  const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const videoCount = mediaSlots.filter((s) => s.type === "video").length;

  const canNext = () => {
    if (step === 1) return firstName.trim().length > 0;
    if (step === 2) {
      const a = parseInt(age, 10);
      return !isNaN(a) && a >= 18 && a <= 99;
    }
    if (step === 3) return gender.length > 0;
    if (step === 4) return lookingFor.length > 0;
    if (step === 6) return mediaSlots.length >= MIN_MEDIA;
    return true;
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else completeOnboarding();
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const pickMedia = async (type: MediaType) => {
    if (mediaSlots.length >= MAX_MEDIA) return;
    if (type === "video" && videoCount >= MAX_VIDEOS) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          type === "video"
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const localUri = result.assets[0].uri;
      if (type === "image") {
        setCropSourceUri(localUri);
        return;
      }
      await uploadPickedMedia(localUri, "video");
    } catch {
      // picker dismissed or unavailable
    }
  };

  const uploadPickedMedia = async (localUri: string, type: MediaType) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('not_authenticated');
      const resp = await fetch(localUri);
      const blob = await resp.blob();
      const mimeType = blob.type || (type === 'video' ? 'video/mp4' : 'image/jpeg');
      const url = await uploadMedia(blob, mimeType, userId, type, localUri);
      setMediaSlots((prev) => [...prev, { localUri, dataUrl: url, type }]);
    } catch {
      setErrorMsg("Kunde inte ladda upp bilden. Försök igen.");
    }
  };

  const handleCropConfirm = async (croppedUri: string) => {
    setCropSourceUri(null);
    await uploadPickedMedia(croppedUri, "image");
  };

  const removeSlot = (localUri: string) => {
    setMediaSlots((prev) => prev.filter((s) => s.localUri !== localUri));
  };

  const completeOnboarding = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // getSession reads from localStorage — no network call, never hangs
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const userEmail = session?.user?.email ?? "";
      if (!userId) {
        setErrorMsg("Du är inte inloggad – gå tillbaka och logga in igen.");
        setLoading(false);
        return;
      }

      const ageNum = parseInt(age, 10);
      const thisYear = new Date().getFullYear();

      const publicUrls = mediaSlots.map((s) => s.dataUrl);

      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        email: userEmail,
        first_name: firstName.trim(),
        last_name: "",
        name: firstName.trim(),
        age: ageNum,
        birth_date: `${thisYear - ageNum}-01-01`,
        gender,
        looking_for: lookingFor,
        dating_goals: datingGoal,
        avatar: publicUrls[0] ?? null,
        images: publicUrls,
        profile_completed: true,
        min_age: 18,
        max_age: 45,
      });

      if (error) {
        setErrorMsg(friendlyError(error, "Kunde inte spara profilen. Försök igen."));
        return;
      }

      router.replace("/(tabs)/swipe");
    } catch (e: any) {
      setErrorMsg(friendlyError(e, "Kunde inte spara profilen. Försök igen."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Progress dots */}
      <View style={[styles.progressRow, { paddingTop: insets.top + 12 }]}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 === step && styles.dotActive,
              i + 1 < step && styles.dotDone,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 1: Name ── */}
        {step === 1 && (
          <View style={styles.stepWrap}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <WaveIcon size={64} />
            </View>
            <Text style={styles.title}>Vad heter du?</Text>
            <Text style={styles.subtitle}>Ditt förnamn syns för dina matcher.</Text>
            <TextInput
              style={styles.bigInput}
              placeholder="Ditt förnamn"
              placeholderTextColor="#444"
              value={firstName}
              onChangeText={setFirstName}
              autoFocus
              maxLength={40}
            />
          </View>
        )}

        {/* ── Step 2: Age ── */}
        {step === 2 && (
          <View style={styles.stepWrap}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <BirthdayCakeIcon size={64} />
            </View>
            <Text style={styles.title}>Hur gammal är du?</Text>
            <Text style={styles.subtitle}>Du måste vara minst 18 år.</Text>
            <TextInput
              style={styles.bigInput}
              placeholder="Din ålder"
              placeholderTextColor="#444"
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              maxLength={2}
              autoFocus
            />
          </View>
        )}

        {/* ── Step 3: Gender ── */}
        {step === 3 && (
          <View style={styles.stepWrap}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <MirrorIcon size={64} />
            </View>
            <Text style={styles.title}>Vem är du?</Text>
            <Text style={styles.subtitle}>Välj det som stämmer bäst.</Text>
            <View style={styles.choiceGrid}>
              {GENDER_OPTIONS.map((opt) => (
                <Touchable
                  key={opt.value}
                  style={[styles.choiceCard, gender === opt.value && styles.choiceCardSelected]}
                  haptic="selection"
                  onPress={() => setGender(opt.value)}
                >
                  {opt.value === "man" && <ManIcon size={28} />}
                  {opt.value === "kvinna" && <FemaleIcon size={28} />}
                  {opt.value === "annat" && <NonBinaryIcon size={28} />}
                  <Text style={[styles.choiceLabel, gender === opt.value && styles.choiceLabelSelected]}>
                    {opt.label}
                  </Text>
                </Touchable>
              ))}
            </View>
          </View>
        )}

        {/* ── Step 4: Looking for ── */}
        {step === 4 && (
          <View style={styles.stepWrap}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <LoveIcon size={64} />
            </View>
            <Text style={styles.title}>Vem söker du?</Text>
            <Text style={styles.subtitle}>Du kan ändra detta senare i Profil.</Text>
            <View style={styles.choiceGrid}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <Touchable
                  key={opt.value}
                  style={[styles.choiceCard, lookingFor === opt.value && styles.choiceCardSelected]}
                  haptic="selection"
                  onPress={() => setLookingFor(opt.value)}
                >
                  {opt.value === "kvinna" && <FemaleIcon size={28} />}
                  {opt.value === "man" && <ManIcon size={28} />}
                  {opt.value === "alla" && <AllGendersIcon size={28} />}
                  <Text style={[styles.choiceLabel, lookingFor === opt.value && styles.choiceLabelSelected]}>
                    {opt.label}
                  </Text>
                </Touchable>
              ))}
            </View>
          </View>
        )}

        {/* ── Step 5: Dating goal ── */}
        {step === 5 && (
          <View style={styles.stepWrap}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <LoveIcon size={64} />
            </View>
            <Text style={styles.title}>Vad söker du?</Text>
            <Text style={styles.subtitle}>Välj ditt syfte — du kan ändra detta senare.</Text>
            <Text style={styles.sectionLabel}>Din intention</Text>
            <View style={styles.chipRow}>
              {DATING_GOAL_OPTIONS.map((opt) => (
                <Touchable
                  key={opt.value}
                  style={[styles.chip, datingGoal.includes(opt.value) && styles.chipSelected]}
                  haptic="selection"
                  onPress={() => setDatingGoal((prev) => toggleDatingGoal(prev, opt.value))}
                >
                  <View style={styles.chipInner}>
                    <DatingGoalIcon value={opt.value} size={18} />
                    <Text style={[styles.chipText, datingGoal.includes(opt.value) && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </View>
                </Touchable>
              ))}
            </View>
          </View>
        )}

        {/* ── Step 6: Photos & Videos ── */}
        {step === 6 && (
          <View style={styles.stepWrap}>
            <Text style={styles.title}>Dina foton</Text>
            <Text style={styles.subtitle}>Minst 2 krävs · Max 2 videos · Max 6 media</Text>

            <Text style={styles.reciprocityHint}>
              Du har {mediaSlots.length} {mediaSlots.length === 1 ? "foto" : "foton"} → du ser {mediaSlots.length} hos andra
            </Text>

            {/* 3-column grid */}
            <View style={styles.mediaGrid}>
              {mediaSlots.map((slot, idx) => (
                <View key={slot.localUri} style={styles.mediaSlot}>
                  <Image
                    source={{ uri: slot.localUri }}
                    style={styles.mediaSlotImage}
                    resizeMode="cover"
                  />
                  {slot.type === "video" && (
                    <View style={styles.videobadge}>
                      <Text style={styles.videobadgeText}>▶</Text>
                    </View>
                  )}
                  <Touchable style={styles.removeSlotBtn} onPress={() => removeSlot(slot.localUri)} hitSlop={10}>
                    <Text style={styles.removeSlotText}>✕</Text>
                  </Touchable>
                  {idx === 0 && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>Huvud</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Empty add-slot */}
              {mediaSlots.length < MAX_MEDIA && (
                <Touchable style={styles.mediaSlotEmpty} onPress={() => pickMedia("image")}>
                  <Text style={styles.mediaSlotPlus}>+</Text>
                </Touchable>
              )}
            </View>

            {/* Inspiration */}
            <View style={styles.inspirationWrap}>
              <Text style={styles.inspirationHeadline}>Visa världen hur fin du är.</Text>
              <Text style={styles.inspirationQuote}>"Du själv, lika mycket som alla andra i hela universum, förtjänar din kärlek."</Text>
              <Text style={styles.inspirationAuthor}>— Buddha</Text>
            </View>

          </View>
        )}

      </ScrollView>

      {!!errorMsg && <Text style={styles.errorMsg}>{errorMsg}</Text>}

      <View style={styles.navRow}>
        <Touchable
          style={styles.backBtn}
          onPress={step > 1 ? goBack : async () => {
            try { await supabase.auth.signOut() } catch {}
            router.replace('/auth')
          }}
        >
          <Text style={styles.backBtnText}>← Tillbaka</Text>
        </Touchable>

        <Touchable
          style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          onPress={goNext}
          disabled={!canNext() || loading}
        >
          <Text style={styles.nextBtnText}>
            {loading ? "Sparar..." : step === TOTAL_STEPS ? "Klar! →" : "Nästa →"}
          </Text>
        </Touchable>
      </View>
    </KeyboardAvoidingView>

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
  container: {
    flex: 1,
    backgroundColor: "#080808",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 60,
    paddingBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1E1C19",
  },
  dotActive: {
    backgroundColor: "#C9A84C",
    width: 22,
    borderRadius: 3,
  },
  dotDone: {
    backgroundColor: "#4A3810",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepWrap: {
    flex: 1,
    paddingTop: 32,
  },
  stepEmoji: {
    fontSize: 44,
    marginBottom: 16,
    textAlign: "center",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    color: "#4A4035",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  reciprocityHint: {
    color: "#C9A84C",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  bigInput: {
    backgroundColor: "#101010",
    color: "#fff",
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#1E1C19",
    marginBottom: 12,
  },
  choiceGrid: {
    gap: 12,
  },
  choiceCard: {
    backgroundColor: "#101010",
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "#1E1C19",
  },
  choiceCardSelected: {
    borderColor: "#C9A84C",
    backgroundColor: "#1E1A0A",
  },
  choiceEmoji: {
    fontSize: 26,
  },
  choiceLabel: {
    color: "#5A5040",
    fontSize: 17,
    fontWeight: "600",
  },
  choiceLabelSelected: {
    color: "#C9A84C",
  },
  chipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionLabel: {
    color: "#3A3530",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    marginTop: 8,
  },
  chipRow: {
    gap: 10,
  },
  chip: {
    backgroundColor: "#101010",
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#1E1C19",
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: "#1E1A0A",
    borderColor: "#C9A84C",
  },
  chipText: {
    color: "#5A5040",
    fontSize: 15,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#C9A84C",
  },
  // Media grid
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
    justifyContent: "center",
  },
  mediaSlot: {
    width: SLOT_W,
    height: SLOT_H,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#101010",
  },
  mediaSlotLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E1C19",
    borderRadius: 12,
  },
  mediaSlotImage: {
    width: "100%",
    height: "100%",
  },
  mediaSlotEmpty: {
    width: SLOT_W,
    height: SLOT_H,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2E2A18",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C0C0C",
  },
  mediaSlotPlus: {
    color: "#3A3530",
    fontSize: 32,
    fontWeight: "300",
  },
  removeSlotBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeSlotText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  videobadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  videobadgeText: {
    color: "#fff",
    fontSize: 10,
  },
  mainBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#C9A84C",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  mainBadgeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "800",
  },
  inspirationWrap: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
    marginBottom: 8,
  },
  inspirationHeadline: {
    color: "#C9A84C",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  inspirationQuote: {
    color: "#3A3020",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  inspirationAuthor: {
    color: "#2A2018",
    fontSize: 11,
    letterSpacing: 1,
    textAlign: "center",
  },
  uploadingNote: {
    color: "#C9A84C",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#111010",
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    minWidth: 100,
  },
  backBtnText: {
    color: "#C9A84C",
    fontSize: 16,
    fontWeight: "600",
  },
  nextBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 140,
    alignItems: "center",
  },
  nextBtnDisabled: {
    opacity: 0.35,
  },
  nextBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  errorMsg: {
    color: "#ff4d4d",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

});
