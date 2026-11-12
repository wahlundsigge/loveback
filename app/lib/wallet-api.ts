import { supabase } from './supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export type CoinTransaction = {
  id: string
  amount: number
  balance_after: number
  type: string
  ref_id: string | null
  ref_type: string | null
  description: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export type WalletData = {
  coin_balance: number
  transactions: CoinTransaction[]
  purchase_history: CoinTransaction[]
  reward_history: CoinTransaction[]
}

export type CoinPackage = {
  id: string
  coins: number
  price_sek: number
  label: string
  bonus_coins: number
  sort_order: number
  /** Only present when fetched via the admin package list (getAdminCoinPackages) —
   *  the customer-facing getCoinPackages() below always filters to active-only
   *  and doesn't select this column. */
  is_active?: boolean
}

export type UnlockResult = {
  success: boolean
  payer_balance: number
  partner_balance: number
  error_code?: string
}

export type PurchaseResult = {
  success: boolean
  new_balance: number
  coins_added: number
  package: {
    id: string
    label: string
    coins: number
    bonus_coins: number
    price_sek: number
  }
}

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) {
    throw new Error('Not authenticated')
  }
  return `Bearer ${data.session.access_token}`
}

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const authHeader = await getAuthHeader()
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    const err = new Error(data.error ?? 'Edge Function error') as Error & {
      statusCode: number
      errorCode: string
    }
    err.statusCode = response.status
    err.errorCode = data.error_code ?? data.error
    throw err
  }

  return data as T
}

export async function getWallet(): Promise<WalletData> {
  return callEdgeFunction<WalletData>('get-wallet')
}

export async function unlockMatch(matchId: string): Promise<UnlockResult> {
  return callEdgeFunction<UnlockResult>('unlock-match', { match_id: matchId })
}

export async function purchaseCoins(packageId: string): Promise<PurchaseResult> {
  return callEdgeFunction<PurchaseResult>('purchase-coins', { package_id: packageId })
}

export interface RoseResult {
  success: boolean
  match_id?: string
  error_code?: string
}

export async function sendRose(toUserId: string, message: string): Promise<RoseResult> {
  const { data, error } = await supabase.rpc('send_rose_atomic', {
    p_to_user: toUserId,
    p_message: message,
  })
  if (error) return { success: false, error_code: error.message }
  const row = Array.isArray(data) ? data[0] : data
  return { success: row?.success ?? false, match_id: row?.match_id, error_code: row?.error_code }
}

export async function claimRoseReward(matchId: string): Promise<{ success: boolean; coins_earned: number }> {
  const { data } = await supabase.rpc('pay_rose_reward', { p_match_id: matchId })
  const row = Array.isArray(data) ? data[0] : data
  return { success: row?.success ?? false, coins_earned: row?.coins_earned ?? 0 }
}

export async function activateBoost(): Promise<{ success: boolean; expires_at?: string; error_code?: string }> {
  const { data, error } = await supabase.rpc('activate_boost_atomic')
  if (error) return { success: false, error_code: error.message }
  const row = Array.isArray(data) ? data[0] : data
  return { success: row?.success ?? false, expires_at: row?.expires_at, error_code: row?.error_code }
}

export async function getCoinPackages(): Promise<CoinPackage[]> {
  const { data, error } = await supabase
    .from('coin_packages')
    .select('id, coins, price_sek, label, bonus_coins, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoinPackage[]
}
