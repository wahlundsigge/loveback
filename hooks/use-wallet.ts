import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../app/lib/supabase'
import type { CoinTransaction, WalletData } from '../app/lib/wallet-api'

type WalletState = {
  data: WalletData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useWallet(): WalletState {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Inte inloggad')

      const [profileRes, txRes] = await Promise.all([
        supabase.from('profiles').select('coin_balance').eq('id', user.id).single(),
        supabase.from('coin_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      ])

      if (profileRes.error) throw new Error(profileRes.error.message)
      if (txRes.error) throw new Error(txRes.error.message)

      if (isMountedRef.current) {
        const balance = profileRes.data?.coin_balance ?? 0
        const txs: CoinTransaction[] = (txRes.data ?? []).map((row: any) => ({
          id: row.id,
          amount: row.amount,
          balance_after: row.balance_after,
          type: row.type,
          ref_id: row.ref_id ?? null,
          ref_type: row.ref_type ?? null,
          description: row.description ?? null,
          created_at: row.created_at,
          metadata: row.metadata ?? {},
        }))
        setData({
          coin_balance: balance,
          transactions: txs,
          purchase_history: txs.filter(t => t.type === 'purchase'),
          reward_history: txs.filter(t => ['reward', 'bonus', 'promotion', 'super_like_reward', 'duo_reward'].includes(t.type)),
        })
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Kunde inte ladda plånbok')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    refresh()
    return () => {
      isMountedRef.current = false
    }
  }, [refresh])

  return { data, loading, error, refresh }
}
