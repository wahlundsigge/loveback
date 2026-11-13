import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "./lib/supabase";
import { IS_DEMO } from "../demo/config";
import { LogoIcon } from "../components/LogoIcon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Touchable } from "../components/Touchable";
import { friendlyError } from "./lib/friendly-error";

const QUOTES = [
  { text: "You know you're in love when you can't fall asleep because reality is finally better than your dreams.", author: "Dr. Seuss" },
  { text: "The greatest love of all is the love we give.", author: "Tupac Shakur" },
  { text: "Gravitation is not responsible for people falling in love.", author: "Albert Einstein" },
  { text: "The mystery of love is greater than the mystery of death.", author: "Oscar Wilde" },
];

function QuoteCycle() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start(() => {
        if (!cancelled) {
          setIndex(i => (i + 1) % QUOTES.length);
        }
      });
    };
    cycle();
    return () => { cancelled = true; };
  }, [index]);

  const q = QUOTES[index];
  return (
    <Animated.View style={[quotStyles.wrap, { opacity }]}>
      <Text style={quotStyles.text}>"{q.text}"</Text>
      <Text style={quotStyles.author}>— {q.author}</Text>
    </Animated.View>
  );
}

const quotStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 36, alignItems: "center" },
  text: { color: "rgba(201,168,76,0.55)", fontSize: 13, fontStyle: "italic", textAlign: "center", lineHeight: 20, letterSpacing: 0.3 },
  author: { color: "rgba(201,168,76,0.3)", fontSize: 11, marginTop: 10, letterSpacing: 2, textTransform: "uppercase" },
});

type Step = "welcome" | "login" | "signup";

