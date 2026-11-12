import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Touchable } from "../components/Touchable";
import { Avatar } from "../components/Avatar";
import { BottomSheet } from "../components/BottomSheet";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import {
  buyDuoSlot,
  createDuoInvite,
  fetchDuoMembers,
  getMyDuos,
  getMyDuoSlotInfo,
  joinDuo,
  leaveDuo,
  setActiveDuo,
  type DuoDeckMember,
  type MyDuo,
} from "./lib/duo-api";
import { DuoCard } from "../components/DuoCard";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = Math.min(SW - 48, 420);
const CARD_H = Math.min(SH * 0.72, 600);

function avatarUri(partner: MyDuo["partner"]) {
  return partner?.avatar || "https://randomuser.me/api/portraits/lego/1.jpg";
}

function partnerName(partner: MyDuo["partner"]) {
  return partner?.first_name || partner?.name || "Väntar på partner";
}

export default function ManageDuosScreen() {
  const insets = useSafeAreaInsets();
  const [duos, setDuos] = useState<MyDuo[]>([]);
  const [slotInfo, setSlotInfo] = useState<{ slots: number; used: number }>({ slots: 1, used: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [buyingSlot, setBuyingSlot] = useState(false);

  const [setupVisible, setSetupVisible] = useState(false);
  const [setupStep, setSetupStep] = useState<"choice" | "created">("choice");
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [codePlaceholder, setCodePlaceholder] = useState("Ange koden här");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [joinExpanded, setJoinExpanded] = useState(false);

  useEffect(() => {
    if (joinExpanded) {
      const hints = [
        "Sesam öppna dig",
        "Ange den hemliga koden",
        "Lösenordet, tack",
        "Vad är lösenordet?",
        "Din inbjudan väntar...",
        "Rätt kod öppnar allt",
        "Pssst — koden?",
      ];
      setCodePlaceholder(hints[Math.floor(Math.random() * hints.length)]);
    }
  }, [joinExpanded]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewMembers, setPreviewMembers] = useState<{
    member1: DuoDeckMember;
    member2: DuoDeckMember;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const [rows, info] = await Promise.all([getMyDuos(), getMyDuoSlotInfo()]);
    setDuos(rows);
    setSlotInfo(info);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const openSetup = () => {
    setSetupStep("choice");
    setSetupError("");
    setJoinCode("");
    setJoinExpanded(false);
    setSetupVisible(true);
  };

  const handleCreateInvite = async () => {
    setSetupLoading(true);
    setSetupError("");
    const result = await createDuoInvite();
    setSetupLoading(false);
    if (result.success && result.inviteCode) {
      setCreatedCode(result.inviteCode);
      setSetupStep("created");
    } else if (result.error_code !== "TOO_MANY_DUOS") {
      setSetupError("Kunde inte skapa Duo-inbjudan. Försök igen.");
    }
  };

  const handleBuySlot = async () => {
    setBuyingSlot(true);
    setSetupError("");
    const result = await buyDuoSlot();
    setBuyingSlot(false);
    if (result.success) {
      setSlotInfo((prev) => ({ ...prev, slots: result.newSlots ?? prev.slots + 1 }));
    } else if (result.error_code === "INSUFFICIENT_BALANCE") {
      setSetupError("Du har inte tillräckligt med coins.");
    } else {
      setSetupError("Något gick fel. Försök igen.");
    }
  };

  const handleShare = async (code: string) => {
    try {
      await Share.share({ message: `Gå med i min Duo på LoveBack! Kod: ${code}` });
    } catch { /* dismissed */ }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { setSetupError("Ange en kod."); return; }
    setSetupLoading(true);
    setSetupError("");
    const result = await joinDuo(joinCode.trim());
    setSetupLoading(false);
    if (result.success) {
      setSetupVisible(false);
      await load();
    } else {
      const messages: Record<string, string> = {
        CODE_NOT_FOUND: "Koden hittades inte.",
        CODE_ALREADY_USED: "Koden är redan använd.",
        CANNOT_JOIN_OWN_INVITE: "Du kan inte gå med i din egen inbjudan.",
        TOO_MANY_DUOS: "Du har nått max antal Duos.",
      };
      setSetupError(messages[result.error_code ?? ""] ?? "Något gick fel. Försök igen.");
    }
  };

  const handleSetActive = async (duoId: string) => {
    setBusyId(duoId);
    await setActiveDuo(duoId);
    await load();
    setBusyId(null);
  };

  const handleLeave = async (duoId: string) => {
    setBusyId(duoId);
    await leaveDuo(duoId);
    await load();
    setBusyId(null);
  };

  const openPreview = async (duoId: string) => {
    const members = await fetchDuoMembers(duoId);
    if (members) {
      setPreviewMembers(members);
      setPreviewVisible(true);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Touchable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/duos" as any)}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Touchable>
        <Text style={styles.title}>HANTERA DUOS</Text>
        <Touchable testID="duos-add" style={styles.addBtn} onPress={openSetup}>
          <Ionicons name="add" size={20} color="#000" />
        </Touchable>
      </View>

      {duos.length === 0 && !loading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyLabel}>INGA DUOS ÄN</Text>
          <Text style={styles.emptySub}>Skapa en ny Duo eller gå med via en kod.</Text>
          <Touchable style={styles.ctaBtn} onPress={openSetup}>
            <Text style={styles.ctaBtnText}>Skapa en Duo</Text>
          </Touchable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {duos.map((duo) => (
            <View key={duo.id} testID="duo-row" style={styles.row}>
              <Avatar uri={avatarUri(duo.partner)} size={48} style={styles.avatar} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {duo.status === "pending"
                    ? `Väntar — kod ${duo.inviteCode}`
                    : partnerName(duo.partner)}
                </Text>
                <Text style={styles.rowSub}>
                  {duo.status === "pending"
                    ? "Ej accepterad ännu"
                    : duo.isActive
                    ? "Aktiv för swipe"
                    : "Inaktiv"}
                </Text>
              </View>

              <View style={styles.rowActions}>
                {duo.status === "pending" ? (
                  <Touchable style={styles.smallBtn} onPress={() => handleShare(duo.inviteCode)}>
                    <Ionicons name="share-outline" size={16} color="#C9A84C" />
                  </Touchable>
                ) : (
                  <>
                    <Touchable
                      testID={`duo-preview-${duo.id}`}
                      style={styles.smallBtn}
                      onPress={() => openPreview(duo.id)}
                    >
                      <Ionicons name="eye-outline" size={16} color="#C9A84C" />
                    </Touchable>
                    <Touchable
                      testID={`duo-set-active-${duo.id}`}
                      style={[styles.smallBtn, duo.isActive && styles.smallBtnActive]}
                      onPress={() => !duo.isActive && handleSetActive(duo.id)}
                      disabled={busyId === duo.id}
                    >
                      <Ionicons
                        name={duo.isActive ? "star" : "star-outline"}
                        size={16}
                        color="#C9A84C"
                      />
                    </Touchable>
                  </>
                )}
                <Touchable
                  testID={`duo-leave-${duo.id}`}
                  style={styles.smallBtn}
                  onPress={() => handleLeave(duo.id)}
                  disabled={busyId === duo.id}
                >
                  <Ionicons name="close" size={16} color="#4A4035" />
                </Touchable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create/join sheet */}
      <BottomSheet visible={setupVisible} onClose={() => setSetupVisible(false)} sheetStyle={styles.sheet}>
            {setupStep === "choice" ? (
              <>
                <Text style={styles.sheetTitle}>Ny Duo</Text>
                <Text style={styles.sheetSub}>
                  Swipa tillsammans med en vän och matcha som ett team.
                </Text>

                <View style={styles.slotRow}>
                  <Text style={styles.slotLabel}>DUO-KOMPANJONER</Text>
                  <Text style={styles.slotCount}>
                    <Text style={slotInfo.used >= slotInfo.slots ? styles.slotFull : styles.slotOk}>
                      {slotInfo.used}
                    </Text>
                    <Text style={styles.slotSep}> / {slotInfo.slots}</Text>
                  </Text>
                </View>

                {!!setupError && <Text style={styles.errorText}>{setupError}</Text>}

                {slotInfo.used >= slotInfo.slots ? (
                  <Touchable
                    style={[styles.sendBtn, buyingSlot && styles.disabled]}
                    haptic="medium"
                    onPress={handleBuySlot}
                    disabled={buyingSlot}
                  >
                    <Text style={styles.sendBtnText}>
                      {buyingSlot ? "Köper..." : "Lås upp fler — 100 ✦"}
                    </Text>
                  </Touchable>
                ) : (
                  <Touchable
                    testID="duo-create-invite"
                    style={[styles.sendBtn, setupLoading && styles.disabled]}
                    haptic="medium"
                    onPress={handleCreateInvite}
                    disabled={setupLoading}
                  >
                    <Text style={styles.sendBtnText}>
                      {setupLoading ? "Skapar..." : "Skapa en Duo"}
                    </Text>
                  </Touchable>
                )}

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>ELLER</Text>
                  <View style={styles.orLine} />
                </View>

                <Touchable
                  style={styles.joinToggle}
                  onPress={() => setJoinExpanded((v) => !v)}
                >
                  <Text style={styles.joinToggleText}>Har du en kod?</Text>
                  <Ionicons
                    name={joinExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#4A4035"
                  />
                </Touchable>

                {joinExpanded && (
                  <>
                    <TextInput
                      testID="duo-join-input"
                      style={styles.input}
                      placeholder={codePlaceholder}
                      placeholderTextColor="#333"
                      value={joinCode}
                      onChangeText={(v) => setJoinCode(v.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={6}
                      autoFocus
                    />
                    <Touchable
                      testID="duo-join-submit"
                      style={[
                        styles.sendBtn,
                        styles.sendBtnOutline,
                        setupLoading && styles.disabled,
                      ]}
                      haptic="medium"
                      onPress={handleJoin}
                      disabled={setupLoading}
                    >
                      <Text style={styles.sendBtnOutlineText}>Gå med</Text>
                    </Touchable>
                  </>
                )}

                <Touchable style={styles.laterBtn} onPress={() => setSetupVisible(false)}>
                  <Text style={styles.laterBtnText}>Avbryt</Text>
                </Touchable>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Din Duo-kod</Text>
                <Text testID="duo-code-created" style={styles.codeText}>
                  {createdCode}
                </Text>
                <Text style={styles.sheetSub}>
                  Dela koden med din vän — hen anger den för att gå med.
                </Text>
                <Touchable style={styles.sendBtn} onPress={() => handleShare(createdCode)}>
                  <Text style={styles.sendBtnText}>Dela kod</Text>
                </Touchable>
                <Touchable
                  testID="duo-setup-done"
                  style={styles.laterBtn}
                  onPress={async () => {
                    setSetupVisible(false);
                    await load();
                  }}
                >
                  <Text style={styles.laterBtnText}>Klart</Text>
                </Touchable>
              </>
            )}
      </BottomSheet>

      {/* Preview modal */}
      <Modal visible={previewVisible} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <Touchable style={styles.previewClose} onPress={() => setPreviewVisible(false)} hitSlop={10}>
            <Text style={styles.previewCloseText}>✕</Text>
          </Touchable>
          <Text style={styles.previewTitle}>Så här ser er Duo ut för andra</Text>
          {previewMembers && (
            <DuoCard
              member1={previewMembers.member1}
              member2={previewMembers.member2}
              width={CARD_W}
              height={CARD_H}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080808", paddingTop: 52 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#101010",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E1C19",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 4 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#C9A84C",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    gap: 12,
    paddingBottom: 80,
  },
  emptyLabel: {
    color: "#2A2420",
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySub: {
    color: "#2A2420",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 8,
  },
  ctaBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  ctaBtnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },

  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#101010",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E1C19",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: "#C9A84C" },
  rowInfo: { flex: 1 },
  rowName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  rowSub: { color: "#4A4035", fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 8 },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#181614",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2E2A18",
  },
  smallBtnActive: { borderColor: "#C9A84C", backgroundColor: "#1E1A0A" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0D0C0A",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 52,
    borderTopWidth: 1,
    borderTopColor: "#1E1C19",
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  sheetSub: {
    color: "#3A3228",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#131110",
    color: "#fff",
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: "#2A2420",
    marginBottom: 12,
    textAlign: "center",
  },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0A0908",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1E1C19",
  },
  slotLabel: { color: "#2A2420", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  slotCount: { fontSize: 16, fontWeight: "900" },
  slotOk: { color: "#C9A84C" },
  slotFull: { color: "#ff4d4d" },
  slotSep: { color: "#2A2420", fontSize: 14, fontWeight: "700" },
  errorText: { color: "#ff4d4d", fontSize: 13, textAlign: "center", marginBottom: 8 },
  sendBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  sendBtnText: { color: "#000", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  sendBtnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2A2420" },
  sendBtnOutlineText: { color: "#C9A84C", fontSize: 16, fontWeight: "800" },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "#1A1814" },
  orText: { color: "#2A2420", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  joinToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    marginBottom: 12,
  },
  joinToggleText: { color: "#4A4035", fontSize: 14, fontWeight: "600" },
  laterBtn: { paddingVertical: 12, alignItems: "center", width: "100%", marginTop: 8 },
  laterBtnText: { color: "#2A2420", fontSize: 13, fontWeight: "500" },
  disabled: { opacity: 0.5 },
  codeText: {
    color: "#C9A84C",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 8,
    marginVertical: 16,
    textAlign: "center",
  },

  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingBottom: 40,
  },
  previewClose: {
    position: "absolute",
    top: 52,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#181614",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2E2A18",
  },
  previewCloseText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  previewTitle: {
    color: "#3A3020",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 20,
  },
});
