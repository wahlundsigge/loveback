import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Image as CachedImage } from "expo-image";
import { Avatar } from "../../components/Avatar";
import { AppLoader } from "../../components/AppLoader";
import { RoseIcon } from "../../components/RoseIcon";
import { supabase } from "../lib/supabase";
import { fetchDuoMembers, fetchMyDuoMatches, getMyDuoIds } from "../lib/duo-api";
import { useUser } from "../../contexts/UserContext";
import { CoinBalanceChip } from "../../components/CoinBalanceChip";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Touchable } from "../../components/Touchable";

// Compact relative timestamp for the conversation list ("2 min", "14:32", "Igår", "3 jan").
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (diffMin < 1) return "Nu";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  if (diffH < 48) return "Igår";
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

const _bhSvg = `<svg fill="#C9A84C" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 437.775 437.774"><path d="M437.775,150.801c0,110.478-218.893,257.212-218.893,257.212S0,266.569,0,150.801C0,67.584,54.202,29.761,121.041,29.761c30.946,0,59.093,11.7,80.463,30.818l-55.744,80.925c-1.392,2.021-1.906,4.527-1.421,6.936c0.484,2.403,1.924,4.522,3.992,5.849l82.958,53.309l-38.178,46.08c-1.921,2.317-2.568,5.433-1.726,8.322l21.359,73.672c1.144,3.955,4.764,6.55,8.709,6.55c0.703,0,1.425-0.089,2.137-0.255c4.72-1.135,7.705-5.786,6.789-10.551l-12.975-67.033l54.456-54.725c1.832-1.841,2.784-4.383,2.624-6.966c-0.159-2.598-1.424-4.995-3.476-6.593l-71.732-55.925l77.963-93.629c1.584-1.906,2.317-4.383,2.033-6.845c-0.142-1.265-0.562-2.471-1.194-3.552c12.129-4.111,25.104-6.387,38.633-6.387C383.574,29.761,437.775,83.962,437.775,150.801z"/></svg>`;
const BROKEN_HEART_URI = `data:image/svg+xml,${encodeURIComponent(_bhSvg)}`;

const QUOTES = [
  "Ge inte upp än. Kärleken kan vara ett swipe bort.",
  "En person kan förändra allt. Kanske är det nästa swipe.",
  "De flesta ger upp precis innan de hittar någon.",
  "Fortsätt söka. Din historia har inte skrivits klart än.",
  "Bakom varje profil finns en person som också letar efter något äkta.",
  "Din person finns där ute. Ge inte upp än.",
  "Du har inte hittat dem än. Men det betyder inte att de inte finns.",
  "De bästa mötena går inte alltid att planera.",
  "Fortsätt upptäcka. Kärleken gillar överraskningar.",
  "Kärlek är sällsynt. Därför är den värd att leta efter.",
];


function EmptyMatches() {
  const [visibleIdx, setVisibleIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => {
        setVisibleIdx((i) => (i + 1) % QUOTES.length);
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();
      });
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={emptyStyles.wrap}>
      <Image source={{ uri: BROKEN_HEART_URI }} style={emptyStyles.icon} />
      <Text style={emptyStyles.label}>INGA MATCHNINGAR ÄN</Text>
      <View style={emptyStyles.divider} />
      <Animated.Text style={[emptyStyles.quote, { opacity }]}>
        {QUOTES[visibleIdx]}
      </Animated.Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap:    {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 48, paddingBottom: 80,
  },
  icon:    { width: 52, height: 52, marginBottom: 20, opacity: 0.6 },
  label:   {
    color: "#3A3228", fontSize: 11, letterSpacing: 4,
    fontWeight: "900", textAlign: "center", marginBottom: 16,
  },
  divider: {
    width: 24, height: 1, backgroundColor: "#2A2420",
    marginBottom: 16,
  },
  quote:   {
    color: "#3A3228", fontSize: 14, lineHeight: 22,
    textAlign: "center", fontStyle: "italic",
  },
});

