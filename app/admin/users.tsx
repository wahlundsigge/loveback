import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { adminGrantCoins, adminSearchUsers, type AdminUser } from '../lib/admin-api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { friendlyError } from '../lib/friendly-error'
import { Touchable } from '../../components/Touchable'

function initials(name: string) {
  return (name || '?').slice(0, 2).toUpperCase()
}

function Avatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function UserSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [amount, setAmount] = useState('100')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [balance, setBalance] = useState(user.coin_balance)

  const grant = async (sign: 1 | -1) => {
    const n = Number(amount)
    if (!n || n <= 0) { setMsg({ ok: false, text: 'Ogiltigt belopp' }); return }
    setSending(true); setMsg(null)
    try {
      const res = await adminGrantCoins(user.id, sign * n, reason || (sign > 0 ? 'Admin-tillägg' : 'Admin-avdrag'))
      setBalance(res.new_balance)
      setMsg({ ok: true, text: `Klart! Nytt saldo: ${res.new_balance.toLocaleString('sv-SE')} Coins` })
    } catch (e: any) {
      setMsg({ ok: false, text: friendlyError(e, 'Kunde inte justera saldot.') })
    } finally {
      setSending(false)
    }
  }

  const isBoostActive = user.boost_expires_at && new Date(user.boost_expires_at) > new Date()

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Touchable style={styles.sheetBackdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Avatar name={user.name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{user.name || '(inget namn)'}</Text>
              <Text style={styles.sheetEmail}>{user.email}</Text>
            </View>
            <Touchable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Touchable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Info grid */}
            <View style={styles.infoGrid}>
              {[
                ['Ålder', user.age ?? '—'],
                ['Kön', user.gender ?? '—'],
                ['Registrerad', formatDate(user.created_at)],
                ['Profil klar', user.profile_completed ? 'Ja' : 'Nej'],
                ['Admin', user.is_admin ? 'Ja' : 'Nej'],
                ['Boost', isBoostActive ? 'Aktiv' : 'Nej'],
              ].map(([k, v]) => (
                <View key={String(k)} style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>{k}</Text>
                  <Text style={styles.infoCellValue}>{String(v)}</Text>
                </View>
              ))}
            </View>

            {/* Balance */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo</Text>
              <Text style={styles.balanceValue}>{balance.toLocaleString('sv-SE')}</Text>
              <Text style={styles.balanceSub}>LoveBack Coins</Text>
            </View>

            {/* Coin adjustment */}
            <Text style={styles.subSection}>JUSTERA COINS</Text>
            <TextInput
              style={styles.input}
              placeholder="Belopp"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Anledning (valfri)"
              placeholderTextColor="#555"
              value={reason}
              onChangeText={setReason}
            />
            <View style={styles.grantRow}>
              <Touchable
                style={[styles.grantBtn, styles.grantBtnAdd]}
                onPress={() => grant(1)}
                disabled={sending}
              >
                <Text style={styles.grantBtnText}>+ Lägg till</Text>
              </Touchable>
              <Touchable
                style={[styles.grantBtn, styles.grantBtnSub]}
                onPress={() => grant(-1)}
                disabled={sending}
              >
                <Text style={[styles.grantBtnText, { color: '#ff6b6b' }]}>− Dra av</Text>
              </Touchable>
            </View>
            {sending && <ActivityIndicator color="#C9A84C" style={{ marginTop: 8 }} />}
            {!!msg && (
              <Text style={[styles.msgText, { color: msg.ok ? '#C9A84C' : '#ff6b6b' }]}>{msg.text}</Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function AdminUsers() {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [searchError, setSearchError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (q: string) => {
    setLoading(true)
    try {
      const res = await adminSearchUsers(q)
      setUsers(res)
      setSearchError('')
    } catch (e: any) {
      setSearchError(friendlyError(e, 'Kunde inte söka just nu.'))
    }
    setLoading(false)
  }

  useEffect(() => { search('') }, [])

  const onChangeQuery = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(q), 300)
  }

  const renderUser = ({ item }: { item: AdminUser }) => (
    <Touchable style={styles.userRow} onPress={() => setSelected(item)}>
      <Avatar name={item.name} />
      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>{item.name || '(inget namn)'}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userMeta}>
          {item.age ? `${item.age} år · ` : ''}{item.gender ?? ''} · {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.balancePill}>
        <Text style={styles.balancePillText}>{item.coin_balance.toLocaleString('sv-SE')}</Text>
      </View>
    </Touchable>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>ANVÄNDARE</Text>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Sök namn eller e-post…"
          placeholderTextColor="#555"
          value={query}
          onChangeText={onChangeQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color="#C9A84C" style={{ marginRight: 12 }} />}
      </View>
      {!!searchError && <Text style={styles.searchErrorText}>{searchError}</Text>}

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={renderUser}
        windowSize={9}
        maxToRenderPerBatch={20}
        initialNumToRender={20}
        removeClippedSubviews
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>Inga användare hittades.</Text> : undefined
        }
        contentContainerStyle={users.length === 0 ? styles.emptyContainer : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {selected && (
        <UserSheet
          user={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#080808', paddingTop: 56 },
  title:          { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 4, paddingHorizontal: 20, marginBottom: 16 },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#101010', borderRadius: 14, borderWidth: 1, borderColor: '#1E1C19' },
  searchInput:    { flex: 1, color: '#fff', fontSize: 15, padding: 14 },
  searchErrorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginHorizontal: 16, marginBottom: 12 },
  userRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  separator:      { height: 1, backgroundColor: '#111010', marginLeft: 72 },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E1A0A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9A84C' },
  avatarText:     { color: '#C9A84C', fontWeight: '800', fontSize: 15 },
  userName:       { color: '#fff', fontSize: 15, fontWeight: '700' },
  userEmail:      { color: '#4A4035', fontSize: 12, marginTop: 1 },
  userMeta:       { color: '#2E2A18', fontSize: 11, marginTop: 2 },
  balancePill:    { backgroundColor: '#1E1A0A', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2E2A18' },
  balancePillText:{ color: '#C9A84C', fontSize: 12, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText:      { color: '#3A3530', textAlign: 'center' },

  // Sheet
  sheetBackdrop:  { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:          { backgroundColor: '#0E0E0E', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#1E1C19', paddingHorizontal: 20, paddingBottom: 40, maxHeight: '85%' },
  sheetHandle:    { width: 40, height: 4, backgroundColor: '#2E2A18', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  sheetHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  sheetName:      { color: '#fff', fontSize: 18, fontWeight: '800' },
  sheetEmail:     { color: '#4A4035', fontSize: 13, marginTop: 2 },
  closeBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#181614', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2E2A18' },
  closeBtnText:   { color: '#fff', fontSize: 13, fontWeight: '800' },
  infoGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  infoCell:       { backgroundColor: '#101010', borderRadius: 10, padding: 10, minWidth: '30%', flex: 1, borderWidth: 1, borderColor: '#1E1C19' },
  infoCellLabel:  { color: '#3A3530', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  infoCellValue:  { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 3 },
  balanceCard:    { backgroundColor: '#1E1A0A', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#2E2A18' },
  balanceLabel:   { color: '#4A4035', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  balanceValue:   { color: '#C9A84C', fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  balanceSub:     { color: '#4A4035', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  subSection:     { color: '#3A3530', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  input:          { backgroundColor: '#101010', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: '#1E1C19' },
  grantRow:       { flexDirection: 'row', gap: 10, marginBottom: 8 },
  grantBtn:       { flex: 1, borderRadius: 50, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  grantBtnAdd:    { backgroundColor: '#1E1A0A', borderColor: '#C9A84C' },
  grantBtnSub:    { backgroundColor: '#1A0808', borderColor: '#3A1515' },
  grantBtnText:   { color: '#C9A84C', fontWeight: '800', fontSize: 15 },
  msgText:        { textAlign: 'center', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8 },
})
