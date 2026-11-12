import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  uri?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Avatar with a graceful fallback — a missing/broken/expired photo URL
 * renders as a plain silhouette instead of an empty black circle. Used
 * anywhere a person's photo is shown small and un-editable (chat header,
 * conversation rows, match cards); the profile editor's own photo grid has
 * its own handling since drag-to-reorder depends on the plain RN Image there.
 */
export function Avatar({ uri, size, style }: Props) {
  const [failed, setFailed] = useState(false);
  // This component isn't re-keyed per person (chat header, conversation
  // rows), so a failed load for one uri must not keep showing the fallback
  // once the uri changes to someone else's photo.
  useEffect(() => { setFailed(false); }, [uri]);
  const showFallback = !uri || failed;

  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#1A1815" }, style]}>
      {!showFallback && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      )}
      {showFallback && (
        <View style={styles.fallback}>
          <Ionicons name="person" size={size * 0.55} color="#3A3530" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
});
