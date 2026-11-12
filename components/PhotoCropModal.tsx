import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Touchable } from './Touchable';

const { width: SW } = Dimensions.get('window');
const FRAME_W = Math.min(SW - 64, 320);
const FRAME_H = FRAME_W * 1.25; // 4:5, matches the aspect used everywhere else photos appear
const MAX_ZOOM_MULT = 4;
const ZOOM_STEP = 1.25;

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function PhotoCropModal({ visible, uri, onCancel, onConfirm }: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const baseScaleRef = useRef(1);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  useEffect(() => {
    if (!visible || !uri) { setImgSize(null); return; }
    setImgSize(null);
    Image.getSize(
      uri,
      (w, h) => {
        const base = Math.max(FRAME_W / w, FRAME_H / h);
        baseScaleRef.current = base;
        scaleRef.current = base;
        txRef.current = 0;
        tyRef.current = 0;
        translate.setValue({ x: 0, y: 0 });
        scaleAnim.setValue(base);
        setImgSize({ w, h });
      },
      () => onCancel(),
    );
  }, [visible, uri]);

  const applyPan = (w: number, h: number, scale: number, tx: number, ty: number) => {
    const maxX = Math.max(0, (w * scale - FRAME_W) / 2);
    const maxY = Math.max(0, (h * scale - FRAME_H) / 2);
    const p = { x: clamp(tx, -maxX, maxX), y: clamp(ty, -maxY, maxY) };
    txRef.current = p.x;
    tyRef.current = p.y;
    translate.setValue(p);
  };

  const applyZoom = (nextScale: number) => {
    if (!imgSize) return;
    const clamped = clamp(nextScale, baseScaleRef.current, baseScaleRef.current * MAX_ZOOM_MULT);
    scaleRef.current = clamped;
    scaleAnim.setValue(clamped);
    applyPan(imgSize.w, imgSize.h, clamped, txRef.current, tyRef.current);
  };

  // Touch (native): single-finger pan, two-finger pinch-to-zoom.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          pinchStart.current = { dist: d, scale: scaleRef.current };
          panStart.current = null;
        } else if (touches.length === 1) {
          panStart.current = { x: touches[0].pageX, y: touches[0].pageY, tx: txRef.current, ty: tyRef.current };
          pinchStart.current = null;
        }
      },
      onPanResponderMove: (evt) => {
        if (!imgSize) return;
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          if (!pinchStart.current) {
            // A second finger just landed mid-gesture (e.g. user started panning
            // with one finger, then added a second to pinch) — establish the
            // pinch baseline now instead of only at the initial grant.
            pinchStart.current = { dist: d, scale: scaleRef.current };
            panStart.current = null;
          } else {
            const ratio = d / (pinchStart.current.dist || 1);
            applyZoom(pinchStart.current.scale * ratio);
          }
        } else if (touches.length === 1) {
          if (!panStart.current) {
            // Dropped from two fingers to one (or started fresh) — re-baseline
            // the pan origin from the current position to avoid a jump.
            panStart.current = { x: touches[0].pageX, y: touches[0].pageY, tx: txRef.current, ty: tyRef.current };
            pinchStart.current = null;
          } else {
            const dx = touches[0].pageX - panStart.current.x;
            const dy = touches[0].pageY - panStart.current.y;
            applyPan(imgSize.w, imgSize.h, scaleRef.current, panStart.current.tx + dx, panStart.current.ty + dy);
          }
        }
      },
      onPanResponderRelease: () => { panStart.current = null; pinchStart.current = null; },
      onPanResponderTerminate: () => { panStart.current = null; pinchStart.current = null; },
    }),
  ).current;

  // Web: mouse-drag to pan, wheel to zoom (mirrors the mouse-drag path used for photo reordering).
  const onFrameMouseDown = (e: any) => {
    if (typeof document === 'undefined' || !imgSize) return;
    const startX: number = e.nativeEvent?.pageX ?? e.pageX ?? 0;
    const startY: number = e.nativeEvent?.pageY ?? e.pageY ?? 0;
    const origin = { tx: txRef.current, ty: tyRef.current };

    const move = (me: MouseEvent) => {
      applyPan(imgSize.w, imgSize.h, scaleRef.current, origin.tx + (me.pageX - startX), origin.ty + (me.pageY - startY));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const onFrameWheel = (e: any) => {
    if (typeof document === 'undefined') return;
    e.preventDefault?.();
    const delta = e.deltaY ?? e.nativeEvent?.deltaY ?? 0;
    applyZoom(scaleRef.current * (delta < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  };

  const handleConfirm = async () => {
    if (!uri || !imgSize || processing) return;
    setProcessing(true);
    try {
      const scale = scaleRef.current;
      const cropW = FRAME_W / scale;
      const cropH = FRAME_H / scale;
      const originX = clamp(imgSize.w / 2 - txRef.current / scale - cropW / 2, 0, Math.max(0, imgSize.w - cropW));
      const originY = clamp(imgSize.h / 2 - tyRef.current / scale - cropH / 2, 0, Math.max(0, imgSize.h - cropH));

      const context = ImageManipulator.manipulate(uri);
      context.crop({ originX, originY, width: cropW, height: cropH });
      const rendered = await context.renderAsync();
      const result = await rendered.saveAsync({ compress: 0.88, format: SaveFormat.JPEG });
      onConfirm(result.uri);
    } catch {
      onConfirm(uri); // don't block the user on a manipulation failure — upload the original instead
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Text style={styles.title}>Beskär foto</Text>
        <Text style={styles.hint}>Dra för att flytta • nyp eller scrolla för att zooma</Text>

        <View
          style={styles.frame}
          {...panResponder.panHandlers}
          // @ts-ignore — web only
          onMouseDown={onFrameMouseDown}
          // @ts-ignore — web-only wheel handler
          onWheel={onFrameWheel}
        >
          {uri && imgSize ? (
            <Animated.Image
              source={{ uri }}
              style={{
                position: 'absolute',
                width: imgSize.w,
                height: imgSize.h,
                top: (FRAME_H - imgSize.h) / 2,
                left: (FRAME_W - imgSize.w) / 2,
                transform: [
                  { translateX: translate.x },
                  { translateY: translate.y },
                  { scale: scaleAnim },
                ],
              }}
            />
          ) : null}

          {/* 3x3 grid guide */}
          <View pointerEvents="none" style={styles.gridOverlay}>
            {[1, 2].map((i) => (
              <View key={`v${i}`} style={[styles.gridLineV, { left: (FRAME_W / 3) * i }]} />
            ))}
            {[1, 2].map((i) => (
              <View key={`h${i}`} style={[styles.gridLineH, { top: (FRAME_H / 3) * i }]} />
            ))}
          </View>
        </View>

        <View style={styles.zoomRow}>
          <Touchable style={styles.zoomBtn} haptic="selection" onPress={() => applyZoom(scaleRef.current / ZOOM_STEP)}>
            <Text style={styles.zoomBtnText}>−</Text>
          </Touchable>
          <Touchable style={styles.zoomBtn} haptic="selection" onPress={() => applyZoom(scaleRef.current * ZOOM_STEP)}>
            <Text style={styles.zoomBtnText}>+</Text>
          </Touchable>
        </View>

        <View style={styles.actions}>
          <Touchable style={styles.cancelBtn} onPress={onCancel} disabled={processing}>
            <Text style={styles.cancelBtnText}>Avbryt</Text>
          </Touchable>
          <Touchable style={styles.confirmBtn} onPress={handleConfirm} disabled={processing || !imgSize}>
            <Text style={styles.confirmBtnText}>{processing ? 'Bearbetar…' : 'Beskär'}</Text>
          </Touchable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: '#080808', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title:          { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  hint:           { color: '#4A4035', fontSize: 12, marginBottom: 20, textAlign: 'center' },
  frame:          {
    width: FRAME_W, height: FRAME_H, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#101010', borderWidth: 1, borderColor: '#2E2A18',
  },
  gridOverlay:    { ...StyleSheet.absoluteFill },
  gridLineV:      { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  gridLineH:      { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  zoomRow:        { flexDirection: 'row', gap: 14, marginTop: 18 },
  zoomBtn:        { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#2E2A18', alignItems: 'center', justifyContent: 'center', backgroundColor: '#101010' },
  zoomBtnText:    { color: '#C9A84C', fontSize: 20, fontWeight: '700', marginTop: -2 },
  actions:        { flexDirection: 'row', gap: 12, marginTop: 28, width: '100%', maxWidth: FRAME_W },
  cancelBtn:      { flex: 1, paddingVertical: 14, borderRadius: 50, borderWidth: 1, borderColor: '#C9A84C', alignItems: 'center' },
  cancelBtnText:  { color: '#C9A84C', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  confirmBtn:     { flex: 1, paddingVertical: 14, borderRadius: 50, backgroundColor: '#C9A84C', alignItems: 'center' },
  confirmBtnText: { color: 'black', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
