import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, dnaColors, fonts } from '../theme';
import { useApp } from '../state';
import { DnaWheel, PillButton } from '../ui';
import { DnaShareCard, ViewRef, shareCard } from '../lib/shareCard';
import { track } from '../lib/track';

export default function OnboardRevealScreen() {
  const { onboardingResult, profileName, navigate, showToast } = useApp();
  const cardRef = useRef<ViewRef>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (onboardingResult) track('first_dna_read', { labels: onboardingResult.aesthetics.length }).catch(() => {});
  }, [onboardingResult]);

  if (!onboardingResult) {
    return (
      <View style={[s.center, { flex: 1 }]}>
        <Text style={s.lede}>Your read is not ready yet.</Text>
        <PillButton label="back to photos" onPress={() => navigate('onboardUpload')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const first = profileName.split(' ')[0] || 'you';

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    track('share_tapped', { surface: 'onboarding_reveal' }).catch(() => {});
    const lead = onboardingResult.aesthetics[0];
    const ok = await shareCard(cardRef, lead ? `My outft. Style DNA: ${lead.pct}% ${lead.label}.` : 'My outft. Style DNA.');
    setSharing(false);
    if (ok) showToast('shared');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>YOUR FIRST READ</Text>
        <Text style={s.title}>This is your Style DNA</Text>

        <View style={s.center}>
          <DnaWheel data={onboardingResult.aesthetics} size={180} centerLabel={first.toLowerCase()} />
        </View>

        <View style={{ marginTop: 18, gap: 12 }}>
          {onboardingResult.aesthetics.map((a, i) => (
            <View key={`${a.label}-${i}`} style={s.row}>
              <View style={[s.dot, { backgroundColor: dnaColors[i % dnaColors.length] }]} />
              <Text style={s.label}>{a.label}</Text>
              <Text style={s.pct}>{a.pct}%</Text>
            </View>
          ))}
        </View>

        <Text style={s.insight}>{onboardingResult.insight}</Text>
        <Text style={s.note}>
          This read combines the AI analysis of your five photos. It gets more precise as you log more outfits.
        </Text>

        {/* Rendered off to the side so the share image is always a clean 9:16 card. */}
        <View style={s.offscreen} pointerEvents="none">
          <DnaShareCard ref={cardRef} result={onboardingResult} name={first} />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <PillButton label={sharing ? 'preparing…' : 'share'} disabled={sharing} onPress={onShare} style={{ flex: 1, paddingVertical: 14 }} />
        <PillButton label="continue" filled onPress={() => navigate('onboardShare')} style={{ flex: 1, paddingVertical: 14 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24 },
  center: { alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  kicker: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2, color: colors.sand },
  title: { fontFamily: fonts.serifItalic, fontSize: 32, color: colors.ink, marginTop: 8 },
  lede: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  pct: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  insight: { fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: 24 },
  note: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.sand, marginTop: 10 },
  offscreen: { position: 'absolute', left: -1000, top: 0 },
  footer: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
});
