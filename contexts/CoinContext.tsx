import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../app/lib/supabase'

export type CoinToastData = { amount: number; label: string }

type CoinContextValue = {
  coinBalance: number
  refreshBalance: () => Promise<void>
  toast: CoinToastData | null
  showCoinToast: (amount: number, label?: string) => void
  clearToast: () => void
}

const CoinContext = createContext<CoinContextValue>({
  coinBalance: 0,
  refreshBalance: async () => {},
  toast: null,
  showCoinToast: () => {},
  clearToast: () => {},
})

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const [coinBalance, setCoinBalance] = useState(0)
  const [toast, setToast] = useState<CoinToastData | null>(null)
  const isMountedRef   = useRef(true)
  const initializedRef = useRef(false)
  const toastTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showCoinToast = useCallback((amount: number, label = '') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ amount, label })
    toastTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setToast(null)
    }, 3500)
  }, [])

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
  }, [])

  const refreshBalance = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return
      const { data } = await supabase
        .from('profiles')
        .select('coin_balance')
        .eq('id', user.id)
        .single()
      if (data && isMountedRef.current) {
        setCoinBalance(data.coin_balance ?? 0)
        initializedRef.current = true
      }
    } catch {
      // Silently fail — balance shows as stale until next refresh
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      realtimeChannel = supabase
        .channel(`coin-balance-${user.id}`)
        .on(
          'postgres_changes' as Parameters<typeof supabase.channel>[0] extends never ? never : any,
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload: { new: Record<string, number>; old: Record<string, number> }) => {
            if (!isMountedRef.current) return
            const newBal = payload.new?.coin_balance ?? 0
            const oldBal = payload.old?.coin_balance ?? 0
            const diff   = newBal - oldBal
            setCoinBalance(newBal)
            // Only toast on unexpected gains (not the initial load)
            if (diff > 0 && initializedRef.current) {
              showCoinToast(diff)
            }
          }
        )
        .subscribe()
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (session) {
        refreshBalance()
        setupRealtime()
      } else {
        if (isMountedRef.current) {
          setCoinBalance(0)
          initializedRef.current = false
        }
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel)
          realtimeChannel = null
        }
      }
    })

    refreshBalance().then(setupRealtime)

    return () => {
      isMountedRef.current = false
      data.subscription?.unsubscribe()
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [refreshBalance, showCoinToast])

  return (
    <CoinContext.Provider value={{ coinBalance, refreshBalance, toast, showCoinToast, clearToast }}>
      {children}
    </CoinContext.Provider>
  )
}

export function useCoin(): CoinContextValue {
  return useContext(CoinContext)
}
