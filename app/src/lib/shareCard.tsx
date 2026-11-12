// A 9:16 Style DNA card for sharing, plus helpers that turn it into an image
// for the share sheet or an Instagram story. Nothing is uploaded by us: the
// image is created on the device and handed to the system share sheet or
// saved to the camera roll.
import React from 'react';
import { Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { colors, dnaColors, fonts } from '../theme';
import { AnalysisResult } from '../data';

export type ViewRef = React.ComponentRef<typeof View>;

export const DnaShareCard = React.forwardRef<ViewRef, { result: AnalysisResult; name: string; width?: number }>(
  ({ result, name, width = 270 }, ref) => (
    <View ref={ref} collapsable={false} style={[card.root, { width }]}>
      <Text style={card.brand}>OUTFT.</Text>
      <Text style={card.kicker}>STYLE DNA</Text>
      <Text style={card.name}>{name}</Text>
      <View style={{ marginTop: 22, gap: 12, alignSelf: 'stretch' }}>
        {result.aesthetics.map((a, i) => (
          <View key={`${a.label}-${i}`}>
            <View style={card.row}>
              <Text style={card.label}>{a.label}</Text>
              <Text style={card.pct}>{a.pct}%</Text>
            </View>
            <View style={card.track}>
              <View style={[card.fill, { width: `${a.pct}%`, backgroundColor: dnaColors[i % dnaColors.length] }]} />
            </View>
          </View>
        ))}
      </View>
      <Text style={card.insight}>{result.insight}</Text>
      <Text style={card.footer}>read by outft.</Text>
    </View>
  ),
);

async function snapshot(ref: React.RefObject<ViewRef | null>): Promise<string> {
  return captureRef(ref as any, { format: 'png', quality: 1 });
}

export async function shareCard(ref: React.RefObject<ViewRef | null>, message: string): Promise<boolean> {
  try {
    const uri = await snapshot(ref);
    const r = await Share.share(Platform.OS === 'ios' ? { url: uri, message } : { message: `${message}\n${uri}` });
    return r.action === Share.sharedAction;
  } catch {
    return false;
  }
}

export type StoryResult = 'opened_instagram' | 'saved_only' | 'permission_denied' | 'failed';

// Saves the card to the camera roll, then opens Instagram's story camera so
// the user can pick it. Without the native Instagram sharing SDK this is the
// most we can do from Expo Go; we say so in the UI instead of pretending.
export async function exportStory(ref: React.RefObject<ViewRef | null>): Promise<StoryResult> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return 'permission_denied';
    const uri = await snapshot(ref);
    await MediaLibrary.saveToLibraryAsync(uri);
    try {
      await Linking.openURL('instagram://story-camera');
      return 'opened_instagram';
    } catch {
      return 'saved_only';
    }
  } catch {
    return 'failed';
  }
}

const card = StyleSheet.create({
  root: {
    aspectRatio: 9 / 16, backgroundColor: colors.paper, padding: 22,
    alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18,
    shadowRadius: 14, elevation: 4,
  },
  brand: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 3, color: colors.ink },
  kicker: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.sand, marginTop: 14 },
  name: { fontFamily: fonts.serifItalic, fontSize: 26, color: colors.ink, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.serif, fontSize: 14, color: colors.ink, flex: 1 },
  pct: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 4, overflow: 'hidden' },
  fill: { height: 4 },
  insight: { fontFamily: fonts.serifItalic, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 20, textAlign: 'center' },
  footer: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.5, color: colors.sand, marginTop: 18 },
});
