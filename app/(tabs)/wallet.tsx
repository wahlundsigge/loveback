import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useWallet } from '../../hooks/use-wallet'
import { useCoin } from '../../contexts/CoinContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type CoinTransaction } from '../lib/wallet-api'
import { Touchable } from '../../components/Touchable'

const TX_TYPE_LABEL: Record<string, string> = {
  purchase:          'Köp',
  reward:            'Belöning',
  unlock_match:      'Match upplåst',
  refund:            'Återbetalning',
  admin_adjustment:  'Justering',
  bonus:             'Bonus',
  promotion:         'Kampanj',
  withdrawal:        'Uttag',
  super_like:        'Rose skickad',
  super_like_reward: 'Rose-belöning',
  boost:             'Profil boostad',
  duo_unlock_match:  'Duo-match upplåst',
  duo_reward:        'Duo-belöning',
  duo_slot_purchase: 'Duo-slot upplåst',
  daily_reward:      'Daglig belöning',
  new_user_bonus:    'Välkomstbonus',
  referral_bonus:    'Vänbonus',
}

const TX_DESC_OVERRIDE: Record<string, string> = {
  reward:            'Din match öppnade chatten — du fick coins som tack.',
  super_like_reward: 'Du svarade på en Rose — välförtjänat.',
  duo_reward:        'Er Duo-match öppnade chatten — ni fick coins som tack.',
}

type FilterTab = 'all' | 'purchase' | 'reward'

export default function WalletScreen() {
  const insets = useSafeAreaInsets()
  const { data, loading, error, refresh } = useWallet()
  const { refreshBalance } = useCoin()
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refresh(), refreshBalance()])
    setRefreshing(false)
  }, [refresh, refreshBalance])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

  const filteredTransactions = (): CoinTransaction[] => {
    if (!data) return []
    if (activeFilter === 'purchase') return data.purchase_history
    if (activeFilter === 'reward')   return data.reward_history
    return data.transactions
  }

  const renderTransaction = ({ item }: { item: CoinTransaction }) => {
    const isCredit = item.amount > 0
    return (
      <View style={styles.txRow}>
        <View style={styles.txLeft}>
          <Text style={styles.txType}>{TX_TYPE_LABEL[item.type] ?? item.type}</Text>
          <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
          {(TX_DESC_OVERRIDE[item.type] || item.description) ? (
            <Text style={styles.txDesc} numberOfLines={2}>
              {TX_DESC_OVERRIDE[item.type] ?? item.description}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.txAmount, isCredit ? styles.credit : styles.debit]}>
          {isCredit ? '+' : ''}{item.amount.toLocaleString('sv-SE')}
        </Text>
      </View>
    )
  }

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C9A84C" size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Touchable onPress={refresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>Försök igen</Text>
        </Touchable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>PLÅNBOK</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Ditt saldo</Text>
        <Text style={styles.balanceValue}>
          {(data?.coin_balance ?? 0).toLocaleString('sv-SE')}
        </Text>
        <Text style={styles.coinLabel}>LoveBack Coins  ✦</Text>
        <View style={styles.balanceActions}>
          <Touchable style={styles.buyButton} onPress={() => router.push('/buy-coins')}>
            <Text style={styles.buyButtonText}>Köp Coins</Text>
          </Touchable>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'purchase', 'reward'] as FilterTab[]).map((tab) => (
          <Touchable
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
              {tab === 'all' ? 'Alla' : tab === 'purchase' ? 'Köp' : 'Belöningar'}
            </Text>
          </Touchable>
        ))}
      </View>

      <FlatList
        data={filteredTransactions()}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        windowSize={9}
        maxToRenderPerBatch={16}
        initialNumToRender={16}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A84C" />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Inga transaktioner ännu.</Text>
        }
        contentContainerStyle={filteredTransactions().length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#080808', paddingTop: 60 },
  center:                { flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' },
  title:                 { color: 'white', fontSize: 20, fontWeight: '900', paddingHorizontal: 20, marginBottom: 20, letterSpacing: 4 },
  balanceCard:           { backgroundColor: '#101010', marginHorizontal: 20, borderRadius: 24, padding: 28, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2E2A18' },
  balanceLabel:          { color: '#4A4035', fontSize: 11, marginBottom: 10, letterSpacing: 3, textTransform: 'uppercase' },
  balanceValue:          { color: '#C9A84C', fontSize: 56, fontWeight: '900', letterSpacing: -1 },
  coinLabel:             { color: '#4A4035', fontSize: 11, marginBottom: 20, letterSpacing: 2, textTransform: 'uppercase' },
  balanceActions:        { flexDirection: 'row', gap: 10 },
  buyButton:             { backgroundColor: '#C9A84C', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 50 },
  buyButtonText:         { color: 'black', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  filterRow:             { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  filterTab:             { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#101010', borderWidth: 1, borderColor: '#1E1C19' },
  filterTabActive:       { backgroundColor: '#1E1A0A', borderColor: '#C9A84C' },
  filterTabText:         { color: '#4A4035', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  filterTabTextActive:   { color: '#C9A84C' },
  txRow:                 { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#111010' },
  txLeft:                { flex: 1, paddingRight: 12 },
  txType:                { color: 'white', fontWeight: '700', fontSize: 16 },
  txDate:                { color: '#3A3530', fontSize: 12, marginTop: 2 },
  txDesc:                { color: '#4A4035', fontSize: 12, marginTop: 2 },
  txAmount:              { fontSize: 16, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  credit:                { color: '#C9A84C' },
  debit:                 { color: '#ff6b6b' },
  emptyContainer:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText:             { color: '#4A4035', textAlign: 'center' },
  errorText:             { color: '#ff6b6b', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  retryBtn:              { backgroundColor: '#101010', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#1E1C19' },
  retryText:             { color: '#C9A84C', fontWeight: '600' },
})
