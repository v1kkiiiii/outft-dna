import React, { useRef, useState } from 'react';
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';
import { AnalysisResult, CATEGORIES } from '../data';
import { analyzeOutfitReal } from '../analyze';
import { backendAvailable } from '../lib/supabase';
import { uploadAndAnalyze, pollAnalysis, toDbCategory, updateOutfitMeta } from '../lib/outfitApi';
import { deleteOutfit } from '../lib/historyApi';
import { useApp, LatestOutfit } from '../state';
import { Photo, PillButton, Tag } from '../ui';

const BAR_WIDTHS = [1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 2, 1, 3, 1, 2, 2, 3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 3, 1, 2, 2];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function receiptStamp(d: Date) {
  const h = d.getHours();
  const daypart = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return {
    date: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    time: `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    daypart,
  };
}

// Short toast-friendly code from a pipeline error string (e.g. 'UPLOAD_FAILED: …').
function shortCode(err: string) {
  return err.split(':')[0].trim();
}

export default function CameraScreen() {
  const { navigate, update, showToast, outfitCount, captures } = useApp();
  const [category, setCategory] = useState('daily');
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [statusText, setStatusText] = useState('Reading your style DNA…');
  const [isDemo, setIsDemo] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [caption, setCaption] = useState('');
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [outfitId, setOutfitId] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [capturedAt, setCapturedAt] = useState<Date>(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // Same-photo payload kept for TRY AGAIN re-runs of the real pipeline.
  const pendingRef = useRef<{ uri: string; base64?: string | null; mt: string } | null>(null);

  // Real pipeline: upload → queue → poll worker. Returns true on success.
  const runRealPipeline = async (p: { uri: string; base64?: string | null; mt: string }): Promise<boolean> => {
    setStatusText('uploading…');
    const up = await uploadAndAnalyze({ uri: p.uri, base64: p.base64, mediaType: p.mt, category });
    if (!up.ok) {
      showToast('upload: ' + shortCode(up.error));
      console.warn('outft: upload failed:', up.error);
      return false;
    }
    // Server row exists from here on — keep its id even if polling fails, so a
    // later server sync dedupes against this capture instead of double-counting.
    setOutfitId(up.outfitId);
    setStatusText('in queue…');
    const polled = await pollAnalysis(up.outfitId, {
      onStatus: (status) => {
        // Truthful status straight from the server row.
        setStatusText(status === 'analysis_queued' || status === 'queued' ? 'in queue…' : 'reading your style DNA…');
      },
    });
    if (!polled.ok) {
      showToast('analysis: ' + shortCode(polled.error));
      console.warn('outft: analysis polling failed:', polled.error);
      return false;
    }
    setOutfitId(up.outfitId);
    setIsDemo(false);
    setResult(polled.result);
    return true;
  };

  // Labeled demo fallback (per PRD: no silent fake AI).
  const runDemo = async (p: { uri: string; base64?: string | null; mt: string }) => {
    setStatusText('Reading your style DNA…');
    setIsDemo(true);
    // Do NOT clear outfitId: if the upload succeeded but analysis failed, the
    // server row exists and the local record must share its id to dedupe later.
    const res = await analyzeOutfitReal({ uri: p.uri, base64: p.base64, mediaType: p.mt });
    setResult(res);
  };

  const handlePicked = async (uri: string, base64?: string | null, mediaType?: string) => {
    const p = { uri, base64, mt: mediaType ?? 'image/jpeg' };
    pendingRef.current = p;
    setPhoto(uri);
    setResult(null);
    setIsDemo(false);
    setOutfitId(null);
    setCanRetry(false);
    setCapturedAt(new Date());
    setAnalyzing(true);
    setOverlayOpen(true);

    if (backendAvailable()) {
      const ok = await runRealPipeline(p);
      if (!ok) {
        // Keep the receipt open and offer an inline retry before any fallback.
        setCanRetry(true);
      }
    } else {
      showToast('backend not configured');
      await runDemo(p);
    }
    setAnalyzing(false);
  };

  const retryPipeline = async () => {
    const p = pendingRef.current;
    if (!p || analyzing) return;
    setCanRetry(false);
    setAnalyzing(true);
    const ok = await runRealPipeline(p);
    if (!ok) {
      // Retry failed too — fall back to the labeled demo analysis.
      await runDemo(p);
    }
    setAnalyzing(false);
  };

  const snap = async () => {
    if (!cameraRef.current || analyzing) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: true });
      if (pic) handlePicked(pic.uri, pic.base64);
    } catch (e) {
      showToast('capture failed — try again');
      console.warn('outft: takePicture failed:', e);
    }
  };

  const upload = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showToast('photo permission needed'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (!r.canceled && r.assets[0]) handlePicked(r.assets[0].uri, r.assets[0].base64, r.assets[0].mimeType);
    } catch (e) {
      showToast('photo picker failed — try again');
      console.warn('outft: image picker failed:', e);
    }
  };

  // Discarding an uploaded-but-unshared trace: tombstone the orphan server row
  // so it never resurfaces in history/stats. Fail-soft.
  const discardOrphan = () => {
    if (outfitId) {
      deleteOutfit(outfitId).catch(() => {});
    }
  };

  const closeOverlay = () => {
    discardOrphan();
    setPhoto(null); setResult(null); setOverlayOpen(false); setBrand(''); setCaption('');
    setOutfitId(null); setCanRetry(false); pendingRef.current = null;
  };
  const retake = () => {
    discardOrphan();
    setPhoto(null); setResult(null); setOverlayOpen(false); setBrand(''); setCaption('');
    setOutfitId(null); setCanRetry(false); pendingRef.current = null;
  };

  const share = () => {
    if (!photo || !result) return;
    const trimmedBrand = brand.trim();
    const trimmedCaption = caption.trim();
    const isReal = !!outfitId && !isDemo;
    if (isReal && outfitId) {
      // Persist meta server-side (fail-soft; brand embedded — no brand column).
      const serverCaption = trimmedBrand
        ? (trimmedCaption ? `brand: ${trimmedBrand} — ${trimmedCaption}` : `brand: ${trimmedBrand}`)
        : trimmedCaption;
      updateOutfitMeta(outfitId, {
        ...(serverCaption ? { caption: serverCaption } : {}),
        category: toDbCategory(category),
      }).then((r) => {
        if (!r.ok) console.warn('outft: outfit meta update failed:', r.error);
      });
    }
    const record: LatestOutfit = {
      // Use the server row id whenever one exists (even for a demo-labeled
      // result after upload succeeded) so a later server sync dedupes.
      id: outfitId ?? String(Date.now()),
      photoUri: photo,
      result,
      category,
      brand: trimmedBrand || undefined,
      caption: trimmedCaption || undefined,
      capturedAt: capturedAt.toISOString(),
    };
    update({
      latestOutfit: record,
      captures: [record, ...captures],
      outfitCount: outfitCount + 1,
    });
    showToast('trace shared');
    navigate('home');
  };

  const catLabel = CATEGORIES.find((c) => c.key === category)?.label ?? 'Daily';
  const stamp = receiptStamp(capturedAt);

  const camGranted = permission?.granted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={s.topBar}>
        <Pressable onPress={() => navigate('home')} hitSlop={12}>
          <Text style={s.topGlyph}>×</Text>
        </Pressable>
        <Text style={s.topTitle}>outft.</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={s.viewfinder}>
        {camGranted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
        ) : (
          <Pressable
            style={s.permBox}
            onPress={() => {
              // After a hard denial iOS won't re-prompt — send them to Settings.
              if (permission && !permission.canAskAgain) Linking.openSettings().catch(() => {});
              else requestPermission();
            }}
          >
            <Text style={s.permText}>
              {permission && !permission.canAskAgain ? 'ENABLE CAMERA IN SETTINGS' : 'TAP TO ENABLE CAMERA'}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 22 }}>
        {CATEGORIES.map((c) => {
          const sel = c.key === category;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[s.catChip, sel && { backgroundColor: colors.ink, borderColor: colors.ink }]}
            >
              <Text style={[s.catChipLabel, sel && { color: colors.paper }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.shutterRow}>
        <Pressable style={s.sideBtn} onPress={upload}>
          <Text style={s.sideGlyph}>▦</Text>
        </Pressable>
        <View style={s.halo}>
          <Pressable style={s.shutter} onPress={snap} disabled={!camGranted} />
        </View>
        <Pressable style={s.sideBtn} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
          <Text style={s.sideGlyph}>↻</Text>
        </Pressable>
      </View>

      {overlayOpen && photo ? (
        <View style={s.overlay}>
          <Pressable style={s.overlayClose} onPress={closeOverlay} hitSlop={12}>
            <Text style={{ fontSize: 19, color: colors.ink }}>×</Text>
          </Pressable>
          <ScrollView
            style={{ maxHeight: Dimensions.get('window').height * 0.78, alignSelf: 'stretch' }}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
          >
          <View style={s.card}>
            <Text style={s.brand}>OUTFT.</Text>
            <Text style={s.recordNo}>fit of record · no. {captures.length + 1}</Text>
            <Photo uri={photo} style={{ width: '100%', aspectRatio: 3 / 4, marginTop: 10 }} />
            <View style={s.dashed} />
            <Text style={s.metaRow}>{catLabel} · {stamp.date}</Text>
            <Text style={s.metaRow}>{stamp.time} · {stamp.daypart} window</Text>
            {analyzing ? (
              <Text style={s.reading}>{statusText}</Text>
            ) : canRetry && !result ? (
              <Text style={s.reading}>analysis didn’t complete</Text>
            ) : result ? (
              <View>
                {isDemo ? <Text style={s.demoLabel}>demo analysis</Text> : null}
                <Text style={s.insight}>{result.insight}</Text>
                {result.aesthetics.map((a) => (
                  <View key={a.label} style={s.aRow}>
                    <Text style={s.aLabel}>{a.label.toUpperCase()}</Text>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${a.pct}%` }]} />
                    </View>
                    <Text style={s.aPct}>{a.pct}%</Text>
                  </View>
                ))}
                <View style={s.tagsRow}>
                  {result.tags.map((t) => <Tag key={t} label={t} />)}
                </View>
                <TextInput
                  style={s.metaInput}
                  placeholder="add a brand (optional)"
                  placeholderTextColor={colors.sand}
                  value={brand}
                  onChangeText={setBrand}
                />
                <TextInput
                  style={s.metaInput}
                  placeholder="write a caption"
                  placeholderTextColor={colors.sand}
                  value={caption}
                  onChangeText={setCaption}
                />
              </View>
            ) : null}
            <View style={s.barcode}>
              {BAR_WIDTHS.map((w, i) => (
                <View key={i} style={{ width: w, height: 28, backgroundColor: colors.ink, marginRight: 2 }} />
              ))}
            </View>
            <Text style={s.footer}>trace · keep · revisit · 2026</Text>
          </View>
          </ScrollView>
          {canRetry && !analyzing ? (
            <View style={s.retryRow}>
              <PillButton label="try again" onPress={retryPipeline} style={{ flex: 1, paddingVertical: 11 }} />
            </View>
          ) : null}
          <View style={s.actions}>
            <PillButton label="retake" onPress={retake} style={{ flex: 1, paddingVertical: 11 }} />
            <PillButton label="share trace" filled onPress={share} disabled={analyzing || !result} style={{ flex: 1, paddingVertical: 11 }} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10,
  },
  topGlyph: { fontSize: 24, color: colors.taupe },
  topTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  chipRow: { marginTop: 14, maxHeight: 34, flexGrow: 0 },
  catChip: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  catChipLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.taupe },
  viewfinder: {
    flex: 1, marginHorizontal: 10, borderRadius: 18,
    backgroundColor: colors.cream, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  permBox: { padding: 30, alignItems: 'center' },
  permText: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color: colors.sand },
  shutterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 34, paddingVertical: 18,
  },
  sideBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  sideGlyph: { fontSize: 16, color: colors.taupe },
  halo: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.ink },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22,
  },
  overlayClose: { position: 'absolute', top: 18, right: 22, zIndex: 10 },
  card: {
    width: '100%', maxWidth: 290, backgroundColor: colors.paper, padding: 16,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.2,
    shadowRadius: 14, elevation: 5,
  },
  brand: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3, color: colors.ink, textAlign: 'center' },
  recordNo: { fontFamily: fonts.sans, fontSize: 9, color: colors.faint, textAlign: 'center', marginTop: 3 },
  dashed: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D8D0C4', marginVertical: 10 },
  metaRow: { fontFamily: fonts.sans, fontSize: 10, color: colors.muted, marginBottom: 2 },
  demoLabel: { fontFamily: fonts.sans, fontSize: 8, color: colors.sand, letterSpacing: 1, marginTop: 8 },
  reading: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.taupe, marginTop: 10 },
  insight: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.ink, marginTop: 10, marginBottom: 8 },
  aRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  aLabel: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1, color: colors.muted, width: 88 },
  track: { flex: 1, height: 2, backgroundColor: colors.line },
  fill: { height: 2, backgroundColor: colors.ink },
  aPct: { fontFamily: fonts.sans, fontSize: 9, color: colors.taupe, width: 30, textAlign: 'right' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaInput: {
    fontFamily: fonts.sans, fontSize: 12, color: colors.ink, marginTop: 10,
    borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 4,
  },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: 14 },
  footer: { fontFamily: fonts.sans, fontSize: 8, color: colors.faint, textAlign: 'center', marginTop: 8, letterSpacing: 1 },
  retryRow: { flexDirection: 'row', marginTop: 14, width: '100%', maxWidth: 290 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%', maxWidth: 290 },
});
