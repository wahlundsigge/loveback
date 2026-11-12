import { useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';

const THUMB = 22;
const TRACK_H = 4;

type Props = {
  label: string;
  min: number;
  max: number;
  step?: number;
  values: number[]; // [value] for a single slider, [minValue, maxValue] for a range
  onChange: (values: number[]) => void;
  formatValue: (values: number[]) => string;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function RangeSlider({ label, min, max, step = 1, values, onChange, formatValue }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const dragOriginRef = useRef(0);
  const dragStartValueRef = useRef(0);

  const round = (v: number) => Math.round(v / step) * step;
  const valueToPct = (v: number) => (v - min) / (max - min);

  const resolveNext = (idx: number, rawValue: number) => {
    let v = clamp(round(rawValue), min, max);
    const next = [...values];
    if (values.length === 2) {
      if (idx === 0) v = Math.min(v, values[1] - step);
      else v = Math.max(v, values[0] + step);
    }
    next[idx] = v;
    return next;
  };

  const moveFromClientX = (idx: number, clientX: number) => {
    if (trackWidth <= 0) return;
    const dx = clientX - dragOriginRef.current;
    const deltaValue = (dx / trackWidth) * (max - min);
    onChange(resolveNext(idx, dragStartValueRef.current + deltaValue));
  };

  // Native touch (iOS/Android)
  const makeResponder = (idx: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        dragOriginRef.current = evt.nativeEvent.pageX;
        dragStartValueRef.current = values[idx];
      },
      onPanResponderMove: (evt) => moveFromClientX(idx, evt.nativeEvent.pageX),
    });

  // Web mouse — mirrors the drag-outside-bounds pattern used for photo reordering,
  // since PanResponder alone doesn't reliably track mouse drags on web.
  const onThumbMouseDown = (idx: number) => (e: any) => {
    if (typeof document === 'undefined') return;
    dragOriginRef.current = e.nativeEvent?.pageX ?? e.pageX ?? 0;
    dragStartValueRef.current = values[idx];

    const move = (me: MouseEvent) => moveFromClientX(idx, me.pageX);
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // Thumb CENTER position in px, ranging from THUMB/2 (min) to trackWidth + THUMB/2 (max).
  const thumbCenter = (v: number) => valueToPct(v) * trackWidth + THUMB / 2;
  const filledFrom = values.length === 2 ? thumbCenter(values[0]) : THUMB / 2;
  const filledTo = values.length === 2 ? thumbCenter(values[1]) : thumbCenter(values[0]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatValue(values)}</Text>
      </View>

      <View
        style={styles.trackWrap}
        onLayout={(e) => setTrackWidth(Math.max(0, e.nativeEvent.layout.width - THUMB))}
      >
        <View style={styles.track} />
        <View style={[styles.trackFilled, { left: filledFrom, width: Math.max(0, filledTo - filledFrom) }]} />

        {values.map((v, idx) => (
          <View
            key={idx}
            style={[styles.thumb, { left: valueToPct(v) * trackWidth }]}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            {...(Platform.OS === 'web' ? {} : makeResponder(idx).panHandlers)}
            // @ts-ignore — web only; kept separate from PanResponder since claiming the
            // responder on the same element blocks the plain mousedown from ever firing.
            onMouseDown={Platform.OS === 'web' ? onThumbMouseDown(idx) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:         { marginBottom: 18 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label:        { color: '#3A3530', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  value:        { color: '#C9A84C', fontSize: 13, fontWeight: '700' },
  trackWrap:    { height: THUMB, justifyContent: 'center' },
  track:        { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: '#2E2A18' },
  trackFilled:  { position: 'absolute', height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: '#C9A84C' },
  thumb:        {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#C9A84C',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2, elevation: 3,
  },
});
