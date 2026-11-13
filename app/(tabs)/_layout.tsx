import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Label only appears under the active tab — five permanent labels read as
// dense/heavy at this width (and "Matchningar" was clipping to "Matchning…").
// One focused label plus four quiet icons is lighter and still unambiguous.
function makeLabel(text: string) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) =>
    focused ? <Text style={{ color, fontSize: 10, fontWeight: "700", letterSpacing: 0.3, marginTop: 2 }}>{text}</Text> : null;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0A",
          borderTopColor: "#18160F",
          borderTopWidth: 1,
          // Room for icon + the active label on every device — including
          // phones without a home-indicator inset, where the label used to clip.
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#C9A84C",
        tabBarInactiveTintColor: "#4A4438",
      }}
    >
      <Tabs.Screen
        name="swipe"
        options={{
          title: "Utforska",
          tabBarLabel: makeLabel("Utforska"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "flame" : "flame-outline"} size={24} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="duos"
        options={{
          title: "Duos",
          tabBarLabel: makeLabel("Duos"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matcher",
          tabBarLabel: makeLabel("Matcher"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={23} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Coins",
          tabBarLabel: makeLabel("Coins"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} size={23} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarLabel: makeLabel("Profil"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={25} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}