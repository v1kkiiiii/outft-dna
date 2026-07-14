import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';
import { AnalysisResult, CATEGORIES } from '../data';
import { analyzeOutfitReal } from '../analyze';
import { useApp, LatestOutfit } from '../state';
import { Header, Photo, PillButton, Tag } from '../ui';

const BAR_WIDTHS = [1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 2, 1, 3, 1, 2, 2, 3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 3, 1, 2, 2];

export default function CameraScreen() {
  const { navigate, update, showToast, outfitCount, captures } = useApp();
  const [category, setCategory] = useState('daily');
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [caption, setCaption] = useState('');
  const autoOpened = useRef(false);

  const handlePicked = async (asset: ImagePicker.ImagePickerAsset) => {
    setPhoto(asset.uri);
    setResult(null);
    setAnalyzing(true);
    setOverlayOpen(true);
    const res = await analyzeOutfitReal({
      uri: asset.uri,
      base64: asset.base64,
      mediaType: asset.mimeType ?? 'image/jpeg',
    });
    setResult(res);
    setAnalyzing(false);
  };

  const capture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { showToast('camera permission needed'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!r.canceled && r.assets[0]) handlePicked(r.assets[0]);
  };

  const upload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('camera permission needed'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!r.canceled && r.assets[0]) handlePicked(r.assets[0]);
  };

  useEffect(() => {
    if (autoOpened.current) return;
    autoOpened.current = true;
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeOverlay = () => { setOverlayOpen(false); };
  const retake = () => { setPhoto(null); setResult(null); setOverlayOpen(false); setBrand(''); setCaption(''); };

  const share = () => {
    if (!photo || !result) return;
    const record: LatestOutfit = {
      id: String(Date.now()),
      photoUri: photo,
      result,
      category,
      brand: brand.trim() || undefined,
      caption: caption.trim() || undefined,
      capturedAt: new Date().toISOString(),
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header onClose={() => navigate('home')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <Text style={s.h1}>Capture your trace</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ gap: 6 }}>
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

        <View style={s.viewfinder}>
          {photo ? (
            <Photo uri={photo} style={StyleSheet.absoluteFill as any} />
          ) : (
            <Text style={s.vfHint}>TAP TO CAPTURE YOUR TODAY</Text>
          )}
          <View style={[s.corner, { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[s.corner, { top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2 }]} />
          <View style={[s.corner, { bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[s.corner, { bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2 }]} />
        </View>

        <View style={s.shutterRow}>
          <Pressable style={s.sideBtn} onPress={() => showToast('camera flipped')}>
            <Text style={s.sideGlyph}>⟳</Text>
          </Pressable>
          <View style={s.halo}>
            <Pressable style={s.shutter} onPress={capture} />
          </View>
          <Pressable style={s.sideBtn} onPress={upload}>
            <Text style={s.sideGlyph}>⬆</Text>
          </Pressable>
        </View>
      </ScrollView>

      {overlayOpen && photo ? (
        <View style={s.overlay}>
          <Pressable style={s.overlayClose} onPress={closeOverlay} hitSlop={12}>
            <Text style={{ fontSize: 19, color: colors.ink }}>✕</Text>
          </Pressable>
          <ScrollView
            style={{ maxHeight: Dimensions.get('window').height * 0.78, alignSelf: 'stretch' }}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
          >
          <View style={s.card}>
            <Text style={s.brand}>OUTFT.</Text>
            <Text style={s.recordNo}>fit of record · no. {144 + outfitCount}</Text>
            <Photo uri={photo} style={{ width: '100%', aspectRatio: 3 / 4, marginTop: 10 }} />
            <View style={s.dashed} />
            <Text style={s.metaRow}>{catLabel} · 22 June 2026</Text>
            <Text style={s.metaRow}>14:32 · afternoon window</Text>
            {analyzing ? (
              <Text style={s.reading}>Reading your style DNA…</Text>
            ) : result ? (
              <View>
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
  h1: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink, marginTop: 4, marginBottom: 12 },
  chipRow: { marginBottom: 14, maxHeight: 34 },
  catChip: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  catChipLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.ink },
  viewfinder: {
    width: '92%', aspectRatio: 3 / 4, alignSelf: 'center', borderRadius: 4,
    backgroundColor: colors.cream, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: '#FFFFFF' },
  vfHint: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.sand },
  shutterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 28, marginTop: 24,
  },
  sideBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.tagBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  sideGlyph: { fontSize: 18, color: colors.ink },
  halo: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink },
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
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%', maxWidth: 290 },
});