const AUTH_SWIPE_W = Dimensions.get("window").width;

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edge-swipe-to-go-back on the login/signup screens — they're a state
  // toggle within this same screen (not routed), so they don't get iOS's
  // native swipe-back gesture for free; this recreates that feel by hand,
  // same pattern as the chat view in app/(tabs)/matches.tsx.
  const screenTranslateX = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current.x;
  const swipeStartXRef = useRef<number | null>(null);
  const goBackToWelcome = () => { setErrorMsg(""); setSuccessMsg(""); setStep("welcome"); };
  const authSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (swipeStartXRef.current === null) return false;
        return swipeStartXRef.current < 28 && gestureState.dx > 10 && Math.abs(gestureState.dy) < 40;
      },
      onPanResponderMove: (_evt, gestureState) => {
        screenTranslateX.setValue(Math.max(0, gestureState.dx));
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const dismiss = gestureState.dx > AUTH_SWIPE_W * 0.3 || gestureState.vx > 0.8;
        if (dismiss) {
          Animated.timing(screenTranslateX, { toValue: AUTH_SWIPE_W, duration: 200, useNativeDriver: true })
            .start(() => { screenTranslateX.setValue(0); goBackToWelcome(); });
        } else {
          Animated.spring(screenTranslateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(screenTranslateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;
  const onAuthScreenTouchStart = (e: any) => { swipeStartXRef.current = e.nativeEvent.pageX; };

  const handleLogin = async () => {
    setErrorMsg("");
    if (!email || !password) { setErrorMsg("Fyll i e-post och lösenord."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg(friendlyError(error, "Kunde inte logga in. Försök igen."));
        setLoading(false);
        return;
      }
      if (!data.session) {
        setErrorMsg("Inloggning misslyckades – kontrollera uppgifterna.");
        setLoading(false);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("id", data.session.user.id)
        .single();
      // A failed lookup here (e.g. a network blip right after sign-in)
      // previously fell through to the `else` below and silently sent an
      // existing, fully-onboarded user back to onboarding instead of their
      // profile — the error was never even read.
      if (profileError) {
        setErrorMsg(friendlyError(profileError, "Kunde inte logga in. Försök igen."));
        setLoading(false);
        return;
      }
      if (profile?.profile_completed) {
        router.replace("/(tabs)/swipe");
      } else {
        router.replace("/onboarding");
      }
    } catch (e: any) {
      setErrorMsg(friendlyError(e, "Kunde inte logga in. Försök igen."));
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setErrorMsg("");
    if (!email || !password) {
      setErrorMsg("Fyll i e-post och lösenord.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg(friendlyError(error, "Kunde inte skapa kontot. Försök igen."));
        return;
      }
      if (!data.user) {
        setErrorMsg("Registrering misslyckades – försök igen.");
        return;
      }
      if (!data.session) {
        setSuccessMsg("✓ Kolla din e-post och bekräfta kontot, sedan kan du logga in.");
        return;
      }
      router.replace("/onboarding");
    } catch (e: any) {
      setErrorMsg(friendlyError(e, "Kunde inte skapa kontot. Försök igen."));
    } finally {
      setLoading(false);
    }
  };

  const startDemo = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithPassword({ email: "", password: "" });
      router.replace("/(tabs)/swipe");
    } finally {
      setLoading(false);
    }
  };

  if (step === "welcome") {
    return (
      <View style={styles.welcome}>
        <View style={styles.logoArea}>
          <LogoIcon size={80} />
          <Text style={styles.appName}>LOVEBACK</Text>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerDot}>✦</Text>
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.tagline}>PREMIUM DATING</Text>
          <View style={styles.quoteArea}>
            <QuoteCycle />
          </View>
        </View>
        {IS_DEMO ? (
          // Demo Mode: one entry point into the fictional demo account —
          // there is no real backend to sign in to or create accounts on.
          <View style={styles.welcomeButtons}>
            <Touchable style={[styles.primaryBtn, loading && styles.disabledBtn]} haptic="medium" onPress={startDemo} disabled={loading} testID="start-demo-btn">
              <Text style={styles.primaryBtnText}>{loading ? "Startar..." : "Starta demo"}</Text>
            </Touchable>
            <Text style={styles.demoCaption}>DEMOLÄGE · FIKTIV DATA</Text>
          </View>
        ) : (
          <View style={styles.welcomeButtons}>
            <Touchable style={styles.primaryBtn} onPress={() => setStep("signup")}>
              <Text style={styles.primaryBtnText}>Skapa konto</Text>
            </Touchable>
            <Touchable style={styles.outlineBtn} onPress={() => setStep("login")}>
              <Text style={styles.outlineBtnText}>Logga in</Text>
            </Touchable>
          </View>
        )}
      </View>
    );
  }

  if (step === "login") {
    return (
      <Animated.View
        style={{ flex: 1, transform: [{ translateX: screenTranslateX }] }}
        onTouchStart={onAuthScreenTouchStart}
        {...authSwipeResponder.panHandlers}
      >
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Touchable style={styles.backRow} onPress={goBackToWelcome}>
          <Text style={styles.backText}>← Tillbaka</Text>
        </Touchable>
        <Text style={styles.heading}>Välkommen tillbaka</Text>
        <TextInput
          style={styles.input}
          placeholder="E-post"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Lösenord"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <Touchable style={styles.passwordToggle} haptic={false} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Text style={styles.passwordToggleText}>{showPassword ? "Dölj" : "Visa"}</Text>
          </Touchable>
        </View>
        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        <Touchable
          style={[styles.primaryBtn, loading && styles.disabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>{loading ? "Loggar in..." : "Logga in"}</Text>
        </Touchable>
        <Touchable onPress={() => { setErrorMsg(""); setStep("signup"); }}>
          <Text style={styles.switchText}>Inget konto? Skapa ett</Text>
        </Touchable>
      </KeyboardAvoidingView>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateX: screenTranslateX }] }}
      onTouchStart={onAuthScreenTouchStart}
      {...authSwipeResponder.panHandlers}
    >
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Touchable style={styles.backRow} onPress={goBackToWelcome}>
          <Text style={styles.backText}>← Tillbaka</Text>
        </Touchable>
        <Text style={styles.heading}>Skapa konto</Text>
        <TextInput
          style={styles.input}
          placeholder="E-post"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Lösenord (minst 6 tecken)"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <Touchable style={styles.passwordToggle} haptic={false} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Text style={styles.passwordToggleText}>{showPassword ? "Dölj" : "Visa"}</Text>
          </Touchable>
        </View>
        {!!successMsg && <Text style={styles.successText}>{successMsg}</Text>}
        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        <Touchable
          style={[styles.primaryBtn, loading && styles.disabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>{loading ? "Skapar konto..." : "Kom igång"}</Text>
        </Touchable>
        <Touchable onPress={() => { setErrorMsg(""); setStep("login"); }}>
          <Text style={styles.switchText}>Har du redan ett konto? Logga in</Text>
        </Touchable>
      </ScrollView>
    </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  welcome: {
    flex: 1,
    backgroundColor: "#080808",
    justifyContent: "space-between",
    paddingBottom: 60,
  },
  logoArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoMark: {
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 10,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  dividerLine: {
    height: 1,
    width: 48,
    backgroundColor: "#2E2A18",
  },
  dividerDot: {
    color: "#C9A84C",
    fontSize: 10,
  },
  tagline: {
    fontSize: 11,
    color: "#C9A84C",
    letterSpacing: 5,
    fontWeight: "600",
  },
  quoteArea: {
    marginTop: 32,
    alignItems: "center",
  },
  demoCaption: { color: "#6E6250", fontSize: 11, letterSpacing: 2.5, textAlign: "center", marginTop: 4 },
  disabledBtn: { opacity: 0.5 },
  welcomeButtons: {
    paddingHorizontal: 32,
    gap: 14,
  },
  screen: {
    flex: 1,
    backgroundColor: "#080808",
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  backRow: {
    marginBottom: 28,
  },
  backText: {
    color: "#C9A84C",
    fontSize: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 28,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#101010",
    color: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E1C19",
  },
  passwordWrap: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 64 },
  passwordToggle: { position: "absolute", right: 6, top: 0, bottom: 12, paddingHorizontal: 12, justifyContent: "center" },
  passwordToggleText: { color: "#C9A84C", fontSize: 13, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  primaryBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  outlineBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C9A84C",
  },
  outlineBtnText: {
    color: "#C9A84C",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  switchText: {
    color: "#5A5040",
    textAlign: "center",
    fontSize: 14,
  },
  successText: {
    color: "#C9A84C",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    color: "#ff4d4d",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});
