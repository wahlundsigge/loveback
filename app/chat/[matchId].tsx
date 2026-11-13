import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../components/Avatar";
import { AppLoader } from "../../components/AppLoader";
import { supabase } from "../lib/supabase";
import { unlockMatch, claimRoseReward } from "../lib/wallet-api";
import { blockUser, reportUser, REPORT_REASONS } from "../lib/moderation-api";
import { friendlyError } from "../lib/friendly-error";
import { fetchDuoMembers, getMyDuoIds, unlockDuoMatch } from "../lib/duo-api";
import { useCoin } from "../../contexts/CoinContext";
import { useUser } from "../../contexts/UserContext";
import { CoinBalanceChip } from "../../components/CoinBalanceChip";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Touchable } from "../../components/Touchable";
import { BottomSheet } from "../../components/BottomSheet";

const UNLOCK_COST = 80;
const UNLOCK_REWARD = 20;
const DUO_REWARD_EACH = 10;
const OPENERS = ["Hej! Hur ser din helg ut? 👋", "Vad fick dig att svepa höger?", "Kaffe eller promenad först?"];

const _hlSvg = `<svg fill="#C9A84C" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45.92 45.92"><g><g><path d="M16.596,6.637C18.296,4.937,20.557,4,22.96,4c4.963,0,9,4.037,9,9v0.143c1.404,0.226,2.756,0.666,4,1.333V13c0-7.168-5.832-13-13-13c-3.472,0-6.736,1.353-9.192,3.807c-0.781,0.781-0.781,2.048-0.001,2.829C14.548,7.417,15.814,7.416,16.596,6.637z"/><path d="M36.871,18.851c-1.927-1.924-4.447-2.886-6.97-2.886c-2.51,0-5.021,0.954-6.941,2.858c-1.921-1.905-4.431-2.858-6.941-2.858c-2.522,0-5.045,0.962-6.971,2.886c-3.849,3.848-3.849,10.09,0,13.939c0.19,0.187,9.322,9.276,12.685,12.623c0.338,0.338,0.783,0.507,1.227,0.507c0.443,0,0.889-0.169,1.227-0.507c3.363-3.347,12.496-12.438,12.686-12.623C40.722,28.941,40.722,22.698,36.871,18.851z M24.96,31.72v3.484c0,1.358-0.641,2.462-2,2.462c-1.359,0-2-1.104-2-2.462V31.72c-1-0.661-1.39-1.596-1.39-2.641c0-2,1.505-3.621,3.505-3.621s3.332,1.621,3.332,3.621C26.407,30.124,25.96,31.059,24.96,31.72z"/></g></g></svg>`;
const HEART_LOCK_URI = `data:image/svg+xml,${encodeURIComponent(_hlSvg)}`;

const UNLOCK_PAIRS = [
  { main: "Lås upp för 80 Coins 💘", sub: "Din match får 20 Coins som tack för att du vågade först." },
  { main: "80 Coins för att ta första steget 🚀", sub: "Din match belönas med 20 Coins. Kärlek ska vara en win-win." },
  { main: "Öppna dörren för 80 Coins 🔓", sub: "Din match får 20 Coins. Vi gillar när båda går därifrån som vinnare." },
  { main: "80 Coins och ett hej närmare 👋", sub: "Din match får 20 Coins. Någon måste ju börja." },
  { main: "80 Coins för att sluta spela svår 😉", sub: "Din match får 20 Coins för att du tog initiativet." },
  { main: "Betala 80 Coins och slipp \"vem skriver först?\"-paniken 😅", sub: "Din match får 20 Coins som fredsgåva." },
  { main: "80 Coins för modet att säga hej 🫡", sub: "Din match får 20 Coins. Hjältar belönas." },
  { main: "Tryck här och skyll på oss om det blir kärlek ❤️", sub: "Kostar 80 Coins. Din match får 20 Coins." },
  { main: "Ge matchen en chans för 80 Coins ✨", sub: "Din match får 20 Coins tillbaka." },
  { main: "En liten investering. En möjlig stor historia.", sub: "80 Coins · Din match får 20 Coins." },
  { main: "Ditt steg. Er chans.", sub: "Lås upp för 80 Coins och ge din match 20 Coins." },
  { main: "Kärlek ska gå åt båda hållen ❤️", sub: "Du låser upp för 80 Coins. Din match får 20 Coins." },
];

