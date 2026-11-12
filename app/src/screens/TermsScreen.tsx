import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { PillButton } from '../ui';
import { LEGAL_VERSION, PRIVACY_URL, TERMS_URL } from '../flags';
import { supabase } from '../lib/supabase';
import { track } from '../lib/track';
import { redeemReferral } from '../lib/growthApi';

const POINTS = [
  'Your outfit photos are sent to our server and read by an AI model to build your Style DNA. The read is an automated opinion and can be wrong.',
  'Your photos stay private unless you choose to share a look or a Wrapped card.',
  'We may share aggregated, anonymous style trends with brands. Never your photos or your identity.',
  'You can delete any photo, or your whole account, from the app at any time.',
];

export default function TermsScreen() {
  const { update, navigate, showToast } = useApp();
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => { track('signup').catch(() => {}); }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => showToast('could not open the link'));

  const accept = async () => {
    if (!accepted) return;
    const at = new Date().toISOString();
    update({ termsVersion: LEGAL_VERSION, termsAcceptedAt: at });
    track('terms_accepted', { version: LEGAL_VERSION }).catch(() => {});
    // Record the accepted version on the profile when signed in. Fail-soft.
    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        const id = data.user?.id;
        if (id) {
          await supabase.from('profiles')
            .update({ terms_version: LEGAL_VERSION, privacy_version: LEGAL_VERSION })
            .eq('user_id', id);
        }
      } catch {}
    }
    if (code.trim()) {
      const ok = await redeemReferral(code.trim());
      if (!ok) showToast('that referral code did not work');
    }
    navigate('onboardUpload');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>BEFORE WE START</Text>
        <Text style={s.title}>Terms and privacy</Text>
        <Text style={s.lede}>The short version of how outft. treats your photos:</Text>
        {POINTS.map((p) => (
          <View key={p} style={s.point}>
            <Text style={s.bullet}>·</Text>
            <Text style={s.pointText}>{p}</Text>
          </View>
        ))}
        <View style={s.links}>
          <Pressable onPress={() => open(TERMS_URL)} hitSlop={8}>
            <Text style={s.link}>Read the Terms of Service</Text>
          </Pressable>
          <Pressable onPress={() => open(PRIVACY_URL)} hitSlop={8}>
            <Text style={s.link}>Read the Privacy Policy</Text>
          </Pressable>
        </View>

        <Text style={s.codeLabel}>REFERRAL CODE (OPTIONAL)</Text>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="e.g. 7F3A9C21"
          placeholderTextColor={colors.faint}
          maxLength={12}
        />
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          style={s.checkRow}
          onPress={() => setAccepted((a) => !a)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View style={[s.box, accepted && s.boxOn]}>
            {accepted ? <Text style={s.tick}>✓</Text> : null}
          </View>
          <Text style={s.checkText}>
            I have read and accept the Terms of Service and the Privacy Policy.
          </Text>
        </Pressable>
        <PillButton label="continue" filled disabled={!accepted} onPress={accept} style={{ paddingVertical: 14 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24 },
  kicker: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2, color: colors.sand },
  title: { fontFamily: fonts.serifItalic, fontSize: 32, color: colors.ink, marginTop: 8 },
  lede: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 10 },
  point: { flexDirection: 'row', gap: 10, marginTop: 10 },
  bullet: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, lineHeight: 20 },
  pointText: { flex: 1, fontFamily: fonts.serif, fontSize: 16, lineHeight: 22, color: colors.ink },
  links: { marginTop: 26, gap: 12 },
  link: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink, textDecorationLine: 'underline' },
  codeLabel: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.sand, marginTop: 30 },
  codeInput: {
    fontFamily: fonts.sans, fontSize: 14, color: colors.ink, marginTop: 8,
    borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8,
  },
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28, gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.ink },
  tick: { color: colors.paper, fontSize: 13 },
  checkText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.ink },
});
