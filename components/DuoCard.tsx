import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
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
      <View style={styles.gradient} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {(member.first_name || member.name || "").split(" ")[0]}{member.age ? `, ${member.age}` : ""}
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
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#101010",
    ...glowShadow(0.08, 24),
  },
  half: { flex: 1, position: "relative" },
  photo: { width: "100%", height: "100%", position: "absolute" },
  photoPlaceholder: { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  gradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  info: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 14, paddingBottom: 14 },
  name: { color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: 0.3 },
  divider: { width: 2, backgroundColor: "#C9A84C" },
  duoBadge: {
    position: "absolute", top: 14, right: 14,
    backgroundColor: "#C9A84C", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  duoBadgeText: { color: "#000", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
});
