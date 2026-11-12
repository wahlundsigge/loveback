import { supabase } from './supabase'
import type { CoinPackage } from './wallet-api'

/** Admin package list — unlike wallet-api's getCoinPackages(), this does NOT
 *  filter to active-only (an admin needs to see and re-enable inactive
 *  packages too) and it selects is_active so the toggle reflects real state. */
export async function getAdminCoinPackages(): Promise<CoinPackage[]> {
  const { data, error } = await supabase
    .from('coin_packages')
    .select('id, coins, price_sek, label, bonus_coins, sort_order, is_active')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CoinPackage[]
}

export type AdminStats = {
  total_users: number
  users_today: number
  users_week: number
  total_matches: number
  matches_today: number
  total_messages: number
  messages_today: number
  coins_circulation: number
  coins_purchased: number
  roses_sent: number
  boosts_used: number
  active_boosts: number
  signups_by_day: Array<{ date: string; count: number }>
}

export type ActivityRange = '7d' | '30d' | '90d' | '1y'

export type AdminActivity = {
  active_users: number
  total_unlocks: number
  series: Array<{ bucket: string; unlocks: number; active_users: number }>
}

export type AdminUser = {
  id: string
  name: string
  email: string
  age: number | null
  gender: string | null
  coin_balance: number
  is_admin: boolean
  profile_completed: boolean
  created_at: string
  boost_expires_at: string | null
}

export type PlatformSetting = {
  key: string
  value: string
  description: string | null
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats')
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Ingen statistik mottagen')
  return data as AdminStats
}

export async function getAdminActivity(range: ActivityRange): Promise<AdminActivity> {
  const { data, error } = await supabase.rpc('get_admin_activity', { p_range: range })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Ingen aktivitetsdata mottagen')
  return data as AdminActivity
}

export async function adminSearchUsers(query: string): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query: query,
    p_limit: 500,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminUser[]
}

export async function adminGrantCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; new_balance: number }> {
  const { data, error } = await supabase.rpc('admin_grant_coins', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; new_balance: number }
}

export async function adminUpdateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_setting', {
    p_key: key,
    p_value: value,
  })
  if (error) throw new Error(error.message)
}

export async function getPlatformSettings(): Promise<PlatformSetting[]> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value, description')
    .order('key')
  if (error) throw new Error(error.message)
  return (data ?? []) as PlatformSetting[]
}

export async function toggleCoinPackage(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('coin_packages')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
