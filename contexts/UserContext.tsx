import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../app/lib/supabase'

type UserContextValue = {
  currentUser: any | null
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  refreshUser: async () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const isMountedRef = useRef(true)

  const refreshUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (isMountedRef.current) {
        setCurrentUser(profile ?? { id: user.id, name: 'Du', first_name: 'Du', age: 25 })
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (session) { refreshUser() } else { if (isMountedRef.current) setCurrentUser(null) }
    })

    refreshUser()

    return () => {
      isMountedRef.current = false
      data.subscription?.unsubscribe()
    }
  }, [refreshUser])

  return (
    <UserContext.Provider value={{ currentUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  return useContext(UserContext)
}
