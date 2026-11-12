import { ActivityIndicator, StyleSheet, View } from "react-native";

export function AppLoader() {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color="#C9A84C" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#080808", justifyContent: "center", alignItems: "center" },
});
