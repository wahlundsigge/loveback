import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAdminActivity, getAdminStats, type ActivityRange, type AdminActivity, type AdminStats } from '../lib/admin-api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { friendlyError } from '../lib/friendly-error'
import { Touchable } from '../../components/Touchable'

const RANGE_LABELS: Record<ActivityRange, string> = {
  '7d': '7 dagar',
  '30d': '30 dagar',
  '90d': '90 dagar',
  '1y': '1 år',
}

const SETTING_LABELS: Record<string, string> = {
  unlock_cost_coins:      'Upplåsningskostnad',
  super_like_cost_coins:  'Rose-kostnad',
  super_like_reward_coins:'Rose-belöning',
  boost_cost_coins:       'Boost-kostnad',
  reward_amount_coins:    'Matchbelöning',
  new_user_bonus:         'Välkomstbonus',
}

function StatCard({ label, value, gold }: { label: string; value: number | string; gold?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={gold ? styles.statValueGold : styles.statValueWhite}>{typeof value === 'number' ? value.toLocaleString('sv-SE') : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function BarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <View style={styles.chart}>
      {data.map((d) => (
        <View key={d.date} style={styles.chartCol}>
          <Text style={styles.chartCount}>{d.count}</Text>
          <View style={styles.chartBarWrap}>
            <View style={[styles.chartBar, { height: Math.max(4, (d.count / max) * 80) }]} />
          </View>
          <Text style={styles.chartDate}>{d.date.slice(5)}</Text>
        </View>
      ))}
    </View>
  )
}

export default function AdminOverview() {
  const insets = useSafeAreaInsets()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [range, setRange] = useState<ActivityRange>('7d')
  const [activity, setActivity] = useState<AdminActivity | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const s = await getAdminStats()
      setStats(s)
    } catch (e: any) {
      setError(friendlyError(e, 'Kunde inte ladda statistiken.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadActivity = async (r: ActivityRange) => {
    try {
      setActivityError(null)
      setActivityLoading(true)
      const a = await getAdminActivity(r)
      setActivity(a)
    } catch (e: any) {
      setActivityError(friendlyError(e, 'Kunde inte ladda aktiviteten.'))
    } finally {
      setActivityLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadActivity(range) }, [range])

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#C9A84C" size="large" />
    </View>
  )

  if (error || !stats) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{error ?? 'Ingen statistik mottagen'}</Text>
      <Touchable onPress={load} style={styles.retryBtn}>
        <Text style={styles.retryText}>Försök igen</Text>
      </Touchable>
    </View>
  )

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); loadActivity(range) }} tintColor="#C9A84C" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>ADMIN</Text>
        <Touchable onPress={() => router.replace('/(tabs)/swipe')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← App</Text>
        </Touchable>
      </View>

      <Text style={styles.section}>ANVÄNDARE</Text>
      <View style={styles.grid2}>
        <StatCard label="Totalt" value={stats!.total_users} />
        <StatCard label="Nya idag" value={stats!.users_today} gold />
        <StatCard label="Denna vecka" value={stats!.users_week} />
        <StatCard label="Aktiva boosts" value={stats!.active_boosts} gold={stats!.active_boosts > 0} />
      </View>

      <Text style={styles.section}>AKTIVITET</Text>
      <View style={styles.grid2}>
        <StatCard label="Matcher totalt" value={stats!.total_matches} />
        <StatCard label="Matcher idag" value={stats!.matches_today} gold />
        <StatCard label="Meddelanden totalt" value={stats!.total_messages} />
        <StatCard label="Meddelanden idag" value={stats!.messages_today} gold />
      </View>

      <Text style={styles.section}>EKONOMI</Text>
      <View style={styles.coinRow}>
        {[
          { label: 'I omlopp', value: stats!.coins_circulation },
          { label: 'Inköpta', value: stats!.coins_purchased },
          { label: 'Roses', value: stats!.roses_sent },
          { label: 'Boosts', value: stats!.boosts_used },
        ].map(({ label, value }) => (
          <View key={label} style={styles.coinCell}>
            <Text style={styles.coinValue}>{value.toLocaleString('sv-SE')}</Text>
            <Text style={styles.coinLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>INREGISTRERINGAR — 7 DAGAR</Text>
      <View style={styles.chartCard}>
        {stats!.signups_by_day.length > 0
          ? <BarChart data={stats!.signups_by_day} />
          : <Text style={styles.emptyText}>Inga registreringar denna vecka</Text>
        }
      </View>

      <Text style={styles.section}>AKTIVITET ÖVER TID</Text>
      <View style={styles.rangeRow}>
        {(Object.keys(RANGE_LABELS) as ActivityRange[]).map((r) => (
          <Touchable
            key={r}
            style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeChipText, range === r && styles.rangeChipTextActive]}>
              {RANGE_LABELS[r]}
            </Text>
          </Touchable>
        ))}
      </View>

      {activityError ? (
        <View style={styles.chartCard}>
          <Text style={styles.errorText}>{activityError}</Text>
          <Touchable onPress={() => loadActivity(range)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Försök igen</Text>
          </Touchable>
        </View>
      ) : activityLoading || !activity ? (
        <View style={styles.chartCard}>
          <ActivityIndicator color="#C9A84C" />
        </View>
      ) : (
        <>
          <View style={styles.grid2}>
            <StatCard label={`Aktiva (${RANGE_LABELS[range]})`} value={activity.active_users} gold />
            <StatCard label={`Upplåsningar (${RANGE_LABELS[range]})`} value={activity.total_unlocks} />
          </View>

          <Text style={styles.chartSubLabel}>UPPLÅSNINGAR</Text>
          <View style={styles.chartCard}>
            {activity.series.length > 0
              ? <BarChart data={activity.series.map(s => ({ date: s.bucket, count: s.unlocks }))} />
              : <Text style={styles.emptyText}>Inga upplåsningar under perioden</Text>
            }
          </View>

          <Text style={styles.chartSubLabel}>AKTIVA ANVÄNDARE</Text>
          <View style={styles.chartCard}>
            {activity.series.length > 0
              ? <BarChart data={activity.series.map(s => ({ date: s.bucket, count: s.active_users }))} />
              : <Text style={styles.emptyText}>Ingen aktivitet under perioden</Text>
            }
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#080808' },
  content:      { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40 },
  center:       { flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:        { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 4 },
  backBtn:      { backgroundColor: '#101010', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#1E1C19' },
  backBtnText:  { color: '#C9A84C', fontSize: 13, fontWeight: '700' },
  section:      { color: '#3A3530', fontSize: 10, fontWeight: '700', letterSpacing: 2.5, marginTop: 20, marginBottom: 10 },
  grid2:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statCard:     { flex: 1, minWidth: '45%', backgroundColor: '#101010', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E1C19', alignItems: 'center' },
  statValueGold: { color: '#C9A84C', fontSize: 28, fontWeight: '900' as const, letterSpacing: -1 },
  statValueWhite: { color: '#fff', fontSize: 28, fontWeight: '900' as const, letterSpacing: -1 },
  statLabel:    { color: '#3A3530', fontSize: 11, marginTop: 4, letterSpacing: 0.5, textAlign: 'center' as const },
  coinRow:      { flexDirection: 'row', backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: '#1E1C19', marginBottom: 4 },
  coinCell:     { flex: 1, alignItems: 'center', padding: 14 },
  coinValue:    { color: '#C9A84C', fontSize: 18, fontWeight: '800' },
  coinLabel:    { color: '#3A3530', fontSize: 10, marginTop: 3, letterSpacing: 0.5 },
  rangeRow:     { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rangeChip:    { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#101010', borderWidth: 1, borderColor: '#1E1C19', alignItems: 'center' },
  rangeChipActive: { backgroundColor: '#1E1A0A', borderColor: '#C9A84C' },
  rangeChipText: { color: '#4A4035', fontSize: 12, fontWeight: '600' },
  rangeChipTextActive: { color: '#C9A84C' },
  chartSubLabel: { color: '#3A3530', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 12, marginBottom: 6 },
  chartCard:    { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: '#1E1C19', padding: 16, marginBottom: 4 },
  chart:        { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 110 },
  chartCol:     { alignItems: 'center', flex: 1 },
  chartCount:   { color: '#C9A84C', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  chartBarWrap: { height: 80, justifyContent: 'flex-end' },
  chartBar:     { width: 20, backgroundColor: '#C9A84C', borderRadius: 4 },
  chartDate:    { color: '#3A3530', fontSize: 9, marginTop: 6 },
  emptyText:    { color: '#3A3530', textAlign: 'center', paddingVertical: 20 },
  errorText:    { color: '#ff6b6b', textAlign: 'center', marginBottom: 16 },
  retryBtn:     { backgroundColor: '#101010', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#1E1C19' },
  retryText:    { color: '#C9A84C', fontWeight: '600' },
} as const)
