import { supabase } from './supabase'

export type DuoStatus = 'pending' | 'active' | 'left'

export type DuoPartner = {
  id: string
  first_name: string | null
  name: string | null
  age: number | null
  avatar: string | null
}

export type MyDuo = {
  id: string
  status: DuoStatus
  inviteCode: string
  partner: DuoPartner | null
  isActive: boolean
}

export type DuoDeckMember = {
  id: string
  first_name: string | null
  name: string | null
  age: number | null
  gender: string | null
  avatar: string | null
  images: string[] | null
}

export type DuoDeckCard = {
  id: string
  member1: DuoDeckMember
  member2: DuoDeckMember
}

function unwrap<T = any>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as T | null
}

export async function createDuoInvite(): Promise<{ success: boolean; duoId?: string; inviteCode?: string; error_code?: string }> {
  const { data, error } = await supabase.rpc('create_duo_invite')
  if (error) return { success: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, duoId: row?.duo_id, inviteCode: row?.invite_code, error_code: row?.error_code }
}

export async function joinDuo(code: string): Promise<{ success: boolean; duoId?: string; partnerId?: string; error_code?: string }> {
  const { data, error } = await supabase.rpc('join_duo', { p_code: code })
  if (error) return { success: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, duoId: row?.duo_id, partnerId: row?.partner_id, error_code: row?.error_code }
}

export async function leaveDuo(duoId: string): Promise<{ success: boolean; error_code?: string }> {
  const { data, error } = await supabase.rpc('leave_duo', { p_duo_id: duoId })
  if (error) return { success: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, error_code: row?.error_code }
}

export async function setActiveDuo(duoId: string): Promise<{ success: boolean; error_code?: string }> {
  const { data, error } = await supabase.rpc('set_active_duo', { p_duo_id: duoId })
  if (error) return { success: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, error_code: row?.error_code }
}

export async function duoSwipeLike(myDuoId: string, targetDuoId: string): Promise<{ success: boolean; matched: boolean; duoMatchId?: string; error_code?: string }> {
  const { data, error } = await supabase.rpc('duo_swipe_like', { p_my_duo_id: myDuoId, p_target_duo_id: targetDuoId })
  if (error) return { success: false, matched: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, matched: row?.matched ?? false, duoMatchId: row?.duo_match_id, error_code: row?.error_code }
}

export async function unlockDuoMatch(duoMatchId: string): Promise<{ success: boolean; payer_balance?: number; error_code?: string }> {
  const { data, error } = await supabase.rpc('unlock_duo_match_atomic', { p_duo_match_id: duoMatchId })
  if (error) return { success: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, payer_balance: row?.payer_balance, error_code: row?.error_code }
}

