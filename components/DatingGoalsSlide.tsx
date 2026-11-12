import { StyleSheet, Text, View } from "react-native";
import { DATING_GOAL_OPTIONS, DatingGoalIcon } from "./DatingGoalOptions";

export function DatingGoalsSlide({ goals, title }: { goals: string[]; title: string }) {
  const selected = DATING_GOAL_OPTIONS.filter((o) => goals.includes(o.value));
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={styles.pillWrap}>
        {selected.map((opt) => (
          <View key={opt.value} style={styles.pill}>
            <DatingGoalIcon value={opt.value} size={18} />
            <Text style={styles.pillText}>{opt.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", width: "100%", height: "100%",
    backgroundColor: "#101010", alignItems: "center", justifyContent: "center",
    padding: 28, gap: 20,
  },
  eyebrow: { color: "#3A3530", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, textAlign: "center" },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1E1A0A", borderColor: "#C9A84C", borderWidth: 1,
    borderRadius: 50, paddingVertical: 12, paddingHorizontal: 18,
  },
  pillText: { color: "#C9A84C", fontSize: 14, fontWeight: "700" },
});
