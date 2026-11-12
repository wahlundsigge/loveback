import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Touchable } from '../../components/Touchable'
import {
  adminUpdateSetting,
  getAdminCoinPackages,
  getPlatformSettings,
  toggleCoinPackage,
  type PlatformSetting,
} from '../lib/admin-api'
import type { CoinPackage } from '../lib/wallet-api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { friendlyError } from '../lib/friendly-error'

const SETTING_LABELS: Record<string, string> = {
  unlock_cost_coins:       'Upplåsningskostnad',
  super_like_cost_coins:   'Rose-kostnad',
  super_like_reward_coins: 'Rose-belöning',
  boost_cost_coins:        'Boost-kostnad',
  reward_amount_coins:     'Matchbelöning',
  new_user_bonus:          'Välkomstbonus',
}

function SettingRow({ setting, onSaved }: { setting: PlatformSetting; onSaved: (key: string, value: string) => void }) {
  const [val, setVal] = useState(setting.value)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = val !== setting.value

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      await adminUpdateSetting(setting.key, val)
      setMsg({ ok: true, text: 'Sparat ✓' })
      onSaved(setting.key, val)
    } catch (e: any) {
      setMsg({ ok: false, text: friendlyError(e, 'Kunde inte spara inställningen.') })
    } finally {
      setSaving(false)
    }
  }

  const label = SETTING_LABELS[setting.key] ?? setting.key

  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {!!setting.description && (
          <Text style={styles.settingDesc}>{setting.description}</Text>
        )}
      </View>
      <View style={styles.settingRight}>
        <TextInput
          style={[styles.settingInput, dirty && styles.settingInputDirty]}
          value={val}
          onChangeText={setVal}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <Touchable
          style={[styles.saveSmall, !dirty && styles.saveSmallDim]}
          onPress={save}
          disabled={!dirty || saving}
        >
          {saving
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.saveSmallText}>Spara</Text>
          }
        </Touchable>
      </View>
      {!!msg && (
        <Text style={[styles.settingMsg, { color: msg.ok ? '#C9A84C' : '#ff6b6b' }]}>{msg.text}</Text>
      )}
    </View>
  )
}

function PackageRow({ pkg, onToggle }: { pkg: CoinPackage; onToggle: (id: string, active: boolean) => void }) {
  const [active, setActive] = useState(pkg.is_active)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')

  const toggle = async (v: boolean) => {
    setToggling(true)
    setError('')
    try {
      await toggleCoinPackage(pkg.id, v)
      setActive(v)
      onToggle(pkg.id, v)
    } catch (e: any) {
      setError(friendlyError(e, 'Gick inte att ändra.'))
    }
    setToggling(false)
  }

  return (
    <View style={styles.packageRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.packageLabel}>{pkg.label}</Text>
        <Text style={styles.packageMeta}>
          {pkg.coins.toLocaleString('sv-SE')} coins
          {pkg.bonus_coins > 0 ? ` + ${pkg.bonus_coins} bonus` : ''} · {pkg.price_sek} kr
        </Text>
        {!!error && <Text style={styles.packageError}>{error}</Text>}
      </View>
      {toggling
        ? <ActivityIndicator color="#C9A84C" />
        : <Switch
            value={active}
            onValueChange={toggle}
            trackColor={{ false: '#1E1C19', true: '#3A2E10' }}
            thumbColor={active ? '#C9A84C' : '#3A3530'}
          />
      }
    </View>
  )
}

export default function AdminSettings() {
  const insets = useSafeAreaInsets()
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [s, p] = await Promise.all([getPlatformSettings(), getAdminCoinPackages()])
      // Show known settings first, then any extras
      const known = Object.keys(SETTING_LABELS)
      const sorted = [
        ...known.map(k => s.find(x => x.key === k)).filter(Boolean),
        ...s.filter(x => !known.includes(x.key)),
      ] as PlatformSetting[]
      setSettings(sorted)
      setPackages(p)
    } catch (e: any) {
      setError(friendlyError(e, 'Kunde inte ladda inställningar.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onSettingSaved = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#C9A84C" size="large" />
    </View>
  )

  if (error) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{error}</Text>
      <Touchable onPress={load} style={styles.retryBtn}>
        <Text style={styles.retryText}>Försök igen</Text>
      </Touchable>
    </View>
  )

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>INSTÄLLNINGAR</Text>

      <Text style={styles.section}>EKONOMI</Text>
      <View style={styles.card}>
        {settings.map((s, i) => (
          <View key={s.key}>
            <SettingRow setting={s} onSaved={onSettingSaved} />
            {i < settings.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      <Text style={styles.section}>COIN-PAKET</Text>
      <View style={styles.card}>
        {packages.map((p, i) => (
          <View key={p.id}>
            <PackageRow pkg={p} onToggle={() => {}} />
            {i < packages.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll:           { flex: 1, backgroundColor: '#080808' },
  content:          { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40 },
  center:           { flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' },
  title:            { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 4, marginBottom: 20 },
  section:          { color: '#3A3530', fontSize: 10, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10, marginTop: 8 },
  card:             { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: '#1E1C19', overflow: 'hidden', marginBottom: 4 },
  divider:          { height: 1, backgroundColor: '#1A1A1A', marginHorizontal: 16 },

  settingRow:       { paddingHorizontal: 16, paddingVertical: 14, flexWrap: 'wrap' as const, flexDirection: 'row' as const, alignItems: 'center', gap: 8 },
  settingLabel:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  settingDesc:      { color: '#3A3530', fontSize: 11, marginTop: 2 },
  settingRight:     { flexDirection: 'row' as const, alignItems: 'center', gap: 8 },
  settingInput:     { backgroundColor: '#0C0C0C', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', width: 80, textAlign: 'center' as const, borderWidth: 1, borderColor: '#1E1C19' },
  settingInputDirty:{ borderColor: '#C9A84C' },
  saveSmall:        { backgroundColor: '#C9A84C', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  saveSmallDim:     { opacity: 0.3 },
  saveSmallText:    { color: '#000', fontWeight: '800', fontSize: 13 },
  settingMsg:       { width: '100%' as const, fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'right' as const },

  packageRow:       { flexDirection: 'row' as const, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  packageLabel:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  packageMeta:      { color: '#4A4035', fontSize: 12, marginTop: 2 },
  packageError:     { color: '#ff6b6b', fontSize: 12, marginTop: 2 },

  errorText:        { color: '#ff6b6b', textAlign: 'center', marginBottom: 16 },
  retryBtn:         { backgroundColor: '#101010', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#1E1C19' },
  retryText:        { color: '#C9A84C', fontWeight: '600' },
})
