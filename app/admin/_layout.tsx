import { Ionicons } from '@expo/vector-icons'
import { router, Tabs, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

export default function AdminLayout() {
  const [checking, setChecking] = useState(true)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth'); return }
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
      if (!data?.is_admin) { router.replace('/(tabs)/swipe'); return }
      setChecking(false)
    }
    check()
  }, [])

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#C9A84C" size="large" />
      </View>
    )
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#080808',
          borderTopColor: '#1A1712',
          borderTopWidth: 1,
          height: 54 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#C9A84C',
        tabBarInactiveTintColor: '#3A3530',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Översikt',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Användare',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Inställningar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  )
}