export default function ChatScreen() {
  const params = useLocalSearchParams<{ matchId: string; kind?: string }>();
  const matchId = params.matchId;
  const isDuo = params.kind === "duo";
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { coinBalance, refreshBalance } = useCoin();

  const [match, setMatch] = useState<any>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [paymentModal, setPaymentModal] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [matchLoadError, setMatchLoadError] = useState(false);
  const [toast, setToast] = useState("");
  const [pairIdx] = useState(() => Math.floor(Math.random() * UNLOCK_PAIRS.length));
  const [reportModal, setReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [dismissModal, setDismissModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledOnOpenRef = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadMatch = async () => {
    if (!matchId || !currentUser) return;
    setLoadingMatch(true);
    setMatchLoadError(false);
    try {
      if (isDuo) {
        const { data: row, error } = await supabase.from("duo_matches").select("*").eq("id", matchId).maybeSingle();
        if (error) throw error;
        if (!row) { setLoadingMatch(false); return; }
        const myDuoIds = await getMyDuoIds();
        const myDuoIdSet = new Set(myDuoIds);
        const otherDuoId = myDuoIdSet.has(row.duo_a) ? row.duo_b : row.duo_a;
        const otherMembers = await fetchDuoMembers(otherDuoId);
        setMatch({
          ...row,
          kind: "duo" as const,
          otherMember1: otherMembers?.member1 ?? null,
          otherMember2: otherMembers?.member2 ?? null,
          chatUnlocked: row.chat_unlocked,
        });
      } else {
        const { data: row, error } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
        if (error) throw error;
        if (!row) { setLoadingMatch(false); return; }
        const partnerId = row.user1 === currentUser.id ? row.user2 : row.user1;
        const { data: partner } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, name, age, avatar")
          .eq("id", partnerId)
          .single();
        setMatch({ ...row, kind: "solo" as const, partner: partner || { id: partnerId }, chatUnlocked: row.chat_unlocked });
      }
    } catch (err) {
      // Previously uncaught (and the error from the main query was ignored
      // entirely) — a dropped connection either froze this screen on its
      // loading spinner forever, or landed on "match not found", which is
      // the wrong message for a connectivity problem.
      console.log("loadMatch error:", err);
      setMatchLoadError(true);
    }
    setLoadingMatch(false);
  };

  useEffect(() => { loadMatch(); }, [matchId]);

  useEffect(() => {
    if (!match) return;
    hasScrolledOnOpenRef.current = false;
    loadMessages();
    const table = isDuo ? "duo_messages" : "messages";
    const fkColumn = isDuo ? "duo_match_id" : "match_id";
    const channel = supabase
      .channel(`${table}-${match.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `${fkColumn}=eq.${match.id}` },
        (payload) => setMessages((prev) =>
          prev.some((m) => m.id === (payload.new as any).id) ? prev : [...prev, payload.new as any]
        )
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [match?.id]);

  const loadMessages = async () => {
    if (!match) return;
    const { data, error } = await supabase
      .from(isDuo ? "duo_messages" : "messages")
      .select("*")
      .eq(isDuo ? "duo_match_id" : "match_id", match.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.log("Kunde inte ladda meddelanden:", error.message);
      // Without this, a failed history load just renders as an empty
      // conversation — indistinguishable from a real brand-new match.
      showToast(friendlyError(error, "Kunde inte ladda meddelanden."));
      return;
    }
    setMessages(data || []);
  };

  const dismissMatch = async () => {
    if (!match) return;
    await supabase.from("matches").delete().eq("id", match.id);
    router.back();
  };

  const submitMatchBlockOnly = async () => {
    if (!match) return;
    const targetId = match.partner?.id ?? match.user1 ?? match.user2;
    if (!targetId) return;
    setReportSending(true);
    try {
      const result = await blockUser(targetId);
      if (result?.refunded) showToast("Dina coins har återbetalats.");
    } finally {
      setReportSending(false);
      setReportModal(false);
      setSelectedReason("");
      router.back();
    }
  };

  const submitMatchReport = async () => {
    if (!selectedReason || !match) return;
    const targetId = match.partner?.id ?? match.user1 ?? match.user2;
    if (!targetId) return;
    setReportSending(true);
    try {
      const [, blockResult] = await Promise.all([
        reportUser(targetId, selectedReason),
        blockUser(targetId),
      ]);
      if (blockResult?.refunded) showToast("Dina coins har återbetalats.");
    } finally {
      setReportSending(false);
      setReportModal(false);
      setSelectedReason("");
      router.back();
    }
  };

  const handleUnlockChat = async () => {
    if (!currentUser || !match) return;

    if (coinBalance < UNLOCK_COST) {
      setPaymentModal(false);
      router.push("/buy-coins" as any);
      return;
    }

    setUnlocking(true);
    try {
      const result = isDuo ? await unlockDuoMatch(match.id) : await unlockMatch(match.id);

      if (result.success || result.error_code === "ALREADY_UNLOCKED") {
        await refreshBalance();
        setMatch({ ...match, chatUnlocked: true });
        setPaymentModal(false);
      } else if (result.error_code === "INSUFFICIENT_BALANCE") {
        setPaymentModal(false);
        router.push("/buy-coins" as any);
      } else {
        showToast("Något gick fel. Försök igen.");
      }
    } catch (err: unknown) {
      console.error("Unlock error:", err);
      showToast("Kunde inte låsa upp chatten. Kontrollera din anslutning.");
    } finally {
      setUnlocking(false);
    }
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !match || !currentUser) return;
    const fkColumn = isDuo ? "duo_match_id" : "match_id";

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      [fkColumn]: match.id,
      sender: currentUser.id,
      sender_name: currentUser.name ?? currentUser.first_name,
      text,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage("");

    try {
      const { data, error } = await supabase
        .from(isDuo ? "duo_messages" : "messages")
        .insert([{ [fkColumn]: match.id, sender: currentUser.id, sender_name: optimisticMsg.sender_name, text }])
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } catch (err) {
      // A hard network failure (not just a handled {error} response) was
      // previously uncaught here — the bubble stayed stuck mid-send forever
      // and the typed text was already gone, with no way to recover it.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(text);
      showToast(friendlyError(err, "Kunde inte skicka — kolla din anslutning."));
      return;
    }

    if (
      !isDuo &&
      match.super_liked_by &&
      match.super_liked_by !== currentUser.id &&
      !match.reward_paid
    ) {
      const reward = await claimRoseReward(match.id);
      if (reward.success) {
        await refreshBalance();
        setMatch({ ...match, reward_paid: true });
        showToast(`+${reward.coins_earned} Coins! 🌹 Tack för att du svarade`);
      }
    }
  };

  const avatarUri = (partner: any) => partner?.avatar || "https://randomuser.me/api/portraits/lego/1.jpg";
  const displayName = (partner: any) => partner?.name ?? partner?.first_name ?? "Match";
  const duoDisplayName = (m: any) => {
    const n1 = m.otherMember1?.first_name || m.otherMember1?.name;
    const n2 = m.otherMember2?.first_name || m.otherMember2?.name;
    return [n1, n2].filter(Boolean).join(" & ") || "Duo";
  };

  if (!currentUser || loadingMatch) return <AppLoader />;
  if (!match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }, styles.centerAll]}>
        <Text style={styles.lockedSubMain}>
          {matchLoadError ? "Kunde inte ladda chatten — kolla din anslutning." : "Den här matchen kunde inte hittas."}
        </Text>
        {matchLoadError ? (
          <Touchable style={styles.cancelBtn} onPress={loadMatch}>
            <Text style={styles.cancelText}>Försök igen</Text>
          </Touchable>
        ) : (
          <Touchable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Tillbaka</Text>
          </Touchable>
        )}
      </View>
    );
  }

  const partner = isDuo ? match.otherMember1 : match.partner;
  const unlocked = match.chatUnlocked;
  const chatTitle = isDuo ? duoDisplayName(match) : displayName(partner);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      {/* Chat header */}
      <View style={styles.chatHeader}>
        <Touchable onPress={() => router.back()} style={styles.backBtn} hitSlop={8} accessibilityLabel="Tillbaka" accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color="#C9A84C" />
        </Touchable>
        <Avatar uri={avatarUri(partner)} size={38} style={styles.chatAvatarWrap} />
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatName} numberOfLines={1}>{unlocked ? chatTitle : "Låst match"}</Text>
          {isDuo
            ? <Text style={styles.chatSub}>Duo-match</Text>
            : partner?.age ? <Text style={styles.chatSub}>{partner.age} år</Text> : null}
        </View>
        <CoinBalanceChip />
        <Touchable onPress={() => { setSelectedReason(""); setReportModal(true); }} style={styles.chatReportBtn} hitSlop={8} accessibilityLabel="Rapportera match" accessibilityRole="button">
          <Ionicons name="flag-outline" size={16} color="#3A3228" />
        </Touchable>
      </View>

      {/* Locked state */}
      {!unlocked ? (
        <View style={styles.lockedWrap}>
          <View style={styles.lockedContent}>
            <Avatar uri={avatarUri(partner)} size={100} style={styles.lockedAvatar} />
            <Image source={{ uri: HEART_LOCK_URI }} style={styles.lockedIcon} />
            {isDuo ? (
              <Text style={styles.lockedSubMain}>
                {`Lås upp för ✦ ${UNLOCK_COST} Coins — er andra Duo delar ✦ ${DUO_REWARD_EACH * 2} Coins`}
              </Text>
            ) : (
              <Text style={styles.lockedSubMain}>{UNLOCK_PAIRS[pairIdx].main}</Text>
            )}
            <View style={styles.lockedActionRow}>
              <Touchable testID="open-unlock-modal" style={styles.coinsBtn} onPress={() => setPaymentModal(true)}>
                <Text style={styles.coinsBtnText}>✦  Lås upp · {UNLOCK_COST} Coins</Text>
              </Touchable>
              <Touchable testID="dismiss-match-btn" style={styles.skippaBtn} onPress={() => setDismissModal(true)}>
                <Text style={styles.skippaBtnText}>SKIPPA</Text>
              </Touchable>
            </View>
            <Text style={styles.balanceLine}>
              Saldo: {coinBalance.toLocaleString("sv-SE")} <Text style={styles.balanceCoin}>✦</Text>
            </Text>
            {coinBalance < UNLOCK_COST && (
              <Touchable onPress={() => router.push("/buy-coins" as any)}>
                <Text style={styles.buyMore}>Köp fler Coins →</Text>
              </Touchable>
            )}
          </View>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id?.toString()}
            windowSize={7}
            maxToRenderPerBatch={20}
            initialNumToRender={20}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: hasScrolledOnOpenRef.current });
              hasScrolledOnOpenRef.current = true;
            }}
            contentContainerStyle={[styles.msgList, messages.length === 0 && styles.msgListEmpty]}
            ListEmptyComponent={
              // A fresh match shouldn't open onto a blank screen — offer a
              // gentle nudge and a few openers that just fill the input.
              <View style={styles.emptyChat}>
                <Avatar uri={avatarUri(partner)} size={84} style={styles.emptyChatAvatar} />
                <Text style={styles.emptyChatTitle}>Chatten är öppen</Text>
                <Text style={styles.emptyChatSub}>Säg hej till {chatTitle} — det första meddelandet är alltid det svåraste.</Text>
                <View style={styles.openerRow}>
                  {OPENERS.map((o) => (
                    <Touchable key={o} style={styles.openerChip} onPress={() => setNewMessage(o)}>
                      <Text style={styles.openerText}>{o}</Text>
                    </Touchable>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item, index }) => {
              const mine = item.sender === currentUser.id;
              // Consecutive messages from the same person read as one
              // thought: tight spacing, and only the last one gets the tail.
              const lastInGroup = messages[index + 1]?.sender !== item.sender;
              return (
                <View style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                  lastInGroup && (mine ? styles.bubbleMineTail : styles.bubbleTheirsTail),
                  lastInGroup && styles.bubbleGroupEnd,
                  item._pending && styles.bubblePending,
                ]}>
                  {!mine && isDuo && <Text style={styles.bubbleSender}>{item.sender_name}</Text>}
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
                </View>
              );
            }}
          />
          <View style={styles.inputRow}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.msgInput}
                placeholder="Skriv ett meddelande..."
                placeholderTextColor="#555"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <Touchable testID="send-message-btn" style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnIdle]} onPress={sendMessage} accessibilityLabel="Skicka meddelande" accessibilityRole="button">
                <Ionicons name="arrow-up" size={18} color="#000" />
              </Touchable>
            </View>
          </View>
        </>
      )}

      {/* Report sheet */}
      <BottomSheet visible={reportModal} onClose={() => setReportModal(false)} sheetStyle={styles.reportSheet}>
        <Text style={styles.reportSheetTitle}>Rapportera match</Text>
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
          onPress={submitMatchBlockOnly}
          disabled={reportSending}
        >
          <Text style={styles.reportSubmitText}>{reportSending ? "Skickar..." : "Blockera"}</Text>
        </Touchable>
        <Touchable
          style={[styles.reportBlockBtn, (!selectedReason || reportSending) && { opacity: 0.4 }]}
          onPress={submitMatchReport}
          disabled={!selectedReason || reportSending}
        >
          <Text style={styles.reportBlockText}>Blockera och rapportera</Text>
        </Touchable>
        <Touchable onPress={() => setReportModal(false)}>
          <Text style={styles.reportCancelText}>Avbryt</Text>
        </Touchable>
      </BottomSheet>

      {/* Dismiss confirm modal */}
      <Modal visible={dismissModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ta bort match?</Text>
            <Text style={styles.modalBody}>Den här matchen försvinner från din lista. Det går inte att ångra.</Text>
            <Touchable style={styles.dismissConfirmBtn} onPress={dismissMatch}>
              <Text style={styles.dismissConfirmText}>Ta bort</Text>
            </Touchable>
            <Touchable style={styles.cancelBtn} onPress={() => setDismissModal(false)}>
              <Text style={styles.cancelText}>Avbryt</Text>
            </Touchable>
          </View>
        </View>
      </Modal>

      {/* Unlock confirm modal */}
      <Modal visible={paymentModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lås upp chatten?</Text>
            <Text style={styles.modalBody}>
              {isDuo ? (
                <>Kostnad: {UNLOCK_COST} Coins{"\n"}Er andra Duo delar {DUO_REWARD_EACH * 2} Coins i belöning.</>
              ) : (
                <>Kostnad: {UNLOCK_COST} Coins{"\n"}Din match får {UNLOCK_REWARD} Coins i belöning.</>
              )}
            </Text>
            <Touchable
              testID="confirm-unlock-btn"
              style={[styles.confirmBtn, unlocking && styles.disabled]}
              haptic="medium"
              onPress={handleUnlockChat}
              disabled={unlocking}
            >
              <Text style={styles.confirmText}>{unlocking ? "Låser upp..." : "Lås upp"}</Text>
            </Touchable>
            <Touchable style={styles.cancelBtn} onPress={() => setPaymentModal(false)}>
              <Text style={styles.cancelText}>Avbryt</Text>
            </Touchable>
          </View>
        </View>
      </Modal>

      {!!toast && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080808" },
  centerAll: { justifyContent: "center", alignItems: "center", gap: 16 },

  /* Chat header */
  chatHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#111010", gap: 10,
  },
  backBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center", marginRight: -2 },
  chatAvatarWrap: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: "#C9A84C30", overflow: "hidden",
  },
  chatHeaderInfo: { flex: 1 },
  chatName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  chatSub: { color: "#4A4035", fontSize: 12, marginTop: 1 },

  /* Locked chat */
  lockedWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  lockedContent: { alignItems: "center" },
  lockedAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: -24, borderWidth: 2, borderColor: "#C9A84C40" },
  lockedIcon: { width: 48, height: 48, marginBottom: 20 },
  lockedSubMain: { color: "#C9A84C", fontSize: 15, fontWeight: "700", textAlign: "center", lineHeight: 24, marginBottom: 28, paddingHorizontal: 24 },
  lockedActionRow: { width: "100%", gap: 10, marginBottom: 14, marginTop: 4 },
  coinsBtn: {
    width: "100%", borderRadius: 50, paddingVertical: 15,
    alignItems: "center", backgroundColor: "#C9A84C",
  },
  coinsBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
  skippaBtn: {
    width: "100%", borderRadius: 50, paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "transparent", borderWidth: 1, borderColor: "#2A2820",
  },
  skippaBtnText: { color: "#4A4035", fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  balanceLine: { color: "#2A2820", fontSize: 13, marginBottom: 8 },
  balanceCoin: { color: "#C9A84C" },
  buyMore: { color: "#C9A84C", fontSize: 14, fontWeight: "600" },

  /* Messages */
  msgList: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8 },
  msgListEmpty: { flexGrow: 1, justifyContent: "center" },
  bubble: { maxWidth: "78%", borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 3 },
  bubbleMine: { backgroundColor: "#C9A84C", alignSelf: "flex-end" },
  bubbleTheirs: { backgroundColor: "#151311", alignSelf: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderColor: "#262219" },
  bubbleMineTail: { borderBottomRightRadius: 6 },
  bubbleTheirsTail: { borderBottomLeftRadius: 6 },
  bubbleGroupEnd: { marginBottom: 12 },
  bubblePending: { opacity: 0.55 },
  bubbleSender: { color: "#887060", fontSize: 10, marginBottom: 3 },
  bubbleTextMine: { color: "#0B0906", fontSize: 15, lineHeight: 21, fontWeight: "500" },
  bubbleTextTheirs: { color: "#F2EEE6", fontSize: 15, lineHeight: 21 },

  /* Empty conversation */
  emptyChat: { alignItems: "center", paddingHorizontal: 28 },
  emptyChatAvatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderColor: "#C9A84C66", marginBottom: 18 },
  emptyChatTitle: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 0.3, marginBottom: 6 },
  emptyChatSub: { color: "#7A6F5C", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 22 },
  openerRow: { alignSelf: "stretch", gap: 8 },
  openerChip: { borderRadius: 50, borderWidth: 1, borderColor: "#2E2A18", backgroundColor: "#0F0E0C", paddingVertical: 12, paddingHorizontal: 18, alignItems: "center" },
  openerText: { color: "#D8CBA6", fontSize: 14 },

  /* Input */
  inputRow: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#111010",
  },
  inputPill: {
    flexDirection: "row", alignItems: "flex-end",
    backgroundColor: "#101010", borderRadius: 24,
    borderWidth: 1, borderColor: "#1E1C19",
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 6,
  },
  msgInput: { flex: 1, color: "#fff", fontSize: 15, maxHeight: 120, paddingVertical: 6 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#C9A84C", justifyContent: "center", alignItems: "center",
  },
  sendBtnIdle: { opacity: 0.35 },

  /* Modal */
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#101010", borderRadius: 24, padding: 28, width: "85%", borderWidth: 1, borderColor: "#2E2A18" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 12, letterSpacing: 0.5 },
  modalBody: { color: "#887060", fontSize: 14, lineHeight: 22, marginBottom: 24 },
  confirmBtn: { backgroundColor: "#C9A84C", borderRadius: 50, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  confirmText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  cancelBtn: { backgroundColor: "#181614", borderRadius: 50, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center", borderWidth: 1, borderColor: "#1E1C19" },
  cancelText: { color: "#887060", fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.5 },

  /* Toast */
  toastWrap: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: "#FF6B8A", borderRadius: 50,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  /* Report */
  chatReportBtn: { width: 28, height: 28, justifyContent: "center", alignItems: "center", marginLeft: 2 },
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
  dismissConfirmBtn: { backgroundColor: "#1A1815", borderRadius: 50, paddingVertical: 14, alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#3A2020" },
  dismissConfirmText: { color: "#FF6B6B", fontWeight: "700", fontSize: 15 },
});
