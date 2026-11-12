import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { getCoinPackages, purchaseCoins, type CoinPackage } from './lib/wallet-api'
import { useCoin } from '../contexts/CoinContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Touchable } from '../components/Touchable'

let _pkgCache: CoinPackage[] | null = null

export default function BuyCoinsScreen() {
  const insets = useSafeAreaInsets()
  const [packages, setPackages] = useState<CoinPackage[]>(_pkgCache ?? [])
  const [loading, setLoading] = useState(_pkgCache === null)
  const [loadError, setLoadError] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const { refreshBalance } = useCoin()

  const loadPackages = () => {
    setLoading(true)
    setLoadError(false)
    getCoinPackages()
      .then(pkgs => { _pkgCache = pkgs; setPackages(pkgs) })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (_pkgCache !== null) return
    loadPackages()
  }, [])

  const handlePurchase = (pkg: CoinPackage) => {
    const totalCoins = pkg.coins + pkg.bonus_coins
    Alert.alert(
      'Bekräfta köp',
      `Köp ${totalCoins.toLocaleString('sv-SE')} Coins för ${pkg.price_sek.toFixed(2)} kr?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Köp',
          onPress: async () => {
            setPurchasing(pkg.id)
            try {
              const result = await purchaseCoins(pkg.id)
              await refreshBalance()
              Alert.alert(
                'Köp genomfört!',
                `${result.coins_added.toLocaleString('sv-SE')} Coins har lagts till.\nNytt saldo: ${result.new_balance.toLocaleString('sv-SE')} Coins.`,
                [{ text: 'OK', onPress: () => router.back() }]
              )
            } catch (err: unknown) {
              Alert.alert(
                'Köpet misslyckades',
                err instanceof Error ? err.message : 'Något gick fel. Försök igen.'
              )
            } finally {
              setPurchasing(null)
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C9A84C" size="large" />
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Kunde inte hämta coin-paketen.</Text>
        <Touchable style={styles.retryBtn} onPress={loadPackages}>
          <Text style={styles.retryText}>Försök igen</Text>
        </Touchable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Touchable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/swipe')} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Tillbaka</Text>
      </Touchable>

      <Text style={styles.title}>KÖP COINS</Text>
      <Text style={styles.subtitle}>Välj ett paket — Coins läggs till direkt på ditt saldo.</Text>

      <FlatList
        data={packages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const totalCoins = item.coins + item.bonus_coins
          const isBuying = purchasing === item.id
          return (
            <Touchable
              style={[styles.packageCard, isBuying && styles.packageCardDisabled]}
              haptic="medium"
              onPress={() => handlePurchase(item)}
              disabled={!!purchasing}
            >
              <View style={styles.packageLeft}>
                <Text style={styles.packageCoins}>
                  {totalCoins.toLocaleString('sv-SE')} Coins
                </Text>
                {item.bonus_coins > 0 && (
                  <View style={styles.bonusBadge}>
                    <Text style={styles.bonusBadgeText}>+{item.bonus_coins} bonus</Text>
                  </View>
                )}
                <Text style={styles.packageLabel}>{item.label}</Text>
              </View>
              <View style={styles.packageRight}>
                {isBuying ? (
                  <ActivityIndicator color="#C9A84C" />
                ) : (
                  <Text style={styles.packagePrice}>{item.price_sek.toFixed(0)} kr</Text>
                )}
              </View>
            </Touchable>
          )
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Inga paket tillgängliga just nu.</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#080808', paddingTop: 52 },
  center:              { flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' },
  errorText:           { color: '#ff6b6b', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  retryBtn:            { backgroundColor: '#101010', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#1E1C19' },
  retryText:           { color: '#C9A84C', fontWeight: '600' },
  backBtn:             { paddingHorizontal: 20, marginBottom: 12 },
  backText:            { color: '#C9A84C', fontSize: 16 },
  title:               { color: 'white', fontSize: 20, fontWeight: '900', paddingHorizontal: 20, marginBottom: 6, letterSpacing: 4 },
  subtitle:            { color: '#4A4035', paddingHorizontal: 20, marginBottom: 20, lineHeight: 21, fontSize: 14 },
  list:                { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  packageCard:         { backgroundColor: '#101010', borderRadius: 20, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1E1C19' },
  packageCardDisabled: { opacity: 0.6 },
  packageLeft:         { flex: 1 },
  packageCoins:        { color: 'white', fontSize: 22, fontWeight: '800' },
  bonusBadge:          { backgroundColor: 'rgba(201,168,76,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  bonusBadgeText:      { color: '#C9A84C', fontSize: 12, fontWeight: '600' },
  packageLabel:        { color: '#3A3530', fontSize: 13, marginTop: 4 },
  packageRight:        { alignItems: 'flex-end', minWidth: 60 },
  packagePrice:        { color: '#C9A84C', fontSize: 22, fontWeight: '700' },
  emptyText:           { color: '#4A4035', textAlign: 'center', marginTop: 40 },
})
