import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { PillButton } from '../ui';
import { DnaShareCard, ViewRef, exportStory, shareCard } from '../lib/shareCard';
import { track } from '../lib/track';

export default function OnboardShareScreen() {
  const { onboardingResult, profileName, update, navigate, showToast } = useApp();
  const cardRef = useRef<ViewRef>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const first = profileName.split(' ')[0] || 'you';

  const finish = () => {
    update({ onboardingDone: true });
    track('onboarding_completed').catch(() => {});
    navigate('home');
  };

  const onStory = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await exportStory(cardRef);
    setBusy(false);
    track('story_exported', { result: r }).catch(() => {});
    if (r === 'opened_instagram') setNote('Saved to your photos. Pick it from your camera roll in the Instagram story camera.');
    else if (r === 'saved_only') setNote('Saved to your photos. Open Instagram and add it to your story from your camera roll.');
    else if (r === 'permission_denied') setNote('We need photo library access to save the card. You can allow it in Settings.');
    else setNote('We could not create the card. Try again.');
  };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    track('share_tapped', { surface: 'onboarding_share' }).catch(() => {});
    const ok = await shareCard(cardRef, 'My outft. Style DNA.');
    setBusy(false);
    if (ok) showToast('shared');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>STEP 3 OF 3 · OPTIONAL</Text>
        <Text style={s.title}>Share your read</Text>
        <Text style={s.lede}>
          Post your Style DNA card to your Instagram story or send it anywhere with the share sheet. Nothing is posted unless you choose to.
        </Text>

        <View style={s.cardWrap}>
          {onboardingResult ? <DnaShareCard ref={cardRef} result={onboardingResult} name={first} width={210} /> : null}
        </View>

        {note ? <Text style={s.note}>{note}</Text> : null}

        <View style={{ gap: 10, marginTop: 18 }}>
          <PillButton label="instagram story" filled disabled={busy || !onboardingResult} onPress={onStory} style={{ paddingVertical: 14 }} />
          <PillButton label="share sheet" disabled={busy || !onboardingResult} onPress={onShare} style={{ paddingVertical: 14 }} />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <PillButton label="done" onPress={finish} style={{ paddingVertical: 14 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24 },
  kicker: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2, color: colors.sand },
  title: { fontFamily: fonts.serifItalic, fontSize: 32, color: colors.ink, marginTop: 8 },
  lede: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 12 },
  cardWrap: { alignItems: 'center', marginTop: 24 },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.ink, marginTop: 16, textAlign: 'center' },
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
});
