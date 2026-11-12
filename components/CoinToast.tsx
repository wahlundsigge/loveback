import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useCoin } from '../contexts/CoinContext'

export function CoinToast() {
  const { toast } = useCoin()
  const opacity   = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-24)).current
  const [visible, setVisible] = useState(false)
  const [displayed, setDisplayed] = useState<{ amount: number; label: string } | null>(null)

  useEffect(() => {
    if (toast) {
      setDisplayed(toast)
      setVisible(true)
      Animated.parallel([
        Animated.spring(opacity,    { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -24, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setVisible(false)
        setDisplayed(null)
      })
    }
  }, [toast, opacity, translateY])

  if (!visible) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.amount}>+{(displayed?.amount ?? 0).toLocaleString('sv-SE')} ✦</Text>
      {displayed?.label ? <Text style={styles.label}>{displayed.label}</Text> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position:        'absolute',
    top:             64,
    alignSelf:       'center',
    backgroundColor: '#120F00',
    borderWidth:     1,
    borderColor:     '#C9A84C',
    borderRadius:    100,
    paddingHorizontal: 22,
    paddingVertical: 11,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    zIndex:          9999,
    shadowColor:     '#C9A84C',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    12,
    elevation:       20,
  },
  amount: { color: '#C9A84C', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
  label:  { color: '#8A7040', fontSize: 13 },
})
