import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { DuoDeckMember } from "../app/lib/duo-api";
import { glowShadow } from "../constants/style";

function avatarUri(member: DuoDeckMember): string | null {
  if (member.images && member.images.length > 0) return member.images[0];
  return member.avatar ?? null;
}

function MemberHalf({ member }: { member: DuoDeckMember }) {
  const uri = avatarUri(member);
  const [failed, setFailed] = useState(false);
  // DuoCard instances aren't re-keyed as the deck advances, so a failed
  // load for one member must not keep hiding the next member's photo.
  useEffect(() => { setFailed(false); }, [uri]);
  const showPhoto = !!uri && !failed;
  return (
    <View style={styles.half}>
      {showPhoto ? (
        <Image source={{ uri }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" transition={150} onError={() => setFailed(true)} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Ionicons name="person" size={40} color="#2A2620" />
        </View>
      )}
      <LinearGradient
        colors={["rgba(8,8,8,0)", "rgba(8,8,8,0.55)", "rgba(8,8,8,0.94)"]}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {(member.first_name || member.name || "").split(" ")[0]}
          {member.age ? <Text style={styles.age}>  {member.age}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

export function DuoCard({
  member1,
  member2,
  width,
  height,
}: {
  member1: DuoDeckMember;
  member2: DuoDeckMember;
  width: number;
  height: number;
}) {
  return (
    <View style={[styles.card, { width, height }]}>
      <MemberHalf member={member1} />
      <View style={styles.divider} />
      <MemberHalf member={member2} />
      <View style={styles.duoBadge}>
        <Text style={styles.duoBadgeText}>DUO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#101010",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(201,168,76,0.22)",
    ...glowShadow(0.08, 24),
  },
  half: { flex: 1, position: "relative" },
  photo: { width: "100%", height: "100%", position: "absolute" },
  photoPlaceholder: { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  gradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "44%",
  },
  info: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 20 },
  name: { color: "#fff", fontSize: 21, fontWeight: "700", letterSpacing: 0.2 },
  age: { fontWeight: "300", color: "rgba(255,255,255,0.86)" },
  divider: { width: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(201,168,76,0.75)" },
  duoBadge: {
    position: "absolute", top: 14, right: 14,
    backgroundColor: "rgba(8,8,8,0.6)", borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.7)",
    paddingHorizontal: 11, paddingVertical: 4,
  },
  duoBadgeText: { color: "#C9A84C", fontSize: 10, fontWeight: "800", letterSpacing: 2.5 },
});
