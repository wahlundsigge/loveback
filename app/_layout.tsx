import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from './lib/supabase';
import { IS_DEMO } from '../demo/config';
import { CoinProvider } from '../contexts/CoinContext';
import { UserProvider } from '../contexts/UserContext';
import { CoinToast } from '../components/CoinToast';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip INITIAL_SESSION — index.tsx handles the first load
      if (event === 'INITIAL_SESSION') return;

      if (!session) {
        router.replace('/auth');
        return;
      }

      const { data: p } = await supabase
        .from('profiles')
        .select('profile_completed')
        .eq('id', session.user.id)
        .single();

      if (!p?.profile_completed) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/swipe');
      }
    });

    // The demo session only lives in memory, so reloading the browser on a
    // deep link (e.g. /profile) arrives without one — send it to the start.
    if (IS_DEMO && Platform.OS === 'web') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) router.replace('/auth');
      });
    }

    return () => data.subscription?.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <CoinProvider>
            <UserProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="buy-coins" options={{ presentation: 'modal' }} />
              <Stack.Screen name="manage-duos" />
              <Stack.Screen name="chat/[matchId]" />
            </Stack>
            <CoinToast />
            <StatusBar style="light" />
            </UserProvider>
          </CoinProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
