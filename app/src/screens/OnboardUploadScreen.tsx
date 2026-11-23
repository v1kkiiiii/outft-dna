import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, fonts } from '../theme';
import { AnalysisResult } from '../data';
import { useApp, LatestOutfit } from '../state';
import { Photo, PillButton } from '../ui';
import { AnalyzeError, analyzeOutfitStrict } from '../analyze';
import { ONBOARDING_PHOTOS } from '../flags';
import { combineReads } from '../lib/dna';
import { track } from '../lib/track';

type SlotStatus = 'reading' | 'done' | 'failed';
interface Slot {
  key: string;
  uri: string;
  base64: string | null;
  status: SlotStatus;
  result?: AnalysisResult;
  error?: string;
}

// 1024px is plenty to read an outfit and keeps the upload around 150 KB,
// so it leaves the phone quickly even on slow connections.
async function prepare(uri: string) {
  try {
    const shrunk = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (shrunk.base64) return { uri: shrunk.uri, base64: shrunk.base64 };
  } catch {}
  return { uri, base64: null };
}

// How many reads run at once. Enough to finish five photos in about the
// time of two, without flooding the server.
const PARALLEL_READS = 3;

export default function OnboardUploadScreen() {
  const { update, navigate, showToast, captures, analysisLog } = useApp();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [picking, setPicking] = useState(false);

  const done = slots.filter((x) => x.status === 'done');
  const remaining = ONBOARDING_PHOTOS - slots.length;
  const busy = slots.some((x) => x.status === 'reading');

  const patch = (key: string, p: Partial<Slot>) =>
    setSlots((all) => all.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const read = async (slot: Slot, index: number) => {
    patch(slot.key, { status: 'reading', error: undefined });
    try {
      let { uri, base64 } = slot;
      if (!base64) {
        const p = await prepare(slot.uri);
        uri = p.uri;
        base64 = p.base64;
        slot.uri = uri;
        slot.base64 = base64;
        patch(slot.key, { uri, base64 });
      }
      const result = await analyzeOutfitStrict({ uri, base64, mediaType: 'image/jpeg' });
      patch(slot.key, { status: 'done', result });
      track('onboarding_photo_uploaded', { index: index + 1 }).catch(() => {});
    } catch (e) {
      const err = e instanceof AnalyzeError ? e : new AnalyzeError('failed', 'We could not read this outfit. Try again.');
      patch(slot.key, { status: 'failed', error: err.message });
      track('onboarding_photo_failed', { index: index + 1, code: err.code }).catch(() => {});
    }
  };

  const add = async (source: 'library' | 'camera') => {
    if (picking || remaining <= 0) return;
    setPicking(true);
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast(source === 'camera' ? 'camera permission needed' : 'photo permission needed');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        // No base64 here: encoding a full-size photo is slow. prepare()
        // makes a small copy and encodes that instead.
        mediaTypes: ['images'], quality: 0.7,
        ...(source === 'library' ? { allowsMultipleSelection: true, selectionLimit: remaining } : {}),
      };
      const r = source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled) return;
      const picked = r.assets.slice(0, remaining);
      const start = slots.length;
      const stamp = Date.now();
      // Show the photos straight away; shrinking and reading happen behind them.
      const fresh: Slot[] = picked.map((a, i) => ({
        key: `${stamp}-${i}`, uri: a.uri, base64: null, status: 'reading',
      }));
      setSlots((all) => [...all, ...fresh]);
      setPicking(false);
      // Read a few at a time: much faster than one by one, without firing
      // every model call at once.
      let next = 0;
      const worker = async () => {
        while (next < fresh.length) {
          const i = next++;
          await read(fresh[i], start + i);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, fresh.length) }, worker));
    } catch {
      showToast('could not open photos. try again');
    } finally {
      setPicking(false);
    }
  };

  const finish = () => {
    const reads = done.map((x) => x.result!).filter(Boolean);
    if (reads.length < ONBOARDING_PHOTOS) return;
    const now = Date.now();
    const newCaptures: LatestOutfit[] = done.map((x, i) => ({
      id: `onboard-${now}-${i}`,
      photoUri: x.uri,
      result: x.result!,
      category: 'daily',
      capturedAt: new Date(now - (done.length - i) * 1000).toISOString(),
    }));
    update({
      onboardingResult: combineReads(reads),
      captures: [...newCaptures.reverse(), ...captures],
      latestOutfit: newCaptures[0],
      outfitCount: captures.length + newCaptures.length,
      analysisLog: [...analysisLog, ...reads.map(() => new Date().toISOString())],
    });
    navigate('onboardReveal');
  };

  const progress = Math.min(done.length, ONBOARDING_PHOTOS);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>STEP 2 OF 3</Text>
        <Text style={s.title}>Upload 5 photos</Text>
        <Text style={s.lede}>
          Five outfits you have actually worn. The more they look like you, the sharper your first read.
        </Text>

        <Text style={s.count}>
          {progress} of {ONBOARDING_PHOTOS} read
          {busy ? <Text style={s.countHint}>  ·  you can keep adding while these read</Text> : null}
        </Text>
        <View style={s.track}>
          <View style={[s.fill, { width: `${(progress / ONBOARDING_PHOTOS) * 100}%` }]} />
        </View>

        <View style={s.grid}>
          {Array.from({ length: ONBOARDING_PHOTOS }).map((_, i) => {
            const slot = slots[i];
            if (!slot) {
              return (
                <View key={`empty-${i}`} style={[s.cell, s.cellEmpty]}>
                  <Text style={s.cellNum}>{i + 1}</Text>
                </View>
              );
            }
            return (
              <View key={slot.key} style={s.cell}>
                <Photo uri={slot.uri} style={StyleSheet.absoluteFill} />
                {slot.status === 'reading' ? (
                  <View style={s.cellOverlay}>
                    <ActivityIndicator color={colors.paper} />
                    <Text style={s.cellReading}>reading</Text>
                  </View>
                ) : null}
                {slot.status === 'done' ? (
                  <View style={s.cellBadge}><Text style={s.cellBadgeText}>✓</Text></View>
                ) : null}
                {slot.status === 'failed' ? (
                  <View style={[s.cellOverlay, { padding: 6 }]}>
                    <Text style={s.cellError}>{slot.error}</Text>
                    <Pressable onPress={() => read(slot, i)} style={s.retry} hitSlop={6}>
                      <Text style={s.retryText}>retry</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSlots((all) => all.filter((x) => x.key !== slot.key))}
                      hitSlop={6}
                    >
                      <Text style={s.removeText}>remove</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        {done.length >= ONBOARDING_PHOTOS ? (
          <PillButton label="see my style DNA" filled onPress={finish} style={{ paddingVertical: 14 }} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PillButton
              label="choose photos"
              filled
              disabled={picking || remaining <= 0}
              onPress={() => add('library')}
              style={{ flex: 1, paddingVertical: 14 }}
            />
            <PillButton
              label="take one"
              disabled={picking || remaining <= 0}
              onPress={() => add('camera')}
              style={{ flex: 1, paddingVertical: 14 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24 },
  kicker: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2, color: colors.sand },
  title: { fontFamily: fonts.serifItalic, fontSize: 32, color: colors.ink, marginTop: 8 },
  lede: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 12 },
  count: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 1, color: colors.ink, marginTop: 24 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 8, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  cell: { width: '31%', aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.cream },
  cellEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  cellNum: { fontFamily: fonts.serif, fontSize: 22, color: colors.faint },
  cellOverlay: {
    ...StyleSheet.absoluteFill, backgroundColor: 'rgba(26,25,22,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  cellBadge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  cellBadgeText: { color: colors.paper, fontSize: 12 },
  cellReading: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1, color: colors.paper },
  countHint: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0, color: colors.muted },
  cellError: { fontFamily: fonts.sans, fontSize: 9, color: colors.paper, textAlign: 'center' },
  retry: { backgroundColor: colors.paper, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  retryText: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.ink },
  removeText: { fontFamily: fonts.sans, fontSize: 9, color: colors.paper, textDecorationLine: 'underline' },
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
});