// All of the caller's pending/active duos, each flagged with whether it's
// currently selected for swiping (profiles.active_duo_id).
export async function getMyDuos(): Promise<MyDuo[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [{ data: profile }, { data: duosData, error }] = await Promise.all([
    supabase.from('profiles').select('active_duo_id').eq('id', user.id).single(),
    supabase
      .from('duos')
      .select(`
        id, invite_code, status, member1, member2,
        member1_profile:profiles!duos_member1_fkey(id, first_name, name, age, avatar),
        member2_profile:profiles!duos_member2_fkey(id, first_name, name, age, avatar)
      `)
      .or(`member1.eq.${user.id},member2.eq.${user.id}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false }),
  ])

  if (error || !duosData) return []
  const activeDuoId = profile?.active_duo_id ?? null

  return duosData.map((d: any) => {
    const isMember1 = d.member1 === user.id
    const partnerProfile = isMember1 ? d.member2_profile : d.member1_profile
    return {
      id: d.id,
      status: d.status as DuoStatus,
      inviteCode: d.invite_code,
      isActive: d.id === activeDuoId,
      partner: partnerProfile
        ? { id: partnerProfile.id, first_name: partnerProfile.first_name, name: partnerProfile.name, age: partnerProfile.age, avatar: partnerProfile.avatar }
        : null,
    }
  })
}

// The one duo (of possibly several) the caller is currently swiping as.
export async function getActiveDuo(): Promise<MyDuo | null> {
  const duos = await getMyDuos()
  return duos.find((d) => d.isActive) ?? null
}

export async function fetchDuoDeckPage(offset: number, limit: number, excludeDuoIds: string[]): Promise<DuoDeckCard[]> {
  let query = supabase
    .from('duos')
    .select(`
      id,
      member1_profile:profiles!duos_member1_fkey(id, first_name, name, age, gender, avatar, images),
      member2_profile:profiles!duos_member2_fkey(id, first_name, name, age, gender, avatar, images)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (excludeDuoIds.length > 0) query = query.not('id', 'in', `(${excludeDuoIds.join(',')})`)

  const { data, error } = await query
  if (error) throw error

  return (data ?? [])
    .filter((d: any) => d.member1_profile && d.member2_profile)
    .map((d: any) => ({ id: d.id, member1: d.member1_profile, member2: d.member2_profile }))
}

export async function getLikedDuoIds(fromDuoId: string): Promise<Set<string>> {
  const { data } = await supabase.from('duo_likes').select('to_duo').eq('from_duo', fromDuoId)
  return new Set((data ?? []).map((r: any) => r.to_duo))
}

export type DuoMatchRow = {
  id: string
  duo_a: string
  duo_b: string
  chat_unlocked: boolean
  match_locked: boolean
  paid_by: string | null
  created_at: string
}

// Every duo the user was ever part of (including 'left' ones) — a dissolved
// duo shouldn't retroactively hide matches/chats formed while it was active.
export async function getMyDuoIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('duos').select('id').or(`member1.eq.${user.id},member2.eq.${user.id}`)
  return (data ?? []).map((d: any) => d.id)
}

export async function fetchMyDuoMatches(myDuoIds: string[]): Promise<DuoMatchRow[]> {
  if (myDuoIds.length === 0) return []
  const orClause = myDuoIds.map((id) => `duo_a.eq.${id},duo_b.eq.${id}`).join(',')
  const { data, error } = await supabase.from('duo_matches').select('*').or(orClause)
  if (error) { console.log('fetchMyDuoMatches error:', error.message); return [] }
  return (data ?? []) as DuoMatchRow[]
}

export async function buyDuoSlot(): Promise<{ success: boolean; newSlots?: number; coinBalance?: number; error_code?: string }> {
  const { data, error } = await supabase.rpc('buy_duo_slot')
  if (error) return { success: false, error_code: error.message }
  const row = unwrap<any>(data)
  return { success: row?.success ?? false, newSlots: row?.new_slots, coinBalance: row?.coin_balance, error_code: row?.error_code }
}

export async function getMyDuoSlotInfo(): Promise<{ slots: number; used: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: 1, used: 0 }
  const [{ data: profile }, { data: duosData }] = await Promise.all([
    supabase.from('profiles').select('duo_slots').eq('id', user.id).single(),
    supabase.from('duos').select('id').or(`member1.eq.${user.id},member2.eq.${user.id}`).in('status', ['pending', 'active']),
  ])
  return { slots: profile?.duo_slots ?? 1, used: (duosData ?? []).length }
}

export async function fetchDuoMembers(duoId: string): Promise<{ member1: DuoDeckMember; member2: DuoDeckMember } | null> {
  const { data } = await supabase
    .from('duos')
    .select(`
      member1_profile:profiles!duos_member1_fkey(id, first_name, name, age, gender, avatar, images),
      member2_profile:profiles!duos_member2_fkey(id, first_name, name, age, gender, avatar, images)
    `)
    .eq('id', duoId)
    .maybeSingle()
  if (!data) return null
  return { member1: (data as any).member1_profile, member2: (data as any).member2_profile }
}