export default function Matches() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const [matches, setMatches] = useState<any[]>([]);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    if (currentUser) {
      loadMatches();
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) loadMatches();
    }, [currentUser])
  );

  const loadMatches = async () => {
    if (!currentUser) return;

    const [{ data: blocks }, { data, error }] = await Promise.all([
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUser.id),
      supabase.from("matches").select("*").or(`user1.eq.${currentUser.id},user2.eq.${currentUser.id}`),
    ]);
    const blockedIds = new Set((blocks || []).map((b: any) => b.blocked_id));

    if (error) {
      console.log("Kunde inte ladda matchningar:", error.message);
      showToast("Kunde inte uppdatera matchningar just nu.");
      return;
    }

    const enrichedMatches = await Promise.all(
      (data || []).map(async (match) => {
        const partnerId = match.user1 === currentUser.id ? match.user2 : match.user1;
        const { data: partner } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, name, age, avatar")
          .eq("id", partnerId)
          .single();

        return {
          ...match,
          kind: "solo" as const,
          partner: partner || { id: partnerId },
          chatUnlocked: match.chat_unlocked,
          paidBy: match.paid_by,
        };
      })
    );

    const filteredMatches = enrichedMatches.filter(m => !blockedIds.has(m.partner?.id));
    const duoMatches = await loadDuoMatches();

    const withPreviews = await attachLastMessages([...filteredMatches, ...duoMatches]);
    setMatches(withPreviews);
  };

  // Last-message preview for the conversation list — one bounded query per
  // table (not one per match), then reduced client-side to "first row seen
  // per match_id" since both queries are already sorted newest-first. No new
  // database objects; genuinely unread-state would need a schema column that
  // doesn't exist yet (messages/duo_messages have no read-tracking column),
  // so that part is intentionally NOT attempted here.
  const attachLastMessages = async (list: any[]) => {
    const soloIds = list.filter(m => m.kind !== "duo").map(m => m.id);
    const duoIds = list.filter(m => m.kind === "duo").map(m => m.id);
    if (soloIds.length === 0 && duoIds.length === 0) return list;

    const [soloMsgs, duoMsgs] = await Promise.all([
      soloIds.length > 0
        ? supabase.from("messages").select("match_id, text, created_at, sender").in("match_id", soloIds).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] as any[] }),
      duoIds.length > 0
        ? supabase.from("duo_messages").select("duo_match_id, text, created_at, sender").in("duo_match_id", duoIds).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const latestById = new Map<string, { text: string; created_at: string; mine: boolean }>();
    for (const row of soloMsgs.data ?? []) {
      if (!latestById.has(row.match_id)) latestById.set(row.match_id, { text: row.text, created_at: row.created_at, mine: row.sender === currentUser.id });
    }
    for (const row of duoMsgs.data ?? []) {
      if (!latestById.has(row.duo_match_id)) latestById.set(row.duo_match_id, { text: row.text, created_at: row.created_at, mine: row.sender === currentUser.id });
    }

    return list.map(m => ({ ...m, lastMessage: latestById.get(m.id) ?? null }));
  };

  const loadDuoMatches = async () => {
    const myDuoIds = await getMyDuoIds();
    if (myDuoIds.length === 0) return [];
    const myDuoIdSet = new Set(myDuoIds);

    const rows = await fetchMyDuoMatches(myDuoIds);

    return Promise.all(
      rows.map(async (row) => {
        const otherDuoId = myDuoIdSet.has(row.duo_a) ? row.duo_b : row.duo_a;
        const otherMembers = await fetchDuoMembers(otherDuoId);

        return {
          ...row,
          kind: "duo" as const,
          otherMember1: otherMembers?.member1 ?? null,
          otherMember2: otherMembers?.member2 ?? null,
          chatUnlocked: row.chat_unlocked,
          paidBy: row.paid_by,
        };
      })
    );
  };

  const avatarUri = (partner: any) =>
    partner?.avatar || "https://randomuser.me/api/portraits/lego/1.jpg";

  const displayName = (partner: any) =>
    partner?.name ?? partner?.first_name ?? "Match";

  const duoDisplayName = (m: any) => {
    const n1 = m.otherMember1?.first_name || m.otherMember1?.name;
    const n2 = m.otherMember2?.first_name || m.otherMember2?.name;
    return [n1, n2].filter(Boolean).join(" & ") || "Duo";
  };

  if (!currentUser) return <AppLoader />;

  /* ── MATCHES LIST ── */
  const roseMatches   = matches.filter((m) => !!m.super_liked_by);
  const newMatches    = matches.filter((m) => !m.chatUnlocked && !m.super_liked_by);
  const conversations = matches.filter((m) =>  m.chatUnlocked  && !m.super_liked_by);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>MATCHNINGAR</Text>
        <CoinBalanceChip />
      </View>

      {matches.length === 0 ? (
        <EmptyMatches />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Roses */}
          {roseMatches.length > 0 && (
            <>
              <View style={styles.sectionLabelRow}>
                <RoseIcon size={12} />
                <Text style={styles.sectionLabelInline}>ROSES</Text>
              </View>
              {roseMatches.map((m) => {
                const iAmRecipient = m.super_liked_by !== currentUser.id;
                return (
                  <Touchable key={m.id} style={styles.roseCard} onPress={() => router.push(`/chat/${m.id}?kind=${m.kind}` as any)}>
                    <View style={styles.roseAccent} />
                    <View style={styles.roseAvatarWrap}>
                      <Avatar uri={avatarUri(m.partner)} size={64} style={styles.roseAvatar} />
                      <View style={styles.roseBadge}><RoseIcon size={14} /></View>
                    </View>
                    <View style={styles.roseInfo}>
                      <Text style={styles.convName} numberOfLines={1}>{displayName(m.partner)}</Text>
                      <Text style={styles.roseSub}>
                        {iAmRecipient
                          ? m.reward_paid
                            ? "Du svarade · Tack för din tid"
                            : "Skickade dig en Rose · +150 ✦ om du svarar"
                          : "Du skickade en Rose"}
                      </Text>
                    </View>
                    {iAmRecipient && !m.reward_paid && (
                      <View style={styles.roseCta}>
                        <Text style={styles.roseCtaText}>Svara →</Text>
                      </View>
                    )}
                  </Touchable>
                );
              })}
            </>
          )}

          {/* New matches */}
          {newMatches.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>NYA MATCHER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newMatchRow}>
                {newMatches.map((m) => (
                  <Touchable key={m.id} testID={m.kind === "duo" ? "duo-new-match" : undefined} style={styles.newMatchCard} onPress={() => router.push(`/chat/${m.id}?kind=${m.kind}` as any)}>
                    <CachedImage source={{ uri: avatarUri(m.kind === "duo" ? m.otherMember1 : m.partner) }} style={styles.newMatchImage} contentFit="cover" cachePolicy="memory-disk" />
                    <View style={styles.newMatchDot} />
                    <View style={styles.newMatchBottom}>
                      {m.kind === "duo"
                        ? <View style={styles.duoTagInline}><Text style={styles.duoTagText}>DUO</Text></View>
                        : <Text style={styles.newMatchQuestion}>?</Text>
                      }
                    </View>
                  </Touchable>
                ))}
              </ScrollView>
            </>
          )}

          {/* Conversations */}
          {conversations.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>KONVERSATIONER</Text>
              {conversations.map((m, i) => (
                <Touchable
                  key={m.id}
                  testID={m.kind === "duo" ? "duo-conv-row" : undefined}
                  style={[styles.convRow, i === conversations.length - 1 && styles.convRowLast]}
                  onPress={() => router.push(`/chat/${m.id}?kind=${m.kind}` as any)}
                >
                  <Avatar uri={avatarUri(m.kind === "duo" ? m.otherMember1 : m.partner)} size={56} style={styles.convAvatar} />
                  <View style={styles.convInfo}>
                    <View style={styles.convNameRow}>
                      <Text style={[styles.convName, { flexShrink: 1 }]} numberOfLines={1}>{m.kind === "duo" ? duoDisplayName(m) : displayName(m.partner)}</Text>
                      {m.kind === "duo" && (
                        <View style={styles.duoTagInline}><Text style={styles.duoTagText}>DUO</Text></View>
                      )}
                    </View>
                    <View style={styles.convSubRow}>
                      <Text style={styles.convSub} numberOfLines={1}>
                        {m.lastMessage
                          ? `${m.lastMessage.mine ? "Du: " : ""}${m.lastMessage.text}`
                          : m.kind === "duo" ? "Duo-match" : m.partner?.age ? `${m.partner.age} år` : "Match"}
                      </Text>
                      {m.lastMessage && (
                        <Text style={styles.convTime} numberOfLines={1}>{relativeTime(m.lastMessage.created_at)}</Text>
                      )}
                    </View>
                  </View>
                </Touchable>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {!!toast && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080808", paddingTop: 52 },

  /* List header */
  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 8,
  },
  listTitle: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 4, flexShrink: 1 },

  /* Section labels */
  sectionLabel: {
    color: "#3A3530", fontSize: 11, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 2, paddingHorizontal: 20, marginBottom: 12, marginTop: 32,
  },
  sectionLabelRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12, marginTop: 32,
  },
  sectionLabelInline: {
    color: "#3A3530", fontSize: 11, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 2, marginLeft: 6,
  },

  /* Rose cards */
  roseCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#0E0A0C", borderRadius: 18,
    padding: 14, overflow: "hidden",
    borderWidth: 1, borderColor: "#2A1520",
  },
  roseAccent: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: "#FF6B8A",
  },
  roseAvatarWrap: { position: "relative", marginRight: 14, marginLeft: 8 },
  roseAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#FF6B8A" },
  roseBadge: {
    position: "absolute", bottom: -2, right: -2,
    backgroundColor: "#0E0A0C", borderRadius: 12, padding: 2,
  },
  roseInfo: { flex: 1 },
  roseSub: { color: "#FF6B8A", fontSize: 12, marginTop: 3, lineHeight: 18 },
  roseCta: {
    backgroundColor: "#1A0A10", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "#FF6B8A40",
  },
  roseCtaText: { color: "#FF6B8A", fontSize: 12, fontWeight: "700" },

  /* New match cards */
  newMatchRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  newMatchCard: {
    width: 86, height: 112, borderRadius: 16,
    overflow: "hidden", backgroundColor: "#101010",
    borderWidth: 1, borderColor: "#1E1C19",
  },
  newMatchImage: { width: "100%", height: "72%", resizeMode: "cover" },
  newMatchBottom: { flex: 1, alignItems: "center", justifyContent: "center" },
  newMatchQuestion: { color: "#3A3530", fontSize: 20, fontWeight: "900", letterSpacing: 4 },
  newMatchDot: {
    position: "absolute", top: 8, right: 8,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#C9A84C", borderWidth: 2, borderColor: "#101010",
  },

  /* Conversation rows */
  convRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#111010",
  },
  convRowLast: { borderBottomWidth: 0 },
  convAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 14 },
  convInfo: { flex: 1 },
  convNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  convName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  convSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  convSub: { color: "#4A4035", fontSize: 13, flexShrink: 1 },
  convTime: { color: "#3A3530", fontSize: 12, flexShrink: 0 },

  /* Toast */
  toastWrap: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: "#FF6B8A", borderRadius: 50,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  /* Duo badge */
  duoTagInline: {
    backgroundColor: "#1E1A0A", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#2E2A18",
  },
  duoTagText: { color: "#C9A84C", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
});
