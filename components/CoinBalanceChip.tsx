import { StyleSheet, Text, View } from 'react-native'
import { useCoin } from '../contexts/CoinContext'

// Headers are tight on space (logo + this chip + boost + filter icon all on
// one row) — an uncapped balance can grow wide enough to push real actions
// off the edge of the screen. Past 6 digits, switch to compact notation
// ("1.2M") the same way follower/like counts do elsewhere.
function formatBalance(n: number): string {
  if (n < 1_000_000) return n.toLocaleString('sv-SE')
  const compact = n / 1_000_000
  return `${compact.toFixed(compact < 10 ? 1 : 0)}M`
}

export function CoinBalanceChip() {
  const { coinBalance } = useCoin()

  return (
    <View style={styles.chip}>
      <Text style={styles.icon}>✦</Text>
      <Text style={styles.balance} numberOfLines={1}>{formatBalance(coinBalance)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101010',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2E2A18',
  },
  icon: {
    fontSize: 10,
    color: '#C9A84C',
  },
  balance: {
    color: '#C9A84C',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
})
